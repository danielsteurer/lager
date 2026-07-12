import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useUndo } from '../lib/UndoContext'

const nav = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/artikel', label: 'Artikel' },
  { to: '/lieferanten', label: 'Lieferanten' },
  { to: '/bestellungen', label: 'Bestellungen' },
  { to: '/bestellt', label: 'Bestellt' },
  { to: '/statistik', label: 'Statistik' },
  { to: '/einstellungen', label: 'Einstellungen' },
]

export default function Layout() {
  const { stack, pop } = useUndo()
  const navigate = useNavigate()
  const user = localStorage.getItem('lager_user')

  function handleLogout() {
    localStorage.removeItem('lager_user')
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f7faf9' }}>
      <header style={{ background: '#fff', borderBottom: '1px solid #e2ebe8' }} className="px-6 py-3 flex items-center justify-between gap-8">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="werkeins" className="h-7 w-auto" />
          <span
            style={{ color: '#3d675e', fontFamily: "'Geist Mono', monospace", fontSize: '11px', letterSpacing: '0.08em' }}
            className="uppercase"
          >
            Lager
          </span>
        </div>

        <nav className="flex gap-1 ml-4">
          {nav.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              style={({ isActive }) => ({
                fontFamily: "'Geist', sans-serif",
                fontWeight: isActive ? 500 : 400,
                fontSize: '14px',
                padding: '6px 14px',
                borderRadius: '6px',
                textDecoration: 'none',
                transition: 'background 0.15s, color 0.15s',
                color: isActive ? '#fff' : '#3d675e',
                background: isActive ? '#3d675e' : 'transparent',
              })}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#8aada5' }}>
            {user}
          </span>
          <button
            onClick={pop}
            disabled={stack.length === 0}
            title={stack.length > 0 ? `Rückgängig: ${stack[stack.length - 1].label}` : 'Nichts rückgängig zu machen'}
            style={{
              fontFamily: "'Geist', sans-serif",
              fontSize: '13px',
              padding: '6px 14px',
              borderRadius: '6px',
              border: '1px solid #d1e0db',
              background: stack.length > 0 ? '#fff' : '#f7faf9',
              color: stack.length > 0 ? '#3d675e' : '#bcc8c3',
              cursor: stack.length > 0 ? 'pointer' : 'default',
              transition: 'all 0.15s',
              fontWeight: 500,
            }}
          >
            ↩ {stack.length > 0 ? stack[stack.length - 1].label : 'Rückgängig'}
          </button>
          <button
            onClick={handleLogout}
            style={{
              fontFamily: "'Geist', sans-serif",
              fontSize: '13px',
              padding: '6px 14px',
              borderRadius: '6px',
              border: '1px solid #fca5a5',
              background: '#fff',
              color: '#991b1b',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Logout
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-6xl w-full mx-auto">
        <Outlet />
      </main>
    </div>
  )
}
