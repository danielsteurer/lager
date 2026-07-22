import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function UpdatePassword() {
  const [passwort, setPasswort] = useState('')
  const [bestaetigung, setBestaetigung] = useState('')
  const [fehler, setFehler] = useState('')
  const [laden, setLaden] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setFehler('')

    if (passwort !== bestaetigung) {
      setFehler('Passwörter stimmen nicht überein')
      return
    }
    if (passwort.length < 6) {
      setFehler('Passwort muss mindestens 6 Zeichen haben')
      return
    }

    setLaden(true)
    const { error } = await supabase.auth.updateUser({ password: passwort })
    if (error) {
      setFehler('Fehler: ' + error.message)
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
            Neues Passwort
          </h1>
          <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#8aada5', margin: 0 }}>
            Bitte wähle ein neues Passwort.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#5a8a80' }}>Neues Passwort</label>
            <input
              type="password"
              value={passwort}
              onChange={e => setPasswort(e.target.value)}
              autoComplete="new-password"
              autoFocus
              style={{ padding: '10px 12px', border: '1px solid #d1e0db', borderRadius: '8px', fontFamily: "'Geist', sans-serif", fontSize: '14px', color: '#1a2e2a', outline: 'none', background: '#fff' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#5a8a80' }}>Wiederholen</label>
            <input
              type="password"
              value={bestaetigung}
              onChange={e => setBestaetigung(e.target.value)}
              autoComplete="new-password"
              style={{ padding: '10px 12px', border: '1px solid #d1e0db', borderRadius: '8px', fontFamily: "'Geist', sans-serif", fontSize: '14px', color: '#1a2e2a', outline: 'none', background: '#fff' }}
            />
          </div>

          {fehler && (
            <div style={{ padding: '10px 12px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px' }}>
              <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#991b1b', margin: 0 }}>{fehler}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={laden}
            style={{ padding: '10px 16px', background: '#3d675e', color: '#fff', border: 'none', borderRadius: '8px', fontFamily: "'Geist', sans-serif", fontSize: '14px', fontWeight: 500, cursor: laden ? 'default' : 'pointer', opacity: laden ? 0.7 : 1, marginTop: '8px' }}
          >
            {laden ? 'Speichern…' : 'Passwort speichern'}
          </button>
        </form>
      </div>
    </div>
  )
}
