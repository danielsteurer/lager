import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const WARN_DAYS = 90

function daysUntil(dateStr) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000)
}

export default function Dashboard() {
  const [artikel, setArtikel] = useState([])
  const [loading, setLoading] = useState(true)
  const [fehler, setFehler] = useState(null)

  useEffect(() => {
    supabase
      .from('artikel_bestand')
      .select('*')
      .then(({ data, error }) => {
        if (error) { setFehler(error.message); console.error(error) }
        else setArtikel(data ?? [])
        setLoading(false)
      })
      .catch(e => { setFehler(e.message); setLoading(false) })
  }, [])

  const unterMin = artikel.filter(a => !a.kein_mindestbestand && a.lager_bestand <= a.mindestbestand)
  const baldAblauf = artikel.filter(a => {
    const d = daysUntil(a.naechstes_verfallsdatum)
    return d !== null && d <= WARN_DAYS
  }).sort((a, b) => new Date(a.naechstes_verfallsdatum) - new Date(b.naechstes_verfallsdatum))

  return (
    <div>
      <div className="mb-6">
        <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '12px', letterSpacing: '0.06em', color: '#3d675e', textTransform: 'uppercase', marginBottom: '6px' }}>
          werkeins PG · Lager
        </p>
        <h1 style={{ fontFamily: "'Geist', sans-serif", fontWeight: 300, fontSize: '32px', color: '#1a2e2a', margin: 0, lineHeight: 1.05 }}>
          Dashboard
        </h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Artikel gesamt',       value: loading ? '…' : artikel.length,   border: '#e2ebe8' },
          { label: 'Unter Mindestbestand', value: loading ? '…' : unterMin.length,  border: '#fca5a5', text: '#991b1b' },
          { label: 'Bald ablaufend',       value: loading ? '…' : baldAblauf.length,border: '#fde68a', text: '#854d0e' },
        ].map(({ label, value, border, text }) => (
          <div key={label} style={{ background: '#fff', border: `1px solid ${border}`, borderRadius: '10px', padding: '20px 24px' }}>
            <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: '#3d675e', letterSpacing: '0.05em', textTransform: 'uppercase', margin: '0 0 8px' }}>{label}</p>
            <p style={{ fontFamily: "'Geist', sans-serif", fontWeight: 300, fontSize: '36px', color: text ?? '#1a2e2a', margin: 0, lineHeight: 1 }}>{value}</p>
          </div>
        ))}
      </div>

      {!loading && (unterMin.length > 0 || baldAblauf.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Unter Mindestbestand */}
          {unterMin.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #fca5a5', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ background: '#fee2e2', padding: '12px 16px', borderBottom: '1px solid #fca5a5' }}>
                <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: '#991b1b', letterSpacing: '0.05em', textTransform: 'uppercase', margin: 0 }}>
                  Nachbestellen ({unterMin.length})
                </p>
              </div>
              {unterMin.map((a, i) => (
                <div key={a.id} style={{ padding: '10px 16px', borderBottom: i < unterMin.length - 1 ? '1px solid #fef2f2' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: "'Geist', sans-serif", fontSize: '14px', color: '#1a2e2a' }}>
                    {a.kritisch && <span style={{ color: '#3d675e', marginRight: '6px' }}>★</span>}
                    {a.bezeichnung}
                  </span>
                  <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '12px', color: '#991b1b', whiteSpace: 'nowrap', marginLeft: '12px' }}>
                    {a.bestand} / {a.mindestbestand} {a.einheit}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Bald ablaufend */}
          {baldAblauf.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #fde68a', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ background: '#fef9c3', padding: '12px 16px', borderBottom: '1px solid #fde68a' }}>
                <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: '#854d0e', letterSpacing: '0.05em', textTransform: 'uppercase', margin: 0 }}>
                  Bald ablaufend ({baldAblauf.length})
                </p>
              </div>
              {baldAblauf.map((a, i) => {
                const days = daysUntil(a.naechstes_verfallsdatum)
                return (
                  <div key={a.id} style={{ padding: '10px 16px', borderBottom: i < baldAblauf.length - 1 ? '1px solid #fefce8' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: "'Geist', sans-serif", fontSize: '14px', color: '#1a2e2a' }}>{a.bezeichnung}</span>
                    <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '12px', color: '#854d0e', whiteSpace: 'nowrap', marginLeft: '12px' }}>
                      {days}d · {new Date(a.naechstes_verfallsdatum).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

        </div>
      )}

      {fehler && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '16px 20px' }}>
          <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '12px', color: '#991b1b', margin: 0 }}>Fehler: {fehler}</p>
        </div>
      )}

      {!loading && !fehler && unterMin.length === 0 && baldAblauf.length === 0 && (
        <div style={{ background: '#fff', border: '1px solid #e2ebe8', borderRadius: '12px', padding: '32px', textAlign: 'center' }}>
          <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '14px', color: '#8aada5', margin: 0 }}>Alles im grünen Bereich.</p>
        </div>
      )}
    </div>
  )
}
