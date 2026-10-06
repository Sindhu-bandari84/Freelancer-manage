import React from 'react'

/**
 * Navbar Component
 * Displays the app title, navigation tabs, current user role, and logout button.
 */
export default function Navbar({ activePage, setActivePage, user, onSignOut }) {
  // Navigation tabs definition
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'clients', label: 'Clients', icon: '👥', freelancerOnly: true },
    { id: 'projects', label: 'Projects', icon: '📁' },
    { id: 'tasks', label: 'Task Board', icon: '📋' },
    { id: 'invoices', label: 'Invoices', icon: '🧾' },
    { id: 'payments', label: 'Payments', icon: '💳' },
  ]

  // Filter items based on user role (clients cannot manage clients list)
  const visibleItems = navItems.filter((item) => {
    if (item.freelancerOnly && user?.role === 'client') return false
    return true
  })

  // Format initials for the avatar badge
  const initials = (user?.name || '')
    .split(' ')
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <header className="app-header">
      <div className="header-brand">
        <span className="brand-logo">💼</span>
        <div>
          <h1 className="brand-title">FreelancerHub</h1>
          <span className="brand-subtitle">Project & Client Management</span>
        </div>
      </div>

      <nav className="header-nav">
        {visibleItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`nav-link ${activePage === item.id ? 'active' : ''}`}
            onClick={() => setActivePage(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="header-user">
        <div className="user-avatar" title={user?.name}>{initials}</div>
        <div className="user-info">
          <span className="user-name">{user?.name}</span>
          <span className={`user-role-badge role-${user?.role}`}>
            {user?.role?.toUpperCase()}
          </span>
        </div>
        <button
          type="button"
          className="btn-signout"
          onClick={onSignOut}
          title="Sign out of your account"
        >
          Logout
        </button>
      </div>
    </header>
  )
}
