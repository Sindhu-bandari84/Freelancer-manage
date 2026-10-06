import React, { useState } from 'react'

/**
 * Client Management Page
 * Allows freelancers to add, view, search, and update client profiles.
 */
export default function ClientsPage({ clients, onOpenModal, onEditClient }) {
  const [searchTerm, setSearchTerm] = useState('')

  // Filter clients by search query (name, company, or email)
  const filteredClients = clients.filter((c) => {
    const q = searchTerm.toLowerCase()
    return (
      c.name.toLowerCase().includes(q) ||
      (c.company && c.company.toLowerCase().includes(q)) ||
      c.email.toLowerCase().includes(q)
    )
  })

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header-flex">
        <div>
          <h2 className="page-heading">Clients Directory</h2>
          <p className="page-subheading">
            Manage your client contacts, company information, and linked accounts.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => onOpenModal('client')}
        >
          + Add New Client
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="filter-bar">
        <input
          type="text"
          className="search-input"
          placeholder="🔍 Search clients by name, company, or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <span className="results-count">
          Showing {filteredClients.length} of {clients.length} clients
        </span>
      </div>

      {/* Clients Table */}
      {filteredClients.length === 0 ? (
        <div className="empty-state">
          <p>No clients found matching your search.</p>
          {clients.length === 0 && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => onOpenModal('client')}
            >
              Add Your First Client
            </button>
          )}
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Client Name</th>
                <th>Company</th>
                <th>Email</th>
                <th>Portal Access</th>
                <th>Phone</th>
                <th>Created</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client) => (
                <tr key={client.id}>
                  <td>
                    <div className="client-cell">
                      <div className="mini-avatar">
                        {client.name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="font-semibold">{client.name}</span>
                    </div>
                  </td>
                  <td>{client.company || '—'}</td>
                  <td>
                    <a href={`mailto:${client.email}`} className="email-link">
                      {client.email}
                    </a>
                  </td>
                  <td>
                    <span className="badge" style={{ backgroundColor: '#e0f2fe', color: '#0369a1', fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                      🔑 Login: {client.email} | pwd: demo123
                    </span>
                  </td>
                  <td>{client.phone || '—'}</td>
                  <td>{client.created_at ? client.created_at.slice(0, 10) : '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      className="btn-table-action"
                      onClick={() => onEditClient(client)}
                    >
                      ✏️ Edit
                    </button>
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
