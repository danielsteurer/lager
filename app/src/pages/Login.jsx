import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const USERS = {
  daniel: '1234',
  vanessa: '1234',
}

export default function Login() {
  const [benutzer, setBenutzer] = useState('')
  const [passwort, setPasswort] = useState('')
  const [fehler, setFehler] = useState('')
  const navigate = useNavigate()

  function handleLogin(e) {
    e.preventDefault()
    setFehler('')

    if (!benutzer.trim() || !passwort.trim()) {
      setFehler('Benutzername und Passwort erforderlich')
      return
    }

    if (USERS[benutzer.toLowerCase()] === passwort) {
      localStorage.setItem('lager_user', benutzer.toLowerCase())
      navigate('/dashboard')
    } else {
      setFehler('Ungültiger Benutzername oder Passwort')
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7faf9' }}>
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2ebe8', padding: '32px', width: '100%', maxWidth: '380px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontFamily: "'Geist', sans-serif", fontSize: '24px', fontWeight: 300, color: '#1a2e2a', margin: '0 0 8px' }}>
            werkeins · Lager
          </h1>
          <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#8aada5', margin: 0 }}>
            Inventory Management System
          </p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#5a8a80' }}>
              Benutzername
            </label>
            <input
              type="text"
              value={benutzer}
              onChange={e => setBenutzer(e.target.value)}
              placeholder="daniel oder vanessa"
              autoFocus
              style={{ padding: '10px 12px', border: '1px solid #d1e0db', borderRadius: '8px', fontFamily: "'Geist', sans-serif", fontSize: '14px', color: '#1a2e2a', outline: 'none', background: '#fff' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#5a8a80' }}>
              Passwort
            </label>
            <input
              type="password"
              value={passwort}
              onChange={e => setPasswort(e.target.value)}
              placeholder="1234"
              style={{ padding: '10px 12px', border: '1px solid #d1e0db', borderRadius: '8px', fontFamily: "'Geist', sans-serif", fontSize: '14px', color: '#1a2e2a', outline: 'none', background: '#fff' }}
            />
          </div>

          {fehler && (
            <div style={{ padding: '10px 12px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px' }}>
              <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#991b1b', margin: 0 }}>
                {fehler}
              </p>
            </div>
          )}

          <button
            type="submit"
            style={{ padding: '10px 16px', background: '#3d675e', color: '#fff', border: 'none', borderRadius: '8px', fontFamily: "'Geist', sans-serif", fontSize: '14px', fontWeight: 500, cursor: 'pointer', marginTop: '8px' }}
          >
            Login
          </button>
        </form>

        <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '11px', color: '#8aada5', margin: '20px 0 0', textAlign: 'center' }}>
          Demo: daniel / vanessa, Passwort: 1234
        </p>
      </div>
    </div>
  )
}
