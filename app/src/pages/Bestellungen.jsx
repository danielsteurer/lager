import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { defaultEmailVorlage } from '../lib/emailVorlage'

const btn = (primary) => ({
  fontFamily: "'Geist', sans-serif", fontSize: '13px', fontWeight: 500,
  padding: '7px 16px', borderRadius: '7px', border: primary ? 'none' : '1px solid #d1e0db',
  cursor: 'pointer', background: primary ? '#3d675e' : '#fff', color: primary ? '#fff' : '#3d675e',
})

export default function Bestellungen() {
  const [artikel, setArtikel] = useState([])
  const [loading, setLoading] = useState(true)
  const [mengen, setMengen] = useState({})
  const [ausgewaehlt, setAusgewaehlt] = useState(new Set())
  const [vorschau, setVorschau] = useState(null)
  const [bestellt, setBestellt] = useState({})

  const [vorlagen, setVorlagen] = useState({}) // lieferantId → email_vorlage

  useEffect(() => {
    Promise.all([
      supabase.from('artikel_bestand').select('*'),
      supabase.from('artikel').select('id, bestellmenge'),
      supabase.from('lieferanten').select('id, email_vorlage'),
    ]).then(([{ data: bestand }, { data: bm }, { data: lief }]) => {
      const bmMap = {}
      ;(bm ?? []).forEach(r => { bmMap[r.id] = r.bestellmenge })
      const alle = (bestand ?? []).map(a => ({ ...a, bestellmenge: bmMap[a.id] }))
      const relevant = alle.filter(a => a.auf_merkliste || (!a.kein_mindestbestand && a.lager_bestand <= a.mindestbestand))
      setArtikel(relevant)
      const init = {}
      relevant.forEach(a => { init[a.id] = a.bestellmenge ?? Math.max(1, (a.mindestbestand * 2) - a.lager_bestand) })
      setMengen(init)
      setAusgewaehlt(new Set(relevant.map(a => a.id)))
      const vm = {}
      ;(lief ?? []).forEach(l => { if (l.email_vorlage) vm[l.id] = l.email_vorlage })
      setVorlagen(vm)
      setLoading(false)
    })
  }, [])

  const gruppen = useMemo(() => {
    const map = {}
    artikel.forEach(a => {
      const key = a.lieferant_id ?? '__unbekannt__'
      if (!map[key]) map[key] = { name: a.lieferant_name ?? 'Unbekannter Lieferant', bestellweg: a.lieferant_bestellweg, email: a.lieferant_email, webshop: a.lieferant_webshop, artikel: [] }
      map[key].artikel.push(a)
    })
    return Object.entries(map)
  }, [artikel])

  function toggleArtikel(id) {
    setAusgewaehlt(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleGruppe(artikelListe, liefId) {
    const alleAn = artikelListe.every(a => ausgewaehlt.has(a.id))
    setAusgewaehlt(prev => {
      const next = new Set(prev)
      artikelListe.forEach(a => alleAn ? next.delete(a.id) : next.add(a.id))
      return next
    })
  }

  // Nur ausgewählte Artikel einer Gruppe
  function ausgewaehlteListe(artikelListe) {
    return artikelListe.filter(a => ausgewaehlt.has(a.id) && mengen[a.id] > 0)
  }

  function emailText(lieferantId, lieferantName, artikelListe) {
    const zeilen = ausgewaehlteListe(artikelListe)
      .map(a => `  - ${a.bezeichnung}${a.lieferant_artikelnr ? ` (Art.-Nr. ${a.lieferant_artikelnr})` : ''}: ${mengen[a.id]} ${a.einheit}`)
      .join('\n')
    const vorlage = vorlagen[lieferantId] || defaultEmailVorlage(lieferantName)
    return vorlage.replace('{{ARTIKEL}}', zeilen)
  }

  function picklisteText(artikelListe) {
    return ausgewaehlteListe(artikelListe)
      .map(a => `• ${a.bezeichnung}\n  Menge: ${mengen[a.id]} ${a.einheit}${a.lieferant_artikelnr ? `  Art.-Nr.: ${a.lieferant_artikelnr}` : ''}`)
      .join('\n\n')
  }

  async function alsBestelltMarkieren(lieferantId, artikelListe) {
    const liste = ausgewaehlteListe(artikelListe)
    if (!liste.length) return
    const { data: bestellung } = await supabase.from('bestellungen').insert({
      lieferant_id: lieferantId === '__unbekannt__' ? null : lieferantId,
      status: 'bestellt',
      bestellt_am: new Date().toISOString().split('T')[0],
    }).select('id').single()

    if (bestellung) {
      await supabase.from('bestellpositionen').insert(
        liste.map(a => ({ bestellung_id: bestellung.id, artikel_id: a.id, menge: mengen[a.id], einheit: a.einheit, preis_pro_einheit: a.letzter_preis }))
      )
      await supabase.from('artikel').update({ auf_merkliste: false }).in('id', liste.map(a => a.id))
    }
    setBestellt(b => ({ ...b, [lieferantId]: true }))
    setVorschau(null)
  }

  if (loading) return <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '12px', color: '#3d675e', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Lade…</p>

  return (
    <div>
      <div className="mb-6">
        <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '12px', letterSpacing: '0.06em', color: '#3d675e', textTransform: 'uppercase', marginBottom: '6px' }}>
          werkeins PG · Lager
        </p>
        <h1 style={{ fontFamily: "'Geist', sans-serif", fontWeight: 300, fontSize: '32px', color: '#1a2e2a', margin: 0, lineHeight: 1.05 }}>
          Nachbestellung
        </h1>
        <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '14px', color: '#8aada5', marginTop: '6px', marginBottom: 0 }}>
          Artikel unter Mindestbestand + Merkliste · Auswahl anpassen · Bestellung vorbereiten
        </p>
      </div>

      {artikel.length === 0 && (
        <div style={{ background: '#fff', border: '1px solid #e2ebe8', borderRadius: '12px', padding: '40px', textAlign: 'center' }}>
          <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '14px', color: '#8aada5', margin: 0 }}>Kein Nachbestellbedarf – alle Bestände über dem Minimum.</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {gruppen.map(([liefId, g]) => {
          const alleAn = g.artikel.every(a => ausgewaehlt.has(a.id))
          const anzahlAn = g.artikel.filter(a => ausgewaehlt.has(a.id)).length
          const istBestellt = bestellt[liefId]

          return (
            <div key={liefId} style={{ background: '#fff', border: `1px solid ${istBestellt ? '#9ad89e' : '#e2ebe8'}`, borderRadius: '12px', overflow: 'hidden' }}>

              {/* Lieferant-Header */}
              <div style={{ background: istBestellt ? '#f0fdf4' : '#f7faf9', padding: '14px 20px', borderBottom: '1px solid #e2ebe8', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {!istBestellt && (
                    <input type="checkbox" checked={alleAn} onChange={() => toggleGruppe(g.artikel, liefId)}
                      style={{ width: '15px', height: '15px', accentColor: '#3d675e', cursor: 'pointer', flexShrink: 0 }} />
                  )}
                  <div>
                    <span style={{ fontFamily: "'Geist', sans-serif", fontWeight: 500, fontSize: '15px', color: '#1a2e2a' }}>{g.name}</span>
                    <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: '#8aada5', marginLeft: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {g.bestellweg === 'online' ? 'Online-Shop' : g.bestellweg === 'email' ? 'E-Mail' : 'Telefon'}
                    </span>
                    {!istBestellt && (
                      <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: anzahlAn > 0 ? '#3d675e' : '#fca5a5', marginLeft: '8px' }}>
                        {anzahlAn} / {g.artikel.length} ausgewählt
                      </span>
                    )}
                  </div>
                </div>

                {istBestellt ? (
                  <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '12px', color: '#166534', background: '#dcfce7', padding: '4px 10px', borderRadius: '6px' }}>✓ Als bestellt markiert</span>
                ) : (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {g.bestellweg === 'online' && (
                      <button style={btn(false)} onClick={() => setVorschau({ liefId, g, typ: 'pickliste', text: picklisteText(g.artikel) })}>
                        📋 Pickliste
                      </button>
                    )}
                    {g.email && (
                      <button style={btn(false)} onClick={() => setVorschau({ liefId, g, typ: 'email', text: emailText(liefId, g.name, g.artikel) })}>
                        ✉️ E-Mail vorbereiten
                      </button>
                    )}
                    <button style={{ ...btn(true), opacity: anzahlAn === 0 ? 0.4 : 1 }}
                      disabled={anzahlAn === 0}
                      onClick={() => alsBestelltMarkieren(liefId, g.artikel)}>
                      ✓ Als bestellt markieren
                    </button>
                  </div>
                )}
              </div>

              {/* Artikelliste */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', fontFamily: "'Geist', sans-serif" }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #f0f5f4' }}>
                    {(!istBestellt ? ['', 'Artikel', 'Lager', 'Mindest', 'Bestellmenge'] : ['Artikel', 'Lager', 'Mindest', 'Bestellmenge']).map(h => (
                      <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontFamily: "'Geist Mono', monospace", fontSize: '11px', fontWeight: 400, color: '#8aada5', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {g.artikel.map((a, i) => {
                    const isAn = ausgewaehlt.has(a.id)
                    return (
                      <tr key={a.id} style={{ borderBottom: i < g.artikel.length - 1 ? '1px solid #f7faf9' : 'none', opacity: istBestellt || isAn ? 1 : 0.4 }}>
                        {!istBestellt && (
                          <td style={{ padding: '10px 16px', width: '36px' }}>
                            <input type="checkbox" checked={isAn} onChange={() => toggleArtikel(a.id)}
                              style={{ width: '15px', height: '15px', accentColor: '#3d675e', cursor: 'pointer' }} />
                          </td>
                        )}
                        <td style={{ padding: '10px 16px', color: isAn ? '#1a2e2a' : '#8aada5' }}>
                          {a.kritisch && <span style={{ color: '#3d675e', marginRight: '6px' }}>★</span>}
                          {a.bezeichnung}
                          {a.auf_merkliste && !(!a.kein_mindestbestand && a.lager_bestand <= a.mindestbestand) && (
                            <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '10px', color: '#8aada5', marginLeft: '6px' }}>Merkliste</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 16px', color: '#5a8a80', fontFamily: "'Geist Mono', monospace", fontSize: '13px' }}>
                          {a.lager_bestand} {a.einheit}
                        </td>
                        <td style={{ padding: '10px 16px', color: '#8aada5', fontFamily: "'Geist Mono', monospace", fontSize: '13px' }}>
                          {a.kein_mindestbestand ? '—' : `${a.mindestbestand} ${a.einheit}`}
                        </td>
                        <td style={{ padding: '8px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button onClick={() => setMengen(m => ({ ...m, [a.id]: Math.max(0, (m[a.id] ?? 1) - 1) }))}
                              style={{ ...btn(false), padding: '3px 9px', fontSize: '15px' }}>−</button>
                            <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '14px', color: '#1a2e2a', minWidth: '28px', textAlign: 'center' }}>
                              {mengen[a.id] ?? 0}
                            </span>
                            <button onClick={() => setMengen(m => ({ ...m, [a.id]: (m[a.id] ?? 0) + 1 }))}
                              style={{ ...btn(false), padding: '3px 9px', fontSize: '15px' }}>+</button>
                            <span style={{ fontFamily: "'Geist', sans-serif", fontSize: '12px', color: '#8aada5' }}>{a.einheit}</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        })}
      </div>

      {/* Vorschau-Modal */}
      {vorschau && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}
          onClick={e => { if (e.target === e.currentTarget) setVorschau(null) }}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '28px', width: '100%', maxWidth: '560px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: '#3d675e', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 4px' }}>
              {vorschau.typ === 'email' ? 'E-Mail Vorschau' : 'Pickliste – Online-Shop'}
            </p>
            <h2 style={{ fontFamily: "'Geist', sans-serif", fontWeight: 400, fontSize: '17px', color: '#1a2e2a', margin: '0 0 16px' }}>{vorschau.g.name}</h2>
            {vorschau.typ === 'email' && vorschau.g.email && (
              <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#3d675e', margin: '0 0 10px' }}>
                An: <a href={`mailto:${vorschau.g.email}`} style={{ color: '#3d675e' }}>{vorschau.g.email}</a>
              </p>
            )}
            <textarea readOnly value={vorschau.text}
              style={{ flex: 1, minHeight: '240px', fontFamily: "'Geist Mono', monospace", fontSize: '13px', color: '#1a2e2a', border: '1px solid #d1e0db', borderRadius: '8px', padding: '12px', resize: 'none', background: '#f7faf9', outline: 'none' }} />
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'flex-end' }}>
              <button style={btn(false)} onClick={() => setVorschau(null)}>Schließen</button>
              <button style={btn(false)} onClick={() => navigator.clipboard?.writeText(vorschau.text)}>Kopieren</button>
              {vorschau.typ === 'email' && vorschau.g.email && (
                <a href={`mailto:${vorschau.g.email}?subject=Nachbestellung%20werkeins%20PG&body=${encodeURIComponent(vorschau.text)}`}
                  style={{ ...btn(true), textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                  In E-Mail öffnen
                </a>
              )}
              <button style={btn(true)} onClick={() => alsBestelltMarkieren(vorschau.liefId, vorschau.g.artikel)}>
                ✓ Als bestellt markieren
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
