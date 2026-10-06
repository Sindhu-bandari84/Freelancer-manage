import React from 'react'

/**
 * Dashboard Page
 * Gives freelancers an immediate overview of business health:
 * - Earnings & Outstanding invoices
 * - Active projects & completion rates
 * - Tasks breakdown & upcoming deadlines
 */
export default function DashboardPage({
  summary,
  projects,
  tasks,
  user,
  onNavigate,
  onOpenModal,
}) {
  const isClient = user?.role === 'client'

  // Format currency helper
  const formatMoney = (val) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val || 0)

  // Calculate task percentage
  const totalTasks = summary?.tasks?.total || 0
  const completedTasks = summary?.tasks?.completed || 0
  const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  return (
    <div className="page-container">
      {/* Welcome Banner */}
      <div className="dashboard-welcome">
        <div>
          <h2 className="page-heading">
            Welcome back, {user?.name}! 👋
          </h2>
          <p className="page-subheading">
            {isClient
              ? 'Here is the current real-time progress on your active projects.'
              : 'Here is what is happening across your freelance clients and projects today.'}
          </p>
        </div>

        {!isClient && (
          <div className="quick-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={() => onOpenModal('project')}
            >
              + New Project
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => onOpenModal('task')}
            >
              + New Task
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => onOpenModal('invoice')}
            >
              + New Invoice
            </button>
          </div>
        )}
      </div>

      {/* KPI Stats Grid */}
      <div className="stats-grid">
        {!isClient && (
          <>
            <div className="stat-card">
              <div className="stat-icon-wrap" style={{ background: '#e0f2fe', color: '#0369a1' }}>
                💰
              </div>
              <div className="stat-details">
                <span className="stat-label">Total Earnings</span>
                <span className="stat-value">{formatMoney(summary?.earnings)}</span>
                <span className="stat-subtext">Collected from completed invoices</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon-wrap" style={{ background: '#fef3c7', color: '#b45309' }}>
                ⏳
              </div>
              <div className="stat-details">
                <span className="stat-label">Outstanding Invoices</span>
                <span className="stat-value">{formatMoney(summary?.outstanding)}</span>
                <span className="stat-subtext">Awaiting client payment</span>
              </div>
            </div>
          </>
        )}

        <div className="stat-card">
          <div className="stat-icon-wrap" style={{ background: '#dcfce7', color: '#15803d' }}>
            📁
          </div>
          <div className="stat-details">
            <span className="stat-label">Active Projects</span>
            <span className="stat-value">{summary?.projects?.active || 0}</span>
            <span className="stat-subtext">
              out of {summary?.projects?.total || 0} total projects
            </span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrap" style={{ background: '#ede9fe', color: '#6d28d9' }}>
            ✅
          </div>
          <div className="stat-details">
            <span className="stat-label">Task Progress</span>
            <span className="stat-value">{completionPercentage}%</span>
            <span className="stat-subtext">
              {completedTasks} of {totalTasks} tasks completed
            </span>
          </div>
        </div>
      </div>

      {/* Progress Bar for Tasks */}
      <div className="progress-card">
        <div className="progress-card-header">
          <span>Overall Project Deliverable Progress</span>
          <strong>{completionPercentage}% Complete</strong>
        </div>
        <div className="progress-bar-track">
          <div
            className="progress-bar-fill"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
      </div>

      {/* Two-column overview: Upcoming Projects and Recent Tasks */}
      <div className="dashboard-columns">
        {/* Projects Section */}
        <div className="content-card">
          <div className="card-header-flex">
            <h3 className="section-title">Active Projects</h3>
            <button
              type="button"
              className="btn-link"
              onClick={() => onNavigate('projects')}
            >
              View All →
            </button>
          </div>

          {projects.length === 0 ? (
            <p className="empty-text">No active projects found.</p>
          ) : (
            <div className="dashboard-list">
              {projects.slice(0, 4).map((project) => (
                <div key={project.id} className="dashboard-list-item">
                  <div>
                    <strong className="item-title">{project.title}</strong>
                    <div className="item-meta">
                      <span>👤 {project.client_name}</span>
                      <span>📅 Due: {project.deadline}</span>
                    </div>
                  </div>
                  <div className="item-right">
                    <span className={`badge badge-${project.status.toLowerCase().replace(' ', '-')}`}>
                      {project.status}
                    </span>
                    <span className="item-budget">{formatMoney(project.budget)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tasks Section */}
        <div className="content-card">
          <div className="card-header-flex">
            <h3 className="section-title">Recent Tasks</h3>
            <button
              type="button"
              className="btn-link"
              onClick={() => onNavigate('tasks')}
            >
              Go to Kanban Board →
            </button>
          </div>

          {tasks.length === 0 ? (
            <p className="empty-text">No tasks available.</p>
          ) : (
            <div className="dashboard-list">
              {tasks.slice(0, 5).map((task) => (
                <div key={task.id} className="dashboard-list-item">
                  <div>
                    <span className="item-title">{task.title}</span>
                    <div className="item-meta">
                      <span>📁 {task.project_title}</span>
                      {task.due_date && <span>⏰ {task.due_date}</span>}
                    </div>
                  </div>
                  <div>
                    <span className={`badge badge-task-${task.status.toLowerCase().replace(' ', '-')}`}>
                      {task.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
