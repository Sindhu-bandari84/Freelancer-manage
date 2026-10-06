import React, { useState, useEffect } from 'react'

/**
 * Task Board Page (Kanban Board)
 * Includes required features & bonus features:
 * - Columns: To Do -> In Progress -> Completed
 * - BONUS 1: AI-Based Task Prioritization (calculates urgency, budget weight, and priority badges)
 * - BONUS 2: Time Tracking per Task (interactive stopwatch and minute logger)
 */
export default function TaskBoardPage({
  tasks,
  projects,
  user,
  onOpenModal,
  onChangeTaskStatus,
  onLogTaskTime,
}) {
  const [selectedProject, setSelectedProject] = useState('All')
  const [aiSortEnabled, setAiSortEnabled] = useState(false)
  const [activeTimerTaskId, setActiveTimerTaskId] = useState(null)
  const [timerSeconds, setTimerSeconds] = useState(0)

  const isClient = user?.role === 'client'

  // Live stopwatch effect for active timer
  useEffect(() => {
    let interval = null
    if (activeTimerTaskId !== null) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [activeTimerTaskId])

  // Stop active timer and submit tracked time
  const handleStopTimer = async (taskId) => {
    const minutes = Math.max(1, Math.round(timerSeconds / 60))
    await onLogTaskTime(taskId, minutes)
    setActiveTimerTaskId(null)
    setTimerSeconds(0)
  }

  // Format seconds to mm:ss
  const formatTimerDisplay = (totalSec) => {
    const mins = Math.floor(totalSec / 60)
    const secs = totalSec % 60
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  // Format minutes into human readable "1h 30m"
  const formatTimeSpent = (mins) => {
    if (!mins || mins === 0) return null
    const h = Math.floor(mins / 60)
    const m = mins % 60
    if (h > 0 && m > 0) return `${h}h ${m}m`
    if (h > 0) return `${h}h`
    return `${m}m`
  }

  /**
   * BONUS: AI Prioritization Algorithm
   * Scores tasks from 1 to 100 based on:
   * 1. Due date proximity (urgent = higher score)
   * 2. Project budget (higher budget projects get higher priority)
   * 3. Keywords in title (bug, fix, deploy, critical)
   */
  const computeAiPriority = (task) => {
    let score = 50
    const reasons = []

    // 1. Due date check
    if (task.due_date) {
      const today = new Date().toISOString().slice(0, 10)
      if (task.due_date < today) {
        score += 35
        reasons.push('Overdue deadline')
      } else if (task.due_date === today) {
        score += 30
        reasons.push('Due today')
      } else {
        const daysLeft = Math.ceil((new Date(task.due_date) - new Date(today)) / (1000 * 60 * 60 * 24))
        if (daysLeft <= 3) {
          score += 20
          reasons.push(`Due in ${daysLeft} days`)
        }
      }
    }

    // 2. Project budget check
    const parentProject = projects.find((p) => p.id === task.project_id)
    if (parentProject && parentProject.budget >= 3000) {
      score += 15
      reasons.push('High-value project')
    }

    // 3. Keyword check
    const text = `${task.title} ${task.description || ''}`.toLowerCase()
    if (text.includes('urgent') || text.includes('critical') || text.includes('bug') || text.includes('deploy')) {
      score += 20
      reasons.push('Critical keywords detected')
    }

    // Determine category
    if (score >= 70) {
      return { level: 'High', color: '#ef4444', bg: '#fee2e2', label: '⚡ High Priority', reason: reasons.join(' • ') || 'Urgent priority' }
    }
    if (score >= 50) {
      return { level: 'Medium', color: '#f59e0b', bg: '#fef3c7', label: '📌 Medium Priority', reason: reasons.join(' • ') || 'Standard priority' }
    }
    return { level: 'Low', color: '#6b7280', bg: '#f3f4f6', label: '☕ Low Priority', reason: reasons.join(' • ') || 'Flexible timeline' }
  }

  // Filter tasks by selected project
  const filteredTasks = tasks.filter((t) => {
    if (selectedProject === 'All') return true
    return String(t.project_id) === String(selectedProject)
  })

  // Columns for Kanban
  const columns = [
    { id: 'To Do', title: 'To Do', color: '#64748b' },
    { id: 'In Progress', title: 'In Progress', color: '#0284c7' },
    { id: 'Completed', title: 'Completed', color: '#16a34a' },
  ]

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header-flex">
        <div>
          <h2 className="page-heading">Task Board (Kanban)</h2>
          <p className="page-subheading">
            Track workflow progress: <strong>To Do → In Progress → Completed</strong>.
          </p>
        </div>

        <div className="taskboard-top-controls">
          {/* AI Prioritize Button */}
          <button
            type="button"
            className={`btn-ai-toggle ${aiSortEnabled ? 'active' : ''}`}
            onClick={() => setAiSortEnabled(!aiSortEnabled)}
            title="Toggle AI-based task urgency sorting"
          >
            🤖 {aiSortEnabled ? 'AI Priority Sorting ON' : 'Sort by AI Priority'}
          </button>

          {!isClient && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => onOpenModal('task')}
            >
              + Add New Task
            </button>
          )}
        </div>
      </div>

      {/* Project Filter */}
      <div className="filter-row">
        <div className="project-filter-group">
          <label htmlFor="kanban-project-filter" className="filter-label">
            Filter by Project:
          </label>
          <select
            id="kanban-project-filter"
            className="filter-select"
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
          >
            <option value="All">All Projects ({tasks.length} tasks)</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} ({p.client_name})
              </option>
            ))}
          </select>
        </div>

        {aiSortEnabled && (
          <span className="ai-active-indicator">
            ✨ AI Prioritization active: high-urgency and high-value project tasks ranked first.
          </span>
        )}
      </div>

      {/* Kanban Board Grid */}
      <div className="kanban-board">
        {columns.map((col) => {
          let colTasks = filteredTasks.filter((t) => t.status === col.id)

          // If AI sort enabled, sort high priority tasks first
          if (aiSortEnabled) {
            colTasks = [...colTasks].sort((a, b) => {
              const pA = computeAiPriority(a).level
              const pB = computeAiPriority(b).level
              const weights = { High: 3, Medium: 2, Low: 1 }
              return (weights[pB] || 0) - (weights[pA] || 0)
            })
          }

          return (
            <div key={col.id} className="kanban-column">
              <div className="kanban-column-header">
                <div className="col-header-left">
                  <span className="col-dot" style={{ backgroundColor: col.color }} />
                  <h3 className="col-title">{col.title}</h3>
                </div>
                <span className="col-count">{colTasks.length}</span>
              </div>

              <div className="kanban-column-body">
                {colTasks.length === 0 ? (
                  <div className="kanban-empty">No tasks in this column</div>
                ) : (
                  colTasks.map((task) => {
                    const aiPriority = computeAiPriority(task)
                    const isTimerRunning = activeTimerTaskId === task.id
                    const timeSpentFormatted = formatTimeSpent(task.time_spent_minutes)

                    return (
                      <div key={task.id} className="task-card">
                        {/* AI Priority Tag */}
                        <div className="task-card-header">
                          <span
                            className="ai-priority-badge"
                            style={{ color: aiPriority.color, backgroundColor: aiPriority.bg }}
                            title={aiPriority.reason}
                          >
                            {aiPriority.label}
                          </span>
                          {task.due_date && (
                            <span className="task-due-date">
                              📅 {task.due_date}
                            </span>
                          )}
                        </div>

                        <h4 className="task-title">{task.title}</h4>

                        {task.description && (
                          <p className="task-description">{task.description}</p>
                        )}

                        <div className="task-project-tag">
                          📁 {task.project_title}
                        </div>

                        {/* BONUS 2: Time Tracking Section */}
                        <div className="task-time-box">
                          <div className="time-display">
                            <span>⏱ Time Logged:</span>
                            <strong>{timeSpentFormatted || '0m'}</strong>
                          </div>

                          {!isClient && (
                            <div className="time-controls">
                              {isTimerRunning ? (
                                <button
                                  type="button"
                                  className="btn-timer-stop"
                                  onClick={() => handleStopTimer(task.id)}
                                >
                                  ⏹ Stop ({formatTimerDisplay(timerSeconds)})
                                </button>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    className="btn-timer-start"
                                    onClick={() => {
                                      setActiveTimerTaskId(task.id)
                                      setTimerSeconds(0)
                                    }}
                                  >
                                    ▶ Timer
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-timer-quick"
                                    onClick={() => onLogTaskTime(task.id, 30)}
                                    title="Quickly add 30 minutes"
                                  >
                                    +30m
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Move Buttons (Status Transition) */}
                        {!isClient && (
                          <div className="task-actions">
                            {col.id === 'To Do' && (
                              <button
                                type="button"
                                className="btn-move btn-move-next"
                                onClick={() => onChangeTaskStatus(task.id, 'In Progress')}
                              >
                                Start Work →
                              </button>
                            )}

                            {col.id === 'In Progress' && (
                              <>
                                <button
                                  type="button"
                                  className="btn-move btn-move-back"
                                  onClick={() => onChangeTaskStatus(task.id, 'To Do')}
                                >
                                  ← To Do
                                </button>
                                <button
                                  type="button"
                                  className="btn-move btn-move-complete"
                                  onClick={() => onChangeTaskStatus(task.id, 'Completed')}
                                >
                                  ✓ Complete
                                </button>
                              </>
                            )}

                            {col.id === 'Completed' && (
                              <button
                                type="button"
                                className="btn-move btn-move-back"
                                onClick={() => onChangeTaskStatus(task.id, 'In Progress')}
                              >
                                ↩ Re-open
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
