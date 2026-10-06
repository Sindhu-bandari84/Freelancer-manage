import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import multer from 'multer'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { db } from './db.js'
import { allowRoles, authenticate, recordProjectHistory } from './middleware.js'

const app = express()
const port = Number(process.env.PORT || 4000)
const sourceDirectory = path.dirname(fileURLToPath(import.meta.url))
const uploadDirectory = path.resolve(sourceDirectory, '..', process.env.UPLOAD_DIRECTORY || './uploads')
const jwtSecret = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'development-only-secret')
if (!jwtSecret) throw new Error('Set JWT_SECRET before running the API in production.')
fs.mkdirSync(uploadDirectory, { recursive: true })
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const allowed = /\.(pdf|png|jpe?g|docx|xlsx|zip)$/i.test(file.originalname)
    callback(allowed ? null : new Error('Attach a PDF, image, DOCX, XLSX, or ZIP file.'), allowed)
  },
})
const corsOrigin = process.env.CORS_ORIGIN || '*'
app.use(cors({ origin: corsOrigin === '*' ? true : corsOrigin }))
app.use(express.json({ limit: '1mb' }))

const asyncRoute = (handler) => (req, res, next) => {
  try {
    handler(req, res, next)
  } catch (error) {
    next(error)
  }
}

function validText(value, label, maxLength = 200) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    throw Object.assign(new Error(`${label} is required and must be under ${maxLength} characters.`), { status: 400 })
  }
  return value.trim()
}

