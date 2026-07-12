import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const label = (s) => ({ fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: '#3d675e', letterSpacing: '0.05em', textTransform: 'uppercase', margin: '0 0 10px' })
const card = { background: '#fff', border: '1px solid #e2ebe8', borderRadius: '12px', padding: '20px 24px' }

function csvExport(artikel) {
  const header = ['Bezeichnung', 'Kategorie', 'Lieferant', 'Bestand', 'Einheit', 'Mindestbestand', 'Naechstes Verfallsdatum', 'Letzter Preis']
  const rows = artikel.map(a => [
    `"${a.bezeichnung}"`, a.kategorie ?? '', `"${a.lieferant_name ?? ''}"`,
    a.bestand, a.einheit, a.mindestbestand,
    a.naechstes_verfallsdatum ?? '', a.letzter_preis ?? '',
  ])
  const csv = [header, ...rows].map(r => r.join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `werkeins_lager_${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function Statistik() {
  const [bewegungen, setBewegungen] = useState([])
  const [artikel, setArtikel] = useState([])
  const [loading, setLoading] = useState(true)
  const [zeitraum, setZeitraum] = useState(30) // Tage

  useEffect(() => {
    const seit = new Date()
    seit.setDate(seit.getDate() - zeitraum)
    Promise.all([
      supabase.from('bewegungen')
        .select('*, artikel(bezeichnung, einheit)')
        .gte('created_at', seit.toISOString())
        .order('created_at', { ascending: false })
        .limit(200),
      supabase.from('artikel_bestand').select('*'),
    ]).then(([{ data: bew }, { data: art }]) => {
      setBewegungen(bew ?? [])
      setArtikel(art ?? [])
      setLoading(false)
    })
  }, [zeitraum])

  // Prognose: durchschnittlicher Verbrauch pro Woche aus bewegungen
  function prognose(artikelId) {
    const verbraeuche = bewegungen.filter(b => b.artikel_id === artikelId && b.typ === 'verbrauch')
    if (verbraeuche.length === 0) return null
    const totalVerbrauch = verbraeuche.reduce((s, b) => s + Math.abs(b.menge), 0)
    const wochenProTag = 1 / 7
    const proWoche = (totalVerbrauch / zeitraum) * 7
    return proWoche
  }

  // Top-Verbrauch
  const verbrauchMap = {}
  bewegungen.filter(b => b.typ === 'verbrauch').forEach(b => {
    const name = b.artikel?.bezeichnung ?? b.artikel_id
    verbrauchMap[name] = (verbrauchMap[name] ?? 0) + Math.abs(b.menge)
  })
  const topVerbrauch = Object.entries(verbrauchMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  // Ausgaben pro Lieferant (Wareneingänge × letzter Preis)
  const ausgabenMap = {}
  bewegungen.filter(b => b.typ === 'wareneingang').forEach(b => {
    const art = artikel.find(a => a.id === b.artikel_id)
    if (!art?.lieferant_name || !art?.letzter_preis) return
    ausgabenMap[art.lieferant_name] = (ausgabenMap[art.lieferant_name] ?? 0) + (b.menge * art.letzter_preis)
  })

  // Artikel mit Prognose (nur wenn Verbrauchsdaten vorhanden)
  const artikelMitPrognose = artikel
    .map(a => ({ ...a, proWoche: prognose(a.id) }))
    .filter(a => a.proWoche !== null && a.proWoche > 0)
    .map(a => ({ ...a, reichtWochen: a.bestand / a.proWoche }))
    .sort((a, b) => a.reichtWochen - b.reichtWochen)

  return (
    <div>
      <div className="mb-6" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '12px', letterSpacing: '0.06em', color: '#3d675e', textTransform: 'uppercase', marginBottom: '6px' }}>
            werkeins PG · Lager
          </p>
          <h1 style={{ fontFamily: "'Geist', sans-serif", fontWeight: 300, fontSize: '32px', color: '#1a2e2a', margin: 0, lineHeight: 1.05 }}>
            Statistik
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select value={zeitraum} onChange={e => { setZeitraum(+e.target.value); setLoading(true) }}
            style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', padding: '7px 12px', border: '1px solid #d1e0db', borderRadius: '8px', background: '#fff', color: '#1a2e2a', cursor: 'pointer' }}>
            <option value={7}>Letzte 7 Tage</option>
            <option value={30}>Letzte 30 Tage</option>
            <option value={90}>Letzte 90 Tage</option>
            <option value={365}>Letztes Jahr</option>
          </select>
          <button onClick={() => csvExport(artikel)}
            style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', fontWeight: 500, padding: '7px 16px', borderRadius: '8px', border: '1px solid #d1e0db', background: '#fff', color: '#3d675e', cursor: 'pointer' }}>
            ↓ CSV Export
          </button>
        </div>
      </div>

      {loading ? (
        <p style={{ color: '#8aada5', fontFamily: "'Geist', sans-serif", fontSize: '14px' }}>Lade…</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Prognose */}
          {artikelMitPrognose.length > 0 && (
            <div style={card}>
              <p style={label()}>Reichweiten-Prognose · basierend auf Ø-Verbrauch der letzten {zeitraum} Tage</p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Geist', sans-serif", fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #f0f5f4' }}>
                    {['Artikel', 'Bestand', 'Ø/Woche', 'Reicht noch'].map(h => (
                      <th key={h} style={{ padding: '6px 12px', textAlign: 'left', fontFamily: "'Geist Mono', monospace", fontSize: '11px', fontWeight: 400, color: '#8aada5', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {artikelMitPrognose.map((a, i) => {
                    const wochen = a.reichtWochen
                    const farbe = wochen < 2 ? '#991b1b' : wochen < 4 ? '#854d0e' : '#166534'
                    const bg = wochen < 2 ? '#fee2e2' : wochen < 4 ? '#fef9c3' : '#dcfce7'
                    return (
                      <tr key={a.id} style={{ borderBottom: i < artikelMitPrognose.length - 1 ? '1px solid #f7faf9' : 'none' }}>
                        <td style={{ padding: '10px 12px', color: '#1a2e2a' }}>{a.bezeichnung}</td>
                        <td style={{ padding: '10px 12px', color: '#5a8a80', fontFamily: "'Geist Mono', monospace", fontSize: '13px' }}>{a.bestand} {a.einheit}</td>
                        <td style={{ padding: '10px 12px', color: '#5a8a80', fontFamily: "'Geist Mono', monospace", fontSize: '13px' }}>{a.proWoche.toFixed(1)} {a.einheit}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ background: bg, color: farbe, fontFamily: "'Geist Mono', monospace", fontSize: '12px', padding: '3px 10px', borderRadius: '5px' }}>
                            {wochen < 1 ? '< 1 Woche' : `~${Math.round(wochen)} Wochen`}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Top Verbrauch */}
            <div style={card}>
              <p style={label()}>Meistverbrauchte Artikel · {zeitraum} Tage</p>
              {topVerbrauch.length === 0 ? (
                <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#8aada5' }}>Noch keine Verbrauchsbuchungen.</p>
              ) : (
                topVerbrauch.map(([name, menge], i) => (
                  <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: i < topVerbrauch.length - 1 ? '1px solid #f0f5f4' : 'none' }}>
                    <span style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#1a2e2a' }}>{name}</span>
                    <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '12px', color: '#3d675e', background: '#f0f5f4', padding: '2px 8px', borderRadius: '4px' }}>{menge}</span>
                  </div>
                ))
              )}
            </div>

            {/* Ausgaben pro Lieferant */}
            <div style={card}>
              <p style={label()}>Ausgaben nach Lieferant · {zeitraum} Tage</p>
              {Object.keys(ausgabenMap).length === 0 ? (
                <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#8aada5' }}>Noch keine Wareneingänge erfasst.</p>
              ) : (
                Object.entries(ausgabenMap).sort((a, b) => b[1] - a[1]).map(([name, betrag], i, arr) => (
                  <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: i < arr.length - 1 ? '1px solid #f0f5f4' : 'none' }}>
                    <span style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#1a2e2a' }}>{name}</span>
                    <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '12px', color: '#3d675e' }}>€ {betrag.toFixed(2)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Bewegungs-Protokoll */}
          <div style={card}>
            <p style={label()}>Alle Buchungen · letzte {zeitraum} Tage ({bewegungen.length})</p>
            {bewegungen.length === 0 ? (
              <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#8aada5' }}>Noch keine Buchungen im gewählten Zeitraum.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Geist', sans-serif", fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #f0f5f4' }}>
                      {['Datum', 'Artikel', 'Typ', 'Menge', 'Notiz'].map(h => (
                        <th key={h} style={{ padding: '6px 12px', textAlign: 'left', fontFamily: "'Geist Mono', monospace", fontSize: '11px', fontWeight: 400, color: '#8aada5', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bewegungen.map((b, i) => (
                      <tr key={b.id} style={{ borderBottom: i < bewegungen.length - 1 ? '1px solid #f7faf9' : 'none' }}>
                        <td style={{ padding: '8px 12px', color: '#8aada5', whiteSpace: 'nowrap', fontFamily: "'Geist Mono', monospace", fontSize: '12px' }}>
                          {new Date(b.created_at).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ padding: '8px 12px', color: '#1a2e2a' }}>{b.artikel?.bezeichnung ?? '—'}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{
                            fontFamily: "'Geist Mono', monospace", fontSize: '11px', padding: '2px 7px', borderRadius: '4px',
                            background: b.typ === 'verbrauch' ? '#fee2e2' : b.typ === 'wareneingang' ? '#dcfce7' : '#f0f5f4',
                            color: b.typ === 'verbrauch' ? '#991b1b' : b.typ === 'wareneingang' ? '#166534' : '#3d675e',
                          }}>{b.typ}</span>
                        </td>
                        <td style={{ padding: '8px 12px', fontFamily: "'Geist Mono', monospace", fontSize: '13px', color: b.menge < 0 ? '#991b1b' : '#166534', fontWeight: 500 }}>
                          {b.menge > 0 ? '+' : ''}{b.menge} {b.artikel?.einheit ?? ''}
                        </td>
                        <td style={{ padding: '8px 12px', color: '#8aada5', fontSize: '12px' }}>{b.notiz ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  )
}
