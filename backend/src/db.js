import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const directory = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(directory, '../.env') })
const dataDirectory = path.resolve(directory, '../data')
fs.mkdirSync(dataDirectory, { recursive: true })

const configuredPath = process.env.DATABASE_FILE || './data/freelancer.sqlite'
const databasePath = path.isAbsolute(configuredPath)
  ? configuredPath
  : path.resolve(directory, '..', configuredPath.replace(/^\.\//, ''))

export const db = new Database(databasePath)
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`)

const migrationVersion = '001_initial_schema'
const alreadyApplied = db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(migrationVersion)
if (!alreadyApplied) {
  const applyMigration = db.transaction(() => {
    db.exec(fs.readFileSync(path.resolve(directory, '../migrations/001_initial_schema.sql'), 'utf8'))
    db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(migrationVersion)
  })
  applyMigration()
}

// Safely ensure time_spent_minutes exists on tasks table for existing databases
try {
  db.exec('ALTER TABLE tasks ADD COLUMN time_spent_minutes INTEGER NOT NULL DEFAULT 0')
} catch (_err) {
  // Column already exists
}

const userCount = db.prepare('SELECT COUNT(*) AS count FROM users').get().count
if (userCount === 0) {
  const addUser = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
  const freelancerId = Number(addUser.run('Alex Morgan', 'freelancer@demo.com', bcrypt.hashSync('demo123', 10), 'freelancer').lastInsertRowid)
  const clientUserId = Number(addUser.run('Jordan Lee', 'client@demo.com', bcrypt.hashSync('demo123', 10), 'client').lastInsertRowid)
  addUser.run('System Admin', 'admin@demo.com', bcrypt.hashSync('demo123', 10), 'admin')

  const clientId = Number(db.prepare(
    'INSERT INTO clients (freelancer_id, user_id, name, email, company, phone) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(freelancerId, clientUserId, 'Jordan Lee', 'jordan@northstar.studio', 'Northstar Studio', '(555) 014-2830').lastInsertRowid)

  const projectId = Number(db.prepare(
    `INSERT INTO projects (freelancer_id, client_id, title, description, budget, deadline, status, attachment_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(freelancerId, clientId, 'Brand identity refresh', 'A complete visual identity update for the studio.', 4800, '2026-11-15', 'Active', 'https://example.com/brand-brief').lastInsertRowid)

  const addTask = db.prepare('INSERT INTO tasks (project_id, title, status, due_date) VALUES (?, ?, ?, ?)')
  addTask.run(projectId, 'Research and discovery', 'Completed', '2026-10-10')
  addTask.run(projectId, 'Logo concepts', 'In Progress', '2026-10-22')
  addTask.run(projectId, 'Brand guidelines', 'To Do', '2026-11-05')
  db.prepare('INSERT INTO project_history (project_id, user_id, action, details) VALUES (?, ?, ?, ?)')
    .run(projectId, freelancerId, 'Project created', 'Brand identity refresh project created.')
}

// Ensure every existing and future client has a login account in users with role 'client'
const unlinkedClients = db.prepare('SELECT id, name, email FROM clients WHERE user_id IS NULL').all()
for (const client of unlinkedClients) {
  let user = db.prepare('SELECT id FROM users WHERE email = ?').get(client.email)
  if (!user) {
    const passwordHash = bcrypt.hashSync('demo123', 10)
    const userResult = db.prepare(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
    ).run(client.name, client.email, passwordHash, 'client')
    user = { id: Number(userResult.lastInsertRowid) }
  }
  db.prepare('UPDATE clients SET user_id = ? WHERE id = ?').run(user.id, client.id)
}
