import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Passwort für den geschützten Finanzbereich. Zum Ändern einfach hier anpassen.
const FINANZEN_PASSWORT = 'werkeins2026'

const AUSGABE_KATEGORIEN = ['Versicherungen', 'Software & Systeme', 'Personal / Gehälter', 'Miete & Betriebskosten', 'Sonstiges']
const EINNAHME_KATEGORIEN = ['Fitnessabos', 'Mieten', 'Sonstiges']
const INTERVALLE = [
  { key: 'monatlich', label: 'Monatlich', faktor: 1 },
  { key: 'quartalsweise', label: 'Quartalsweise', faktor: 1 / 3 },
  { key: 'jaehrlich', label: 'Jährlich', faktor: 1 / 12 },
]

function monatlichBetrag(p) {
  const f = INTERVALLE.find(i => i.key === p.intervall)?.faktor ?? 1
  return (p.betrag || 0) * f
}

// Dein Anteil an einer Ausgabe (monatlich)
function anteilMonatlich(p) {
  const anteil = p.anteil_prozent != null ? p.anteil_prozent : 100
  return monatlichBetrag(p) * (anteil / 100)
}

const ANTEIL_BUTTONS = [
  { label: '100 %', wert: 100 },
  { label: '½', wert: 50 },
  { label: '⅓', wert: 33.3333 },
  { label: '⅔', wert: 66.6667 },
]

const MWST_BUTTONS = [20, 13, 10, 0]

function mwstProz(x) { return x.mwst_prozent != null ? x.mwst_prozent : 20 }
// Netto = Brutto / (1 + MwSt)
function nettoVonBrutto(brutto, mwst) { return brutto / (1 + (mwst || 0) / 100) }
// Netto-Anteil (monatlich) einer Einnahme
function nettoMonatlich(p) { return nettoVonBrutto(anteilMonatlich(p), mwstProz(p)) }

// Fitness-Abo-Klassen: Laufzeit in Monaten + Preis pro Monat (inkl. MwSt)
const FITNESS_KLASSEN = {
  1: { label: 'Klasse 1', monate: 3, preis: 79 },
  2: { label: 'Klasse 2', monate: 6, preis: 74 },
  3: { label: 'Klasse 3', monate: 12, preis: 69 },
}

function aboEnde(a) {
  const monate = FITNESS_KLASSEN[a.klasse]?.monate ?? 0
  const d = new Date(a.startdatum)
  d.setMonth(d.getMonth() + monate)
  return d
}
function aboAktiv(a) {
  const now = new Date()
  const start = new Date(a.startdatum)
  return start <= now && now < aboEnde(a)
}
function aboVollMonatlich(a) {
  const preis = FITNESS_KLASSEN[a.klasse]?.preis ?? 0
  return (a.anzahl || 0) * preis
}
function aboMonatlich(a) {
  const anteil = a.anteil_prozent != null ? a.anteil_prozent : 100
  return aboAktiv(a) ? aboVollMonatlich(a) * (anteil / 100) : 0
}
// Netto-Anteil (monatlich) eines Abos
function aboNettoMonatlich(a) { return nettoVonBrutto(aboMonatlich(a), mwstProz(a)) }

// Monatsbereich für Prognose (offset 0 = aktueller Monat)
function monatsBereich(offset) {
  const jetzt = new Date()
  const start = new Date(jetzt.getFullYear(), jetzt.getMonth() + offset, 1)
  const ende = new Date(jetzt.getFullYear(), jetzt.getMonth() + offset + 1, 1) // exklusiv
  return { start, ende, label: start.toLocaleDateString('de-AT', { month: 'long', year: 'numeric' }) }
}
// Abo im Zeitraum aktiv? (Laufzeit überschneidet den Monat)
function aboAktivImZeitraum(a, start, ende) {
  return new Date(a.startdatum) < ende && aboEnde(a) > start
}
function aboNettoImMonat(a, start, ende) {
  if (!aboAktivImZeitraum(a, start, ende)) return 0
  const anteil = a.anteil_prozent != null ? a.anteil_prozent : 100
  return nettoVonBrutto(aboVollMonatlich(a) * (anteil / 100), mwstProz(a))
}

// Fällt für diesen Posten (Intervall + nächste Zahlung) eine Zahlung in den Monat [start, ende)?
function zahlungImMonat(intervall, naechsteZahlung, start, ende) {
  const step = intervall === 'quartalsweise' ? 3 : intervall === 'jaehrlich' ? 12 : 1
  const basis = naechsteZahlung ? new Date(naechsteZahlung) : new Date()
  let d = new Date(basis.getFullYear(), basis.getMonth(), 1) // auf Monatsanfang normieren
  // vorspulen, bis die Zahlung im oder nach dem Fenster liegt
  let schutz = 0
  while (d < start && schutz < 240) { d.setMonth(d.getMonth() + step); schutz++ }
  return d >= start && d < ende
}
// Anteiliger Betrag einer einzelnen Zahlung (nicht normalisiert)
function betragAnteil(p) {
  const anteil = p.anteil_prozent != null ? p.anteil_prozent : 100
  return (p.betrag || 0) * (anteil / 100)
}

