import React, { useState } from 'react'

/**
 * Projects Overview Page
 * Displays all client projects with lifecycle tracking:
 * - Budget, deadline, and task completion progress
 * - Status updating (Active -> Completed -> On hold)
 * - Deliverable attachments (file upload or URL)
 * - Audit history logs
 */
export default function ProjectsPage({
  projects,
  user,
  onOpenModal,
  onChangeStatus,
  onOpenHistory,
}) {
  const [filterStatus, setFilterStatus] = useState('All')
  const [search, setSearch] = useState('')

  const isClient = user?.role === 'client'

  const formatMoney = (val) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val || 0)

  // Filter projects by status tab and search
  const filteredProjects = projects.filter((p) => {
    const matchesStatus = filterStatus === 'All' || p.status === filterStatus
    const matchesSearch =
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.client_name.toLowerCase().includes(search.toLowerCase())
    return matchesStatus && matchesSearch
  })

  // Check if project is overdue
  const isOverdue = (deadline, status) => {
    if (status === 'Completed') return false
    const now = new Date().toISOString().slice(0, 10)
    return deadline < now
  }

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header-flex">
        <div>
          <h2 className="page-heading">Project Overview</h2>
          <p className="page-subheading">
            Track budgets, deadlines, deliverables, and lifecycle progression.
          </p>
        </div>
        {!isClient && (
          <button
            type="button"
            className="btn-primary"
            onClick={() => onOpenModal('project')}
          >
            + Create New Project
          </button>
        )}
      </div>

      {/* Filter Tabs and Search */}
      <div className="filter-row">
        <div className="status-tabs">
          {['All', 'Active', 'Completed', 'On hold'].map((st) => (
            <button
              key={st}
              type="button"
              className={`filter-tab ${filterStatus === st ? 'active' : ''}`}
              onClick={() => setFilterStatus(st)}
            >
              {st}
            </button>
          ))}
        </div>

        <input
          type="text"
          className="search-input"
          placeholder="🔍 Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: '300px' }}
        />
      </div>

      {/* Projects Cards Grid */}
      {filteredProjects.length === 0 ? (
        <div className="empty-state">
          <p>No projects found matching the selected filter.</p>
        </div>
      ) : (
        <div className="projects-grid">
          {filteredProjects.map((project) => {
            const overdue = isOverdue(project.deadline, project.status)
            const taskTotal = Number(project.task_count) || 0
            const taskCompleted = Number(project.completed_tasks) || 0
            const progress = taskTotal > 0 ? Math.round((taskCompleted / taskTotal) * 100) : 0

            return (
              <div key={project.id} className="project-card">
                <div className="project-card-top">
                  <div>
                    <span className="project-client-name">
                      👤 {project.client_name} {project.client_company ? `(${project.client_company})` : ''}
                    </span>
                    <h3 className="project-card-title">{project.title}</h3>
                  </div>

                  <span className={`badge badge-${project.status.toLowerCase().replace(' ', '-')}`}>
                    {project.status}
                  </span>
                </div>

                {project.description && (
                  <p className="project-card-desc">{project.description}</p>
                )}

                {/* Metrics */}
                <div className="project-metrics">
                  <div>
                    <span className="metric-label">Budget</span>
                    <strong className="metric-val">{formatMoney(project.budget)}</strong>
                  </div>
                  <div>
                    <span className="metric-label">Deadline</span>
                    <strong className={`metric-val ${overdue ? 'text-danger' : ''}`}>
                      {project.deadline} {overdue && '⚠️ Overdue'}
                    </strong>
                  </div>
                  <div>
                    <span className="metric-label">Tasks</span>
                    <strong className="metric-val">
                      {taskCompleted}/{taskTotal} done
                    </strong>
                  </div>
                </div>

                {/* Task Progress Bar */}
                <div className="progress-mini-wrap">
                  <div className="progress-mini-bar" style={{ width: `${progress}%` }} />
                </div>

                {/* Deliverable Link */}
                {project.attachment_url && (
                  <div className="attachment-box">
                    <span className="attachment-icon">📎 Deliverable:</span>
                    {project.attachment_url.startsWith('/uploads/') ? (
                      <a
                        href={`${(import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:4000/api')).replace(/\/api\/?$/, '')}/api/projects/${project.id}/attachment`}
                        target="_blank"
                        rel="noreferrer"
                        className="attachment-link"
                      >
                        Download Attachment
                      </a>
                    ) : (
                      <a
                        href={project.attachment_url}
                        target="_blank"
                        rel="noreferrer"
                        className="attachment-link"
                      >
                        View Deliverable URL ↗
                      </a>
                    )}
                  </div>
                )}

                {/* Footer Actions */}
                <div className="project-card-footer">
                  {!isClient ? (
                    <div className="status-selector-wrap">
                      <label htmlFor={`status-${project.id}`} className="status-label">
                        Status:
                      </label>
                      <select
                        id={`status-${project.id}`}
                        className="status-select"
                        value={project.status}
                        onChange={(e) => onChangeStatus(project.id, e.target.value)}
                      >
                        <option value="Active">Active</option>
                        <option value="On hold">On hold</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </div>
                  ) : <div />}

                  <button
                    type="button"
                    className="btn-history"
                    onClick={() => onOpenHistory(project)}
                  >
                    📜 History Log
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