function validDate(value, label) {
  const parsed = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00.000Z`)
    : null
  if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw Object.assign(new Error(`${label} must be a valid date.`), { status: 400 })
  }
  return value
}

function currentUserId(req) {
  return req.user.role === 'admin' ? null : req.user.id
}

function getProject(projectId, user) {
  const project = db.prepare(`
    SELECT p.*, c.name AS client_name
    FROM projects p JOIN clients c ON c.id = p.client_id
    WHERE p.id = ?
  `).get(projectId)
  if (!project) return null
  if (user.role === 'admin' || project.freelancer_id === user.id) return project
  if (user.role === 'client' && db.prepare('SELECT 1 FROM clients WHERE id = ? AND user_id = ?').get(project.client_id, user.id)) return project
  return null
}

app.get('/api/projects/:id/attachment', authenticate, (req, res, next) => {
  const project = getProject(Number(req.params.id), req.user)
  if (!project || !project.attachment_url.startsWith('/uploads/')) {
    return res.status(404).json({ error: 'Uploaded attachment not found.' })
  }
  const filePath = path.join(uploadDirectory, path.basename(project.attachment_url))
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Uploaded attachment file is missing.' })
  res.sendFile(filePath, (error) => {
    if (error) next(error)
  })
})

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

app.post('/api/auth/login', asyncRoute((req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim() : ''
  const password = typeof req.body.password === 'string' ? req.body.password : ''
  if (!email || !password) return res.status(400).json({ error: 'Enter your email and password.' })
  const user = db.prepare('SELECT id, name, email, password_hash, role FROM users WHERE email = ?').get(email)
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Email or password is incorrect.' })
  }
  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    jwtSecret,
    { expiresIn: '12h' },
  )
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } })
}))

app.get('/api/auth/me', authenticate, (req, res) => res.json({ user: req.user }))

app.get('/api/dashboard/summary', authenticate, (req, res) => {
  const userId = currentUserId(req)
  const baseFilter = userId === null ? '' : 'WHERE freelancer_id = ?'
  const args = userId === null ? [] : [userId]
  const projectStats = db.prepare(`
    SELECT COUNT(*) AS total,
      SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) AS active,
      SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) AS completed
    FROM projects ${baseFilter}
  `).get(...args)
  const taskFilter = userId === null ? '' : 'WHERE p.freelancer_id = ?'
  const taskStats = db.prepare(`
    SELECT COUNT(t.id) AS total,
      SUM(CASE WHEN t.status = 'Completed' THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN t.status = 'In Progress' THEN 1 ELSE 0 END) AS in_progress
    FROM tasks t JOIN projects p ON p.id = t.project_id ${taskFilter}
  `).get(...args)
  const earned = db.prepare(`
    SELECT COALESCE(SUM(pay.amount), 0) AS total
    FROM payments pay JOIN invoices i ON i.id = pay.invoice_id
    JOIN projects p ON p.id = i.project_id ${userId === null ? '' : 'WHERE p.freelancer_id = ?'}
  `).get(...args).total
  const outstanding = db.prepare(`
    SELECT COALESCE(SUM(i.amount - COALESCE(paid.total_paid, 0)), 0) AS total
    FROM invoices i JOIN projects p ON p.id = i.project_id
    LEFT JOIN (SELECT invoice_id, SUM(amount) AS total_paid FROM payments GROUP BY invoice_id) paid ON paid.invoice_id = i.id
    ${userId === null ? '' : 'WHERE p.freelancer_id = ?'}
  `).get(...args).total

  if (req.user.role === 'client') {
    const client = db.prepare('SELECT id FROM clients WHERE user_id = ?').get(req.user.id)
    const clientProjects = client ? db.prepare(`
      SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) AS active
      FROM projects WHERE client_id = ?
    `).get(client.id) : { total: 0, active: 0 }
    const clientTasks = client ? db.prepare(`
      SELECT COUNT(t.id) AS total, SUM(CASE WHEN t.status = 'Completed' THEN 1 ELSE 0 END) AS completed
      FROM tasks t JOIN projects p ON p.id = t.project_id WHERE p.client_id = ?
    `).get(client.id) : { total: 0, completed: 0 }
    return res.json({ projects: clientProjects, tasks: clientTasks, earnings: null, outstanding: null })
  }
  res.json({ projects: projectStats, tasks: taskStats, earnings: earned, outstanding })
})

app.get('/api/clients', authenticate, (req, res) => {
  if (req.user.role === 'client') {
    return res.json(db.prepare('SELECT * FROM clients WHERE user_id = ?').all(req.user.id))
  }
  const sql = req.user.role === 'admin'
    ? `SELECT c.*, u.name AS freelancer_name FROM clients c LEFT JOIN users u ON u.id = c.freelancer_id ORDER BY c.name`
    : 'SELECT * FROM clients WHERE freelancer_id = ? ORDER BY name'
  const rows = req.user.role === 'admin' ? db.prepare(sql).all() : db.prepare(sql).all(req.user.id)
  res.json(rows)
})

app.post('/api/clients', authenticate, allowRoles('freelancer', 'admin'), asyncRoute((req, res) => {
  const name = validText(req.body.name, 'Client name')
  const email = validText(req.body.email, 'Client email', 254)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error('Enter a valid client email.'), { status: 400 })
  const company = typeof req.body.company === 'string' ? req.body.company.trim().slice(0, 200) : ''
  const phone = typeof req.body.phone === 'string' ? req.body.phone.trim().slice(0, 50) : ''
  const freelancerId = req.user.role === 'admin' && Number.isInteger(Number(req.body.freelancer_id))
    ? Number(req.body.freelancer_id) : req.user.id

  // Automatically create or link a user account for this client with default password 'demo123'
  let clientUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
  if (!clientUser) {
    const defaultPasswordHash = bcrypt.hashSync('demo123', 10)
    const userResult = db.prepare(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
    ).run(name, email, defaultPasswordHash, 'client')
    clientUser = { id: Number(userResult.lastInsertRowid) }
  }

  const result = db.prepare(
    'INSERT INTO clients (freelancer_id, user_id, name, email, company, phone) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(freelancerId, clientUser.id, name, email, company, phone)
  res.status(201).json(db.prepare('SELECT * FROM clients WHERE id = ?').get(result.lastInsertRowid))
}))

app.put('/api/clients/:id', authenticate, allowRoles('freelancer', 'admin'), asyncRoute((req, res) => {
  const clientId = Number(req.params.id)
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId)
  if (!client || (req.user.role !== 'admin' && client.freelancer_id !== req.user.id)) {
    return res.status(404).json({ error: 'Client not found.' })
  }
  const name = validText(req.body.name, 'Client name')
  const email = validText(req.body.email, 'Client email', 254)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error('Enter a valid client email.'), { status: 400 })
  const company = typeof req.body.company === 'string' ? req.body.company.trim().slice(0, 200) : ''
  const phone = typeof req.body.phone === 'string' ? req.body.phone.trim().slice(0, 50) : ''

  // Sync or link user account for this client
  let clientUserId = client.user_id
  if (clientUserId) {
    db.prepare('UPDATE users SET name = ?, email = ? WHERE id = ?').run(name, email, clientUserId)
  } else {
    let existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
    if (!existingUser) {
      const userResult = db.prepare(
        'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
      ).run(name, email, bcrypt.hashSync('demo123', 10), 'client')
      clientUserId = Number(userResult.lastInsertRowid)
    } else {
      clientUserId = existingUser.id
    }
  }

  db.prepare('UPDATE clients SET user_id = ?, name = ?, email = ?, company = ?, phone = ? WHERE id = ?')
    .run(clientUserId, name, email, company, phone, clientId)
  res.json(db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId))
}))


app.get('/api/projects', authenticate, (req, res) => {
  const filter = req.user.role === 'admin'
    ? ''
    : req.user.role === 'client'
      ? 'WHERE c.user_id = ?'
      : 'WHERE p.freelancer_id = ?'
  const args = req.user.role === 'admin' ? [] : [req.user.id]
  const projects = db.prepare(`
    SELECT p.*, c.name AS client_name, c.company AS client_company,
      COUNT(t.id) AS task_count,
      SUM(CASE WHEN t.status = 'Completed' THEN 1 ELSE 0 END) AS completed_tasks
    FROM projects p JOIN clients c ON c.id = p.client_id
    LEFT JOIN tasks t ON t.project_id = p.id
    ${filter}
    GROUP BY p.id ORDER BY p.deadline ASC
  `).all(...args)
  res.json(projects)
})

app.post('/api/projects', authenticate, allowRoles('freelancer', 'admin'), upload.single('attachment'), asyncRoute((req, res) => {
  const clientId = Number(req.body.client_id)
  const title = validText(req.body.title, 'Project title')
  const description = typeof req.body.description === 'string' ? req.body.description.trim().slice(0, 2000) : ''
  const budget = Number(req.body.budget)
  const deadline = validDate(req.body.deadline, 'Deadline')
  const attachmentUrl = typeof req.body.attachment_url === 'string' ? req.body.attachment_url.trim() : ''
  if (!Number.isInteger(clientId) || clientId < 1) throw Object.assign(new Error('Select a client.'), { status: 400 })
  if (!Number.isFinite(budget) || budget < 0) throw Object.assign(new Error('Budget must be zero or more.'), { status: 400 })
  if (attachmentUrl && !/^https?:\/\/\S+$/i.test(attachmentUrl)) throw Object.assign(new Error('Attachment must be a valid http or https URL.'), { status: 400 })
  if (attachmentUrl && req.file) throw Object.assign(new Error('Choose either an attachment URL or an uploaded file.'), { status: 400 })
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId)
  if (!client || (req.user.role !== 'admin' && client.freelancer_id !== req.user.id)) {
    throw Object.assign(new Error('Choose one of your clients.'), { status: 400 })
  }
  const freelancerId = req.user.role === 'admin' ? client.freelancer_id : req.user.id
  const storedAttachment = req.file
    ? `/uploads/${randomUUID()}${path.extname(req.file.originalname).toLowerCase()}`
    : attachmentUrl
  const result = db.prepare(`
    INSERT INTO projects (freelancer_id, client_id, title, description, budget, deadline, attachment_url)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(freelancerId, clientId, title, description, budget, deadline, storedAttachment)
  const id = Number(result.lastInsertRowid)
  if (req.file) fs.writeFileSync(path.join(uploadDirectory, path.basename(storedAttachment)), req.file.buffer)
  recordProjectHistory(id, req.user.id, 'Project created', `${title} project created.`)
  res.status(201).json(getProject(id, req.user))
}))

