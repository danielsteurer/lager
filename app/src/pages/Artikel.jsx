import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import BuchungModal from '../components/BuchungModal'
import BestelllisteModal from '../components/BestelllisteModal'
import ArtikelFormModal from '../components/ArtikelFormModal'

const WARN_DAYS = 90
const GAUGE_ORDER = [18, 20, 22, 24, 25, 27, 30]

function daysUntil(dateStr) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000)
}

function stueckProEinheit(einheit) {
  const m = einheit?.match(/^P\/(\d+)/)
  return m ? parseInt(m[1]) : null
}

function sortArtikelInKategorie(liste, farbMap) {
  // Wenn mindestens ein Artikel sortierung > 0 hat, dann nach sortierung sortieren
  const hasSortierung = liste.some(a => (a.sortierung ?? 0) > 0)

  return [...liste].sort((a, b) => {
    if (hasSortierung) {
      return (a.sortierung ?? 0) - (b.sortierung ?? 0)
    }

    // Ansonsten nach gauge/länge/ml sortieren
    const aHasGauge = a.gauge !== null && a.gauge !== undefined
    const bHasGauge = b.gauge !== null && b.gauge !== undefined

    if (aHasGauge && bHasGauge) {
      const aIdx = GAUGE_ORDER.indexOf(a.gauge)
      const bIdx = GAUGE_ORDER.indexOf(b.gauge)
      if (aIdx !== bIdx) return aIdx - bIdx
      return (a.länge || 0) - (b.länge || 0)
    } else if (aHasGauge) {
      return -1
    } else if (bHasGauge) {
      return 1
    }

    const aml = a.syringe_ml || 0
    const bml = b.syringe_ml || 0
    if (aml !== bml) return aml - bml
    return (b.luer_lock ? 1 : 0) - (a.luer_lock ? 1 : 0)
  })
}

// Gibt { gesamt, stueck } zurück
// gesamt = lager + bz, stueck = Stückzahl wenn P/X (sonst null)
function gesamtInfo(lager, bz, einheit) {
  const gesamt = (parseFloat(lager) || 0) + (parseFloat(bz) || 0)
  const m = einheit?.match(/^P\/(\d+)/)
  const stueck = m ? Math.round(gesamt * parseInt(m[1])) : null
  return { gesamt, stueck }
}

function StatusBadge({ lagerBestand, mindestbestand, verfallsdatum, keinMindestbestand }) {
  const days = daysUntil(verfallsdatum)
  const baldAblauf = days !== null && days <= WARN_DAYS
  if (keinMindestbestand)
    return <span style={{ background: '#f0f5f4', color: '#5a8a80', fontSize: '11px', fontFamily: "'Geist Mono', monospace", padding: '2px 8px', borderRadius: '4px' }}>Bei Bedarf</span>
  if (lagerBestand <= mindestbestand)
    return <span style={{ background: '#fee2e2', color: '#991b1b', fontSize: '11px', fontFamily: "'Geist Mono', monospace", padding: '2px 8px', borderRadius: '4px' }}>Nachbestellen</span>
  if (baldAblauf)
    return <span style={{ background: '#fef9c3', color: '#854d0e', fontSize: '11px', fontFamily: "'Geist Mono', monospace", padding: '2px 8px', borderRadius: '4px' }}>Läuft ab {days}d</span>
  return <span style={{ background: '#dcfce7', color: '#166534', fontSize: '11px', fontFamily: "'Geist Mono', monospace", padding: '2px 8px', borderRadius: '4px' }}>OK</span>
}