const euro = (n) => '€' + n.toLocaleString('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const inp = {
  width: '100%', padding: '9px 12px', border: '1px solid #d1e0db', borderRadius: '8px',
  fontFamily: "'Geist', sans-serif", fontSize: '14px', color: '#1a2e2a', boxSizing: 'border-box',
}
const lbl = { fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#5a8a80', display: 'block', marginBottom: '6px' }
const btn = (primary, disabled) => ({
  fontFamily: "'Geist', sans-serif", fontSize: '13px', fontWeight: 500,
  padding: '8px 16px', borderRadius: '7px', border: primary ? 'none' : '1px solid #d1e0db',
  cursor: disabled ? 'not-allowed' : 'pointer',
  background: disabled ? '#e2ebe8' : (primary ? '#3d675e' : '#fff'),
  color: disabled ? '#8aada5' : (primary ? '#fff' : '#3d675e'), opacity: disabled ? 0.5 : 1,
})

export default function Finanzen() {
  const [entsperrt, setEntsperrt] = useState(() => sessionStorage.getItem('finanzen_unlocked') === '1')
  const [pwEingabe, setPwEingabe] = useState('')
  const [pwFehler, setPwFehler] = useState(false)

  const [posten, setPosten] = useState([])
  const [abos, setAbos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // { typ } für neu, oder posten-Objekt zum Bearbeiten
  const [aboModal, setAboModal] = useState(null) // true für neu, oder abo-Objekt zum Bearbeiten
  const [prognoseMonate, setPrognoseMonate] = useState(3)

  useEffect(() => { if (entsperrt) laden() }, [entsperrt])

  async function laden() {
    const [{ data: fp }, { data: fa }] = await Promise.all([
      supabase.from('finanzposten').select('*').order('created_at', { ascending: false }),
      supabase.from('fitnessabos').select('*').order('startdatum', { ascending: false }),
    ])
    setPosten(fp ?? [])
    setAbos(fa ?? [])
    setLoading(false)
  }

  function entsperren(e) {
    e?.preventDefault()
    if (pwEingabe === FINANZEN_PASSWORT) {
      sessionStorage.setItem('finanzen_unlocked', '1')
      setEntsperrt(true)
      setPwFehler(false)
    } else {
      setPwFehler(true)
    }
  }

  function sperren() {
    sessionStorage.removeItem('finanzen_unlocked')
    setEntsperrt(false)
    setPwEingabe('')
  }

  // Passwort-Schleuse
  if (!entsperrt) {
    return (
      <div style={{ maxWidth: '400px', margin: '60px auto', background: '#fff', border: '1px solid #e2ebe8', borderRadius: '14px', padding: '32px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔒</div>
          <h1 style={{ fontFamily: "'Geist', sans-serif", fontWeight: 400, fontSize: '22px', color: '#1a2e2a', margin: 0 }}>Finanzen</h1>
          <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#8aada5', margin: '6px 0 0' }}>Geschützter Bereich – bitte Passwort eingeben</p>
        </div>
        <form onSubmit={entsperren}>
          <input type="password" value={pwEingabe} onChange={e => { setPwEingabe(e.target.value); setPwFehler(false) }}
            placeholder="Passwort" autoFocus style={{ ...inp, borderColor: pwFehler ? '#fca5a5' : '#d1e0db' }} />
          {pwFehler && <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '12px', color: '#991b1b', margin: '6px 0 0' }}>Falsches Passwort</p>}
          <button type="submit" style={{ ...btn(true, false), width: '100%', marginTop: '14px', padding: '10px' }}>Entsperren</button>
        </form>
      </div>
    )
  }

  if (loading) return <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '12px', color: '#3d675e', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Lade…</p>

  const einnahmen = posten.filter(p => p.typ === 'einnahme')
  const ausgaben = posten.filter(p => p.typ === 'ausgabe')
  // Einnahmen: brutto (dein Anteil) + netto (nach MwSt-Abfuhr)
  const einnahmenBruttoMon = einnahmen.reduce((s, p) => s + anteilMonatlich(p), 0) + abos.reduce((s, a) => s + aboMonatlich(a), 0)
  const einnahmenNettoMon = einnahmen.reduce((s, p) => s + nettoMonatlich(p), 0) + abos.reduce((s, a) => s + aboNettoMonatlich(a), 0)
  const mwstAbzufuehrenMon = einnahmenBruttoMon - einnahmenNettoMon
  // Ausgaben: brutto = echte Kosten (unecht steuerbefreit, keine Vorsteuer-Rückholung)
  const ausgabenMonVoll = ausgaben.reduce((s, p) => s + monatlichBetrag(p), 0)
  const ausgabenMon = ausgaben.reduce((s, p) => s + anteilMonatlich(p), 0) // dein Anteil, brutto
  const ergebnisMon = einnahmenNettoMon - ausgabenMon

  // Prognose: pro Monat nach echter Fälligkeit (Intervall + nächste Zahlung), Abos nach Laufzeit
  const prognose = Array.from({ length: prognoseMonate }, (_, off) => {
    const { start, ende, label } = monatsBereich(off)
    const einNetto =
      einnahmen.reduce((s, p) => s + (zahlungImMonat(p.intervall, p.naechste_zahlung, start, ende) ? nettoVonBrutto(betragAnteil(p), mwstProz(p)) : 0), 0)
      + abos.reduce((s, a) => s + aboNettoImMonat(a, start, ende), 0)
    const ausg = ausgaben.reduce((s, p) => s + (zahlungImMonat(p.intervall, p.naechste_zahlung, start, ende) ? betragAnteil(p) : 0), 0)
    return { label, einNetto, ausg, ergebnis: einNetto - ausg }
  })

  // Fitness-Abos nach Klasse gruppieren
  const aboGruppen = { 1: [], 2: [], 3: [] }
  abos.forEach(a => { if (aboGruppen[a.klasse]) aboGruppen[a.klasse].push(a) })

  // Ausgaben nach Kategorie gruppieren
  const ausgabenGruppen = {}
  ausgaben.forEach(p => {
    const k = p.kategorie || 'Sonstiges'
    if (!ausgabenGruppen[k]) ausgabenGruppen[k] = []
    ausgabenGruppen[k].push(p)
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '12px', letterSpacing: '0.06em', color: '#3d675e', textTransform: 'uppercase', marginBottom: '6px' }}>werkeins PG · Finanzen</p>
          <h1 style={{ fontFamily: "'Geist', sans-serif", fontWeight: 300, fontSize: '32px', color: '#1a2e2a', margin: 0, lineHeight: 1.05 }}>Ausgaben & Einnahmen</h1>
        </div>
        <button onClick={sperren} style={btn(false, false)}>🔒 Sperren</button>
      </div>

      {/* Übersichts-Karten */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '28px' }}>
        <SummaryCard label="Einnahmen netto / Monat" wert={euro(einnahmenNettoMon)} farbe="#166534" bg="#f0fdf4" border="#bbf7d0" sub={'brutto ' + euro(einnahmenBruttoMon) + ' · MwSt ' + euro(mwstAbzufuehrenMon) + ' abführen'} />
        <SummaryCard label="Deine Ausgaben / Monat" wert={euro(ausgabenMon)} farbe="#991b1b" bg="#fef2f2" border="#fecaca" sub={'brutto · von ' + euro(ausgabenMonVoll) + ' gesamt'} />
        <SummaryCard
          label="Ergebnis / Monat"
          wert={(ergebnisMon >= 0 ? '+' : '−') + euro(Math.abs(ergebnisMon)).slice(1)}
          farbe={ergebnisMon >= 0 ? '#166534' : '#991b1b'}
          bg={ergebnisMon >= 0 ? '#f0fdf4' : '#fef2f2'}
          border={ergebnisMon >= 0 ? '#bbf7d0' : '#fecaca'}
          sub={'netto − Ausgaben · ' + (ergebnisMon >= 0 ? '+' : '−') + euro(Math.abs(ergebnisMon * 12)).slice(1) + ' / Jahr'}
        />
      </div>

      {/* Prognose */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 10px', flexWrap: 'wrap', gap: '8px' }}>
          <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', letterSpacing: '0.06em', color: '#5a8a80', textTransform: 'uppercase', margin: 0 }}>Prognose · nächste {prognoseMonate} Monate</p>
          <button onClick={() => setPrognoseMonate(prognoseMonate === 3 ? 12 : 3)} style={{ ...btn(false, false), padding: '6px 14px' }}>
            {prognoseMonate === 3 ? '12 Monate anzeigen ▾' : 'Weniger anzeigen ▴'}
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
          {prognose.map((m, i) => (
            <div key={i} style={{ background: '#fff', border: '1px solid #e2ebe8', borderRadius: '12px', padding: '16px 18px' }}>
              <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '14px', fontWeight: 600, color: '#1a2e2a', margin: '0 0 10px', textTransform: 'capitalize' }}>{m.label}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontFamily: "'Geist', sans-serif", fontSize: '12px', color: '#8aada5' }}>Einnahmen netto</span>
                <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '12px', color: '#166534', fontWeight: 600 }}>{euro(m.einNetto)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontFamily: "'Geist', sans-serif", fontSize: '12px', color: '#8aada5' }}>Ausgaben</span>
                <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '12px', color: '#991b1b', fontWeight: 600 }}>−{euro(m.ausg).slice(1)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid #f0f5f4' }}>
                <span style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#1a2e2a', fontWeight: 500 }}>Ergebnis</span>
                <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '14px', fontWeight: 700, color: m.ergebnis >= 0 ? '#166534' : '#991b1b' }}>
                  {(m.ergebnis >= 0 ? '+' : '−') + euro(Math.abs(m.ergebnis)).slice(1)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <button onClick={() => setModal({ typ: 'ausgabe' })} style={btn(true, false)}>+ Ausgabe</button>
        <button onClick={() => setAboModal(true)} style={{ ...btn(false, false), borderColor: '#9ad89e', color: '#166534' }}>+ Fitnessabo</button>
        <button onClick={() => setModal({ typ: 'einnahme' })} style={{ ...btn(false, false), borderColor: '#9ad89e', color: '#166534' }}>+ Sonstige Einnahme</button>
      </div>

      {/* Einnahmen */}
      <Abschnitt titel="Einnahmen" akzent="#166534" summe={'netto ' + euro(einnahmenNettoMon) + ' / Monat'}>
        {/* Fitness-Abos nach Klasse */}
        {[1, 2, 3].map(kl => {
          const liste = aboGruppen[kl]
          const def = FITNESS_KLASSEN[kl]
          const aktivAnzahl = liste.filter(aboAktiv).reduce((s, a) => s + (a.anzahl || 0), 0)
          const klSumme = liste.reduce((s, a) => s + aboMonatlich(a), 0)
          return (
            <div key={kl} style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 4px' }}>
                <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', fontWeight: 600, color: '#5a8a80', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  {def.label} · {def.monate} Monate · {euro(def.preis)}/Mon · {aktivAnzahl} aktiv
                </span>
                <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: '#166534', fontWeight: 600 }}>{euro(klSumme)} / Monat</span>
              </div>
              {liste.length === 0
                ? <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '12px', color: '#c8d4d0', margin: '0 0 0 4px' }}>Noch keine Abos in dieser Klasse</p>
                : liste.map(a => <AboZeile key={a.id} a={a} onEdit={() => setAboModal(a)} onDelete={laden} />)}
            </div>
          )
        })}

        {/* Sonstige Einnahmen */}
        {einnahmen.length > 0 && (
          <div style={{ marginTop: '4px' }}>
            <div style={{ padding: '6px 4px' }}>
              <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', fontWeight: 600, color: '#5a8a80', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Sonstige Einnahmen</span>
            </div>
            {einnahmen.map(p => <PostenZeile key={p.id} p={p} onEdit={() => setModal(p)} onDelete={laden} />)}
          </div>
        )}
      </Abschnitt>

      {/* Ausgaben nach Kategorie */}
      <div style={{ marginTop: '28px' }}>
        <Abschnitt titel="Ausgaben" akzent="#991b1b" summe={'dein Anteil ' + euro(ausgabenMon) + ' / Monat'}>
          {ausgaben.length === 0 && <LeerHinweis text="Noch keine Ausgaben erfasst" />}
          {Object.entries(ausgabenGruppen).sort(([a], [b]) => a.localeCompare(b)).map(([kat, liste]) => {
            const katSumme = liste.reduce((s, p) => s + anteilMonatlich(p), 0)
            return (
              <div key={kat} style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 4px' }}>
                  <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', fontWeight: 600, color: '#5a8a80', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{kat}</span>
                  <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: '#8aada5' }}>dein Anteil {euro(katSumme)} / Monat</span>
                </div>
                {liste.map(p => <PostenZeile key={p.id} p={p} onEdit={() => setModal(p)} onDelete={laden} />)}
              </div>
            )
          })}
        </Abschnitt>
      </div>

      {modal && (
        <FinanzModal
          posten={modal.id ? modal : null}
          typ={modal.typ || modal.typ}
          onClose={() => setModal(null)}
          onDone={() => { setModal(null); laden() }}
        />
      )}
      {aboModal && (
        <FitnessAboModal
          abo={aboModal.id ? aboModal : null}
          onClose={() => setAboModal(null)}
          onDone={() => { setAboModal(null); laden() }}
        />
      )}
    </div>
  )
}