app.patch('/api/projects/:id/status', authenticate, allowRoles('freelancer', 'admin'), asyncRoute((req, res) => {
  const project = getProject(Number(req.params.id), req.user)
  if (!project) return res.status(404).json({ error: 'Project not found.' })
  const status = req.body.status
  if (!['Active', 'Completed', 'On hold'].includes(status)) throw Object.assign(new Error('Choose a valid project status.'), { status: 400 })
  if (status === 'Completed') {
    const tasks = db.prepare('SELECT COUNT(*) AS total, SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS completed FROM tasks WHERE project_id = ?')
      .get('Completed', project.id)
    if (!tasks.total || tasks.completed !== tasks.total) {
      throw Object.assign(new Error('Complete all project tasks before marking the project completed.'), { status: 400 })
    }
  }
  db.prepare('UPDATE projects SET status = ? WHERE id = ?').run(status, project.id)
  recordProjectHistory(project.id, req.user.id, 'Project status updated', `Project status changed to ${status}.`)
  res.json(getProject(project.id, req.user))
}))

app.get('/api/tasks', authenticate, (req, res) => {
  const filter = req.user.role === 'admin'
    ? ''
    : req.user.role === 'client'
      ? 'WHERE c.user_id = ?'
      : 'WHERE p.freelancer_id = ?'
  const args = req.user.role === 'admin' ? [] : [req.user.id]
  res.json(db.prepare(`
    SELECT t.*, p.title AS project_title, p.client_id
    FROM tasks t JOIN projects p ON p.id = t.project_id
    JOIN clients c ON c.id = p.client_id ${filter}
    ORDER BY t.created_at DESC
  `).all(...args))
})

