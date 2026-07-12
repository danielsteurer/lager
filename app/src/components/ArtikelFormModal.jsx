import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useUndo } from '../lib/UndoContext'
import LieferantFormModal from './LieferantFormModal'

const field = { display: 'flex', flexDirection: 'column', gap: '4px' }
const lbl = { fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#5a8a80' }
const inp = (err) => ({
  padding: '9px 12px', border: `1px solid ${err ? '#fca5a5' : '#d1e0db'}`,
  borderRadius: '8px', fontFamily: "'Geist', sans-serif", fontSize: '14px',
  color: '#1a2e2a', outline: 'none', background: '#fff', width: '100%', boxSizing: 'border-box',
})
const row2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }

function stueckProEinheit(einheit) {
  const m = einheit?.match(/^P\/(\d+)/)
  return m ? parseInt(m[1]) : null
}

const DEFAULT_KATEGORIEN = ['Handschuhe', 'Kanülen / Spritzen', 'Verbandsmaterial', 'Desinfektion', 'Medikamente', 'Ultraschall / EKG', 'Sonstiges']

// Einheit aus gespeichertem String ableiten
function parseEinheit(str) {
  if (!str || str === 'Stück') return { typ: 'stueck', anzahl: '' }
  if (str === 'Flasche') return { typ: 'flasche', anzahl: '' }
  const packung = str.match(/^P\/(.+)$/)
  if (packung) return { typ: 'packung', anzahl: packung[1] }
  const rolle = str.match(/^Rolle\/(.+)$/)
  if (rolle) return { typ: 'rolle', anzahl: rolle[1] }
  if (str === 'Rolle') return { typ: 'rolle', anzahl: '' }
  return { typ: 'sonstiges', anzahl: str }
}

function buildEinheit(typ, anzahl) {
  if (typ === 'stueck') return 'Stück'
  if (typ === 'flasche') return 'Flasche'
  if (typ === 'packung') return anzahl ? `P/${anzahl}` : 'P/?'
  if (typ === 'rolle') return anzahl ? `Rolle/${anzahl}` : 'Rolle'
  return anzahl // sonstiges
}

const EINHEIT_TYPEN = [
  { key: 'stueck',   label: 'Stück',   sub: null },
  { key: 'packung',  label: 'Packung', sub: 'Stück pro Packung' },
  { key: 'flasche',  label: 'Flasche', sub: null },
  { key: 'rolle',    label: 'Rolle',   sub: 'Stück pro Rolle (optional)' },
  { key: 'sonstiges',label: 'Sonstiges', sub: 'Einheit frei eingeben' },
]