function AboZeile({ a, onEdit, onDelete }) {
  async function loeschen() {
    if (!confirm('Dieses Abo wirklich löschen?')) return
    await supabase.from('fitnessabos').delete().eq('id', a.id)
    onDelete()
  }
  const def = FITNESS_KLASSEN[a.klasse]
  const aktiv = aboAktiv(a)
  const ende = aboEnde(a)
  const zukunft = new Date(a.startdatum) > new Date()
  const anteil = a.anteil_prozent != null ? a.anteil_prozent : 100
  const voll = aboVollMonatlich(a)
  const anteilBetrag = voll * (anteil / 100)
  const geteilt = anteil < 100
  return (
    <div style={{ background: '#fff', border: '1px solid #e2ebe8', borderRadius: '10px', padding: '12px 16px', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', opacity: aktiv ? 1 : 0.6 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '14px', fontWeight: 500, color: '#1a2e2a', margin: 0 }}>
          {a.anzahl}× {def.label}
          <span style={{ marginLeft: '8px', fontFamily: "'Geist Mono', monospace", fontSize: '10px', padding: '2px 7px', borderRadius: '10px', background: aktiv ? '#dcfce7' : zukunft ? '#fef9c3' : '#f0f0f0', color: aktiv ? '#166534' : zukunft ? '#854d0e' : '#8aada5' }}>
            {aktiv ? 'aktiv' : zukunft ? 'startet später' : 'beendet'}
          </span>
        </p>
        <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '12px', color: '#8aada5', margin: '3px 0 0' }}>
          Start: {new Date(a.startdatum).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' })} · Ende: {ende.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          {geteilt && <> · dein Anteil {anteil % 1 === 0 ? anteil : anteil.toFixed(1)} %</>}
          {a.notiz && <> · {a.notiz}</>}
        </p>
      </div>
      <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
        <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '15px', fontWeight: 600, color: aktiv ? '#166534' : '#8aada5', margin: 0 }}>{euro(anteilBetrag)}<span style={{ fontSize: '11px', color: '#8aada5', fontWeight: 400 }}> / Mon.</span></p>
        {geteilt && <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: '#8aada5', margin: '2px 0 0' }}>von {euro(voll)} gesamt</p>}
      </div>
      <div style={{ display: 'flex', gap: '6px' }}>
        <button onClick={onEdit} title="Bearbeiten" style={{ ...btn(false, false), padding: '6px 10px' }}>✎</button>
        <button onClick={loeschen} title="Löschen" style={{ ...btn(false, false), padding: '6px 10px', borderColor: '#fca5a5', color: '#991b1b' }}>🗑</button>
      </div>
    </div>
  )
}