app.post('/api/tasks', authenticate, allowRoles('freelancer', 'admin'), asyncRoute((req, res) => {
  const projectId = Number(req.body.project_id)
  const project = getProject(projectId, req.user)
  if (!project) throw Object.assign(new Error('Choose one of your projects.'), { status: 400 })
  const title = validText(req.body.title, 'Task title')
  const description = typeof req.body.description === 'string' ? req.body.description.trim().slice(0, 1000) : ''
  const dueDate = req.body.due_date ? validDate(req.body.due_date, 'Task due date') : null
  const result = db.prepare(
    'INSERT INTO tasks (project_id, title, description, due_date) VALUES (?, ?, ?, ?)',
  ).run(projectId, title, description, dueDate)
  recordProjectHistory(projectId, req.user.id, 'Task created', `${title} task created.`)
  res.status(201).json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid))
}))

app.put('/api/tasks/:id/status', authenticate, allowRoles('freelancer', 'admin'), asyncRoute((req, res) => {
  const task = db.prepare(`
    SELECT t.*, p.freelancer_id, p.id AS project_id FROM tasks t
    JOIN projects p ON p.id = t.project_id WHERE t.id = ?
  `).get(Number(req.params.id))
  if (!task || (req.user.role !== 'admin' && task.freelancer_id !== req.user.id)) return res.status(404).json({ error: 'Task not found.' })
  const status = req.body.status
  if (!['To Do', 'In Progress', 'Completed'].includes(status)) throw Object.assign(new Error('Choose a valid task status.'), { status: 400 })
  db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run(status, task.id)
  recordProjectHistory(task.project_id, req.user.id, 'Task status updated', `${task.title} moved to ${status}.`)
  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(task.id))
}))

