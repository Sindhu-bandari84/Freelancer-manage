import jwt from 'jsonwebtoken'
import { db } from './db.js'

export function authenticate(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Sign in to continue.' })

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'development-only-secret')
    next()
  } catch {
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.' })
  }
}

export function allowRoles(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'You do not have permission to do that.' })
    next()
  }
}

export function recordProjectHistory(projectId, userId, action, details = '') {
  db.prepare('INSERT INTO project_history (project_id, user_id, action, details) VALUES (?, ?, ?, ?)')
    .run(projectId, userId, action, details)
}
