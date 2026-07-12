import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import WareneingangBestellungModal from '../components/WareneingangBestellungModal'

export default function Bestellt() {
  const [bestellungen, setBestellungen] = useState([])
  const [loading, setLoading] = useState(true)
  const [aktiv, setAktiv] = useState(null) // Bestellung für Wareneingang-Modal

  async function laden() {
    const { data: best } = await supabase
      .from('bestellungen')
      .select('*')
      .eq('status', 'bestellt')
      .order('bestellt_am', { ascending: false })

    if (!best?.length) { setBestellungen([]); setLoading(false); return }

    // Positionen + Artikel dazu laden
    const { data: pos } = await supabase
      .from('bestellpositionen')
      .select('*, artikel(bezeichnung, einheit)')
      .in('bestellung_id', best.map(b => b.id))

    // Lieferantennamen laden
    const { data: lief } = await supabase
      .from('lieferanten')
      .select('id, name')
      .in('id', best.map(b => b.lieferant_id).filter(Boolean))

    const liefMap = {}
    ;(lief ?? []).forEach(l => { liefMap[l.id] = l.name })

    const posMap = {}
    ;(pos ?? []).forEach(p => {
      if (!posMap[p.bestellung_id]) posMap[p.bestellung_id] = []
      posMap[p.bestellung_id].push({
        id: p.id,
        artikel_id: p.artikel_id,
        bezeichnung: p.artikel?.bezeichnung ?? '—',
        einheit: p.artikel?.einheit ?? '',
        menge: p.menge,
      })
    })

    setBestellungen(best.map(b => ({
      ...b,
      lieferant_name: liefMap[b.lieferant_id] ?? 'Unbekannter Lieferant',
      positionen: posMap[b.id] ?? [],
    })))
    setLoading(false)
  }

  useEffect(() => { laden() }, [])

  return (
    <div>
      <div className="mb-6">
        <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '12px', letterSpacing: '0.06em', color: '#3d675e', textTransform: 'uppercase', marginBottom: '6px' }}>
          werkeins PG · Lager
        </p>
        <h1 style={{ fontFamily: "'Geist', sans-serif", fontWeight: 300, fontSize: '32px', color: '#1a2e2a', margin: 0, lineHeight: 1.05 }}>
          Bestellt
        </h1>
        <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '14px', color: '#8aada5', marginTop: '6px', marginBottom: 0 }}>
          Offene Bestellungen · Wareneingang einbuchen wenn Lieferung eintrifft
        </p>
      </div>

      {loading ? (
        <p style={{ color: '#8aada5', fontFamily: "'Geist', sans-serif", fontSize: '14px' }}>Lade…</p>
      ) : bestellungen.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #e2ebe8', borderRadius: '12px', padding: '48px', textAlign: 'center' }}>
          <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '15px', color: '#1a2e2a', margin: '0 0 6px', fontWeight: 500 }}>Keine offenen Bestellungen</p>
          <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#8aada5', margin: 0 }}>
            Bestellungen erscheinen hier sobald du sie im Tab „Bestellungen" als bestellt markierst.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {bestellungen.map(b => (
            <div key={b.id} style={{ background: '#fff', border: '1px solid #e2ebe8', borderRadius: '12px', overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ background: '#f7faf9', padding: '14px 20px', borderBottom: '1px solid #e2ebe8', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                  <span style={{ fontFamily: "'Geist', sans-serif", fontWeight: 500, fontSize: '15px', color: '#1a2e2a' }}>{b.lieferant_name}</span>
                  <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: '#8aada5', marginLeft: '10px' }}>
                    Bestellt am {new Date(b.bestellt_am).toLocaleDateString('de-AT')} · {b.positionen.length} Artikel
                  </span>
                </div>
                <button onClick={() => setAktiv(b)}
                  style={{ fontFamily: "'Geist', sans-serif", fontSize: '14px', fontWeight: 500, padding: '8px 18px', borderRadius: '8px', border: 'none', background: '#3d675e', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  ✓ Lieferung einbuchen
                </button>
              </div>

              {/* Artikel-Liste */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Geist', sans-serif", fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #f0f5f4' }}>
                    {['Artikel', 'Bestellt'].map(h => (
                      <th key={h} style={{ padding: '8px 20px', textAlign: 'left', fontFamily: "'Geist Mono', monospace", fontSize: '11px', fontWeight: 400, color: '#8aada5', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {b.positionen.map((p, i) => (
                    <tr key={p.id} style={{ borderBottom: i < b.positionen.length - 1 ? '1px solid #f7faf9' : 'none' }}>
                      <td style={{ padding: '10px 20px', color: '#1a2e2a' }}>{p.bezeichnung}</td>
                      <td style={{ padding: '10px 20px', fontFamily: "'Geist Mono', monospace", fontSize: '13px', color: '#3d675e' }}>
                        {p.menge} {p.einheit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {aktiv && (
        <WareneingangBestellungModal
          bestellung={aktiv}
          onClose={() => setAktiv(null)}
          onDone={() => { setAktiv(null); setLoading(true); laden() }}
        />
      )}
    </div>
  )
}