// BONUS: Track time spent on a task (in minutes)
app.post('/api/tasks/:id/time', authenticate, allowRoles('freelancer', 'admin'), asyncRoute((req, res) => {
  const taskId = Number(req.params.id)
  const minutes = Number(req.body.minutes)
  if (!Number.isFinite(minutes) || minutes <= 0) {
    throw Object.assign(new Error('Minutes must be a positive number.'), { status: 400 })
  }
  const task = db.prepare(`
    SELECT t.*, p.freelancer_id, p.id AS project_id FROM tasks t
    JOIN projects p ON p.id = t.project_id WHERE t.id = ?
  `).get(taskId)
  if (!task || (req.user.role !== 'admin' && task.freelancer_id !== req.user.id)) {
    return res.status(404).json({ error: 'Task not found.' })
  }
  db.prepare('UPDATE tasks SET time_spent_minutes = COALESCE(time_spent_minutes, 0) + ? WHERE id = ?').run(minutes, taskId)
  recordProjectHistory(task.project_id, req.user.id, 'Time logged', `Logged ${minutes} minute(s) on "${task.title}".`)
  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId))
}))

app.get('/api/invoices', authenticate, (req, res) => {
  const filter = req.user.role === 'admin'
    ? ''
    : req.user.role === 'client'
      ? 'WHERE c.user_id = ?'
      : 'WHERE p.freelancer_id = ?'
  const args = req.user.role === 'admin' ? [] : [req.user.id]
  res.json(db.prepare(`
    SELECT i.*, p.title AS project_title, c.name AS client_name,
      COALESCE(SUM(pay.amount), 0) AS amount_paid
    FROM invoices i JOIN projects p ON p.id = i.project_id
    JOIN clients c ON c.id = i.client_id
    LEFT JOIN payments pay ON pay.invoice_id = i.id
    ${filter} GROUP BY i.id ORDER BY i.created_at DESC
  `).all(...args))
})

app.post('/api/invoices', authenticate, allowRoles('freelancer', 'admin'), asyncRoute((req, res) => {
  const projectId = Number(req.body.project_id)
  const project = getProject(projectId, req.user)
  if (!project) throw Object.assign(new Error('Choose one of your projects.'), { status: 400 })
  const amount = Number(req.body.amount)
  const dueDate = validDate(req.body.due_date, 'Due date')
  if (!Number.isFinite(amount) || amount <= 0) throw Object.assign(new Error('Invoice amount must be greater than zero.'), { status: 400 })
  const completedTasks = db.prepare("SELECT COUNT(*) AS count FROM tasks WHERE project_id = ? AND status = 'Completed'").get(projectId).count
  if (completedTasks === 0) throw Object.assign(new Error('Complete at least one project task before creating an invoice.'), { status: 400 })
  const total = db.prepare('SELECT COALESCE(SUM(amount), 0) AS total FROM invoices WHERE project_id = ?').get(projectId).total
  if (amount + total > project.budget) throw Object.assign(new Error('Invoices for this project cannot exceed its budget.'), { status: 400 })
  const invoiceNumber = `INV-${new Date().getFullYear()}-${randomUUID().slice(0, 6).toUpperCase()}`
  const result = db.prepare(
    'INSERT INTO invoices (project_id, client_id, invoice_number, amount, due_date) VALUES (?, ?, ?, ?, ?)',
  ).run(projectId, project.client_id, invoiceNumber, amount, dueDate)
  recordProjectHistory(projectId, req.user.id, 'Invoice created', `${invoiceNumber} invoice created for $${amount.toFixed(2)}.`)
  res.status(201).json(db.prepare('SELECT * FROM invoices WHERE id = ?').get(result.lastInsertRowid))
}))

