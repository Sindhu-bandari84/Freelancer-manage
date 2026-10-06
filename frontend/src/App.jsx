import React, { useState, useEffect, useCallback } from 'react'
import Navbar from './components/Navbar'
import Modal from './components/Modal'
import ProjectHistoryModal from './components/ProjectHistoryModal'
import InvoiceReminderModal from './components/InvoiceReminderModal'

import DashboardPage from './pages/DashboardPage'
import ClientsPage from './pages/ClientsPage'
import ProjectsPage from './pages/ProjectsPage'
import TaskBoardPage from './pages/TaskBoardPage'
import InvoicesPage from './pages/InvoicesPage'
import PaymentsPage from './pages/PaymentsPage'

import './App.css'

// Backend API URL configured via environment or default to relative in production / local port 4000
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:4000/api')

/**
 * Standard fetch helper that automatically attaches JWT token and parses JSON responses.
 */
async function apiRequest(endpoint, token, options = {}) {
  const isFormData = options.body instanceof FormData
  const headers = {
    ...(isFormData ? {} : options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }

  const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers })
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.error || 'Server request failed.')
  }
  return data
}

export default function App() {
  // Authentication state
  const [token, setToken] = useState(() => localStorage.getItem('freelancer_token') || '')
  const [user, setUser] = useState(null)
  const [authError, setAuthError] = useState('')
  const [busy, setBusy] = useState(false)

  // Current active page tab
  const [activePage, setActivePage] = useState('dashboard')

  // Main application data state
  const [data, setData] = useState({
    summary: null,
    clients: [],
    projects: [],
    tasks: [],
    invoices: [],
    payments: [],
  })
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // Modal dialog states
  const [modalType, setModalType] = useState('') // 'client' | 'project' | 'task' | 'invoice' | 'payment'
  const [clientToEdit, setClientToEdit] = useState(null)
  const [historyProject, setHistoryProject] = useState(null)
  const [reminderInvoice, setReminderInvoice] = useState(null)
  const [selectedInvoiceForPay, setSelectedInvoiceForPay] = useState(null)

  // Quick state for pre-filling project in invoice modal
  const [selectedProjectIdForInvoice, setSelectedProjectIdForInvoice] = useState('')

  /**
   * Load all application entities from backend
   */
  const fetchAllData = useCallback(async (authToken) => {
    setLoading(true)
    setErrorMessage('')
    try {
      const [summary, clients, projects, tasks, invoices, payments] = await Promise.all([
        apiRequest('/dashboard/summary', authToken),
        apiRequest('/clients', authToken),
        apiRequest('/projects', authToken),
        apiRequest('/tasks', authToken),
        apiRequest('/invoices', authToken),
        apiRequest('/payments', authToken),
      ])
      setData({ summary, clients, projects, tasks, invoices, payments })
    } catch (err) {
      setErrorMessage(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Auto-login verification on page mount
  useEffect(() => {
    if (!token) return
    apiRequest('/auth/me', token)
      .then((res) => {
        setUser(res.user)
        return fetchAllData(token)
      })
      .catch(() => {
        // If token expired, clear session
        handleSignOut()
      })
  }, [token, fetchAllData])

  /**
   * User login handler
   */
  async function handleLogin(email, password) {
    setAuthError('')
    setBusy(true)
    try {
      const res = await apiRequest('/auth/login', '', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      localStorage.setItem('freelancer_token', res.token)
      setToken(res.token)
      setUser(res.user)
      await fetchAllData(res.token)
    } catch (err) {
      setAuthError(err.message)
    } finally {
      setBusy(false)
    }
  }

  /**
   * User logout handler
   */
  function handleSignOut() {
    localStorage.removeItem('freelancer_token')
    setToken('')
    setUser(null)
    setData({ summary: null, clients: [], projects: [], tasks: [], invoices: [], payments: [] })
    setActivePage('dashboard')
  }

  /**
   * Status change handlers
   */
  async function handleTaskStatusChange(taskId, newStatus) {
    try {
      await apiRequest(`/tasks/${taskId}/status`, token, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      })
      await fetchAllData(token)
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleProjectStatusChange(projectId, newStatus) {
    try {
      await apiRequest(`/projects/${projectId}/status`, token, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      })
      await fetchAllData(token)
    } catch (err) {
      alert(err.message)
    }
  }

  /**
   * BONUS: Track time on a task
   */
  async function handleLogTaskTime(taskId, minutes) {
    try {
      await apiRequest(`/tasks/${taskId}/time`, token, {
        method: 'POST',
        body: JSON.stringify({ minutes }),
      })
      await fetchAllData(token)
    } catch (err) {
      alert(err.message)
    }
  }

  /**
   * Open project history audit trail
   */
  async function handleOpenHistory(project) {
    try {
      const entries = await apiRequest(`/history?project_id=${project.id}`, token)
      setHistoryProject({ project, entries })
    } catch (err) {
      alert(err.message)
    }
  }

  /**
   * Generic form submission for adding clients, projects, tasks, invoices, payments
   */
  async function handleFormSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setErrorMessage('')
    const form = new FormData(e.currentTarget)

    try {
      if (modalType === 'client') {
        const body = JSON.stringify({
          name: form.get('name'),
          email: form.get('email'),
          company: form.get('company'),
          phone: form.get('phone'),
        })
        if (clientToEdit) {
          await apiRequest(`/clients/${clientToEdit.id}`, token, { method: 'PUT', body })
        } else {
          await apiRequest('/clients', token, { method: 'POST', body })
        }
      } else if (modalType === 'project') {
        // Projects use FormData because of potential file uploads
        await apiRequest('/projects', token, { method: 'POST', body: form })
      } else if (modalType === 'task') {
        const body = JSON.stringify({
          project_id: Number(form.get('project_id')),
          title: form.get('title'),
          description: form.get('description'),
          due_date: form.get('due_date') || null,
        })
        await apiRequest('/tasks', token, { method: 'POST', body })
      } else if (modalType === 'invoice') {
        const body = JSON.stringify({
          project_id: Number(form.get('project_id')),
          amount: Number(form.get('amount')),
          due_date: form.get('due_date'),
        })
        await apiRequest('/invoices', token, { method: 'POST', body })
      } else if (modalType === 'payment') {
        const body = JSON.stringify({
          invoice_id: Number(form.get('invoice_id')),
          amount: Number(form.get('amount')),
          note: form.get('note'),
        })
        await apiRequest('/payments', token, { method: 'POST', body })
      }

      // Close modal and refresh data
      setModalType('')
      setClientToEdit(null)
      setSelectedInvoiceForPay(null)
      await fetchAllData(token)
    } catch (err) {
      setErrorMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  // --- RENDER LOGIN SCREEN IF NOT AUTHENTICATED ---
  if (!token || !user) {
    return (
      <div className="login-wrapper">
        <div className="login-card">
          <div className="login-header">
            <span className="login-logo">💼</span>
            <h2>FreelancerHub</h2>
            <p>Smart Freelancer Project & Client Management System</p>
          </div>

          {authError && <div className="error-alert">{authError}</div>}

          <form onSubmit={(e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            handleLogin(fd.get('email'), fd.get('password'))
          }}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                name="email"
                type="email"
                required
                className="form-control"
                placeholder="name@example.com"
                defaultValue="freelancer@demo.com"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                name="password"
                type="password"
                required
                className="form-control"
                placeholder="Enter password"
                defaultValue="demo123"
              />
            </div>

            <button type="submit" disabled={busy} className="btn-primary btn-block">
              {busy ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          {/* 1-Click Demo Accounts for Student Presentations & Testing */}
          <div className="demo-accounts-box">
            <span className="demo-title">Quick Demo Logins (Password: demo123):</span>
            <div className="demo-buttons-grid">
              <button
                type="button"
                className="btn-demo"
                onClick={() => handleLogin('freelancer@demo.com', 'demo123')}
              >
                Freelancer (Alex)
              </button>
              <button
                type="button"
                className="btn-demo"
                onClick={() => handleLogin('client@demo.com', 'demo123')}
              >
                Client (Jordan)
              </button>
              <button
                type="button"
                className="btn-demo"
                onClick={() => handleLogin('admin@demo.com', 'demo123')}
              >
                Admin (System)
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // --- MAIN APPLICATION INTERFACE ---
  return (
    <div className="app-shell">
      {/* Top Navigation Bar */}
      <Navbar
        activePage={activePage}
        setActivePage={setActivePage}
        user={user}
        onSignOut={handleSignOut}
      />

      {/* Global Error Banner */}
      {errorMessage && (
        <div className="global-error-banner">
          <span>⚠️ {errorMessage}</span>
          <button type="button" onClick={() => setErrorMessage('')}>✕</button>
        </div>
      )}

      {/* Loading Indicator */}
      {loading && <div className="loading-bar" />}

      {/* Page Content View */}
      <main className="main-content">
        {activePage === 'dashboard' && (
          <DashboardPage
            summary={data.summary}
            projects={data.projects}
            tasks={data.tasks}
            user={user}
            onNavigate={setActivePage}
            onOpenModal={(type) => setModalType(type)}
          />
        )}

        {activePage === 'clients' && (
          <ClientsPage
            clients={data.clients}
            onOpenModal={(type) => setModalType(type)}
            onEditClient={(client) => {
              setClientToEdit(client)
              setModalType('client')
            }}
          />
        )}

        {activePage === 'projects' && (
          <ProjectsPage
            projects={data.projects}
            user={user}
            onOpenModal={(type) => setModalType(type)}
            onChangeStatus={handleProjectStatusChange}
            onOpenHistory={handleOpenHistory}
          />
        )}

        {activePage === 'tasks' && (
          <TaskBoardPage
            tasks={data.tasks}
            projects={data.projects}
            user={user}
            onOpenModal={(type) => setModalType(type)}
            onChangeTaskStatus={handleTaskStatusChange}
            onLogTaskTime={handleLogTaskTime}
          />
        )}

        {activePage === 'invoices' && (
          <InvoicesPage
            invoices={data.invoices}
            user={user}
            onOpenModal={(type) => setModalType(type)}
            onOpenReminder={(inv) => setReminderInvoice(inv)}
            onQuickPay={(inv) => {
              setSelectedInvoiceForPay(inv)
              setModalType('payment')
            }}
          />
        )}

        {activePage === 'payments' && (
          <PaymentsPage
            payments={data.payments}
            user={user}
            onOpenModal={(type) => setModalType(type)}
          />
        )}
      </main>

      {/* --- REUSABLE MODALS --- */}

      {/* 1. Client Modal (Add/Edit) */}
      <Modal
        title={clientToEdit ? 'Edit Client Profile' : 'Add New Client'}
        isOpen={modalType === 'client'}
        onClose={() => {
          setModalType('')
          setClientToEdit(null)
        }}
      >
        <form onSubmit={handleFormSubmit}>
          <div className="form-group">
            <label className="form-label">Client Name *</label>
            <input
              name="name"
              required
              className="form-control"
              placeholder="e.g. Acme Corp / Jane Doe"
              defaultValue={clientToEdit?.name || ''}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Email Address *</label>
            <input
              name="email"
              type="email"
              required
              className="form-control"
              placeholder="contact@example.com"
              defaultValue={clientToEdit?.email || ''}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Company Name</label>
            <input
              name="company"
              className="form-control"
              placeholder="Company or Studio"
              defaultValue={clientToEdit?.company || ''}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Phone Number</label>
            <input
              name="phone"
              className="form-control"
              placeholder="(555) 123-4567"
              defaultValue={clientToEdit?.phone || ''}
            />
          </div>
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '0.65rem 0.85rem', marginBottom: '1rem', fontSize: '0.82rem', color: '#166534' }}>
            ℹ️ <strong>Client Portal Access:</strong> This client will automatically be able to log in using their email and default password <code>demo123</code> to track their project progress.
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setModalType('')
                setClientToEdit(null)
              }}
            >
              Cancel
            </button>
            <button type="submit" disabled={busy} className="btn-primary">
              {busy ? 'Saving...' : clientToEdit ? 'Save Changes' : 'Create Client'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 2. Project Modal */}
      <Modal
        title="Create New Project"
        isOpen={modalType === 'project'}
        onClose={() => setModalType('')}
      >
        <form onSubmit={handleFormSubmit}>
          <div className="form-group">
            <label className="form-label">Client *</label>
            <select name="client_id" required className="form-control">
              <option value="">Select a client...</option>
              {data.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.company ? `(${c.company})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Project Title * (Unique per client)</label>
            <input
              name="title"
              required
              className="form-control"
              placeholder="e.g. Website Redesign"
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Budget ($ USD) *</label>
              <input
                name="budget"
                type="number"
                min="0"
                step="0.01"
                required
                className="form-control"
                placeholder="2500"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Deadline *</label>
              <input
                name="deadline"
                type="date"
                required
                className="form-control"
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              name="description"
              rows={3}
              className="form-control"
              placeholder="Scope of work and project goals..."
            />
          </div>
          <div className="form-group">
            <label className="form-label">Deliverable URL (Optional)</label>
            <input
              name="attachment_url"
              type="url"
              className="form-control"
              placeholder="https://figma.com/... or https://github.com/..."
            />
          </div>
          <div className="form-group">
            <label className="form-label">Or Upload File Deliverable</label>
            <input
              name="attachment"
              type="file"
              className="form-control"
              accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.zip"
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={() => setModalType('')}>
              Cancel
            </button>
            <button type="submit" disabled={busy} className="btn-primary">
              {busy ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 3. Task Modal */}
      <Modal
        title="Add New Task"
        isOpen={modalType === 'task'}
        onClose={() => setModalType('')}
      >
        <form onSubmit={handleFormSubmit}>
          <div className="form-group">
            <label className="form-label">Project *</label>
            <select name="project_id" required className="form-control">
              <option value="">Select project...</option>
              {data.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p.client_name})
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Task Title *</label>
            <input
              name="title"
              required
              className="form-control"
              placeholder="e.g. Design wireframes"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Due Date</label>
            <input
              name="due_date"
              type="date"
              className="form-control"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Task Description</label>
            <textarea
              name="description"
              rows={3}
              className="form-control"
              placeholder="Details or acceptance criteria..."
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={() => setModalType('')}>
              Cancel
            </button>
            <button type="submit" disabled={busy} className="btn-primary">
              {busy ? 'Adding...' : 'Add Task'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 4. Invoice Modal */}
      <Modal
        title="Create Invoice"
        isOpen={modalType === 'invoice'}
        onClose={() => setModalType('')}
      >
        <form onSubmit={handleFormSubmit}>
          <div className="form-group">
            <label className="form-label">Project * (Requires at least 1 completed task)</label>
            <select
              name="project_id"
              required
              className="form-control"
              value={selectedProjectIdForInvoice}
              onChange={(e) => setSelectedProjectIdForInvoice(e.target.value)}
            >
              <option value="">Select project...</option>
              {data.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} - Budget: ${p.budget} ({p.client_name})
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Invoice Amount ($ USD) *</label>
              <input
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                required
                className="form-control"
                placeholder="Amount (cannot exceed budget)"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Payment Due Date *</label>
              <input
                name="due_date"
                type="date"
                required
                className="form-control"
              />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={() => setModalType('')}>
              Cancel
            </button>
            <button type="submit" disabled={busy} className="btn-primary">
              {busy ? 'Creating...' : 'Generate Invoice'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 5. Payment Modal */}
      <Modal
        title="Record Payment"
        isOpen={modalType === 'payment'}
        onClose={() => {
          setModalType('')
          setSelectedInvoiceForPay(null)
        }}
      >
        <form onSubmit={handleFormSubmit}>
          <div className="form-group">
            <label className="form-label">Invoice *</label>
            <select
              name="invoice_id"
              required
              className="form-control"
              defaultValue={selectedInvoiceForPay ? selectedInvoiceForPay.id : ''}
            >
              <option value="">Select invoice to pay...</option>
              {data.invoices
                .filter((inv) => inv.status !== 'Paid')
                .map((inv) => {
                  const balance = inv.amount - (inv.amount_paid || 0)
                  return (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_number} ({inv.client_name}) - Balance: ${balance.toFixed(2)}
                    </option>
                  )
                })}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Payment Amount ($ USD) *</label>
            <input
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              required
              className="form-control"
              placeholder="e.g. 500"
              defaultValue={
                selectedInvoiceForPay
                  ? (selectedInvoiceForPay.amount - (selectedInvoiceForPay.amount_paid || 0)).toFixed(2)
                  : ''
              }
            />
          </div>
          <div className="form-group">
            <label className="form-label">Payment Reference / Note</label>
            <input
              name="note"
              className="form-control"
              placeholder="e.g. Bank transfer, Stripe, Check #104"
            />
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setModalType('')
                setSelectedInvoiceForPay(null)
              }}
            >
              Cancel
            </button>
            <button type="submit" disabled={busy} className="btn-primary">
              {busy ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 6. Project History Audit Trail Modal */}
      {historyProject && (
        <ProjectHistoryModal
          history={historyProject}
          onClose={() => setHistoryProject(null)}
        />
      )}

      {/* 7. BONUS: Automated Invoice Reminder Modal */}
      {reminderInvoice && (
        <InvoiceReminderModal
          invoice={reminderInvoice}
          onClose={() => setReminderInvoice(null)}
        />
      )}
    </div>
  )
}