function FitnessAboModal({ abo, onClose, onDone }) {
  const isNeu = !abo
  const [klasse, setKlasse] = useState(abo?.klasse ?? 1)
  const [anzahl, setAnzahl] = useState(abo?.anzahl ?? 1)
  const [startdatum, setStartdatum] = useState(abo?.startdatum ?? new Date().toISOString().split('T')[0])
  const [anteil, setAnteil] = useState(abo?.anteil_prozent != null ? abo.anteil_prozent : 33.3333)
  const [mwst, setMwst] = useState(abo?.mwst_prozent != null ? abo.mwst_prozent : 20)
  const [notiz, setNotiz] = useState(abo?.notiz ?? '')
  const [saving, setSaving] = useState(false)
  const [fehler, setFehler] = useState(null)

  const def = FITNESS_KLASSEN[klasse]
  const gueltig = anzahl >= 1 && startdatum
  const anteilFaktor = (parseFloat(anteil) || 100) / 100
  const bruttoAnteil = anzahl * def.preis * anteilFaktor
  const nettoAnteil = nettoVonBrutto(bruttoAnteil, parseFloat(mwst) || 0)

  async function speichern() {
    if (!gueltig) return
    setSaving(true)
    setFehler(null)
    const data = { klasse: parseInt(klasse), anzahl: parseInt(anzahl), startdatum, anteil_prozent: parseFloat(anteil) || 100, mwst_prozent: parseFloat(mwst) || 0, notiz: notiz.trim() || null }
    const result = isNeu
      ? await supabase.from('fitnessabos').insert(data)
      : await supabase.from('fitnessabos').update(data).eq('id', abo.id)
    setSaving(false)
    if (result.error) { setFehler(result.error.message); return }
    onDone()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '480px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ padding: '24px 28px 16px' }}>
          <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: '#166534', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 4px' }}>{isNeu ? 'Neues Fitnessabo' : 'Fitnessabo bearbeiten'}</p>
          <h2 style={{ fontFamily: "'Geist', sans-serif", fontWeight: 400, fontSize: '20px', color: '#1a2e2a', margin: 0 }}>Fitnessabo</h2>
        </div>

        <div style={{ overflowY: 'auto', padding: '0 28px', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Klasse */}
          <div>
            <label style={lbl}>Abo-Klasse</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[1, 2, 3].map(kl => {
                const d = FITNESS_KLASSEN[kl]
                const aktiv = klasse == kl
                return (
                  <button key={kl} type="button" onClick={() => setKlasse(kl)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderRadius: '10px', border: `1px solid ${aktiv ? '#166534' : '#d1e0db'}`, background: aktiv ? '#f0fdf4' : '#fff', cursor: 'pointer', textAlign: 'left' }}>
                    <div>
                      <span style={{ fontFamily: "'Geist', sans-serif", fontSize: '14px', fontWeight: 600, color: aktiv ? '#166534' : '#1a2e2a' }}>{d.label}</span>
                      <span style={{ fontFamily: "'Geist', sans-serif", fontSize: '12px', color: '#8aada5', marginLeft: '8px' }}>{d.monate} Monate Laufzeit</span>
                    </div>
                    <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '14px', fontWeight: 600, color: aktiv ? '#166534' : '#5a8a80' }}>{euro(d.preis)}/Mon</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>Anzahl</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button onClick={() => setAnzahl(Math.max(1, anzahl - 1))} style={{ padding: '8px 12px', border: '1px solid #d1e0db', borderRadius: '6px', cursor: 'pointer', background: '#fff' }}>−</button>
                <input type="number" min="1" value={anzahl} onChange={e => setAnzahl(Math.max(1, parseInt(e.target.value) || 1))}
                  style={{ ...inp, textAlign: 'center' }} />
                <button onClick={() => setAnzahl(anzahl + 1)} style={{ padding: '8px 12px', border: '1px solid #d1e0db', borderRadius: '6px', cursor: 'pointer', background: '#fff' }}>+</button>
              </div>
            </div>
            <div>
              <label style={lbl}>Startdatum *</label>
              <input type="date" value={startdatum} onChange={e => setStartdatum(e.target.value)} style={inp} />
            </div>
          </div>

          {/* Anteil */}
          <div>
            <label style={lbl}>Dein Anteil</label>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
              {ANTEIL_BUTTONS.map(b => {
                const aktiv = Math.abs((parseFloat(anteil) || 0) - b.wert) < 0.01
                return (
                  <button key={b.label} type="button" onClick={() => setAnteil(b.wert)}
                    style={{ padding: '7px 16px', borderRadius: '8px', border: `1px solid ${aktiv ? '#3d675e' : '#d1e0db'}`, background: aktiv ? '#f0f5f4' : '#fff', color: aktiv ? '#3d675e' : '#8aada5', fontFamily: "'Geist', sans-serif", fontSize: '14px', fontWeight: aktiv ? 600 : 400, cursor: 'pointer' }}>
                    {b.label}
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="number" step="0.01" min="0" max="100" value={anteil} onChange={e => setAnteil(e.target.value)} style={{ ...inp, width: '120px' }} />
              <span style={{ fontFamily: "'Geist', sans-serif", fontSize: '14px', color: '#8aada5' }}>%</span>
            </div>
          </div>

          {/* MwSt */}
          <div>
            <label style={lbl}>MwSt (im Preis enthalten)</label>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
              {MWST_BUTTONS.map(m => {
                const aktiv = Math.abs((parseFloat(mwst) || 0) - m) < 0.01
                return (
                  <button key={m} type="button" onClick={() => setMwst(m)}
                    style={{ padding: '7px 16px', borderRadius: '8px', border: `1px solid ${aktiv ? '#3d675e' : '#d1e0db'}`, background: aktiv ? '#f0f5f4' : '#fff', color: aktiv ? '#3d675e' : '#8aada5', fontFamily: "'Geist', sans-serif", fontSize: '14px', fontWeight: aktiv ? 600 : 400, cursor: 'pointer' }}>
                    {m} %
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="number" step="0.1" min="0" max="100" value={mwst} onChange={e => setMwst(e.target.value)} style={{ ...inp, width: '120px' }} />
              <span style={{ fontFamily: "'Geist', sans-serif", fontSize: '14px', color: '#8aada5' }}>%</span>
            </div>
          </div>

          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '12px 14px' }}>
            <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#166534', margin: 0 }}>
              Netto (dein Anteil) / Monat: <strong>{euro(nettoAnteil)}</strong>
            </p>
            <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '12px', color: '#5a8a80', margin: '4px 0 0' }}>
              brutto {euro(bruttoAnteil)}{anteilFaktor < 1 && <> (von {euro(anzahl * def.preis)} gesamt)</>} · MwSt abzuführen {euro(bruttoAnteil - nettoAnteil)}
            </p>
            <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '12px', color: '#5a8a80', margin: '4px 0 0' }}>
              {anzahl}× {euro(def.preis)} · Laufzeit {def.monate} Monate
              {startdatum && <> · bis {(() => { const d = new Date(startdatum); d.setMonth(d.getMonth() + def.monate); return d.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' }) })()}</>}
            </p>
          </div>

          <div>
            <label style={lbl}>Notiz (optional)</label>
            <input value={notiz} onChange={e => setNotiz(e.target.value)} placeholder="z.B. Firmenkunde" style={inp} />
          </div>
        </div>

        {fehler && (
          <div style={{ margin: '0 28px', padding: '10px 14px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px' }}>
            <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#991b1b', margin: 0 }}>Fehler: {fehler}</p>
          </div>
        )}

        <div style={{ padding: '16px 28px 24px', display: 'flex', gap: '8px', borderTop: '1px solid #f0f5f4' }}>
          <button onClick={onClose} style={{ ...btn(false, false), flex: 1, padding: '10px' }}>Abbrechen</button>
          <button onClick={speichern} disabled={!gueltig || saving} style={{ ...btn(true, !gueltig || saving), flex: 1, padding: '10px' }}>
            {saving ? '…' : isNeu ? 'Hinzufügen' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ label, wert, farbe, bg, border, sub }) {
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: '12px', padding: '18px 20px' }}>
      <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: farbe, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px', opacity: 0.8 }}>{label}</p>
      <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '26px', fontWeight: 600, color: farbe, margin: 0 }}>{wert}</p>
      <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '12px', color: farbe, margin: '4px 0 0', opacity: 0.7 }}>{sub}</p>
    </div>
  )
}

function Abschnitt({ titel, akzent, summe, children }) {
  return (
    <div>
      <div style={{ background: '#3d675e', borderRadius: '10px', padding: '12px 18px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 2px 8px rgba(61,103,94,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: akzent === '#166534' ? '#9ad89e' : '#fca5a5', flexShrink: 0 }} />
          <span style={{ fontFamily: "'Geist', sans-serif", fontWeight: 600, fontSize: '17px', color: '#fff' }}>{titel}</span>
        </div>
        <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '13px', fontWeight: 600, color: '#fff', background: 'rgba(255,255,255,0.15)', padding: '3px 10px', borderRadius: '10px' }}>{summe}</span>
      </div>
      {children}
    </div>
  )
}

function LeerHinweis({ text }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2ebe8', borderRadius: '10px', padding: '24px', textAlign: 'center' }}>
      <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#8aada5', margin: 0 }}>{text}</p>
    </div>
  )
}