app.get('/api/payments', authenticate, (req, res) => {
  const filter = req.user.role === 'admin'
    ? ''
    : req.user.role === 'client'
      ? 'WHERE c.user_id = ?'
      : 'WHERE p.freelancer_id = ?'
  const args = req.user.role === 'admin' ? [] : [req.user.id]
  res.json(db.prepare(`
    SELECT pay.*, i.invoice_number, i.amount AS invoice_amount, c.name AS client_name, p.title AS project_title
    FROM payments pay JOIN invoices i ON i.id = pay.invoice_id
    JOIN clients c ON c.id = i.client_id JOIN projects p ON p.id = i.project_id
    ${filter} ORDER BY pay.paid_at DESC
  `).all(...args))
})

app.post('/api/payments', authenticate, allowRoles('freelancer', 'admin'), asyncRoute((req, res) => {
  const invoiceId = Number(req.body.invoice_id)
  const amount = Number(req.body.amount)
  const note = typeof req.body.note === 'string' ? req.body.note.trim().slice(0, 200) : ''
  if (!Number.isInteger(invoiceId) || invoiceId < 1) throw Object.assign(new Error('Select an invoice.'), { status: 400 })
  if (!Number.isFinite(amount) || amount <= 0) throw Object.assign(new Error('Payment amount must be greater than zero.'), { status: 400 })
  const invoice = db.prepare(`
    SELECT i.*, p.freelancer_id FROM invoices i JOIN projects p ON p.id = i.project_id WHERE i.id = ?
  `).get(invoiceId)
  if (!invoice || (req.user.role !== 'admin' && invoice.freelancer_id !== req.user.id)) {
    throw Object.assign(new Error('Choose one of your invoices.'), { status: 400 })
  }
  const paid = db.prepare('SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE invoice_id = ?').get(invoiceId).total
  if (amount > invoice.amount - paid + 0.00001) throw Object.assign(new Error('Payment cannot exceed the outstanding invoice balance.'), { status: 400 })
  const addPayment = db.transaction(() => {
    const result = db.prepare('INSERT INTO payments (invoice_id, amount, note) VALUES (?, ?, ?)').run(invoiceId, amount, note)
    const newTotal = paid + amount
    const status = newTotal >= invoice.amount - 0.00001 ? 'Paid' : 'Partially Paid'
    db.prepare('UPDATE invoices SET status = ? WHERE id = ?').run(status, invoiceId)
    recordProjectHistory(invoice.project_id, req.user.id, 'Payment recorded', `$${amount.toFixed(2)} payment recorded for ${invoice.invoice_number}.`)
    return result.lastInsertRowid
  })
  const paymentId = addPayment()
  res.status(201).json(db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId))
}))

app.get('/api/history', authenticate, (req, res) => {
  const projectId = Number(req.query.project_id)
  const project = getProject(projectId, req.user)
  if (!project) return res.status(404).json({ error: 'Project not found.' })
  res.json(db.prepare(`
    SELECT h.*, u.name AS user_name FROM project_history h
    LEFT JOIN users u ON u.id = h.user_id
    WHERE h.project_id = ? ORDER BY h.created_at DESC, h.id DESC
  `).all(projectId))
})

// Serve frontend built assets in production if available
const frontendDist = path.resolve(sourceDirectory, '../../frontend/dist')
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist))
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(frontendDist, 'index.html'))
    }
    next()
  })
}

app.use((error, _req, res, _next) => {
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body must contain valid JSON.' })
  }
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Attachment must be 10 MB or smaller.' : error.message })
  }
  if (error.message === 'Attach a PDF, image, DOCX, XLSX, or ZIP file.') return res.status(400).json({ error: error.message })
  if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return res.status(409).json({ error: 'A project with this title already exists for that client.' })
  }
  if (error.code?.startsWith('SQLITE_CONSTRAINT')) {
    return res.status(400).json({ error: 'This change conflicts with existing data.' })
  }
  if (error.status && error.status < 500) {
    return res.status(error.status).json({ error: error.message })
  }
  console.error(error)
  res.status(500).json({ error: 'Something went wrong on the server.' })
})

app.listen(port, () => console.log(`Freelancer Management API listening on http://localhost:${port}`))