export default function Artikel() {
  const [artikel, setArtikel] = useState([])
  const [farben, setFarben] = useState({})
  const [loading, setLoading] = useState(true)
  const [suche, setSuche] = useState('')
  const [kategorie, setKategorie] = useState('Alle')
  const [ausgewaehlt, setAusgewaehlt] = useState(new Set())
  const [buchungModal, setBuchungModal] = useState(null)
  const [bestellModal, setBestellModal] = useState(false)
  const [artikelForm, setArtikelForm] = useState(null)
  const [draggedArtikel, setDraggedArtikel] = useState(null)
  const [kategorieWechsel, setKategorieWechsel] = useState(null)
  const [hoverRowId, setHoverRowId] = useState(null)
  const [sortierungMeldung, setSortierungMeldung] = useState(null)

  function laden() {
    supabase.from('artikel_bestand').select('*').order('kategorie')
      .then(({ data, error }) => {
        if (error) console.error(error)
        else setArtikel(data ?? [])
        setLoading(false)
      })

    supabase.from('kanule_gauge_config').select('*')
      .then(({ data, error }) => {
        if (error) console.error(error)
        else {
          const map = {}
          data?.forEach(row => { map[row.gauge] = row.farbe })
          setFarben(map)
        }
      })
  }
  useEffect(() => { laden() }, [])

  const kategorien = useMemo(() => {
    const set = new Set(artikel.map(a => a.kategorie).filter(Boolean))
    return ['Alle', ...Array.from(set).sort()]
  }, [artikel])

  const gefiltert = useMemo(() => artikel.filter(a => {
    const matchKat = kategorie === 'Alle' || a.kategorie === kategorie
    const matchSuche = !suche || a.bezeichnung.toLowerCase().includes(suche.toLowerCase())
    return matchKat && matchSuche
  }), [artikel, kategorie, suche])

  const stats = useMemo(() => ({
    gesamt: artikel.length,
    unterMin: artikel.filter(a => !a.kein_mindestbestand && a.lager_bestand <= a.mindestbestand).length,
    ablauf: artikel.filter(a => { const d = daysUntil(a.naechstes_verfallsdatum); return d !== null && d <= WARN_DAYS }).length,
  }), [artikel])

  function toggleAuswahl(id) {
    setAusgewaehlt(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function alleToggle() {
    if (ausgewaehlt.size === gefiltert.length) setAusgewaehlt(new Set())
    else setAusgewaehlt(new Set(gefiltert.map(a => a.id)))
  }

  const ausgewaehlteListe = artikel.filter(a => ausgewaehlt.has(a.id))

  function handleDragStart(a) {
    setDraggedArtikel(a)
  }

  function handleDragOver(e) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  async function handleDropOnKategorie(targetKat) {
    if (!draggedArtikel || draggedArtikel.kategorie === targetKat) {
      setDraggedArtikel(null)
      return
    }

    setKategorieWechsel({ artikel: draggedArtikel, von: draggedArtikel.kategorie, zu: targetKat })
    setDraggedArtikel(null)
  }

  async function kategorieWechselBestaetigen() {
    if (!kategorieWechsel) return
    const { artikel: a, zu } = kategorieWechsel

    await supabase.from('artikel').update({ kategorie: zu }).eq('id', a.id)
    setKategorieWechsel(null)
    setLoading(true)
    laden()
  }

  function handleDragOverRow(e, a) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'grab'
    if (draggedArtikel?.kategorie === a.kategorie) {
      setHoverRowId(a.id)
    }
  }

  function handleDragLeaveRow() {
    setHoverRowId(null)
  }

  async function handleDropRow(liste, index) {
    setHoverRowId(null)
    if (!draggedArtikel || draggedArtikel.kategorie !== liste[index]?.kategorie) {
      setDraggedArtikel(null)
      return
    }

    const draggedIdx = liste.findIndex(a => a.id === draggedArtikel.id)
    if (draggedIdx === -1 || draggedIdx === index) {
      setDraggedArtikel(null)
      return
    }

    // Neue Reihenfolge berechnen
    const newListe = [...liste]
    const [removed] = newListe.splice(draggedIdx, 1)
    newListe.splice(index, 0, removed)

    setDraggedArtikel(null)

    // Speichere Sortierung in DB für diese Kategorie
    try {
      for (let i = 0; i < newListe.length; i++) {
        await supabase.from('artikel').update({ sortierung: i }).eq('id', newListe[i].id)
      }
      setSortierungMeldung('✓ Sortierung gespeichert')
      setTimeout(() => setSortierungMeldung(null), 2000)

      // Reload alles
      setLoading(true)
      laden()
    } catch (err) {
      console.error('Fehler:', err)
      setSortierungMeldung('❌ Fehler')
      setTimeout(() => setSortierungMeldung(null), 2000)
    }
  }

  return (
    <div style={{ paddingBottom: ausgewaehlt.size > 0 ? '80px' : '0', position: 'relative' }}>
      {/* Sortierungs-Feedback */}
      {sortierungMeldung && (
        <div style={{ position: 'fixed', bottom: '32px', right: '32px', background: sortierungMeldung.startsWith('✓') ? '#dcfce7' : '#fee2e2', border: `1px solid ${sortierungMeldung.startsWith('✓') ? '#86efac' : '#fca5a5'}`, borderRadius: '8px', padding: '12px 20px', fontFamily: "'Geist', sans-serif", fontSize: '14px', color: sortierungMeldung.startsWith('✓') ? '#166534' : '#991b1b', zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          {sortierungMeldung}
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '12px', letterSpacing: '0.06em', color: '#3d675e', textTransform: 'uppercase', marginBottom: '6px' }}>
          werkeins PG · Lager
        </p>
        <h1 style={{ fontFamily: "'Geist', sans-serif", fontWeight: 300, fontSize: '32px', color: '#1a2e2a', margin: 0, lineHeight: 1.05 }}>
          Artikel
        </h1>
      </div>
      <button onClick={() => setArtikelForm(false)}
        style={{ position: 'absolute', top: '24px', right: '24px', fontFamily: "'Geist', sans-serif", fontSize: '14px', fontWeight: 500, padding: '9px 20px', borderRadius: '8px', border: 'none', background: '#3d675e', color: '#fff', cursor: 'pointer' }}>
        + Neuer Artikel
      </button>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Artikel gesamt', value: stats.gesamt, color: '#e2ebe8' },
          { label: 'Unter Mindestbestand', value: stats.unterMin, color: '#fee2e2', textColor: '#991b1b' },
          { label: 'Bald ablaufend', value: stats.ablauf, color: '#fef9c3', textColor: '#854d0e' },
        ].map(({ label, value, color, textColor }) => (
          <div key={label} style={{ background: '#fff', border: `1px solid ${color}`, borderRadius: '10px', padding: '16px 20px' }}>
            <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: '#3d675e', letterSpacing: '0.05em', textTransform: 'uppercase', margin: '0 0 6px' }}>{label}</p>
            <p style={{ fontFamily: "'Geist', sans-serif", fontWeight: 300, fontSize: '32px', color: textColor ?? '#1a2e2a', margin: 0, lineHeight: 1 }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-3 mb-4">
        <input type="text" placeholder="Suchen…" value={suche} onChange={e => setSuche(e.target.value)}
          style={{ fontFamily: "'Geist', sans-serif", fontSize: '14px', padding: '8px 12px', border: '1px solid #d1e0db', borderRadius: '8px', outline: 'none', flex: 1, background: '#fff', color: '#1a2e2a' }} />
        <select value={kategorie} onChange={e => setKategorie(e.target.value)}
          style={{ fontFamily: "'Geist', sans-serif", fontSize: '14px', padding: '8px 12px', border: '1px solid #d1e0db', borderRadius: '8px', background: '#fff', color: '#1a2e2a', cursor: 'pointer' }}>
          {kategorien.map(k => <option key={k}>{k}</option>)}
        </select>
      </div>

      {/* Tabelle – nach Kategorien gruppiert */}
      {loading ? (
        <p style={{ color: '#8aada5', fontFamily: "'Geist', sans-serif", fontSize: '14px' }}>Lade…</p>
      ) : gefiltert.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #e2ebe8', borderRadius: '12px', padding: '32px', textAlign: 'center' }}>
          <p style={{ color: '#8aada5', fontFamily: "'Geist', sans-serif", fontSize: '14px', margin: 0 }}>Keine Artikel gefunden.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Alle-Checkbox nur wenn kein Kategorie-Filter */}
          {kategorie === 'Alle' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 4px' }}>
              <input type="checkbox"
                checked={gefiltert.length > 0 && ausgewaehlt.size === gefiltert.length}
                onChange={alleToggle}
                style={{ cursor: 'pointer', accentColor: '#3d675e' }} />
              <span style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#8aada5' }}>Alle auswählen</span>
            </div>
          )}

          {/* Pro Kategorie ein Block */}
          {(() => {
            const gruppen = {}
            gefiltert.forEach(a => {
              const k = a.kategorie ?? 'Sonstiges'
              if (!gruppen[k]) gruppen[k] = []
              gruppen[k].push(a)
            })
            return Object.entries(gruppen).sort(([a], [b]) => a.localeCompare(b)).map(([kat, liste]) => (
              <div key={kat} style={{ background: '#fff', border: '1px solid #e2ebe8', borderRadius: '12px', overflow: 'hidden', opacity: draggedArtikel?.kategorie !== kat && draggedArtikel ? 0.6 : 1 }}>
                {/* Kategorie-Header */}
                <div
                  onDragOver={handleDragOver}
                  onDrop={() => handleDropOnKategorie(kat)}
                  style={{ background: '#f0f5f4', padding: '10px 16px', borderBottom: '1px solid #e2ebe8', display: 'flex', alignItems: 'center', gap: '10px', border: draggedArtikel && draggedArtikel.kategorie !== kat ? '2px dashed #3d675e' : 'none' }}>
                  <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', fontWeight: 600, color: '#3d675e', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{kat}</span>
                  <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: '#8aada5' }}>{liste.length} Artikel</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', fontFamily: "'Geist', sans-serif" }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #f0f5f4' }}>
                      <th style={{ padding: '8px 16px', width: '36px' }} />
                      {['Bezeichnung', 'Spezifikation', 'Lieferant', 'Lager', 'BZ', 'Gesamt Stk', 'Mindest', 'Verfall', 'Preis', 'Status', ''].map((h, idx) => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontFamily: "'Geist Mono', monospace", fontSize: '11px', fontWeight: 400, color: '#8aada5', letterSpacing: '0.04em', textTransform: 'uppercase', minWidth: idx === 3 ? '120px' : idx === 4 ? '100px' : idx === 9 ? '110px' : 'auto', maxWidth: idx === 1 || idx === 2 ? '110px' : 'none' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortArtikelInKategorie(liste, farben).map((a, i) => (
                      <tr key={a.id}
                        draggable
                        onDragStart={() => handleDragStart(a)}
                        onDragOver={(e) => handleDragOverRow(e, a)}
                        onDragLeave={handleDragLeaveRow}
                        onDrop={() => handleDropRow(sortArtikelInKategorie(liste, farben), i)}
                        onClick={() => toggleAuswahl(a.id)}
                        style={{ borderBottom: i < liste.length - 1 ? '1px solid #f7faf9' : 'none', borderTop: hoverRowId === a.id && draggedArtikel?.kategorie === a.kategorie ? '3px solid #3d675e' : 'none', background: ausgewaehlt.has(a.id) ? '#f0f5f4' : draggedArtikel?.id === a.id ? '#e8f5e9' : 'transparent', cursor: draggedArtikel ? 'grabbing' : 'pointer', opacity: draggedArtikel?.id === a.id ? 0.5 : 1, verticalAlign: 'middle' }}>
                        <td style={{ padding: '8px 16px' }} onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={ausgewaehlt.has(a.id)} onChange={() => toggleAuswahl(a.id)}
                            style={{ cursor: 'pointer', accentColor: '#3d675e' }} />
                        </td>
                        <td style={{ padding: '11px 16px', color: '#1a2e2a', fontWeight: a.kritisch ? 500 : 400, minHeight: '50px', verticalAlign: 'middle' }}>
                          {a.kritisch && <span style={{ color: '#3d675e', marginRight: '6px' }}>★</span>}
                          {a.bezeichnung}
                          {a.auf_merkliste && <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '10px', color: '#3d675e', background: '#f0f5f4', padding: '1px 5px', borderRadius: '3px', marginLeft: '6px' }}>Bestellt</span>}
                        </td>
                        <td style={{ padding: '11px 10px', color: '#5a8a80', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', minHeight: '50px', maxWidth: '110px' }}>
                          {a.spezifikation ? (
                            <span>{a.spezifikation}</span>
                          ) : (
                            <>
                              {a.gauge !== null && a.gauge !== undefined && (
                                <>
                                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: farben[a.gauge] || '#ccc' }} />
                                  <span>{a.gauge}G {a.länge}mm</span>
                                </>
                              )}
                              {a.syringe_ml && (
                                <span>{a.syringe_ml}ml{a.luer_lock ? ' LL' : ''}</span>
                              )}
                              {!a.gauge && !a.syringe_ml && '—'}
                            </>
                          )}
                        </td>
                        <td style={{ padding: '11px 10px', color: '#5a8a80', fontSize: '12px', minHeight: '50px', verticalAlign: 'middle', maxWidth: '110px', lineHeight: 1.3 }}>{a.lieferant_name}</td>
                        <td style={{ padding: '11px 16px', fontWeight: 500, color: (!a.kein_mindestbestand && a.lager_bestand <= a.mindestbestand) ? '#991b1b' : '#1a2e2a', minHeight: '50px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{a.lager_bestand} <span style={{ color: '#8aada5', fontWeight: 400, fontSize: '12px' }}>{a.einheit}</span></span>
                            {stueckProEinheit(a.einheit) && (
                              <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: '#8aada5' }}>
                                = {Math.round(a.lager_bestand * stueckProEinheit(a.einheit))} Stk
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '11px 16px', color: a.bz_bestand > 0 ? '#1a2e2a' : '#d1e0db', minHeight: '50px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                          {a.bz_bestand > 0 ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>{a.bz_bestand} <span style={{ color: '#8aada5', fontSize: '12px' }}>{a.einheit}</span></span>
                              {stueckProEinheit(a.einheit) && (
                                <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: '#8aada5' }}>
                                  = {Math.round(a.bz_bestand * stueckProEinheit(a.einheit))} Stk
                                </span>
                              )}
                            </div>
                          ) : '—'}
                        </td>
                        <td style={{ padding: '11px 16px', fontFamily: "'Geist Mono', monospace", fontSize: '13px', minHeight: '50px', verticalAlign: 'middle' }}>
                          {(() => {
                            const { gesamt, stueck } = gesamtInfo(a.lager_bestand, a.bz_bestand, a.einheit)
                            return (
                              <span style={{ color: '#3d675e', fontWeight: 500 }}>
                                {stueck !== null
                                  ? <>{stueck.toLocaleString('de-AT')} <span style={{ color: '#8aada5', fontWeight: 400, fontSize: '11px' }}>Stk</span></>
                                  : <>{gesamt} <span style={{ color: '#8aada5', fontWeight: 400, fontSize: '11px' }}>{a.einheit}</span></>
                                }
                              </span>
                            )
                          })()}
                        </td>
                        <td style={{ padding: '11px 16px', color: '#8aada5', minHeight: '50px', verticalAlign: 'middle' }}>{a.kein_mindestbestand ? '—' : a.mindestbestand}</td>
                        <td style={{ padding: '11px 10px', color: '#8aada5', fontSize: '13px', minHeight: '50px', verticalAlign: 'middle' }}>
                          {a.naechstes_verfallsdatum ? new Date(a.naechstes_verfallsdatum).toLocaleDateString('de-AT', { month: '2-digit', year: 'numeric' }) : '—'}
                        </td>
                        <td style={{ padding: '11px 10px', color: '#5a8a80', fontSize: '13px', fontFamily: "'Geist Mono', monospace", minHeight: '50px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                          {a.letzter_preis != null ? `€${Number(a.letzter_preis).toFixed(2)}` : '—'}
                        </td>
                        <td style={{ padding: '11px 10px', minHeight: '50px', display: 'flex', alignItems: 'center' }}>
                          <StatusBadge lagerBestand={a.lager_bestand} mindestbestand={a.mindestbestand} verfallsdatum={a.naechstes_verfallsdatum} keinMindestbestand={a.kein_mindestbestand} />
                        </td>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', minHeight: '50px', display: 'flex', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                          <button onClick={() => setArtikelForm(a)} title="Bearbeiten"
                            style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '6px', border: '1px solid #d1e0db', background: '#fff', color: '#5a8a80', cursor: 'pointer', marginRight: '4px' }}>✎</button>
                          <button onClick={() => setBuchungModal({ artikel: a, modus: 'verbrauch' })} title="Verbrauch buchen"
                            style={{ fontFamily: "'Geist Mono', monospace", fontSize: '13px', fontWeight: 600, padding: '4px 10px', borderRadius: '6px', border: '1px solid #fca5a5', background: '#fff', color: '#991b1b', cursor: 'pointer', marginRight: '4px' }}>−</button>
                          <button onClick={() => setBuchungModal({ artikel: a, modus: 'umbuchung' })} title="Lager → Behandlungsraum"
                            style={{ fontFamily: "'Geist Mono', monospace", fontSize: '13px', fontWeight: 600, padding: '4px 10px', borderRadius: '6px', border: '1px solid #d1e0db', background: '#fff', color: '#3d675e', cursor: 'pointer', marginRight: '4px' }}>⇄</button>
                          <button onClick={() => setBuchungModal({ artikel: a, modus: 'wareneingang' })} title="Wareneingang buchen"
                            style={{ fontFamily: "'Geist Mono', monospace", fontSize: '13px', fontWeight: 600, padding: '4px 10px', borderRadius: '6px', border: '1px solid #9ad89e', background: '#fff', color: '#2d6e3e', cursor: 'pointer' }}>+</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            ))
          })()}
        </div>
      )}

      {kategorieWechsel && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '32px', maxWidth: '400px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontFamily: "'Geist', sans-serif", fontSize: '18px', color: '#1a2e2a', margin: '0 0 12px' }}>
              Kategorie wechseln?
            </h3>
            <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '14px', color: '#5a8a80', margin: '0 0 20px', lineHeight: 1.5 }}>
              <strong>„{kategorieWechsel.artikel.bezeichnung}"</strong> von <strong>{kategorieWechsel.von}</strong> zu <strong>{kategorieWechsel.zu}</strong> verschieben?
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setKategorieWechsel(null)}
                style={{ fontFamily: "'Geist', sans-serif", fontSize: '14px', fontWeight: 500, padding: '9px 20px', borderRadius: '8px', border: '1px solid #d1e0db', background: '#fff', color: '#3d675e', cursor: 'pointer' }}>
                Nein
              </button>
              <button onClick={kategorieWechselBestaetigen}
                style={{ fontFamily: "'Geist', sans-serif", fontSize: '14px', fontWeight: 500, padding: '9px 20px', borderRadius: '8px', border: 'none', background: '#3d675e', color: '#fff', cursor: 'pointer' }}>
                Ja, verschieben
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Sammel-Button */}
      {ausgewaehlt.size > 0 && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 40, display: 'flex', alignItems: 'center', gap: '12px', background: '#1a2e2a', borderRadius: '12px', padding: '12px 20px', boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}>
          <span style={{ fontFamily: "'Geist', sans-serif", fontSize: '14px', color: 'rgba(255,255,255,0.7)' }}>
            {ausgewaehlt.size} {ausgewaehlt.size === 1 ? 'Artikel' : 'Artikel'} ausgewählt
          </span>
          <button onClick={() => setAusgewaehlt(new Set())}
            style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', padding: '6px 14px', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}>
            Abwählen
          </button>
          <button onClick={() => setBestellModal(true)}
            style={{ fontFamily: "'Geist', sans-serif", fontSize: '14px', fontWeight: 600, padding: '8px 20px', borderRadius: '8px', border: 'none', background: '#9ad89e', color: '#1a2e2a', cursor: 'pointer' }}>
            Bestellliste →
          </button>
        </div>
      )}

      {buchungModal && (
        <BuchungModal
          artikel={buchungModal.artikel}
          modus={buchungModal.modus}
          onClose={() => setBuchungModal(null)}
          onDone={() => { setBuchungModal(null); setLoading(true); laden() }}
        />
      )}

      {artikelForm !== null && (
        <ArtikelFormModal
          artikel={artikelForm || null}
          onClose={() => setArtikelForm(null)}
          onDone={() => { setArtikelForm(null); setLoading(true); laden() }}
        />
      )}

      {bestellModal && (
        <BestelllisteModal
          ausgewaehlt={ausgewaehlteListe}
          onClose={() => setBestellModal(false)}
          onDone={() => { setBestellModal(false); setAusgewaehlt(new Set()); laden() }}
        />
      )}
    </div>
  )
}