function PostenZeile({ p, onEdit, onDelete }) {
  async function loeschen() {
    if (!confirm(`„${p.bezeichnung}" wirklich löschen?`)) return
    await supabase.from('finanzposten').delete().eq('id', p.id)
    onDelete()
  }
  const mon = monatlichBetrag(p)
  const anteil = p.anteil_prozent != null ? p.anteil_prozent : 100
  const anteilMon = anteilMonatlich(p)
  const geteilt = anteil < 100
  const intervallLabel = INTERVALLE.find(i => i.key === p.intervall)?.label || p.intervall
  return (
    <div style={{ background: '#fff', border: '1px solid #e2ebe8', borderRadius: '10px', padding: '12px 16px', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '14px', fontWeight: 500, color: '#1a2e2a', margin: 0 }}>{p.bezeichnung}</p>
        <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '12px', color: '#8aada5', margin: '3px 0 0' }}>
          {p.anbieter && <>{p.anbieter} · </>}
          {intervallLabel}
          {geteilt && <> · dein Anteil {anteil % 1 === 0 ? anteil : anteil.toFixed(1)} %</>}
          {p.naechste_zahlung && <> · nächste: {new Date(p.naechste_zahlung).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' })}</>}
          {p.vertragsnr && <> · Vertr.-Nr. {p.vertragsnr}</>}
        </p>
        {p.notiz && <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '12px', color: '#8aada5', margin: '3px 0 0', fontStyle: 'italic' }}>{p.notiz}</p>}
      </div>
      <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
        {geteilt ? (
          <>
            <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '15px', fontWeight: 600, color: '#1a2e2a', margin: 0 }}>{euro(anteilMon)}<span style={{ fontSize: '11px', color: '#8aada5', fontWeight: 400 }}> / Mon.</span></p>
            <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: '#8aada5', margin: '2px 0 0' }}>von {euro(mon)} gesamt</p>
          </>
        ) : (
          <>
            <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '15px', fontWeight: 600, color: p.typ === 'einnahme' ? '#166534' : '#1a2e2a', margin: 0 }}>{euro(p.betrag || 0)}</p>
            {p.intervall !== 'monatlich' && (
              <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: '#8aada5', margin: '2px 0 0' }}>= {euro(mon)} / Mon.</p>
            )}
          </>
        )}
      </div>
      <div style={{ display: 'flex', gap: '6px' }}>
        <button onClick={onEdit} title="Bearbeiten" style={{ ...btn(false, false), padding: '6px 10px' }}>✎</button>
        <button onClick={loeschen} title="Löschen" style={{ ...btn(false, false), padding: '6px 10px', borderColor: '#fca5a5', color: '#991b1b' }}>🗑</button>
      </div>
    </div>
  )
}

