import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [passwort, setPasswort] = useState('')
  const [fehler, setFehler] = useState('')
  const [laden, setLaden] = useState(false)
  const navigate = useNavigate()

  async function handleLogin(e) {
    e.preventDefault()
    setFehler('')
    setLaden(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password: passwort })

    if (error) {
      setFehler('Ungültige E-Mail oder Passwort')
    } else {
      navigate('/dashboard')
    }
    setLaden(false)
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
              E-Mail
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="E-Mail-Adresse"
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
            disabled={laden}
            style={{ padding: '10px 16px', background: '#3d675e', color: '#fff', border: 'none', borderRadius: '8px', fontFamily: "'Geist', sans-serif", fontSize: '14px', fontWeight: 500, cursor: laden ? 'default' : 'pointer', opacity: laden ? 0.7 : 1, marginTop: '8px' }}
          >
            {laden ? 'Anmelden…' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  )
}
