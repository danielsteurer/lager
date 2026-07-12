import { useState } from 'react'
import { supabase } from '../lib/supabase'

const inputStyle = {
  width: '80px', padding: '6px 10px', border: '1px solid #d1e0db',
  borderRadius: '7px', fontFamily: "'Geist Mono', monospace", fontSize: '14px',
  color: '#1a2e2a', outline: 'none', textAlign: 'center', boxSizing: 'border-box',
}

export default function BestelllisteModal({ ausgewaehlt, onClose, onDone }) {
  const [mengen, setMengen] = useState(() => {
    const init = {}
    ausgewaehlt.forEach(a => {
      init[a.id] = Math.max(1, (a.mindestbestand * 2) - a.bestand)
    })
    return init
  })
  const [loading, setLoading] = useState(false)

  async function hinzufuegen() {
    setLoading(true)
    for (const a of ausgewaehlt) {
      await supabase.from('artikel').update({
        auf_merkliste: true,
        bestellmenge: mengen[a.id] ?? 1,
      }).eq('id', a.id)
    }
    setLoading(false)
    onDone()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: '#fff', borderRadius: '14px', padding: '28px', width: '100%', maxWidth: '500px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>

        <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: '#3d675e', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 4px' }}>
          Zur Bestellliste hinzufügen
        </p>
        <h2 style={{ fontFamily: "'Geist', sans-serif", fontWeight: 400, fontSize: '18px', color: '#1a2e2a', margin: '0 0 20px' }}>
          Menge festlegen
        </h2>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {ausgewaehlt.map((a, i) => (
            <div key={a.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
              padding: '12px 0', borderBottom: i < ausgewaehlt.length - 1 ? '1px solid #f0f5f4' : 'none',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '14px', color: '#1a2e2a', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {a.bezeichnung}
                </p>
                <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: '#8aada5', margin: '2px 0 0' }}>
                  Bestand: {a.bestand} {a.einheit} · Lieferant: {a.lieferant_name}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                <button onClick={() => setMengen(m => ({ ...m, [a.id]: Math.max(1, (m[a.id] ?? 1) - 1) }))}
                  style={{ border: '1px solid #d1e0db', background: '#fff', borderRadius: '6px', width: '28px', height: '28px', cursor: 'pointer', fontSize: '15px', color: '#3d675e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                <input
                  type="number" min="1" value={mengen[a.id] ?? 1}
                  onChange={e => setMengen(m => ({ ...m, [a.id]: Math.max(1, parseInt(e.target.value) || 1) }))}
                  style={inputStyle}
                />
                <button onClick={() => setMengen(m => ({ ...m, [a.id]: (m[a.id] ?? 1) + 1 }))}
                  style={{ border: '1px solid #d1e0db', background: '#fff', borderRadius: '6px', width: '28px', height: '28px', cursor: 'pointer', fontSize: '15px', color: '#3d675e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                <span style={{ fontFamily: "'Geist', sans-serif", fontSize: '12px', color: '#8aada5', minWidth: '40px' }}>{a.einheit}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '20px', justifyContent: 'flex-end' }}>
          <button onClick={onClose}
            style={{ fontFamily: "'Geist', sans-serif", fontSize: '14px', fontWeight: 500, padding: '9px 20px', borderRadius: '8px', border: '1px solid #d1e0db', cursor: 'pointer', background: '#fff', color: '#3d675e' }}>
            Abbrechen
          </button>
          <button onClick={hinzufuegen} disabled={loading}
            style={{ fontFamily: "'Geist', sans-serif", fontSize: '14px', fontWeight: 500, padding: '9px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: '#3d675e', color: '#fff' }}>
            {loading ? '…' : `${ausgewaehlt.length} Artikel zur Bestellliste`}
          </button>
        </div>
      </div>
    </div>
  )
}