function FinanzModal({ posten, typ, onClose, onDone }) {
  const isNeu = !posten
  const aktTyp = posten?.typ || typ
  const [form, setForm] = useState({
    bezeichnung: posten?.bezeichnung ?? '',
    kategorie: posten?.kategorie ?? '',
    anbieter: posten?.anbieter ?? '',
    betrag: posten?.betrag ?? '',
    intervall: posten?.intervall ?? 'monatlich',
    anteil: posten?.anteil_prozent != null ? posten.anteil_prozent : 100,
    mwst: posten?.mwst_prozent != null ? posten.mwst_prozent : 20,
    naechste_zahlung: posten?.naechste_zahlung ?? '',
    vertragsnr: posten?.vertragsnr ?? '',
    notiz: posten?.notiz ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [fehler, setFehler] = useState(null)
  const kategorien = aktTyp === 'einnahme' ? EINNAHME_KATEGORIEN : AUSGABE_KATEGORIEN
  const gueltig = form.bezeichnung.trim() && form.betrag !== '' && !isNaN(parseFloat(form.betrag))

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function speichern() {
    if (!gueltig) return
    setSaving(true)
    setFehler(null)
    const data = {
      typ: aktTyp,
      bezeichnung: form.bezeichnung.trim(),
      kategorie: form.kategorie || (aktTyp === 'einnahme' ? 'Fitnessabos' : 'Sonstiges'),
      anbieter: form.anbieter.trim() || null,
      betrag: parseFloat(form.betrag),
      intervall: form.intervall,
      anteil_prozent: parseFloat(form.anteil) || 100,
      mwst_prozent: parseFloat(form.mwst) || 0,
      naechste_zahlung: form.naechste_zahlung || null,
      vertragsnr: form.vertragsnr.trim() || null,
      notiz: form.notiz.trim() || null,
    }
    const result = isNeu
      ? await supabase.from('finanzposten').insert(data)
      : await supabase.from('finanzposten').update(data).eq('id', posten.id)
    setSaving(false)
    if (result.error) {
      setFehler(result.error.message)
      return
    }
    onDone()
  }

  const titelTyp = aktTyp === 'einnahme' ? 'Einnahme' : 'Ausgabe'

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '500px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ padding: '24px 28px 16px' }}>
          <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: aktTyp === 'einnahme' ? '#166534' : '#991b1b', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 4px' }}>
            {isNeu ? `Neue ${titelTyp}` : `${titelTyp} bearbeiten`}
          </p>
          <h2 style={{ fontFamily: "'Geist', sans-serif", fontWeight: 400, fontSize: '20px', color: '#1a2e2a', margin: 0 }}>{isNeu ? titelTyp + ' hinzufügen' : form.bezeichnung}</h2>
        </div>

        <div style={{ overflowY: 'auto', padding: '0 28px', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={lbl}>Bezeichnung *</label>
            <input value={form.bezeichnung} onChange={e => set('bezeichnung', e.target.value)}
              placeholder={aktTyp === 'einnahme' ? 'z.B. Fitnessabo Monatsbeiträge' : 'z.B. eCard-System Abo'} autoFocus style={inp} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>Kategorie</label>
              <select value={form.kategorie} onChange={e => set('kategorie', e.target.value)} style={inp}>
                <option value="">– wählen –</option>
                {kategorien.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Anbieter / Firma</label>
              <input value={form.anbieter} onChange={e => set('anbieter', e.target.value)} placeholder="z.B. ÖGK" style={inp} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>Betrag (€) *</label>
              <input type="number" step="0.01" min="0" value={form.betrag} onChange={e => set('betrag', e.target.value)} placeholder="z.B. 49.90" style={inp} />
            </div>
            <div>
              <label style={lbl}>Intervall</label>
              <select value={form.intervall} onChange={e => set('intervall', e.target.value)} style={inp}>
                {INTERVALLE.map(i => <option key={i.key} value={i.key}>{i.label}</option>)}
              </select>
            </div>
          </div>

          {form.betrag && form.intervall !== 'monatlich' && (
            <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '12px', color: '#5a8a80', margin: '-6px 0 0' }}>
              = <strong style={{ color: '#3d675e' }}>{euro(parseFloat(form.betrag || 0) * (INTERVALLE.find(i => i.key === form.intervall)?.faktor ?? 1))}</strong> pro Monat
            </p>
          )}

          {/* Anteil (Ausgaben + Einnahmen) */}
          {true && (
            <div>
              <label style={lbl}>Dein Anteil</label>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                {ANTEIL_BUTTONS.map(b => {
                  const aktiv = Math.abs(parseFloat(form.anteil) - b.wert) < 0.01
                  return (
                    <button key={b.label} type="button" onClick={() => set('anteil', b.wert)}
                      style={{ padding: '7px 16px', borderRadius: '8px', border: `1px solid ${aktiv ? '#3d675e' : '#d1e0db'}`, background: aktiv ? '#f0f5f4' : '#fff', color: aktiv ? '#3d675e' : '#8aada5', fontFamily: "'Geist', sans-serif", fontSize: '14px', fontWeight: aktiv ? 600 : 400, cursor: 'pointer' }}>
                      {b.label}
                    </button>
                  )
                })}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="number" step="0.01" min="0" max="100" value={form.anteil}
                  onChange={e => set('anteil', e.target.value)} style={{ ...inp, width: '120px' }} />
                <span style={{ fontFamily: "'Geist', sans-serif", fontSize: '14px', color: '#8aada5' }}>%</span>
                {form.betrag && (
                  <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '13px', color: '#5a8a80', marginLeft: '4px' }}>
                    = dein Anteil <strong style={{ color: '#3d675e' }}>{euro(parseFloat(form.betrag || 0) * (INTERVALLE.find(i => i.key === form.intervall)?.faktor ?? 1) * ((parseFloat(form.anteil) || 100) / 100))}</strong> / Monat
                  </span>
                )}
              </div>
            </div>
          )}

          {/* MwSt – Einnahmen & Ausgaben (Brutto → Netto) */}
          {true && (
            <div>
              <label style={lbl}>MwSt (im Betrag enthalten)</label>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                {MWST_BUTTONS.map(m => {
                  const aktiv = Math.abs(parseFloat(form.mwst) - m) < 0.01
                  return (
                    <button key={m} type="button" onClick={() => set('mwst', m)}
                      style={{ padding: '7px 16px', borderRadius: '8px', border: `1px solid ${aktiv ? '#3d675e' : '#d1e0db'}`, background: aktiv ? '#f0f5f4' : '#fff', color: aktiv ? '#3d675e' : '#8aada5', fontFamily: "'Geist', sans-serif", fontSize: '14px', fontWeight: aktiv ? 600 : 400, cursor: 'pointer' }}>
                      {m} %
                    </button>
                  )
                })}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="number" step="0.1" min="0" max="100" value={form.mwst}
                  onChange={e => set('mwst', e.target.value)} style={{ ...inp, width: '120px' }} />
                <span style={{ fontFamily: "'Geist', sans-serif", fontSize: '14px', color: '#8aada5' }}>%</span>
              </div>
              {form.betrag && (() => {
                const bruttoAnteil = parseFloat(form.betrag || 0) * (INTERVALLE.find(i => i.key === form.intervall)?.faktor ?? 1) * ((parseFloat(form.anteil) || 100) / 100)
                const netto = nettoVonBrutto(bruttoAnteil, parseFloat(form.mwst) || 0)
                if (aktTyp === 'einnahme') {
                  return (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 12px', marginTop: '8px' }}>
                      <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '12px', color: '#166534', margin: 0 }}>
                        Brutto: <strong>{euro(bruttoAnteil)}</strong> · Netto (dein Anteil): <strong>{euro(netto)}</strong> / Monat
                      </p>
                      <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: '#5a8a80', margin: '3px 0 0' }}>
                        MwSt abzuführen: {euro(bruttoAnteil - netto)} / Monat
                      </p>
                    </div>
                  )
                }
                return (
                  <div style={{ background: '#f7faf9', border: '1px solid #e2ebe8', borderRadius: '8px', padding: '10px 12px', marginTop: '8px' }}>
                    <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '12px', color: '#1a2e2a', margin: 0 }}>
                      Brutto: <strong>{euro(bruttoAnteil)}</strong> · Netto: <strong>{euro(netto)}</strong> / Monat
                    </p>
                    <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: '#8aada5', margin: '3px 0 0' }}>
                      enthaltene MwSt: {euro(bruttoAnteil - netto)} · Brutto = echte Kosten (nicht rückholbar)
                    </p>
                  </div>
                )
              })()}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>Nächste Zahlung</label>
              <input type="date" value={form.naechste_zahlung} onChange={e => set('naechste_zahlung', e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>Vertrags-/Kundennr.</label>
              <input value={form.vertragsnr} onChange={e => set('vertragsnr', e.target.value)} placeholder="optional" style={inp} />
            </div>
          </div>

          <div>
            <label style={lbl}>Notiz</label>
            <textarea value={form.notiz} onChange={e => set('notiz', e.target.value)} rows={2}
              placeholder="z.B. Kündigungsfrist 3 Monate" style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }} />
          </div>
        </div>

        {fehler && (
          <div style={{ margin: '0 28px', padding: '10px 14px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px' }}>
            <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#991b1b', margin: 0 }}>Fehler: {fehler}</p>
          </div>
        )}

        <div style={{ padding: '16px 28px 24px', display: 'flex', gap: '8px', borderTop: '1px solid #f0f5f4' }}>
          <button onClick={onClose} style={{ ...btn(false, false), flex: 1, padding: '10px' }}>Abbrechen</button>
          <button onClick={speichern} disabled={!gueltig || saving} style={{ ...btn(true, !gueltig || saving), flex: 1, padding: '10px' }}>
            {saving ? '…' : isNeu ? titelTyp + ' hinzufügen' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}
