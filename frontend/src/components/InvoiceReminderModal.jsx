import React, { useState } from 'react'
import Modal from './Modal'

/**
 * BONUS FEATURE: Automated Invoice Reminder Modal
 * Automatically creates a polite, professional reminder email with invoice details,
 * due date status, and amount for the client. Includes one-click copy to clipboard.
 */
export default function InvoiceReminderModal({ invoice, onClose }) {
  const [copied, setCopied] = useState(false)

  if (!invoice) return null

  // Calculate days until due or overdue
  const today = new Date()
  const dueDate = new Date(`${invoice.due_date}T00:00:00`)
  const diffTime = dueDate.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  const isOverdue = diffDays < 0
  const outstandingAmount = (invoice.amount - (invoice.amount_paid || 0)).toFixed(2)

  // Generate automated polite email template
  const emailSubject = `Gentle Reminder: Invoice ${invoice.invoice_number} for ${invoice.project_title}`
  const emailBody = `Hi ${invoice.client_name},

Hope you are having a wonderful week!

This is a friendly reminder regarding Invoice ${invoice.invoice_number} for "${invoice.project_title}", with an outstanding balance of $${outstandingAmount}.

Due Date: ${invoice.due_date} (${isOverdue ? `Overdue by ${Math.abs(diffDays)} day(s)` : `Due in ${diffDays} day(s)`})

Please let me know if you need any additional details or if the payment has already been initiated.

Thank you so much for your partnership!

Best regards,
Your Freelancer`

  const handleCopy = () => {
    navigator.clipboard.writeText(`Subject: ${emailSubject}\n\n${emailBody}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <Modal title={`Automated Reminder: ${invoice.invoice_number}`} isOpen={true} onClose={onClose}>
      <div className="reminder-header-info">
        <p>
          Generate a polite payment reminder email for <strong>{invoice.client_name}</strong>.
        </p>
        <div className={`status-pill ${isOverdue ? 'status-danger' : 'status-warning'}`}>
          {isOverdue ? `⚠️ Overdue by ${Math.abs(diffDays)} day(s)` : `⏰ Due in ${diffDays} day(s)`}
        </div>
      </div>

      <div className="form-group" style={{ marginTop: '1rem' }}>
        <label className="form-label">Subject Line</label>
        <input
          type="text"
          className="form-control"
          readOnly
          value={emailSubject}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Email Message Template</label>
        <textarea
          className="form-control"
          rows={10}
          readOnly
          value={emailBody}
          style={{ fontFamily: 'inherit', fontSize: '0.9rem', lineHeight: '1.5' }}
        />
      </div>

      <div className="modal-actions">
        <button type="button" className="btn-secondary" onClick={onClose}>
          Close
        </button>
        <button type="button" className="btn-primary" onClick={handleCopy}>
          {copied ? '✓ Copied to Clipboard!' : '📋 Copy Reminder Email'}
        </button>
      </div>
    </Modal>
  )
}
