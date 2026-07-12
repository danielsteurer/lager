import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const btn = (primary, small) => ({
  fontFamily: "'Geist', sans-serif", fontSize: small ? '13px' : '14px', fontWeight: 500,
  padding: small ? '5px 12px' : '9px 20px', borderRadius: '8px',
  border: primary ? 'none' : '1px solid #d1e0db', cursor: 'pointer',
  background: primary ? '#3d675e' : '#fff', color: primary ? '#fff' : '#3d675e',
})
const inputStyle = {
  display: 'block', width: '100%', marginTop: '4px', padding: '9px 12px',
  border: '1px solid #d1e0db', borderRadius: '8px', outline: 'none',
  fontFamily: "'Geist', sans-serif", fontSize: '14px', color: '#1a2e2a', boxSizing: 'border-box',
}

// Gibt Stück-pro-Einheit zurück wenn erkennbar (z.B. P/100 → 100), sonst null
function stueckProEinheit(einheit) {
  const m = einheit?.match(/^P\/(\d+)/)
  return m ? parseInt(m[1]) : null
}

function einheitInfo(einheit) {
  const spE = stueckProEinheit(einheit)
  if (spE) return `1 ${einheit} = ${spE} Stück`
  return null
}

// Menge in Einheits-String umrechnen: 0.5 P/100 → "0.5 P/100 (50 Stück)"
function mengeLabel(menge, einheit) {
  if (!menge) return ''
  const spE = stueckProEinheit(einheit)
  const m = parseFloat(menge)
  if (!spE || isNaN(m)) return ''
  const stueck = Math.round(m * spE)
  return `= ${stueck} Stück`
}

const MODI = [
  { key: 'verbrauch',   label: '− Verbrauch',  color: '#fca5a5', textColor: '#991b1b' },
  { key: 'umbuchung',   label: '⇄ Umbuchung',  color: '#d1e0db', textColor: '#3d675e' },
  { key: 'wareneingang',label: '+ Wareneingang',color: '#9ad89e', textColor: '#166534' },
]

