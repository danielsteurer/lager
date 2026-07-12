import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { defaultEmailVorlage } from '../lib/emailVorlage'

const TAB_BTN = (aktiv) => ({
  fontFamily: "'Geist', sans-serif", fontSize: '14px', fontWeight: aktiv ? 500 : 400,
  padding: '8px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer',
  background: aktiv ? '#3d675e' : 'transparent', color: aktiv ? '#fff' : '#5a8a80',
})

export default function Einstellungen() {
  const [tab, setTab] = useState('vorlagen') // 'vorlagen' | 'farben' | 'papierkorb' | 'buchungen'
  const [lieferanten, setLieferanten] = useState([])
  const [vorlagen, setVorlagen] = useState({})
  const [gespeichert, setGespeichert] = useState({})
  const [loading, setLoading] = useState(true)

  // Kanülen-Farben
  const [kanuleFarben, setKanuleFarben] = useState({})
  const [farbenGespeichert, setFarbenGespeichert] = useState({})
  const [farbenLoading, setFarbenLoading] = useState(true)
  const [neueGauge, setNeueGauge] = useState(false)
  const [neueGaugeNum, setNeueGaugeNum] = useState('')
  const [neueGaugeFarbe, setNeueGaugeFarbe] = useState('#9ad89e')

  // Papierkorb
  const [geloeschteArtikel, setGeloeschteArtikel] = useState([])
  const [geloeschteLieferanten, setGeloeschteLieferanten] = useState([])
  const [letzteMovements, setLetzteMovements] = useState([])
  const [papierLoading, setPapierLoading] = useState(true)

  useEffect(() => {
    supabase.from('lieferanten').select('*').is('deleted_at', null).order('name').then(({ data }) => {
      setLieferanten(data ?? [])
      const init = {}
      ;(data ?? []).forEach(l => { init[l.id] = l.email_vorlage ?? defaultEmailVorlage(l.name) })
      setVorlagen(init)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    supabase.from('kanule_gauge_config').select('*').order('sortierung').then(({ data, error }) => {
      console.log('Kanule Farben geladen:', data, error)
      if (error) { console.error('Fehler beim Laden:', error); setFarbenLoading(false); return }
      const map = {}
      ;(data ?? []).forEach(row => { map[row.gauge] = row.farbe })
      console.log('Farben Map:', map)
      setKanuleFarben(map)
      setFarbenLoading(false)
    })
  }, [])

  useEffect(() => {
    Promise.all([
      supabase.from('artikel').select('id, bezeichnung, kategorie, deleted_at').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
      supabase.from('lieferanten').select('id, name, deleted_at').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
      supabase.from('bewegungen').select('*, artikel(bezeichnung, einheit)').order('created_at', { ascending: false }).limit(30),
    ]).then(([{ data: a }, { data: l }, { data: m }]) => {
      setGeloeschteArtikel(a ?? [])
      setGeloeschteLieferanten(l ?? [])
      setLetzteMovements(m ?? [])
      setPapierLoading(false)
    })
  }, [tab])

  async function speichern(id) {
    await supabase.from('lieferanten').update({ email_vorlage: vorlagen[id] }).eq('id', id)
    setGespeichert(s => ({ ...s, [id]: true }))
    setTimeout(() => setGespeichert(s => ({ ...s, [id]: false })), 2000)
  }

  async function wiederherstellen(tabelle, id) {
    await supabase.from(tabelle).update({ deleted_at: null }).eq('id', id)
    if (tabelle === 'artikel') setGeloeschteArtikel(p => p.filter(x => x.id !== id))
    else setGeloeschteLieferanten(p => p.filter(x => x.id !== id))
  }

  async function farbenSpeichern(gauge) {
    await supabase.from('kanule_gauge_config').update({ farbe: kanuleFarben[gauge] }).eq('gauge', gauge)
    setFarbenGespeichert(s => ({ ...s, [gauge]: true }))
    setTimeout(() => setFarbenGespeichert(s => ({ ...s, [gauge]: false })), 2000)
  }

  async function gaugeHinzufuegen() {
    const g = parseInt(neueGaugeNum)
    if (!g || g < 1 || g > 50 || kanuleFarben[g]) return

    await supabase.from('kanule_gauge_config').insert({
      gauge: g,
      farbe: neueGaugeFarbe,
      sortierung: Object.keys(kanuleFarben).map(Number).sort((a, b) => a - b).pop() + 1
    })

    setKanuleFarben(k => ({ ...k, [g]: neueGaugeFarbe }))
    setNeueGauge(false)
    setNeueGaugeNum('')
    setNeueGaugeFarbe('#9ad89e')
  }

  async function endgueltigLoeschen(tabelle, id) {
    if (!confirm('Endgültig löschen? Das kann nicht rückgängig gemacht werden.')) return
    await supabase.from(tabelle).delete().eq('id', id)
    if (tabelle === 'artikel') setGeloeschteArtikel(p => p.filter(x => x.id !== id))
    else setGeloeschteLieferanten(p => p.filter(x => x.id !== id))
  }

  async function buchungStornieren(bewegung) {
    if (!confirm(`Buchung „${bewegung.typ}" (${bewegung.menge > 0 ? '+' : ''}${bewegung.menge} ${bewegung.artikel?.einheit ?? ''}) stornieren?`)) return
    const gegenmenge = -bewegung.menge

    if (bewegung.typ === 'verbrauch') {
      // Bestand wiederherstellen: neue Charge mit ursprünglicher Menge anlegen
      await supabase.from('chargen').insert({
        artikel_id: bewegung.artikel_id,
        menge: Math.abs(bewegung.menge),
        lagerort: 'lager',
        charge_nr: null,
        verfallsdatum: null,
      })
    } else if (bewegung.typ === 'wareneingang') {
      // Charge reduzieren: älteste Charge dieses Artikels nehmen
      const { data: chargen } = await supabase.from('chargen').select('*').eq('artikel_id', bewegung.artikel_id).order('created_at', { ascending: false }).limit(1)
      if (chargen?.[0]) {
        const c = chargen[0]
        const neuMenge = c.menge - Math.abs(bewegung.menge)
        if (neuMenge <= 0) await supabase.from('chargen').delete().eq('id', c.id)
        else await supabase.from('chargen').update({ menge: neuMenge }).eq('id', c.id)
      }
    }

    await supabase.from('bewegungen').insert({
      artikel_id: bewegung.artikel_id,
      menge: gegenmenge,
      typ: 'korrektur',
      notiz: `Storno von ${bewegung.typ} (${new Date(bewegung.created_at).toLocaleDateString('de-AT')})`,
    })
    setLetzteMovements(p => p.filter(m => m.id !== bewegung.id))
  }

  async function zuruecksetzen(id, name) {
    const def = defaultEmailVorlage(name)
    setVorlagen(v => ({ ...v, [id]: def }))
    await supabase.from('lieferanten').update({ email_vorlage: def }).eq('id', id)
    setGespeichert(s => ({ ...s, [id]: true }))
    setTimeout(() => setGespeichert(s => ({ ...s, [id]: false })), 2000)
  }

  // Nur Lieferanten mit E-Mail anzeigen
  const mitEmail = lieferanten.filter(l => l.email)

  return (
    <div>
      <div className="mb-6">
        <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '12px', letterSpacing: '0.06em', color: '#3d675e', textTransform: 'uppercase', marginBottom: '6px' }}>
          werkeins PG · Lager
        </p>
        <h1 style={{ fontFamily: "'Geist', sans-serif", fontWeight: 300, fontSize: '32px', color: '#1a2e2a', margin: 0, lineHeight: 1.05 }}>
          Einstellungen
        </h1>
      </div>

      {/* Tab-Leiste */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: '#f0f5f4', borderRadius: '10px', padding: '4px', width: 'fit-content', flexWrap: 'wrap' }}>
        <button onClick={() => setTab('vorlagen')} style={TAB_BTN(tab === 'vorlagen')}>E-Mail-Vorlagen</button>
        <button onClick={() => setTab('farben')} style={TAB_BTN(tab === 'farben')}>Kanülen-Farben</button>
        <button onClick={() => setTab('papierkorb')} style={TAB_BTN(tab === 'papierkorb')}>
          Papierkorb
          {(geloeschteArtikel.length + geloeschteLieferanten.length) > 0 && (
            <span style={{ marginLeft: '6px', background: '#fca5a5', color: '#991b1b', borderRadius: '10px', fontSize: '11px', padding: '1px 6px' }}>
              {geloeschteArtikel.length + geloeschteLieferanten.length}
            </span>
          )}
        </button>
        <button onClick={() => setTab('buchungen')} style={TAB_BTN(tab === 'buchungen')}>Buchungen rückgängig</button>
      </div>

      {loading && tab === 'vorlagen' ? (
        <p style={{ color: '#8aada5', fontFamily: "'Geist', sans-serif", fontSize: '14px' }}>Lade…</p>
      ) : tab === 'farben' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {farbenLoading ? (
            <p style={{ color: '#8aada5', fontFamily: "'Geist', sans-serif", fontSize: '14px' }}>Lade…</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {Object.entries(kanuleFarben).sort(([a], [b]) => Number(a) - Number(b)).map(([gauge, farbe]) => (
                <div key={gauge} style={{ background: '#fff', border: '1px solid #e2ebe8', borderRadius: '10px', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontFamily: "'Geist', sans-serif", fontWeight: 500, fontSize: '15px', color: '#1a2e2a', minWidth: '60px' }}>
                      {gauge}G
                    </span>
                    <div style={{ width: '40px', height: '40px', background: farbe, border: '2px solid #e2ebe8', borderRadius: '8px' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="color" value={farbe}
                      onChange={e => setKanuleFarben(k => ({ ...k, [gauge]: e.target.value }))}
                      style={{ width: '50px', height: '40px', border: '1px solid #d1e0db', borderRadius: '6px', cursor: 'pointer' }} />
                    {farbenGespeichert[gauge] && (
                      <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '12px', color: '#166534', background: '#dcfce7', padding: '3px 10px', borderRadius: '5px', minWidth: '75px' }}>✓ Gespeichert</span>
                    )}
                    <button onClick={() => farbenSpeichern(gauge)}
                      style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', fontWeight: 500, padding: '6px 16px', borderRadius: '7px', border: 'none', background: '#3d675e', color: '#fff', cursor: 'pointer' }}>
                      Speichern
                    </button>
                  </div>
                </div>
              ))}

              {!neueGauge && (
                <button onClick={() => setNeueGauge(true)}
                  style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', fontWeight: 500, padding: '12px 20px', borderRadius: '10px', border: '2px dashed #d1e0db', background: 'transparent', color: '#3d675e', cursor: 'pointer', alignSelf: 'flex-start' }}>
                  + Neue Gauge
                </button>
              )}

              {neueGauge && (
                <div style={{ background: '#f7faf9', border: '2px dashed #d1e0db', borderRadius: '10px', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input type="number" min="1" max="50" value={neueGaugeNum} onChange={e => setNeueGaugeNum(e.target.value)}
                    placeholder="z.B. 21" autoFocus
                    style={{ width: '60px', padding: '8px 10px', border: '1px solid #d1e0db', borderRadius: '6px', fontFamily: "'Geist', sans-serif", fontSize: '14px', color: '#1a2e2a' }} />
                  <span style={{ fontFamily: "'Geist', sans-serif", fontWeight: 500, fontSize: '15px', color: '#1a2e2a' }}>G</span>
                  <input type="color" value={neueGaugeFarbe} onChange={e => setNeueGaugeFarbe(e.target.value)}
                    style={{ width: '50px', height: '40px', border: '1px solid #d1e0db', borderRadius: '6px', cursor: 'pointer' }} />
                  <button onClick={gaugeHinzufuegen}
                    style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', fontWeight: 500, padding: '6px 16px', borderRadius: '7px', border: 'none', background: '#9ad89e', color: '#1a2e2a', cursor: 'pointer' }}>
                    Hinzufügen
                  </button>
                  <button onClick={() => setNeueGauge(false)}
                    style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', padding: '6px 10px', borderRadius: '7px', border: '1px solid #d1e0db', background: '#fff', color: '#8aada5', cursor: 'pointer' }}>
                    ✕
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : tab === 'papierkorb' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {papierLoading ? <p style={{ color: '#8aada5', fontFamily: "'Geist', sans-serif", fontSize: '14px' }}>Lade…</p> : (
            <>
              {geloeschteArtikel.length === 0 && geloeschteLieferanten.length === 0 && (
                <div style={{ background: '#fff', border: '1px solid #e2ebe8', borderRadius: '12px', padding: '40px', textAlign: 'center' }}>
                  <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '14px', color: '#8aada5', margin: 0 }}>Papierkorb ist leer.</p>
                </div>
              )}
              {[...geloeschteArtikel.map(x => ({ ...x, _typ: 'artikel' })), ...geloeschteLieferanten.map(x => ({ ...x, _typ: 'lieferanten' }))].sort((a, b) => new Date(b.deleted_at) - new Date(a.deleted_at)).map(item => (
                <div key={item.id} style={{ background: '#fff', border: '1px solid #e2ebe8', borderRadius: '10px', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <div>
                    <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '14px', color: '#1a2e2a', margin: '0 0 3px' }}>
                      {item.bezeichnung ?? item.name}
                      <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: '#8aada5', marginLeft: '8px' }}>
                        {item._typ === 'artikel' ? 'Artikel' : 'Lieferant'}
                        {item.kategorie ? ` · ${item.kategorie}` : ''}
                      </span>
                    </p>
                    <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: '#8aada5', margin: 0 }}>
                      Gelöscht: {new Date(item.deleted_at).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button onClick={() => wiederherstellen(item._typ, item.id)}
                      style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', fontWeight: 500, padding: '6px 16px', borderRadius: '7px', border: 'none', background: '#3d675e', color: '#fff', cursor: 'pointer' }}>
                      ↩ Wiederherstellen
                    </button>
                    <button onClick={() => endgueltigLoeschen(item._typ, item.id)}
                      style={{ fontFamily: "'Geist', sans-serif", fontSize: '12px', padding: '6px 12px', borderRadius: '7px', border: '1px solid #fca5a5', background: '#fff', color: '#991b1b', cursor: 'pointer' }}>
                      Endgültig löschen
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      ) : tab === 'buchungen' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#8aada5', margin: '0 0 8px' }}>
            Letzte 30 Buchungen – Stornierung erstellt eine Gegenbuchung und stellt den Bestand wieder her.
          </p>
          {papierLoading ? <p style={{ color: '#8aada5', fontFamily: "'Geist', sans-serif", fontSize: '14px' }}>Lade…</p> :
            letzteMovements.filter(m => m.typ !== 'korrektur' && m.typ !== 'umbuchung').map(m => (
              <div key={m.id} style={{ background: '#fff', border: '1px solid #e2ebe8', borderRadius: '10px', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <div>
                  <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '14px', color: '#1a2e2a', margin: '0 0 2px' }}>
                    {m.artikel?.bezeichnung ?? '—'}
                  </p>
                  <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: '#8aada5', margin: 0 }}>
                    {new Date(m.created_at).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    &nbsp;·&nbsp;
                    <span style={{ color: m.menge < 0 ? '#991b1b' : '#166534' }}>
                      {m.menge > 0 ? '+' : ''}{m.menge} {m.artikel?.einheit ?? ''}
                    </span>
                    &nbsp;·&nbsp;{m.typ}
                    {m.notiz ? ` · ${m.notiz}` : ''}
                  </p>
                </div>
                <button onClick={() => buchungStornieren(m)}
                  style={{ fontFamily: "'Geist', sans-serif", fontSize: '12px', fontWeight: 500, padding: '6px 14px', borderRadius: '7px', border: '1px solid #d1e0db', background: '#fff', color: '#3d675e', cursor: 'pointer', flexShrink: 0 }}>
                  ↩ Stornieren
                </button>
              </div>
            ))
          }
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Abschnitt: E-Mail-Vorlagen */}
          <div>
            <div style={{ marginBottom: '12px' }}>
              <h2 style={{ fontFamily: "'Geist', sans-serif", fontWeight: 500, fontSize: '18px', color: '#1a2e2a', margin: '0 0 4px' }}>
                E-Mail-Vorlagen
              </h2>
              <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#8aada5', margin: 0 }}>
                Pro Lieferant anpassbar. <strong style={{ color: '#3d675e' }}>{'{{ARTIKEL}}'}</strong> wird durch die Bestellliste ersetzt.
                Neue Lieferanten erhalten automatisch die Standard-Vorlage.
              </p>
            </div>

            {mitEmail.length === 0 && (
              <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '14px', color: '#8aada5' }}>
                Keine Lieferanten mit E-Mail-Adresse gefunden.
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {mitEmail.map(l => (
                <div key={l.id} style={{ background: '#fff', border: '1px solid #e2ebe8', borderRadius: '12px', overflow: 'hidden' }}>
                  {/* Header */}
                  <div style={{ background: '#f7faf9', padding: '12px 20px', borderBottom: '1px solid #e2ebe8', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <div>
                      <span style={{ fontFamily: "'Geist', sans-serif", fontWeight: 500, fontSize: '15px', color: '#1a2e2a' }}>{l.name}</span>
                      <span style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#8aada5', marginLeft: '8px' }}>{l.email}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {gespeichert[l.id] && (
                        <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '12px', color: '#166534', background: '#dcfce7', padding: '3px 10px', borderRadius: '5px' }}>✓ Gespeichert</span>
                      )}
                      <button onClick={() => zuruecksetzen(l.id, l.name)}
                        style={{ fontFamily: "'Geist', sans-serif", fontSize: '12px', padding: '5px 12px', borderRadius: '7px', border: '1px solid #d1e0db', background: '#fff', color: '#8aada5', cursor: 'pointer' }}>
                        Standard
                      </button>
                      <button onClick={() => speichern(l.id)}
                        style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', fontWeight: 500, padding: '6px 16px', borderRadius: '7px', border: 'none', background: '#3d675e', color: '#fff', cursor: 'pointer' }}>
                        Speichern
                      </button>
                    </div>
                  </div>

                  {/* Textarea */}
                  <div style={{ padding: '16px 20px' }}>
                    <textarea
                      value={vorlagen[l.id] ?? ''}
                      onChange={e => setVorlagen(v => ({ ...v, [l.id]: e.target.value }))}
                      rows={12}
                      style={{ width: '100%', fontFamily: "'Geist Mono', monospace", fontSize: '13px', color: '#1a2e2a', border: '1px solid #d1e0db', borderRadius: '8px', padding: '12px', resize: 'vertical', lineHeight: 1.6, outline: 'none', boxSizing: 'border-box', background: '#fafafa' }}
                    />
                    <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '12px', color: '#8aada5', margin: '6px 0 0' }}>
                      Tipp: <strong style={{ color: '#3d675e' }}>{'{{ARTIKEL}}'}</strong> muss in der Vorlage stehen – dort erscheint die Bestellliste automatisch.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
