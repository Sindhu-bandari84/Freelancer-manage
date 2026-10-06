import React from 'react'
import Modal from './Modal'

/**
 * Project History Modal
 * Displays the audit log of all actions taken on a project (creation, tasks, invoices, payments).
 */
export default function ProjectHistoryModal({ history, onClose }) {
  if (!history) return null

  const { project, entries } = history

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <Modal title={`History Log: ${project.title}`} isOpen={true} onClose={onClose}>
      <p className="history-intro">
        Audit trail tracking changes and lifecycle milestones for this project.
      </p>

      {entries.length === 0 ? (
        <p className="empty-text">No activity recorded yet for this project.</p>
      ) : (
        <div className="history-timeline">
          {entries.map((entry) => (
            <div key={entry.id} className="history-item">
              <div className="history-indicator" />
              <div className="history-content">
                <div className="history-item-header">
                  <span className="history-action-badge">{entry.action}</span>
                  <span className="history-time">{formatDate(entry.created_at)}</span>
                </div>
                <p className="history-details">{entry.details}</p>
                {entry.user_name && (
                  <span className="history-author">By: {entry.user_name}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
        <button type="button" className="btn-secondary" onClick={onClose}>
          Close Log
        </button>
      </div>
    </Modal>
  )
}