export default function BuchungModal({ artikel, modus: initialModus, onClose, onDone }) {
  const [modus, setModus] = useState(initialModus)
  const [menge, setMenge] = useState('')
  const [lagerort, setLagerort] = useState('lager')          // für Verbrauch + Wareneingang
  const [zielort, setZielort] = useState('behandlungsraum')  // für Umbuchung
  const [chargeNr, setChargeNr] = useState('')
  const [keineCharge, setKeineCharge] = useState(false)
  const [verfall, setVerfall] = useState('')
  const [keinVerfall, setKeinVerfall] = useState(false)
  const [notiz, setNotiz] = useState('')
  const [loading, setLoading] = useState(false)
  const [fehler, setFehler] = useState(null)
  const [chargen, setChargen] = useState([])

  useEffect(() => {
    supabase.from('chargen').select('*')
      .eq('artikel_id', artikel.id)
      .order('lagerort').order('verfallsdatum', { ascending: true, nullsFirst: false })
      .then(({ data }) => setChargen(data ?? []))
  }, [])

  const istVerbrauch = modus === 'verbrauch'
  const istUmbuchung = modus === 'umbuchung'
  const istWareneingang = modus === 'wareneingang'

  const jetzt = new Date().toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const schnellmengen = istWareneingang ? [1, 2, 3, 5] : [1, 2, 5, 10]
  const info = einheitInfo(artikel.einheit)

  // Chargen nach gewähltem Lagerort filtern
  const chargenAmOrt = chargen.filter(c =>
    istWareneingang ? true : c.lagerort === (istUmbuchung ? 'lager' : lagerort)
  )

  // Bestand am gewählten Ort
  const bestandAmOrt = chargenAmOrt.reduce((s, c) => s + c.menge, 0)

  async function buchen() {
    setFehler(null)
    const m = parseFloat(menge)
    if (!m || m <= 0) { setFehler('Bitte eine Menge eingeben.'); return }
    if (istWareneingang) {
      if (!keineCharge && !chargeNr.trim()) { setFehler('Bitte Charge-Nr. eingeben oder „nicht vorhanden" wählen.'); return }
      if (!keinVerfall && !verfall) { setFehler('Bitte Verfallsdatum eingeben oder „nicht vorhanden" wählen.'); return }
    }
    setLoading(true)

    if (istVerbrauch) await verbrauchBuchen(m)
    else if (istUmbuchung) await umbuchungBuchen(m)
    else await wareneingangBuchen(m)
    setLoading(false)
  }

  // FEFO innerhalb des gewählten Lagerorts
  async function verbrauchBuchen(menge) {
    const relevant = chargenAmOrt.sort((a, b) => {
      if (!a.verfallsdatum) return 1
      if (!b.verfallsdatum) return -1
      return new Date(a.verfallsdatum) - new Date(b.verfallsdatum)
    })
    let rest = menge
    for (const c of relevant) {
      if (rest <= 0) break
      const abzug = Math.min(c.menge, rest)
      rest -= abzug
      if (c.menge <= abzug) await supabase.from('chargen').delete().eq('id', c.id)
      else await supabase.from('chargen').update({ menge: c.menge - abzug }).eq('id', c.id)
      await supabase.from('bewegungen').insert({ artikel_id: artikel.id, charge_id: c.id, menge: -abzug, typ: 'verbrauch', notiz: notiz || null })
    }
    if (rest > 0) { setFehler(`Nicht genug Bestand am ${lagerort === 'lager' ? 'Lager' : 'Behandlungsraum'}. ${rest} zu viel.`); setLoading(false); return }
    onDone()
  }

  // Umbuchung: Lager → Behandlungsraum (älteste Charge zuerst, lagerort wechseln)
  async function umbuchungBuchen(menge) {
    const relevant = chargenAmOrt.sort((a, b) => {
      if (!a.verfallsdatum) return 1
      if (!b.verfallsdatum) return -1
      return new Date(a.verfallsdatum) - new Date(b.verfallsdatum)
    })
    let rest = menge
    for (const c of relevant) {
      if (rest <= 0) break
      const abzug = Math.min(c.menge, rest)
      rest -= abzug
      if (c.menge <= abzug) {
        // Ganze Charge umbuchen: lagerort ändern
        await supabase.from('chargen').update({ lagerort: zielort }).eq('id', c.id)
      } else {
        // Charge aufteilen: Rest bleibt im Lager, abgezogene Menge geht in BZ
        await supabase.from('chargen').update({ menge: c.menge - abzug }).eq('id', c.id)
        await supabase.from('chargen').insert({ artikel_id: artikel.id, charge_nr: c.charge_nr, menge: abzug, verfallsdatum: c.verfallsdatum, lagerort: zielort })
      }
      await supabase.from('bewegungen').insert({ artikel_id: artikel.id, charge_id: c.id, menge: 0, typ: 'umbuchung', notiz: `Lager → Behandlungsraum${notiz ? ': ' + notiz : ''}` })
    }
    if (rest > 0) { setFehler(`Nicht genug Lagerbestand. ${rest} ${artikel.einheit} zu viel.`); setLoading(false); return }
    onDone()
  }

  async function wareneingangBuchen(menge) {
    const { error } = await supabase.from('chargen').insert({
      artikel_id: artikel.id,
      charge_nr: keineCharge ? null : chargeNr.trim(),
      menge, verfallsdatum: keinVerfall ? null : verfall,
      lagerort,
    })
    if (error) { setFehler(error.message); setLoading(false); return }
    await supabase.from('bewegungen').insert({ artikel_id: artikel.id, menge, typ: 'wareneingang', notiz: notiz || null })
    onDone()
  }

  // Bestand-Übersicht
  const lagerBestand = chargen.filter(c => c.lagerort === 'lager').reduce((s, c) => s + c.menge, 0)
  const bzBestand = chargen.filter(c => c.lagerort === 'behandlungsraum').reduce((s, c) => s + c.menge, 0)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: '14px', padding: '28px', width: '100%', maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>

        {/* Artikel-Info */}
        <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: '#3d675e', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 4px' }}>Buchung</p>
        <h2 style={{ fontFamily: "'Geist', sans-serif", fontWeight: 400, fontSize: '17px', color: '#1a2e2a', margin: '0 0 4px', lineHeight: 1.3 }}>{artikel.bezeichnung}</h2>

        {/* Bestand je Ort */}
        <div style={{ display: 'flex', gap: '12px', margin: '8px 0 16px', flexWrap: 'wrap' }}>
          {[['Lager', lagerBestand], ['Behandlungsraum', bzBestand]].map(([ort, bestand]) => (
            <span key={ort} style={{ fontFamily: "'Geist Mono', monospace", fontSize: '12px', color: '#3d675e', background: '#f0f5f4', padding: '3px 10px', borderRadius: '5px' }}>
              {ort}: <strong>{bestand}</strong> {artikel.einheit}
            </span>
          ))}
          {info && <span style={{ fontFamily: "'Geist', sans-serif", fontSize: '12px', color: '#8aada5' }}>{info}</span>}
        </div>

        {/* Modus-Auswahl */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
          {MODI.map(m => (
            <button key={m.key} onClick={() => setModus(m.key)}
              style={{ flex: 1, padding: '8px 6px', borderRadius: '8px', border: `1px solid ${modus === m.key ? m.color : '#e2ebe8'}`, background: modus === m.key ? m.color + '30' : '#fff', color: modus === m.key ? m.textColor : '#8aada5', fontFamily: "'Geist', sans-serif", fontSize: '12px', fontWeight: modus === m.key ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {m.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Lagerort-Auswahl (Verbrauch + Wareneingang) */}
          {!istUmbuchung && (
            <div>
              <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#5a8a80', margin: '0 0 6px' }}>
                {istWareneingang ? 'Einbuchen in' : 'Abbuchen von'}
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[['lager', 'Lager'], ['behandlungsraum', 'Behandlungsraum']].map(([val, lab]) => (
                  <button key={val} onClick={() => setLagerort(val)}
                    style={{ flex: 1, padding: '8px', borderRadius: '8px', border: `1px solid ${lagerort === val ? '#3d675e' : '#d1e0db'}`, background: lagerort === val ? '#f0f5f4' : '#fff', color: lagerort === val ? '#3d675e' : '#8aada5', fontFamily: "'Geist', sans-serif", fontSize: '13px', fontWeight: lagerort === val ? 600 : 400, cursor: 'pointer' }}>
                    {lab}
                    <span style={{ display: 'block', fontSize: '11px', fontFamily: "'Geist Mono', monospace", marginTop: '2px' }}>
                      {chargen.filter(c => c.lagerort === val).reduce((s, c) => s + c.menge, 0)} {artikel.einheit}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Umbuchung: Richtung anzeigen */}
          {istUmbuchung && (
            <div style={{ background: '#f0f5f4', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
              <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '14px', color: '#1a2e2a', margin: 0 }}>
                <strong>Lager</strong> ({lagerBestand} {artikel.einheit}) → <strong>Behandlungsraum</strong>
              </p>
              <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '12px', color: '#8aada5', margin: '4px 0 0' }}>
                Älteste Charge zuerst
              </p>
            </div>
          )}

          {/* Menge */}
          <div>
            <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#5a8a80', margin: '0 0 6px' }}>
              Menge ({artikel.einheit}) *
            </p>
            {/* Schnellauswahl in Einheiten */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
              {schnellmengen.map(m => (
                <button key={m} onClick={() => setMenge(String(m))}
                  style={{ ...btn(String(m) === menge, true), minWidth: '40px' }}>{m}</button>
              ))}
              {/* Schnellauswahl in Stück wenn P/X */}
              {stueckProEinheit(artikel.einheit) && (
                <>
                  {[stueckProEinheit(artikel.einheit) / 4, stueckProEinheit(artikel.einheit) / 2].filter(n => n >= 1).map(n => {
                    const val = String(n / stueckProEinheit(artikel.einheit))
                    return (
                      <button key={n} onClick={() => setMenge(val)}
                        style={{ ...btn(menge === val, true), minWidth: '60px' }}>
                        {n} Stk
                      </button>
                    )
                  })}
                </>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input type="number" min="0.01" step="0.5" value={menge} onChange={e => setMenge(e.target.value)}
                autoFocus placeholder={`z.B. 0.5 = halbe Packung`} style={{ ...inputStyle, flex: 1, marginTop: 0 }} />
              {mengeLabel(menge, artikel.einheit) && (
                <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '13px', color: '#3d675e', background: '#f0f5f4', padding: '9px 12px', borderRadius: '8px', whiteSpace: 'nowrap' }}>
                  {mengeLabel(menge, artikel.einheit)}
                </span>
              )}
            </div>
            {stueckProEinheit(artikel.einheit) && (
              <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '12px', color: '#8aada5', margin: '4px 0 0' }}>
                Tipp: 0.5 = 50 Stück · 0.25 = 25 Stück
              </p>
            )}
          </div>

          {/* Wareneingang: Charge + Verfall */}
          {istWareneingang && (
            <>
              <div>
                <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#5a8a80', margin: '0 0 4px' }}>Charge-Nr. {keineCharge ? '' : '*'}</p>
                <input type="text" value={chargeNr} onChange={e => setChargeNr(e.target.value)}
                  disabled={keineCharge} placeholder="z.B. 50012543"
                  style={{ ...inputStyle, opacity: keineCharge ? 0.4 : 1 }} />
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: '12px', color: '#8aada5' }}>
                  <input type="checkbox" checked={keineCharge} onChange={e => { setKeineCharge(e.target.checked); setChargeNr('') }} />
                  Keine Chargennummer vorhanden
                </label>
              </div>
              <div>
                <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#5a8a80', margin: '0 0 4px' }}>Verfallsdatum {keinVerfall ? '' : '*'}</p>
                <input type="date" value={verfall} onChange={e => setVerfall(e.target.value)}
                  disabled={keinVerfall} style={{ ...inputStyle, opacity: keinVerfall ? 0.4 : 1 }} />
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: '12px', color: '#8aada5' }}>
                  <input type="checkbox" checked={keinVerfall} onChange={e => { setKeinVerfall(e.target.checked); setVerfall('') }} />
                  Kein Verfallsdatum vorhanden
                </label>
              </div>
            </>
          )}

          {/* Verbrauch: Chargen-Info */}
          {!istWareneingang && chargenAmOrt.length > 0 && (
            <div style={{ background: '#f7faf9', border: '1px solid #e2ebe8', borderRadius: '8px', padding: '10px 12px' }}>
              <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: '#3d675e', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>
                {istUmbuchung ? 'Wird umgebucht (älteste zuerst)' : 'Wird abgebucht (älteste zuerst)'}
              </p>
              {chargenAmOrt.map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'Geist', sans-serif", fontSize: '12px', color: '#5a8a80', padding: '2px 0' }}>
                  <span>{c.charge_nr ?? '(keine Charge)'}</span>
                  <span>{c.menge} {artikel.einheit}{c.verfallsdatum ? ` · MHD ${new Date(c.verfallsdatum).toLocaleDateString('de-AT', { month: '2-digit', year: 'numeric' })}` : ''}</span>
                </div>
              ))}
            </div>
          )}

          {/* Notiz */}
          <div>
            <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#5a8a80', margin: '0 0 4px' }}>Notiz (optional)</p>
            <input type="text" value={notiz} onChange={e => setNotiz(e.target.value)}
              placeholder={istUmbuchung ? 'z.B. für Patientenbehandlung' : 'z.B. Behandlung'} style={inputStyle} />
          </div>
        </div>

        {fehler && <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#991b1b', margin: '12px 0 0' }}>{fehler}</p>}
        <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: '#b0c8c2', margin: '10px 0 0' }}>Wird gebucht am {jetzt}</p>

        <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btn(false)}>Abbrechen</button>
          <button onClick={buchen} disabled={loading} style={btn(true)}>
            {loading ? '…' : istUmbuchung ? '⇄ Umbuchen' : istVerbrauch ? '− Abbuchen' : '+ Einbuchen'}
          </button>
        </div>
      </div>
    </div>
  )
}
