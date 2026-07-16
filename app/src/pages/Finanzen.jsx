import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Passwort für den geschützten Finanzbereich. Zum Ändern einfach hier anpassen.
const FINANZEN_PASSWORT = 'werkeins2026'

const AUSGABE_KATEGORIEN = ['Versicherungen', 'Software & Systeme', 'Personal / Gehälter', 'Miete & Betriebskosten', 'Sonstiges']
const EINNAHME_KATEGORIEN = ['Fitnessabos', 'Sonstiges']
const INTERVALLE = [
  { key: 'monatlich', label: 'Monatlich', faktor: 1 },
  { key: 'quartalsweise', label: 'Quartalsweise', faktor: 1 / 3 },
  { key: 'jaehrlich', label: 'Jährlich', faktor: 1 / 12 },
]

function monatlichBetrag(p) {
  const f = INTERVALLE.find(i => i.key === p.intervall)?.faktor ?? 1
  return (p.betrag || 0) * f
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
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // { typ } für neu, oder posten-Objekt zum Bearbeiten

  useEffect(() => { if (entsperrt) laden() }, [entsperrt])

  async function laden() {
    const { data } = await supabase.from('finanzposten').select('*').order('created_at', { ascending: false })
    setPosten(data ?? [])
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
  const einnahmenMon = einnahmen.reduce((s, p) => s + monatlichBetrag(p), 0)
  const ausgabenMon = ausgaben.reduce((s, p) => s + monatlichBetrag(p), 0)
  const ergebnisMon = einnahmenMon - ausgabenMon

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
        <SummaryCard label="Einnahmen / Monat" wert={euro(einnahmenMon)} farbe="#166534" bg="#f0fdf4" border="#bbf7d0" sub={euro(einnahmenMon * 12) + ' / Jahr'} />
        <SummaryCard label="Ausgaben / Monat" wert={euro(ausgabenMon)} farbe="#991b1b" bg="#fef2f2" border="#fecaca" sub={euro(ausgabenMon * 12) + ' / Jahr'} />
        <SummaryCard
          label="Ergebnis / Monat"
          wert={(ergebnisMon >= 0 ? '+' : '−') + euro(Math.abs(ergebnisMon)).slice(1)}
          farbe={ergebnisMon >= 0 ? '#166534' : '#991b1b'}
          bg={ergebnisMon >= 0 ? '#f0fdf4' : '#fef2f2'}
          border={ergebnisMon >= 0 ? '#bbf7d0' : '#fecaca'}
          sub={(ergebnisMon >= 0 ? '+' : '−') + euro(Math.abs(ergebnisMon * 12)).slice(1) + ' / Jahr'}
        />
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <button onClick={() => setModal({ typ: 'ausgabe' })} style={btn(true, false)}>+ Ausgabe</button>
        <button onClick={() => setModal({ typ: 'einnahme' })} style={{ ...btn(false, false), borderColor: '#9ad89e', color: '#166534' }}>+ Einnahme</button>
      </div>

      {/* Einnahmen */}
      <Abschnitt titel="Einnahmen" akzent="#166534" summe={euro(einnahmenMon) + ' / Monat'}>
        {einnahmen.length === 0
          ? <LeerHinweis text="Noch keine Einnahmen erfasst" />
          : einnahmen.map(p => <PostenZeile key={p.id} p={p} onEdit={() => setModal(p)} onDelete={laden} />)}
      </Abschnitt>

      {/* Ausgaben nach Kategorie */}
      <div style={{ marginTop: '28px' }}>
        <Abschnitt titel="Ausgaben" akzent="#991b1b" summe={euro(ausgabenMon) + ' / Monat'}>
          {ausgaben.length === 0 && <LeerHinweis text="Noch keine Ausgaben erfasst" />}
          {Object.entries(ausgabenGruppen).sort(([a], [b]) => a.localeCompare(b)).map(([kat, liste]) => {
            const katSumme = liste.reduce((s, p) => s + monatlichBetrag(p), 0)
            return (
              <div key={kat} style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 4px' }}>
                  <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', fontWeight: 600, color: '#5a8a80', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{kat}</span>
                  <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: '#8aada5' }}>{euro(katSumme)} / Monat</span>
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
  const intervallLabel = INTERVALLE.find(i => i.key === p.intervall)?.label || p.intervall
  return (
    <div style={{ background: '#fff', border: '1px solid #e2ebe8', borderRadius: '10px', padding: '12px 16px', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '14px', fontWeight: 500, color: '#1a2e2a', margin: 0 }}>{p.bezeichnung}</p>
        <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '12px', color: '#8aada5', margin: '3px 0 0' }}>
          {p.anbieter && <>{p.anbieter} · </>}
          {intervallLabel}
          {p.naechste_zahlung && <> · nächste: {new Date(p.naechste_zahlung).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' })}</>}
          {p.vertragsnr && <> · Vertr.-Nr. {p.vertragsnr}</>}
        </p>
        {p.notiz && <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '12px', color: '#8aada5', margin: '3px 0 0', fontStyle: 'italic' }}>{p.notiz}</p>}
      </div>
      <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
        <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '15px', fontWeight: 600, color: p.typ === 'einnahme' ? '#166534' : '#1a2e2a', margin: 0 }}>{euro(p.betrag || 0)}</p>
        {p.intervall !== 'monatlich' && (
          <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: '#8aada5', margin: '2px 0 0' }}>= {euro(mon)} / Mon.</p>
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
    naechste_zahlung: posten?.naechste_zahlung ?? '',
    vertragsnr: posten?.vertragsnr ?? '',
    notiz: posten?.notiz ?? '',
  })
  const [saving, setSaving] = useState(false)
  const kategorien = aktTyp === 'einnahme' ? EINNAHME_KATEGORIEN : AUSGABE_KATEGORIEN
  const gueltig = form.bezeichnung.trim() && form.betrag !== '' && !isNaN(parseFloat(form.betrag))

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function speichern() {
    if (!gueltig) return
    setSaving(true)
    const data = {
      typ: aktTyp,
      bezeichnung: form.bezeichnung.trim(),
      kategorie: form.kategorie || (aktTyp === 'einnahme' ? 'Fitnessabos' : 'Sonstiges'),
      anbieter: form.anbieter.trim() || null,
      betrag: parseFloat(form.betrag),
      intervall: form.intervall,
      naechste_zahlung: form.naechste_zahlung || null,
      vertragsnr: form.vertragsnr.trim() || null,
      notiz: form.notiz.trim() || null,
    }
    if (isNeu) await supabase.from('finanzposten').insert(data)
    else await supabase.from('finanzposten').update(data).eq('id', posten.id)
    setSaving(false)
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
