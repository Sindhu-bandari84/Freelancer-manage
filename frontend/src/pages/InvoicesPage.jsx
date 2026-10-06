import React, { useState } from 'react'

/**
 * Invoice Management Page
 * Handles project billing records:
 * - Creates invoices for projects with completed work
 * - Enforces business rule: Total invoices <= project budget
 * - Tracks invoice status: Pending -> Partially Paid -> Paid
 * - BONUS: Automated invoice reminder generator
 */
export default function InvoicesPage({
  invoices,
  user,
  onOpenModal,
  onOpenReminder,
  onQuickPay,
}) {
  const [filterStatus, setFilterStatus] = useState('All')
  const [searchTerm, setSearchTerm] = useState('')

  const isClient = user?.role === 'client'

  const formatMoney = (val) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val || 0)

  // Filter invoices
  const filteredInvoices = invoices.filter((inv) => {
    const matchesStatus = filterStatus === 'All' || inv.status === filterStatus
    const q = searchTerm.toLowerCase()
    const matchesSearch =
      inv.invoice_number.toLowerCase().includes(q) ||
      inv.project_title.toLowerCase().includes(q) ||
      inv.client_name.toLowerCase().includes(q)
    return matchesStatus && matchesSearch
  })

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header-flex">
        <div>
          <h2 className="page-heading">Invoice Management</h2>
          <p className="page-subheading">
            Generate invoices for completed deliverables and track payment fulfillment.
          </p>
        </div>

        {!isClient && (
          <button
            type="button"
            className="btn-primary"
            onClick={() => onOpenModal('invoice')}
          >
            + Create New Invoice
          </button>
        )}
      </div>

      {/* Filter and Search */}
      <div className="filter-row">
        <div className="status-tabs">
          {['All', 'Pending', 'Partially Paid', 'Paid'].map((st) => (
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
          placeholder="🔍 Search invoices by #, project, client..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ maxWidth: '300px' }}
        />
      </div>

      {/* Invoices Table */}
      {filteredInvoices.length === 0 ? (
        <div className="empty-state">
          <p>No invoices found matching the current filters.</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Project</th>
                <th>Client</th>
                <th>Total Amount</th>
                <th>Amount Paid</th>
                <th>Due Date</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map((inv) => {
                const paid = Number(inv.amount_paid) || 0
                const balance = inv.amount - paid
                const isPaidFull = inv.status === 'Paid'

                return (
                  <tr key={inv.id}>
                    <td>
                      <span className="font-mono font-semibold">{inv.invoice_number}</span>
                    </td>
                    <td>{inv.project_title}</td>
                    <td>{inv.client_name}</td>
                    <td className="font-semibold">{formatMoney(inv.amount)}</td>
                    <td>
                      <span className={paid > 0 ? 'text-success' : 'text-muted'}>
                        {formatMoney(paid)}
                      </span>
                      {balance > 0 && paid > 0 && (
                        <span className="balance-subtext"> ({formatMoney(balance)} left)</span>
                      )}
                    </td>
                    <td>{inv.due_date}</td>
                    <td>
                      <span className={`badge badge-inv-${inv.status.toLowerCase().replace(' ', '-')}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="table-actions-inline">
                        {/* BONUS: Automated Reminder */}
                        {!isPaidFull && !isClient && (
                          <button
                            type="button"
                            className="btn-table-action btn-reminder"
                            onClick={() => onOpenReminder(inv)}
                            title="Generate automated email reminder"
                          >
                            🔔 Reminder
                          </button>
                        )}

                        {/* Quick Record Payment button */}
                        {!isPaidFull && !isClient && (
                          <button
                            type="button"
                            className="btn-table-action btn-pay"
                            onClick={() => onQuickPay(inv)}
                            title="Record a payment towards this invoice"
                          >
                            💳 Record Pay
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