export default function ArtikelFormModal({ artikel, onClose, onDone }) {
  const isNeu = !artikel
  const { push } = useUndo()
  const [lieferanten, setLieferanten] = useState([])
  const [kategorien, setKategorien] = useState(DEFAULT_KATEGORIEN)
  const [neueKat, setNeueKat] = useState(false)
  const [neueKatText, setNeueKatText] = useState('')
  const [neuerLieferant, setNeuerLieferant] = useState(false)
  const [saving, setSaving] = useState(false)
  const [autoSaveStatus, setAutoSaveStatus] = useState(null)
  const [bestand, setBestand] = useState({ lager: 0, bz: 0 })
  const [bestandInput, setBestandInput] = useState({ lager: '', bz: '' })
  const [bestandLoading, setBestandLoading] = useState(true)
  const [bestandAutoSaveStatus, setBestandAutoSaveStatus] = useState(null)
  const [chargen, setChargen] = useState([])
  const [chargenInput, setChargenInput] = useState({})
  const [chargenAutoSaveStatus, setChargenAutoSaveStatus] = useState(null)
  const [alleChargenDatum, setAlleChargenDatum] = useState('')
  const [fehler, setFehler] = useState({})

  const parsed = parseEinheit(artikel?.einheit)
  const [einheitTyp, setEinheitTyp] = useState(parsed.typ)
  const [einheitAnzahl, setEinheitAnzahl] = useState(parsed.anzahl)

  const [form, setForm] = useState({
    bezeichnung: artikel?.bezeichnung ?? '',
    kategorie: artikel?.kategorie ?? '',
    lieferant_id: artikel?.lieferant_id ?? '',
    lieferant_artikelnr: artikel?.lieferant_artikelnr ?? '',
    mindestbestand: artikel?.mindestbestand ?? 0,
    kein_mindestbestand: artikel?.kein_mindestbestand ?? false,
    gauge: artikel?.gauge ?? '',
    länge: artikel?.länge ?? '',
    syringe_ml: artikel?.syringe_ml ?? '',
    luer_lock: artikel?.luer_lock ?? false,
    spezifikation: artikel?.spezifikation ?? '',
    kritisch: artikel?.kritisch ?? false,
    letzter_preis: artikel?.letzter_preis ?? '',
    notiz: artikel?.notiz ?? '',
  })

  async function ladenLieferanten(selectId) {
    const { data } = await supabase.from('lieferanten').select('id, name').order('name')
    setLieferanten(data ?? [])
    if (selectId) setForm(f => ({ ...f, lieferant_id: selectId }))
  }

  async function ladenKategorien() {
    const { data } = await supabase.from('artikel').select('kategorie').not('kategorie', 'is', null)
    const aus_db = [...new Set((data ?? []).map(r => r.kategorie).filter(Boolean))]
    const alle = [...new Set([...DEFAULT_KATEGORIEN, ...aus_db])].sort()
    setKategorien(alle)
  }

  useEffect(() => {
    ladenLieferanten()
    ladenKategorien()
    if (!isNeu) {
      ladenBestand()
      ladenChargen()
    }
  }, [])

  async function ladenBestand() {
    const { data } = await supabase.from('artikel_bestand').select('lager_bestand, bz_bestand').eq('id', artikel.id).single()
    if (data) {
      setBestand({ lager: data.lager_bestand, bz: data.bz_bestand })
      setBestandInput({ lager: String(data.lager_bestand), bz: String(data.bz_bestand) })
    }
    setBestandLoading(false)
  }

  async function ladenChargen() {
    const { data } = await supabase.from('chargen').select('*').eq('artikel_id', artikel.id).is('deleted_at', null).order('verfallsdatum', { ascending: true, nullsFirst: false })
    if (data) {
      setChargen(data)
      const inputs = {}
      data.forEach(c => {
        inputs[c.id] = c.verfallsdatum || ''
      })
      setChargenInput(inputs)
    }
  }

  // Auto-Save für Bestandsänderungen
  useEffect(() => {
    if (isNeu || !bestandInput.lager) return
    const timer = setTimeout(() => {
      bestandAutoSave()
    }, 1000)
    return () => clearTimeout(timer)
  }, [bestandInput])

  async function bestandAutoSave() {
    if (isNeu || !artikel?.id) return

    const neuLager = parseFloat(bestandInput.lager) || 0
    const neuBz = parseFloat(bestandInput.bz) || 0
    const diffLager = neuLager - bestand.lager
    const diffBz = neuBz - bestand.bz

    if (diffLager === 0 && diffBz === 0) return

    setBestandAutoSaveStatus('speichert...')

    try {
      // Lager-Differenz buchen
      if (diffLager !== 0) {
        if (diffLager > 0) {
          await supabase.from('chargen').insert({ artikel_id: artikel.id, menge: diffLager, lagerort: 'lager', charge_nr: null, verfallsdatum: null })
        } else {
          // Verbrauch: älteste Chargen zuerst (FEFO)
          const { data: chargen } = await supabase.from('chargen').select('*').eq('artikel_id', artikel.id).eq('lagerort', 'lager').order('verfallsdatum', { ascending: true, nullsFirst: false })
          let abzuBuchendeLagerMenge = Math.abs(diffLager)
          for (const c of chargen || []) {
            if (abzuBuchendeLagerMenge <= 0) break
            const abzug = Math.min(c.menge, abzuBuchendeLagerMenge)
            abzuBuchendeLagerMenge -= abzug
            if (c.menge <= abzug) {
              await supabase.from('chargen').delete().eq('id', c.id)
            } else {
              await supabase.from('chargen').update({ menge: c.menge - abzug }).eq('id', c.id)
            }
          }
        }
        await supabase.from('bewegungen').insert({ artikel_id: artikel.id, menge: diffLager, typ: diffLager > 0 ? 'wareneingang' : 'verbrauch', notiz: 'Bestandskorrektur' })
      }

      // BZ-Differenz buchen
      if (diffBz !== 0) {
        if (diffBz > 0) {
          await supabase.from('chargen').insert({ artikel_id: artikel.id, menge: diffBz, lagerort: 'behandlungsraum', charge_nr: null, verfallsdatum: null })
        } else {
          // Verbrauch: älteste Chargen zuerst
          const { data: chargen } = await supabase.from('chargen').select('*').eq('artikel_id', artikel.id).eq('lagerort', 'behandlungsraum').order('verfallsdatum', { ascending: true, nullsFirst: false })
          let abzuBuchendeBzMenge = Math.abs(diffBz)
          for (const c of chargen || []) {
            if (abzuBuchendeBzMenge <= 0) break
            const abzug = Math.min(c.menge, abzuBuchendeBzMenge)
            abzuBuchendeBzMenge -= abzug
            if (c.menge <= abzug) {
              await supabase.from('chargen').delete().eq('id', c.id)
            } else {
              await supabase.from('chargen').update({ menge: c.menge - abzug }).eq('id', c.id)
            }
          }
        }
        await supabase.from('bewegungen').insert({ artikel_id: artikel.id, menge: diffBz, typ: diffBz > 0 ? 'wareneingang' : 'verbrauch', notiz: 'Bestandskorrektur BZ' })
      }

      setBestand({ lager: neuLager, bz: neuBz })
      setBestandAutoSaveStatus('✓ Gespeichert')
      setTimeout(() => setBestandAutoSaveStatus(null), 2000)
    } catch (err) {
      setBestandAutoSaveStatus('❌ Fehler')
      setTimeout(() => setBestandAutoSaveStatus(null), 3000)
    }
  }

  // Auto-Save für Chargen-Verfallsdaten
  useEffect(() => {
    if (isNeu || chargen.length === 0) return
    const timer = setTimeout(() => {
      chargenAutoSave()
    }, 1000)
    return () => clearTimeout(timer)
  }, [chargenInput])

  async function chargenAutoSave() {
    if (isNeu || chargen.length === 0) return
    setChargenAutoSaveStatus('speichert...')
    try {
      for (const c of chargen) {
        const neuVerfall = chargenInput[c.id] || null
        if (neuVerfall !== (c.verfallsdatum || '')) {
          await supabase.from('chargen').update({ verfallsdatum: neuVerfall || null }).eq('id', c.id)
        }
      }
      setChargenAutoSaveStatus('✓ Gespeichert')
      setTimeout(() => setChargenAutoSaveStatus(null), 2000)
      ladenChargen()
    } catch (err) {
      setChargenAutoSaveStatus('❌ Fehler')
      setTimeout(() => setChargenAutoSaveStatus(null), 3000)
    }
  }

  async function alleChargenAktualisieren(neuesVerfall) {
    if (!neuesVerfall || isNeu) return
    setChargenAutoSaveStatus('speichert...')
    try {
      await supabase.from('chargen').update({ verfallsdatum: neuesVerfall }).eq('artikel_id', artikel.id).is('deleted_at', null)
      const inputs = {}
      chargen.forEach(c => {
        inputs[c.id] = neuesVerfall
      })
      setChargenInput(inputs)
      setChargenAutoSaveStatus('✓ Alle aktualisiert')
      setTimeout(() => setChargenAutoSaveStatus(null), 2000)
      ladenChargen()
    } catch (err) {
      setChargenAutoSaveStatus('❌ Fehler')
      setTimeout(() => setChargenAutoSaveStatus(null), 3000)
    }
  }

  // Auto-Save mit Debounce
  useEffect(() => {
    if (isNeu) return // Nur für bestehende Artikel

    const timer = setTimeout(() => {
      autoSave()
    }, 1000)

    return () => clearTimeout(timer)
  }, [form, einheitTyp, einheitAnzahl])

  async function autoSave() {
    if (isNeu || !artikel?.id) return

    setAutoSaveStatus('speichert...')

    const einheit = buildEinheit(einheitTyp, einheitAnzahl)
    const data = {
      bezeichnung: form.bezeichnung.trim() || 'Unbenannt',
      kategorie: form.kategorie || null,
      lieferant_id: form.lieferant_id || null,
      lieferant_artikelnr: form.lieferant_artikelnr.trim() || null,
      einheit,
      mindestbestand: form.kein_mindestbestand ? 0 : parseFloat(form.mindestbestand) || 0,
      kein_mindestbestand: form.kein_mindestbestand,
      gauge: form.gauge ? parseInt(form.gauge) : null,
      länge: form.länge ? parseInt(form.länge) : null,
      syringe_ml: form.syringe_ml ? parseInt(form.syringe_ml) : null,
      luer_lock: form.luer_lock,
      spezifikation: form.spezifikation.trim() || null,
      kritisch: form.kritisch,
      letzter_preis: form.letzter_preis !== '' ? parseFloat(form.letzter_preis) : null,
      notiz: form.notiz.trim() || null,
    }

    try {
      const result = await supabase.from('artikel').update(data).eq('id', artikel.id)
      if (result.error) {
        setAutoSaveStatus('❌ Fehler beim Speichern')
        setTimeout(() => setAutoSaveStatus(null), 3000)
      } else {
        setAutoSaveStatus('✓ Gespeichert')
        setTimeout(() => setAutoSaveStatus(null), 2000)
      }
    } catch (err) {
      setAutoSaveStatus('❌ Fehler')
      setTimeout(() => setAutoSaveStatus(null), 3000)
    }
  }

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setFehler(e => ({ ...e, [k]: null })) }

  function katHinzufuegen() {
    const k = neueKatText.trim()
    if (!k) return
    setKategorien(prev => [...new Set([...prev, k])].sort())
    setForm(f => ({ ...f, kategorie: k }))
    setNeueKat(false)
    setNeueKatText('')
  }

  async function speichern() {
    console.log('speichern() aufgerufen')
    const err = {}
    if (!form.bezeichnung.trim()) err.bezeichnung = 'Pflichtfeld'
    if (!form.kategorie) err.kategorie = 'Bitte eine Kategorie wählen oder neu anlegen'
    if (!form.lieferant_id) err.lieferant_id = 'Bitte einen Lieferanten wählen oder anlegen'
    const einheit = buildEinheit(einheitTyp, einheitAnzahl)
    if (einheitTyp === 'packung' && !einheitAnzahl) err.einheit = 'Bitte Anzahl pro Packung eingeben'
    if (einheitTyp === 'sonstiges' && !einheitAnzahl.trim()) err.einheit = 'Bitte Einheit eingeben'
    if (Object.keys(err).length) { console.log('Validierungsfehler:', err); setFehler(err); return }
    setSaving(true)
    console.log('Speichern gestartet mit Daten:', { isNeu, ...form })

    const data = {
      bezeichnung: form.bezeichnung.trim(),
      kategorie: form.kategorie,
      lieferant_id: form.lieferant_id || null,
      lieferant_artikelnr: form.lieferant_artikelnr.trim() || null,
      einheit,
      mindestbestand: form.kein_mindestbestand ? 0 : parseFloat(form.mindestbestand) || 0,
      kein_mindestbestand: form.kein_mindestbestand,
      gauge: form.gauge ? parseInt(form.gauge) : null,
      länge: form.länge ? parseInt(form.länge) : null,
      syringe_ml: form.syringe_ml ? parseInt(form.syringe_ml) : null,
      luer_lock: form.luer_lock,
      spezifikation: form.spezifikation.trim() || null,
      kritisch: form.kritisch,
      letzter_preis: form.letzter_preis !== '' ? parseFloat(form.letzter_preis) : null,
      notiz: form.notiz.trim() || null,
    }

    if (isNeu) {
      const result = await supabase.from('artikel').insert(data)
      console.log('Insert result:', result)
      if (result.error) { console.error('Insert error:', result.error); setFehler({ submit: result.error.message }); setSaving(false); return }
    } else {
      console.log('Update mit ID:', artikel.id, 'Daten:', data)
      const result = await supabase.from('artikel').update(data).eq('id', artikel.id)
      console.log('Update result:', result)
      if (result.error) { console.error('Update error:', result.error); setFehler({ submit: result.error.message }); setSaving(false); return }
    }
    setSaving(false)
    console.log('onDone() aufgerufen')
    onDone()
  }

  const einheitVorschau = buildEinheit(einheitTyp, einheitAnzahl)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '560px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>

        <div style={{ padding: '24px 28px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: '#3d675e', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 4px' }}>
                {isNeu ? 'Neuer Artikel' : 'Artikel bearbeiten'}
              </p>
              <h2 style={{ fontFamily: "'Geist', sans-serif", fontWeight: 400, fontSize: '20px', color: '#1a2e2a', margin: '0 0 6px' }}>
                {isNeu ? 'Artikel anlegen' : form.bezeichnung}
              </h2>
              {!isNeu && artikel?.bezeichnung_original && (
                <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '10px', color: '#8aada5', margin: '0 0 16px' }}>
                  {artikel.bezeichnung_original}
                </p>
              )}
            </div>
            {autoSaveStatus && !isNeu && (
              <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '12px', color: autoSaveStatus.startsWith('✓') ? '#166534' : '#991b1b', margin: '4px 0 0', fontWeight: 500 }}>
                {autoSaveStatus}
              </p>
            )}
          </div>
        </div>

        <div style={{ overflowY: 'auto', padding: '0 28px', flex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '8px' }}>

            {/* Bezeichnung */}
            <div style={field}>
              <label style={lbl}>Bezeichnung *</label>
              <input value={form.bezeichnung} onChange={e => set('bezeichnung', e.target.value)}
                placeholder="z.B. Nitril 3000 Handschuhe Gr. M" autoFocus style={inp(fehler.bezeichnung)} />
              {fehler.bezeichnung && <span style={{ fontSize: '12px', color: '#991b1b', fontFamily: "'Geist', sans-serif" }}>{fehler.bezeichnung}</span>}
            </div>

            {/* Kategorie */}
            <div style={field}>
              <label style={lbl}>Kategorie *</label>
              {!neueKat ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select value={form.kategorie} onChange={e => set('kategorie', e.target.value)}
                    style={{ ...inp(fehler.kategorie), flex: 1 }}>
                    <option value="">– Kategorie wählen –</option>
                    {kategorien.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                  <button type="button" onClick={() => { setNeueKat(true); setNeueKatText('') }}
                    style={{ flexShrink: 0, padding: '9px 14px', borderRadius: '8px', border: '1px solid #d1e0db', background: '#f7faf9', color: '#3d675e', cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: '13px', fontWeight: 500 }}>
                    + Neu
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input autoFocus value={neueKatText} onChange={e => setNeueKatText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && katHinzufuegen()}
                    placeholder="Neue Kategorie eingeben" style={{ ...inp(false), flex: 1 }} />
                  <button type="button" onClick={katHinzufuegen}
                    style={{ flexShrink: 0, padding: '9px 14px', borderRadius: '8px', border: 'none', background: '#3d675e', color: '#fff', cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: '13px', fontWeight: 500 }}>
                    Hinzufügen
                  </button>
                  <button type="button" onClick={() => setNeueKat(false)}
                    style={{ flexShrink: 0, padding: '9px 10px', borderRadius: '8px', border: '1px solid #d1e0db', background: '#fff', color: '#8aada5', cursor: 'pointer', fontSize: '13px' }}>
                    ✕
                  </button>
                </div>
              )}
              {fehler.kategorie && <span style={{ fontSize: '12px', color: '#991b1b', fontFamily: "'Geist', sans-serif" }}>{fehler.kategorie}</span>}
            </div>

            {/* Einheit */}
            <div style={field}>
              <label style={lbl}>Einheit *</label>
              {/* Typ-Auswahl */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {EINHEIT_TYPEN.map(t => (
                  <button key={t.key} type="button"
                    onClick={() => { setEinheitTyp(t.key); setEinheitAnzahl(''); setFehler(e => ({ ...e, einheit: null })) }}
                    style={{ padding: '7px 14px', borderRadius: '8px', border: `1px solid ${einheitTyp === t.key ? '#3d675e' : '#d1e0db'}`, background: einheitTyp === t.key ? '#f0f5f4' : '#fff', color: einheitTyp === t.key ? '#3d675e' : '#8aada5', fontFamily: "'Geist', sans-serif", fontSize: '13px', fontWeight: einheitTyp === t.key ? 600 : 400, cursor: 'pointer' }}>
                    {t.label}
                  </button>
                ))}
              </div>
              {/* Anzahl-Input wenn nötig */}
              {EINHEIT_TYPEN.find(t => t.key === einheitTyp)?.sub && (
                <input
                  type={einheitTyp === 'sonstiges' ? 'text' : 'number'}
                  min="1" value={einheitAnzahl}
                  onChange={e => { setEinheitAnzahl(e.target.value); setFehler(f => ({ ...f, einheit: null })) }}
                  placeholder={EINHEIT_TYPEN.find(t => t.key === einheitTyp)?.sub}
                  style={inp(fehler.einheit)} />
              )}
              {fehler.einheit && <span style={{ fontSize: '12px', color: '#991b1b', fontFamily: "'Geist', sans-serif" }}>{fehler.einheit}</span>}
              {/* Vorschau */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontFamily: "'Geist', sans-serif", fontSize: '12px', color: '#8aada5' }}>Einheit:</span>
                <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '13px', color: '#3d675e', background: '#f0f5f4', padding: '2px 8px', borderRadius: '4px' }}>{einheitVorschau}</span>
              </div>
            </div>

            {/* Lieferant */}
            <div style={field}>
              <label style={lbl}>Lieferant *</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select value={form.lieferant_id} onChange={e => set('lieferant_id', e.target.value)}
                  style={{ ...inp(fehler.lieferant_id), flex: 1 }}>
                  <option value="">– Lieferant auswählen –</option>
                  {lieferanten.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
                <button type="button" onClick={() => setNeuerLieferant(true)}
                  style={{ flexShrink: 0, padding: '9px 14px', borderRadius: '8px', border: '1px solid #d1e0db', background: '#f7faf9', color: '#3d675e', cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: '13px', fontWeight: 500 }}>
                  + Neu
                </button>
              </div>
              {fehler.lieferant_id && <span style={{ fontSize: '12px', color: '#991b1b', fontFamily: "'Geist', sans-serif" }}>{fehler.lieferant_id}</span>}
            </div>

            {/* Artikelnummer */}
            <div style={field}>
              <label style={lbl}>Artikelnummer beim Lieferanten</label>
              <input value={form.lieferant_artikelnr} onChange={e => set('lieferant_artikelnr', e.target.value)}
                placeholder="z.B. 115634" style={inp(false)} />
              <span style={{ fontSize: '12px', color: '#8aada5', fontFamily: "'Geist', sans-serif" }}>Wird auf der Nachbestell-Pickliste angezeigt</span>
            </div>

            {/* Mindestbestand + Preis */}
            <div style={row2}>
              <div style={field}>
                <label style={lbl}>Mindestbestand</label>
                <input type="number" min="0" step="1" value={form.mindestbestand}
                  onChange={e => set('mindestbestand', e.target.value)}
                  disabled={form.kein_mindestbestand}
                  style={{ ...inp(false), opacity: form.kein_mindestbestand ? 0.35 : 1 }} />
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: '12px', color: '#5a8a80', marginTop: '2px' }}>
                  <input type="checkbox" checked={form.kein_mindestbestand}
                    onChange={e => set('kein_mindestbestand', e.target.checked)}
                    style={{ accentColor: '#3d675e', cursor: 'pointer' }} />
                  Kein Mindestbestand – wird nur bei Bedarf ersetzt
                </label>
              </div>
              <div style={field}>
                <label style={lbl}>Letzter Preis (€)</label>
                <input type="number" min="0" step="0.01" value={form.letzter_preis}
                  onChange={e => set('letzter_preis', e.target.value)} placeholder="z.B. 5.39" style={inp(false)} />
              </div>
            </div>

            {/* Bestand Eingabe */}
            {!isNeu && (() => {
              const spE = stueckProEinheit(artikel.einheit)
              const lagerStueck = spE ? Math.round(parseFloat(bestandInput.lager || 0) * spE) : null
              const bzStueck = spE ? Math.round(parseFloat(bestandInput.bz || 0) * spE) : null
              return (
                <div style={{ background: '#f0f5f4', borderRadius: '10px', padding: '14px', border: '1px solid #d1e0db', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: '#5a8a80', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px' }}>Bestand ({artikel.einheit})</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '12px', color: '#8aada5', margin: '0 0 4px' }}>Lager</p>
                        <input type="number" min="0" step="0.5" value={bestandInput.lager}
                          onChange={e => setBestandInput(b => ({ ...b, lager: e.target.value }))}
                          style={inp(false)} />
                        {lagerStueck !== null && (
                          <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: '#8aada5', margin: '3px 0 0' }}>= {lagerStueck} Stück</p>
                        )}
                      </div>
                      <div>
                        <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '12px', color: '#8aada5', margin: '0 0 4px' }}>Behandlungsraum</p>
                        <input type="number" min="0" step="0.5" value={bestandInput.bz}
                          onChange={e => setBestandInput(b => ({ ...b, bz: e.target.value }))}
                          style={inp(false)} />
                        {bzStueck !== null && (
                          <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: '#8aada5', margin: '3px 0 0' }}>= {bzStueck} Stück</p>
                        )}
                      </div>
                    </div>
                    <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: '#8aada5', margin: '8px 0 0' }}>
                      Gesamt: <strong>{parseFloat(bestandInput.lager || 0) + parseFloat(bestandInput.bz || 0)}</strong>
                      {spE && <span> = <strong>{Math.round((parseFloat(bestandInput.lager || 0) + parseFloat(bestandInput.bz || 0)) * spE)}</strong> Stück</span>}
                    </p>
                  </div>
                  {bestandAutoSaveStatus && (
                    <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '12px', color: bestandAutoSaveStatus.startsWith('✓') ? '#166534' : '#991b1b', margin: '0 0 0 12px', fontWeight: 500, whiteSpace: 'nowrap' }}>
                      {bestandAutoSaveStatus}
                    </p>
                  )}
                </div>
              )
            })()}

            {/* Chargen */}
            {!isNeu && chargen.length > 0 && (
              <div style={{ background: '#fafafa', borderRadius: '10px', padding: '14px', border: '1px solid #e2ebe8' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: '#5a8a80', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Chargen ({chargen.length})</p>
                  {chargenAutoSaveStatus && (
                    <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '11px', color: chargenAutoSaveStatus.startsWith('✓') ? '#166534' : '#991b1b', margin: 0, fontWeight: 500 }}>
                      {chargenAutoSaveStatus}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <input type="date" value={alleChargenDatum} onChange={e => setAlleChargenDatum(e.target.value)}
                    style={{ ...inp(false), flex: 1 }} />
                  <button type="button" onClick={() => alleChargenAktualisieren(alleChargenDatum)}
                    disabled={!alleChargenDatum}
                    style={{ padding: '9px 14px', borderRadius: '8px', border: 'none', background: alleChargenDatum ? '#3d675e' : '#d1e0db', color: '#fff', cursor: alleChargenDatum ? 'pointer' : 'not-allowed', fontFamily: "'Geist', sans-serif", fontSize: '12px', fontWeight: 500, whiteSpace: 'nowrap' }}>
                    Alle aktualisieren
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {chargen.map(c => {
                    const locOrt = c.lagerort === 'lager' ? 'Lager' : 'Behandlungsraum'
                    return (
                      <div key={c.id} style={{ background: '#fff', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2ebe8', display: 'grid', gridTemplateColumns: '80px 1fr 120px', gap: '8px', alignItems: 'center' }}>
                        <div>
                          <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: '#8aada5', margin: 0 }}>Menge</p>
                          <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#1a2e2a', margin: 0, fontWeight: 500 }}>{c.menge}</p>
                        </div>
                        <div>
                          <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: '#8aada5', margin: 0 }}>Charge {c.charge_nr ? `(${c.charge_nr})` : '—'} • {locOrt}</p>
                        </div>
                        <input type="date" value={chargenInput[c.id] || ''} onChange={e => setChargenInput(inp => ({ ...inp, [c.id]: e.target.value }))}
                          style={inp(false)} />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Kritisch */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '12px', background: form.kritisch ? '#f0f5f4' : '#fafafa', borderRadius: '8px', border: `1px solid ${form.kritisch ? '#9ad89e' : '#e2ebe8'}` }}>
              <input type="checkbox" checked={form.kritisch} onChange={e => set('kritisch', e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: '#3d675e', cursor: 'pointer', flexShrink: 0 }} />
              <div>
                <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '14px', color: '#1a2e2a', margin: 0, fontWeight: form.kritisch ? 500 : 400 }}>★ Kritischer Artikel</p>
                <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '12px', color: '#8aada5', margin: '2px 0 0' }}>Wird im Dashboard und in Warnungen ganz oben angezeigt</p>
              </div>
            </label>

            {/* Kanülen-Spezifikation */}
            <div>
              <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#5a8a80', margin: '0 0 10px' }}>
                <strong>Kanülen (optional)</strong>
              </p>
              <div style={row2}>
                <div style={field}>
                  <label style={lbl}>Gauge (G)</label>
                  <select value={form.gauge} onChange={e => set('gauge', e.target.value)} style={inp(false)}>
                    <option value="">– Nicht angeben –</option>
                    {[18, 20, 22, 24, 25, 27, 30].map(g => <option key={g} value={g}>{g}G</option>)}
                  </select>
                </div>
                <div style={field}>
                  <label style={lbl}>Länge (mm)</label>
                  <input type="number" min="0" value={form.länge} onChange={e => set('länge', e.target.value)}
                    placeholder="z.B. 40" style={inp(false)} />
                </div>
              </div>
            </div>

            {/* Spritzen-Spezifikation */}
            <div>
              <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#5a8a80', margin: '0 0 10px' }}>
                <strong>Spritzen (optional)</strong>
              </p>
              <div style={row2}>
                <div style={field}>
                  <label style={lbl}>Volumen (ml)</label>
                  <input type="number" min="0" value={form.syringe_ml} onChange={e => set('syringe_ml', e.target.value)}
                    placeholder="z.B. 20" style={inp(false)} />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', background: form.luer_lock ? '#f0f5f4' : '#fafafa', borderRadius: '8px', border: `1px solid ${form.luer_lock ? '#d1e0db' : '#e2ebe8'}`, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.luer_lock} onChange={e => set('luer_lock', e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: '#3d675e', cursor: 'pointer' }} />
                  <span style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#5a8a80' }}>Luer Lock</span>
                </label>
              </div>
            </div>

            {/* Spezifikation (manuell) */}
            <div style={field}>
              <label style={lbl}>Spezifikation (manuell)</label>
              <input value={form.spezifikation} onChange={e => set('spezifikation', e.target.value)}
                placeholder="z.B. '20ml Luer', überschreibt automatische Angabe" style={inp(false)} />
            </div>

            {/* Notiz */}
            <div style={field}>
              <label style={lbl}>Notiz</label>
              <textarea value={form.notiz} onChange={e => set('notiz', e.target.value)}
                rows={3} placeholder="z.B. Nur für Behandlungszimmer 1, Steril ..."
                style={{ ...inp(false), resize: 'vertical', lineHeight: 1.5 }} />
            </div>

          </div>
        </div>

        {fehler.submit && (
          <div style={{ margin: '12px 28px 0', padding: '10px 14px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px' }}>
            <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#991b1b', margin: 0 }}>{fehler.submit}</p>
          </div>
        )}

        <div style={{ padding: '16px 28px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f0f5f4', marginTop: '8px' }}>
          {!isNeu && (
            <button onClick={async () => {
              if (!confirm('Artikel in den Papierkorb verschieben? Du kannst ihn unter Einstellungen → Papierkorb wiederherstellen.')) return
              await supabase.from('artikel').update({ deleted_at: new Date().toISOString() }).eq('id', artikel.id)
              push({ label: `"${form.bezeichnung}" gelöscht`, undo: async () => {
                await supabase.from('artikel').update({ deleted_at: null }).eq('id', artikel.id)
              }})
              onDone()
            }} style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', padding: '7px 14px', borderRadius: '7px', border: '1px solid #fca5a5', background: '#fff', color: '#991b1b', cursor: 'pointer' }}>
              Löschen
            </button>
          )}
          <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
            <button onClick={onClose} style={{ fontFamily: "'Geist', sans-serif", fontSize: '14px', fontWeight: 500, padding: '9px 20px', borderRadius: '8px', border: '1px solid #d1e0db', background: '#fff', color: '#3d675e', cursor: 'pointer' }}>
              Abbrechen
            </button>
            <button onClick={speichern} disabled={saving} style={{ fontFamily: "'Geist', sans-serif", fontSize: '14px', fontWeight: 500, padding: '9px 20px', borderRadius: '8px', border: 'none', background: '#3d675e', color: '#fff', cursor: 'pointer' }}>
              {saving ? '…' : isNeu ? 'Artikel anlegen' : 'Speichern'}
            </button>
          </div>
        </div>
      </div>

      {neuerLieferant && (
        <LieferantFormModal
          lieferant={null}
          onClose={() => setNeuerLieferant(false)}
          onDone={async () => {
            setNeuerLieferant(false)
            const { data } = await supabase.from('lieferanten').select('id').order('created_at', { ascending: false }).limit(1)
            if (data?.[0]) ladenLieferanten(data[0].id)
            else ladenLieferanten()
          }}
        />
      )}
    </div>
  )
}
