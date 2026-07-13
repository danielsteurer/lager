import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const btn = (primary, disabled) => ({
  fontFamily: "'Geist', sans-serif", fontSize: '13px', fontWeight: 500,
  padding: '7px 16px', borderRadius: '7px', border: primary ? 'none' : '1px solid #d1e0db',
  cursor: disabled ? 'not-allowed' : 'pointer',
  background: disabled ? '#e2ebe8' : (primary ? '#3d675e' : '#fff'),
  color: disabled ? '#8aada5' : (primary ? '#fff' : '#3d675e'),
  opacity: disabled ? 0.5 : 1,
})

const inp = {
  width: '100%', padding: '9px 12px', border: '1px solid #d1e0db', borderRadius: '8px',
  fontFamily: "'Geist', sans-serif", fontSize: '14px', color: '#1a2e2a', boxSizing: 'border-box',
}
const lbl = { fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#5a8a80', display: 'block', marginBottom: '6px' }

const EINHEIT_TYPEN = [
  { key: 'stueck',    label: 'Stück',     sub: null,                       einheitLabel: 'Stück' },
  { key: 'packung',   label: 'Packung',   sub: 'Stück pro Packung',        einheitLabel: 'Packung' },
  { key: 'flasche',   label: 'Flasche',   sub: 'Milliliter (ml)',          einheitLabel: 'Flasche' },
  { key: 'rolle',     label: 'Rolle',     sub: 'Stück pro Rolle (optional)', einheitLabel: 'Rolle' },
  { key: 'sonstiges', label: 'Sonstiges', sub: 'Einheit frei eingeben',    einheitLabel: '' },
]

function buildEinheit(typ, anzahl) {
  if (typ === 'stueck') return 'Stück'
  if (typ === 'flasche') return 'Flasche'
  if (typ === 'packung') return anzahl ? `P/${anzahl}` : 'P/?'
  if (typ === 'rolle') return anzahl ? `Rolle/${anzahl}` : 'Rolle'
  return anzahl || 'Stück'
}

const DEFAULT_KATEGORIEN = ['Handschuhe', 'Kanülen / Spritzen', 'Verbandsmaterial', 'Desinfektion', 'Medikamente', 'Ultraschall / EKG', 'Sonstiges']
const GAUGE_OPTIONEN = [18, 20, 22, 24, 25, 27, 30]

export default function Bestellungen() {
  const [tab, setTab] = useState('offen') // 'offen' | 'bestellt' | 'lager'
  const [bestellungen, setBestellungen] = useState([])
  const [artikel, setArtikel] = useState([])
  const [lieferanten, setLieferanten] = useState([])
  const [loading, setLoading] = useState(true)
  const [neuerArtikelModal, setNeuerArtikelModal] = useState(false)
  const [ausArtikelListeModal, setAusArtikelListeModal] = useState(false)
  const [mindestbestandModal, setMindestbestandModal] = useState(false)

  useEffect(() => {
    ladenDaten()
  }, [])

  async function ladenDaten() {
    try {
      const [best, art, lief] = await Promise.all([
        supabase.from('bestellungen').select('*, bestellpositionen(*), lieferanten(name)').order('created_at', { ascending: false }),
        supabase.from('artikel_bestand').select('*'),
        supabase.from('lieferanten').select('*'),
      ])

      setBestellungen(best.data ?? [])
      setArtikel(art.data ?? [])
      setLieferanten(lief.data ?? [])
      setLoading(false)
    } catch (err) {
      console.error(err)
      setLoading(false)
    }
  }

  const bestellungenNachStatus = bestellungen.filter(b => b.status === tab)
  const mindestbestandArtikel = artikel.filter(a => !a.kein_mindestbestand && a.lager_bestand <= a.mindestbestand)
  const kategorien = [...new Set([...DEFAULT_KATEGORIEN, ...artikel.map(a => a.kategorie).filter(Boolean)])].sort()

  if (loading) return <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '12px', color: '#3d675e', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Lade…</p>

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '12px', letterSpacing: '0.06em', color: '#3d675e', textTransform: 'uppercase', marginBottom: '6px' }}>
          werkeins PG · Lager
        </p>
        <h1 style={{ fontFamily: "'Geist', sans-serif", fontWeight: 300, fontSize: '32px', color: '#1a2e2a', margin: 0, lineHeight: 1.05 }}>
          Bestellungen
        </h1>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', borderBottom: '1px solid #e2ebe8', paddingBottom: '16px' }}>
        {[
          { key: 'offen', label: 'Bestellungen' },
          { key: 'bestellt', label: 'Bestellt' },
          { key: 'lager', label: 'Lager' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              fontFamily: "'Geist', sans-serif", fontSize: '14px', fontWeight: 500,
              border: 'none', background: 'none', cursor: 'pointer',
              color: tab === t.key ? '#3d675e' : '#8aada5',
              paddingBottom: '8px',
              borderBottom: tab === t.key ? '3px solid #3d675e' : 'none',
              transition: 'all 0.2s'
            }}
          >
            {t.label} ({bestellungen.filter(b => b.status === t.key).length})
          </button>
        ))}
      </div>

      {/* Tab: Bestellungen (offen) */}
      {tab === 'offen' && (
        <div>
          <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={() => setAusArtikelListeModal(true)} style={btn(true, false)}>
              + Aus Artikelliste
            </button>
            <button onClick={() => setNeuerArtikelModal(true)} style={btn(false, false)}>
              + Neuer Artikel
            </button>
            <button onClick={() => setMindestbestandModal(true)} style={btn(false, false)}>
              ⚠ Unter Mindestbestand ({mindestbestandArtikel.length})
            </button>
          </div>

          {bestellungenNachStatus.length === 0 ? (
            <div style={{ background: '#fff', border: '1px solid #e2ebe8', borderRadius: '12px', padding: '40px', textAlign: 'center' }}>
              <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '14px', color: '#8aada5', margin: 0 }}>Keine offenen Bestellungen</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {bestellungenNachStatus.map(b => (
                <BestellungCard
                  key={b.id}
                  bestellung={b}
                  onStatusChange={() => ladenDaten()}
                  onDelete={() => ladenDaten()}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Bestellt */}
      {tab === 'bestellt' && (
        <div>
          {bestellungenNachStatus.length === 0 ? (
            <div style={{ background: '#fff', border: '1px solid #e2ebe8', borderRadius: '12px', padding: '40px', textAlign: 'center' }}>
              <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '14px', color: '#8aada5', margin: 0 }}>Keine bestellten Artikel</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {bestellungenNachStatus.map(b => (
                <BestellungCard
                  key={b.id}
                  bestellung={b}
                  onStatusChange={() => ladenDaten()}
                  onDelete={() => ladenDaten()}
                  isGeliefert={false}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Lager */}
      {tab === 'lager' && (
        <div style={{ background: '#fff', border: '1px solid #e2ebe8', borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
          <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '14px', color: '#8aada5', margin: 0 }}>Lager-Ansicht kommt bald – für jetzt: Gehe zu "Artikel" Tab</p>
        </div>
      )}

      {/* Modals */}
      {ausArtikelListeModal && (
        <AusArtikelListeModal
          artikel={artikel}
          lieferanten={lieferanten}
          onClose={() => setAusArtikelListeModal(false)}
          onDone={() => { setAusArtikelListeModal(false); ladenDaten() }}
        />
      )}
      {neuerArtikelModal && (
        <NeuerArtikelModal
          lieferanten={lieferanten}
          kategorien={kategorien}
          onClose={() => setNeuerArtikelModal(false)}
          onDone={() => { setNeuerArtikelModal(false); ladenDaten() }}
        />
      )}
      {mindestbestandModal && (
        <MindestbestandModal
          artikel={mindestbestandArtikel}
          onClose={() => setMindestbestandModal(false)}
          onDone={() => { setMindestbestandModal(false); ladenDaten() }}
        />
      )}
    </div>
  )
}

function BestellungCard({ bestellung, onStatusChange, onDelete, isGeliefert }) {
  const positionen = bestellung.bestellpositionen || []

  async function statusAendern(neuerStatus) {
    await supabase.from('bestellungen').update({ status: neuerStatus }).eq('id', bestellung.id)
    onStatusChange()
  }

  async function loeschen() {
    if (!confirm('Bestellung wirklich löschen?')) return
    await supabase.from('bestellungen').delete().eq('id', bestellung.id)
    onDelete()
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e2ebe8', borderRadius: '12px', overflow: 'hidden' }}>
      <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f0f5f4' }}>
        <div>
          <p style={{ fontFamily: "'Geist', sans-serif", fontWeight: 500, fontSize: '14px', color: '#1a2e2a', margin: 0 }}>
            {positionen.length > 0 ? positionen[0].artikel?.bezeichnung : 'Artikel nicht gefunden'}
          </p>
          <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '12px', color: '#8aada5', margin: '4px 0 0' }}>
            Lieferant: {bestellung.lieferanten?.name || 'Unbekannt'} • Preis: €{positionen.reduce((sum, p) => sum + (p.preis_pro_einheit || 0) * (p.menge || 1), 0).toFixed(2)}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {bestellung.status === 'offen' && (
            <>
              <button onClick={() => statusAendern('bestellt')} style={btn(true, false)}>Bestellt</button>
              <button onClick={loeschen} style={{ ...btn(false, false), borderColor: '#fca5a5', color: '#991b1b' }}>Löschen</button>
            </>
          )}
          {bestellung.status === 'bestellt' && (
            <>
              <button onClick={() => statusAendern('geliefert')} style={btn(true, false)}>Wareneingang</button>
              <button onClick={() => statusAendern('offen')} style={btn(false, false)}>Zurück</button>
            </>
          )}
        </div>
      </div>
      <div style={{ padding: '12px 16px', background: '#f7faf9' }}>
        <table style={{ width: '100%', fontSize: '12px', fontFamily: "'Geist', sans-serif" }}>
          <tbody>
            {positionen.map((p, i) => (
              <tr key={i} style={{ borderBottom: i < positionen.length - 1 ? '1px solid #e2ebe8' : 'none' }}>
                <td style={{ padding: '6px 0', color: '#1a2e2a' }}>Menge: {p.menge} {p.einheit}</td>
                <td style={{ padding: '6px 0', color: '#8aada5', textAlign: 'right' }}>€{(p.preis_pro_einheit || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AusArtikelListeModal({ artikel, lieferanten, onClose, onDone }) {
  const [kategorie, setKategorie] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [menge, setMenge] = useState(1)
  const [suche, setSuche] = useState('')
  const [saving, setSaving] = useState(false)

  const kategorien = [...new Set(artikel.map(a => a.kategorie || 'Sonstiges'))].sort()
  const selected = artikel.find(a => a.id === selectedId)

  // Gefilterte Artikel: nach Kategorie + Suche
  const gefiltert = artikel.filter(a => {
    if (kategorie && (a.kategorie || 'Sonstiges') !== kategorie) return false
    if (suche && !a.bezeichnung.toLowerCase().includes(suche.toLowerCase())) return false
    return true
  })

  async function hinzufuegen() {
    if (!selectedId) return
    setSaving(true)

    const bestellung = await supabase.from('bestellungen').insert({
      lieferant_id: selected.lieferant_id,
      status: 'offen',
    }).select('id').single()

    if (bestellung.data) {
      await supabase.from('bestellpositionen').insert({
        bestellung_id: bestellung.data.id,
        artikel_id: selectedId,
        menge,
        einheit: selected.einheit,
        preis_pro_einheit: selected.letzter_preis,
      })
    }

    setSaving(false)
    onDone()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '520px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ padding: '24px 28px 16px' }}>
          <h2 style={{ fontFamily: "'Geist', sans-serif", fontWeight: 400, fontSize: '20px', color: '#1a2e2a', margin: 0 }}>Aus Artikelliste</h2>
        </div>

        <div style={{ overflowY: 'auto', padding: '0 28px', flex: 1 }}>
          {/* Kategorie-Filter */}
          <div style={{ marginBottom: '14px' }}>
            <label style={lbl}>Kategorie</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button onClick={() => { setKategorie(''); setSelectedId(null) }}
                style={{ padding: '6px 12px', borderRadius: '7px', border: `1px solid ${kategorie === '' ? '#3d675e' : '#d1e0db'}`, background: kategorie === '' ? '#f0f5f4' : '#fff', color: kategorie === '' ? '#3d675e' : '#8aada5', fontFamily: "'Geist', sans-serif", fontSize: '12px', fontWeight: kategorie === '' ? 600 : 400, cursor: 'pointer' }}>
                Alle
              </button>
              {kategorien.map(k => (
                <button key={k} onClick={() => { setKategorie(k); setSelectedId(null) }}
                  style={{ padding: '6px 12px', borderRadius: '7px', border: `1px solid ${kategorie === k ? '#3d675e' : '#d1e0db'}`, background: kategorie === k ? '#f0f5f4' : '#fff', color: kategorie === k ? '#3d675e' : '#8aada5', fontFamily: "'Geist', sans-serif", fontSize: '12px', fontWeight: kategorie === k ? 600 : 400, cursor: 'pointer' }}>
                  {k}
                </button>
              ))}
            </div>
          </div>

          {/* Suche */}
          <div style={{ marginBottom: '14px' }}>
            <input type="text" value={suche} onChange={e => setSuche(e.target.value)} placeholder="Suchen…" style={inp} />
          </div>

          {/* Artikel-Liste */}
          <div style={{ marginBottom: '16px', maxHeight: '260px', overflowY: 'auto', border: '1px solid #e2ebe8', borderRadius: '8px' }}>
            {gefiltert.length === 0 ? (
              <p style={{ padding: '16px', textAlign: 'center', fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#8aada5', margin: 0 }}>Keine Artikel</p>
            ) : gefiltert.map(a => (
              <div key={a.id} onClick={() => setSelectedId(a.id)}
                style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f7faf9', background: selectedId === a.id ? '#f0f5f4' : '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#1a2e2a', margin: 0, fontWeight: selectedId === a.id ? 500 : 400 }}>{a.bezeichnung}</p>
                  <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '11px', color: '#8aada5', margin: '2px 0 0' }}>{a.lieferant_name} • Lager: {a.lager_bestand} {a.einheit} • €{(a.letzter_preis || 0).toFixed(2)}</p>
                </div>
                {selectedId === a.id && <span style={{ color: '#3d675e', fontSize: '16px' }}>✓</span>}
              </div>
            ))}
          </div>

          {selected && (
            <div style={{ background: '#f0f5f4', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', fontFamily: "'Geist', sans-serif", color: '#5a8a80' }}>
              <p style={{ margin: '0 0 4px' }}>Einzelpreis: <strong>€{(selected.letzter_preis || 0).toFixed(2)}</strong></p>
              <p style={{ margin: '0 0 4px' }}>Gesamt ({menge}×): <strong style={{ color: '#3d675e' }}>€{((selected.letzter_preis || 0) * menge).toFixed(2)}</strong></p>
              <p style={{ margin: 0 }}>Lieferant: <strong>{selected.lieferant_name}</strong></p>
            </div>
          )}

          <div>
            <label style={lbl}>Bestellmenge</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button onClick={() => setMenge(Math.max(1, menge - 1))} style={{ padding: '6px 12px', border: '1px solid #d1e0db', borderRadius: '6px', cursor: 'pointer', background: '#fff' }}>−</button>
              <input type="number" min="1" value={menge} onChange={e => setMenge(Math.max(1, parseInt(e.target.value) || 1))}
                style={{ width: '60px', padding: '6px', border: '1px solid #d1e0db', borderRadius: '6px', textAlign: 'center' }} />
              <button onClick={() => setMenge(menge + 1)} style={{ padding: '6px 12px', border: '1px solid #d1e0db', borderRadius: '6px', cursor: 'pointer', background: '#fff' }}>+</button>
              <span style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#8aada5' }}>{selected?.einheit}</span>
            </div>
          </div>
        </div>

        <div style={{ padding: '16px 28px 24px', display: 'flex', gap: '8px', borderTop: '1px solid #f0f5f4' }}>
          <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: '8px', border: '1px solid #d1e0db', background: '#fff', color: '#3d675e', cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: '14px', fontWeight: 500, flex: 1 }}>
            Abbrechen
          </button>
          <button onClick={hinzufuegen} disabled={!selectedId || saving} style={{ ...btn(true, !selectedId || saving), flex: 1 }}>
            {saving ? '…' : 'Hinzufügen'}
          </button>
        </div>
      </div>
    </div>
  )
}

function NeuerArtikelModal({ lieferanten, kategorien, onClose, onDone }) {
  const [form, setForm] = useState({
    name: '', lieferant_id: '', preis: '', menge: 1, kategorie: '',
    gauge: '', länge: '', syringe_ml: '', luer_lock: false, spezifikation: '',
    charge_nr: '', verfallsdatum: '',
  })
  const [neueKat, setNeueKat] = useState(false)
  const [neueKatText, setNeueKatText] = useState('')
  const [einheitTyp, setEinheitTyp] = useState('stueck')
  const [einheitAnzahl, setEinheitAnzahl] = useState('') // Stück pro Packung / ml bei Flasche / Stück pro Rolle
  const [saving, setSaving] = useState(false)

  const typDef = EINHEIT_TYPEN.find(t => t.key === einheitTyp)
  const einheitVorschau = buildEinheit(einheitTyp, einheitAnzahl)
  const gueltig = form.name.trim() && form.lieferant_id && form.preis && form.kategorie &&
    !(einheitTyp === 'packung' && !einheitAnzahl) &&
    !(einheitTyp === 'sonstiges' && !einheitAnzahl.trim())

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function katHinzufuegen() {
    const k = neueKatText.trim()
    if (!k) return
    set('kategorie', k)
    setNeueKat(false)
    setNeueKatText('')
  }

  async function hinzufuegen() {
    if (!gueltig) return
    setSaving(true)

    const einheit = buildEinheit(einheitTyp, einheitAnzahl)
    // Manuelle Spezifikation überschreibt; sonst bei Flasche die ml
    const spezifikation = form.spezifikation.trim() || (einheitTyp === 'flasche' && einheitAnzahl ? `${einheitAnzahl}ml` : null)

    const artikel = await supabase.from('artikel').insert({
      bezeichnung: form.name.trim(),
      kategorie: form.kategorie,
      lieferant_id: form.lieferant_id,
      einheit,
      gauge: form.gauge ? parseInt(form.gauge) : null,
      länge: form.länge ? parseInt(form.länge) : null,
      syringe_ml: form.syringe_ml ? parseInt(form.syringe_ml) : null,
      luer_lock: form.luer_lock,
      spezifikation,
      letzter_preis: parseFloat(form.preis),
      mindestbestand: 0,
      kein_mindestbestand: true,
    }).select('id').single()

    if (artikel.data) {
      const bestellung = await supabase.from('bestellungen').insert({
        lieferant_id: form.lieferant_id,
        status: 'offen',
      }).select('id').single()

      if (bestellung.data) {
        await supabase.from('bestellpositionen').insert({
          bestellung_id: bestellung.data.id,
          artikel_id: artikel.data.id,
          menge: form.menge,
          einheit,
          preis_pro_einheit: parseFloat(form.preis),
          charge_nr: form.charge_nr.trim() || null,
          verfallsdatum: form.verfallsdatum || null,
        })
      }
    }

    setSaving(false)
    onDone()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '520px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ padding: '24px 28px 16px' }}>
          <h2 style={{ fontFamily: "'Geist', sans-serif", fontWeight: 400, fontSize: '20px', color: '#1a2e2a', margin: 0 }}>Neuer Artikel</h2>
          <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#8aada5', margin: '6px 0 0' }}>Wird in die Artikelliste übernommen und zur Bestellliste hinzugefügt.</p>
        </div>

        <div style={{ overflowY: 'auto', padding: '0 28px', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={lbl}>Artikel-Name *</label>
            <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="z.B. Wundpflaster Spezial" autoFocus style={inp} />
          </div>

          {/* Kategorie mit Dropdown + Neu */}
          <div>
            <label style={lbl}>Kategorie *</label>
            {!neueKat ? (
              <div style={{ display: 'flex', gap: '8px' }}>
                <select value={form.kategorie} onChange={e => set('kategorie', e.target.value)} style={{ ...inp, flex: 1 }}>
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
                  placeholder="Neue Kategorie eingeben" style={{ ...inp, flex: 1 }} />
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
          </div>

          <div>
            <label style={lbl}>Lieferant *</label>
            <select value={form.lieferant_id} onChange={e => set('lieferant_id', e.target.value)} style={inp}>
              <option value="">– Lieferant auswählen –</option>
              {lieferanten.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>

          {/* Einheit */}
          <div>
            <label style={lbl}>Einheit *</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {EINHEIT_TYPEN.map(t => (
                <button key={t.key} type="button"
                  onClick={() => { setEinheitTyp(t.key); setEinheitAnzahl('') }}
                  style={{ padding: '7px 14px', borderRadius: '8px', border: `1px solid ${einheitTyp === t.key ? '#3d675e' : '#d1e0db'}`, background: einheitTyp === t.key ? '#f0f5f4' : '#fff', color: einheitTyp === t.key ? '#3d675e' : '#8aada5', fontFamily: "'Geist', sans-serif", fontSize: '13px', fontWeight: einheitTyp === t.key ? 600 : 400, cursor: 'pointer' }}>
                  {t.label}
                </button>
              ))}
            </div>
            {typDef?.sub && (
              <input
                type={einheitTyp === 'sonstiges' ? 'text' : 'number'}
                min="1" value={einheitAnzahl}
                onChange={e => setEinheitAnzahl(e.target.value)}
                placeholder={typDef.sub}
                style={{ ...inp, marginTop: '8px' }} />
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
              <span style={{ fontFamily: "'Geist', sans-serif", fontSize: '12px', color: '#8aada5' }}>Einheit:</span>
              <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '13px', color: '#3d675e', background: '#f0f5f4', padding: '2px 8px', borderRadius: '4px' }}>{einheitVorschau}</span>
              {einheitTyp === 'flasche' && einheitAnzahl && (
                <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '12px', color: '#8aada5' }}>· {einheitAnzahl}ml</span>
              )}
            </div>
          </div>

          {/* Kanülen-Spezifikation */}
          <div>
            <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#5a8a80', margin: '0 0 8px' }}><strong>Kanülen (optional)</strong></p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={lbl}>Gauge (G)</label>
                <select value={form.gauge} onChange={e => set('gauge', e.target.value)} style={inp}>
                  <option value="">– Nicht angeben –</option>
                  {GAUGE_OPTIONEN.map(g => <option key={g} value={g}>{g}G</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Länge (mm)</label>
                <input type="number" min="0" value={form.länge} onChange={e => set('länge', e.target.value)} placeholder="z.B. 40" style={inp} />
              </div>
            </div>
          </div>

          {/* Spritzen-Spezifikation */}
          <div>
            <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#5a8a80', margin: '0 0 8px' }}><strong>Spritzen (optional)</strong></p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={lbl}>Volumen (ml)</label>
                <input type="number" min="0" value={form.syringe_ml} onChange={e => set('syringe_ml', e.target.value)} placeholder="z.B. 20" style={inp} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', background: form.luer_lock ? '#f0f5f4' : '#fafafa', borderRadius: '8px', border: `1px solid ${form.luer_lock ? '#d1e0db' : '#e2ebe8'}`, cursor: 'pointer', marginTop: '22px' }}>
                <input type="checkbox" checked={form.luer_lock} onChange={e => set('luer_lock', e.target.checked)} style={{ width: '16px', height: '16px', accentColor: '#3d675e', cursor: 'pointer' }} />
                <span style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#5a8a80' }}>Luer Lock</span>
              </label>
            </div>
          </div>

          {/* Spezifikation manuell */}
          <div>
            <label style={lbl}>Spezifikation (manuell)</label>
            <input value={form.spezifikation} onChange={e => set('spezifikation', e.target.value)}
              placeholder="z.B. '20ml Luer', überschreibt automatische Angabe" style={inp} />
          </div>

          {/* Charge + Verfall */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>Chargennummer</label>
              <input value={form.charge_nr} onChange={e => set('charge_nr', e.target.value)} placeholder="z.B. LOT12345" style={inp} />
            </div>
            <div>
              <label style={lbl}>Verfallsdatum</label>
              <input type="date" value={form.verfallsdatum} onChange={e => set('verfallsdatum', e.target.value)} style={inp} />
            </div>
          </div>

          {/* Preis + Menge */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>Einzelpreis (€) *</label>
              <input type="number" step="0.01" min="0" value={form.preis} onChange={e => set('preis', e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>Bestellmenge</label>
              <input type="number" min="1" value={form.menge} onChange={e => set('menge', Math.max(1, parseInt(e.target.value) || 1))} style={inp} />
            </div>
          </div>
          {form.preis && (
            <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '12px', color: '#5a8a80', margin: '-4px 0 0' }}>
              Gesamt: <strong style={{ color: '#3d675e' }}>€{(parseFloat(form.preis || 0) * form.menge).toFixed(2)}</strong>
            </p>
          )}
        </div>

        <div style={{ padding: '16px 28px 24px', display: 'flex', gap: '8px', borderTop: '1px solid #f0f5f4' }}>
          <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: '8px', border: '1px solid #d1e0db', background: '#fff', color: '#3d675e', cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: '14px', fontWeight: 500, flex: 1 }}>
            Abbrechen
          </button>
          <button onClick={hinzufuegen} disabled={!gueltig || saving} style={{ ...btn(true, !gueltig || saving), flex: 1 }}>
            {saving ? '…' : 'Hinzufügen'}
          </button>
        </div>
      </div>
    </div>
  )
}

function MindestbestandModal({ artikel, onClose, onDone }) {
  const [ausgewaehlt, setAusgewaehlt] = useState(new Set(artikel.map(a => a.id)))
  const [mengen, setMengen] = useState(() => {
    const init = {}
    artikel.forEach(a => { init[a.id] = Math.max(1, (a.mindestbestand * 2) - a.lager_bestand) })
    return init
  })
  const [saving, setSaving] = useState(false)

  function toggle(id) {
    setAusgewaehlt(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function hinzufuegen() {
    const liste = artikel.filter(a => ausgewaehlt.has(a.id) && mengen[a.id] > 0)
    if (!liste.length) return
    setSaving(true)

    for (const a of liste) {
      const bestellung = await supabase.from('bestellungen').insert({
        lieferant_id: a.lieferant_id,
        status: 'offen',
      }).select('id').single()

      if (bestellung.data) {
        await supabase.from('bestellpositionen').insert({
          bestellung_id: bestellung.data.id,
          artikel_id: a.id,
          menge: mengen[a.id],
          einheit: a.einheit,
          preis_pro_einheit: a.letzter_preis,
        })
      }
    }

    setSaving(false)
    onDone()
  }

  const anzahlAn = artikel.filter(a => ausgewaehlt.has(a.id)).length

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '560px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ padding: '24px 28px 16px' }}>
          <h2 style={{ fontFamily: "'Geist', sans-serif", fontWeight: 400, fontSize: '20px', color: '#1a2e2a', margin: 0 }}>Unter Mindestbestand</h2>
          <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#8aada5', margin: '6px 0 0' }}>Artikel deren Lager-Bestand am oder unter dem Minimum ist.</p>
        </div>

        <div style={{ overflowY: 'auto', padding: '0 28px', flex: 1 }}>
          {artikel.length === 0 ? (
            <p style={{ padding: '24px', textAlign: 'center', fontFamily: "'Geist', sans-serif", fontSize: '14px', color: '#8aada5' }}>Alle Bestände über dem Minimum 🎉</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {artikel.map(a => {
                const isAn = ausgewaehlt.has(a.id)
                return (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${isAn ? '#d1e0db' : '#e2ebe8'}`, background: isAn ? '#fff' : '#fafafa', opacity: isAn ? 1 : 0.5 }}>
                    <input type="checkbox" checked={isAn} onChange={() => toggle(a.id)} style={{ width: '15px', height: '15px', accentColor: '#3d675e', cursor: 'pointer', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#1a2e2a', margin: 0 }}>{a.bezeichnung}</p>
                      <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '11px', color: '#8aada5', margin: '2px 0 0' }}>{a.lieferant_name} • Lager: {a.lager_bestand} / Min: {a.mindestbestand}</p>
                      <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: '#5a8a80', margin: '3px 0 0' }}>
                        Einzel: €{(a.letzter_preis || 0).toFixed(2)} · Gesamt: <strong style={{ color: '#3d675e' }}>€{((a.letzter_preis || 0) * (mengen[a.id] ?? 1)).toFixed(2)}</strong>
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button onClick={() => setMengen(m => ({ ...m, [a.id]: Math.max(1, (m[a.id] ?? 1) - 1) }))} style={{ padding: '3px 9px', border: '1px solid #d1e0db', borderRadius: '6px', cursor: 'pointer', background: '#fff' }}>−</button>
                      <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '13px', minWidth: '24px', textAlign: 'center' }}>{mengen[a.id] ?? 1}</span>
                      <button onClick={() => setMengen(m => ({ ...m, [a.id]: (m[a.id] ?? 1) + 1 }))} style={{ padding: '3px 9px', border: '1px solid #d1e0db', borderRadius: '6px', cursor: 'pointer', background: '#fff' }}>+</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div style={{ padding: '16px 28px 24px', display: 'flex', gap: '8px', borderTop: '1px solid #f0f5f4' }}>
          <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: '8px', border: '1px solid #d1e0db', background: '#fff', color: '#3d675e', cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: '14px', fontWeight: 500, flex: 1 }}>
            Abbrechen
          </button>
          <button onClick={hinzufuegen} disabled={anzahlAn === 0 || saving} style={{ ...btn(true, anzahlAn === 0 || saving), flex: 1 }}>
            {saving ? '…' : `${anzahlAn} zur Bestellliste`}
          </button>
        </div>
      </div>
    </div>
  )
}
