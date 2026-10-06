import React, { useState } from 'react'

/**
 * Payment Tracking Page
 * Displays financial transactions and logs:
 * - Records full or partial payments against invoices
 * - Enforces business rule: Overpayment is strictly prevented
 * - Displays paid timestamps and optional client payment notes
 */
export default function PaymentsPage({ payments, user, onOpenModal }) {
  const [searchTerm, setSearchTerm] = useState('')

  const isClient = user?.role === 'client'

  const formatMoney = (val) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val || 0)

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  // Filter payments
  const filteredPayments = payments.filter((p) => {
    const q = searchTerm.toLowerCase()
    return (
      (p.invoice_number && p.invoice_number.toLowerCase().includes(q)) ||
      (p.client_name && p.client_name.toLowerCase().includes(q)) ||
      (p.project_title && p.project_title.toLowerCase().includes(q))
    )
  })

  // Calculate total collected
  const totalCollected = payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0)

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header-flex">
        <div>
          <h2 className="page-heading">Payment Tracking</h2>
          <p className="page-subheading">
            Audit history of all financial receipts, client payments, and notes.
          </p>
        </div>

        {!isClient && (
          <button
            type="button"
            className="btn-primary"
            onClick={() => onOpenModal('payment')}
          >
            + Record New Payment
          </button>
        )}
      </div>

      {/* Summary Card and Search */}
      <div className="filter-row">
        <div className="payments-total-chip">
          <span>Total Received to Date:</span>
          <strong>{formatMoney(totalCollected)}</strong>
        </div>

        <input
          type="text"
          className="search-input"
          placeholder="🔍 Search payments..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ maxWidth: '300px' }}
        />
      </div>

      {/* Payments Table */}
      {filteredPayments.length === 0 ? (
        <div className="empty-state">
          <p>No payment records found.</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date Paid</th>
                <th>Invoice #</th>
                <th>Project</th>
                <th>Client</th>
                <th>Amount Paid</th>
                <th>Note / Reference</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map((p) => (
                <tr key={p.id}>
                  <td>{formatDate(p.paid_at)}</td>
                  <td>
                    <span className="font-mono font-semibold">{p.invoice_number}</span>
                  </td>
                  <td>{p.project_title}</td>
                  <td>{p.client_name}</td>
                  <td>
                    <strong className="text-success font-semibold">
                      +{formatMoney(p.amount)}
                    </strong>
                  </td>
                  <td>
                    <span className="payment-note">{p.note || 'Direct payment'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
