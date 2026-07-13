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

export default function Bestellungen() {
  const [tab, setTab] = useState('offen') // 'offen' | 'bestellt' | 'lager'
  const [bestellungen, setBestellungen] = useState([])
  const [artikel, setArtikel] = useState([])
  const [lieferanten, setLieferanten] = useState([])
  const [loading, setLoading] = useState(true)
  const [neuerArtikelModal, setNeuerArtikelModal] = useState(false)
  const [ausArtikelListeModal, setAusArtikelListeModal] = useState(false)

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
          <div style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
            <button onClick={() => setAusArtikelListeModal(true)} style={btn(true, false)}>
              + Aus Artikelliste
            </button>
            <button onClick={() => setNeuerArtikelModal(true)} style={btn(false, false)}>
              + Neuer Artikel
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
          onClose={() => setNeuerArtikelModal(false)}
          onDone={() => { setNeuerArtikelModal(false); ladenDaten() }}
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
  const [selectedId, setSelectedId] = useState(null)
  const [menge, setMenge] = useState(1)
  const [saving, setSaving] = useState(false)

  const selected = artikel.find(a => a.id === selectedId)

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
      <div style={{ background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '500px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ padding: '24px 28px' }}>
          <h2 style={{ fontFamily: "'Geist', sans-serif", fontWeight: 400, fontSize: '20px', color: '#1a2e2a', margin: 0 }}>Aus Artikelliste</h2>
        </div>

        <div style={{ overflowY: 'auto', padding: '0 28px', flex: 1 }}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#5a8a80', display: 'block', marginBottom: '6px' }}>Artikel</label>
            <select value={selectedId || ''} onChange={e => setSelectedId(e.target.value || null)}
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1e0db', borderRadius: '8px', fontFamily: "'Geist', sans-serif", fontSize: '14px', color: '#1a2e2a' }}>
              <option value="">– Artikel auswählen –</option>
              {artikel.map(a => (
                <option key={a.id} value={a.id}>{a.bezeichnung} ({a.lieferant_name})</option>
              ))}
            </select>
          </div>

          {selected && (
            <div style={{ background: '#f0f5f4', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', fontFamily: "'Geist', sans-serif", color: '#5a8a80' }}>
              <p style={{ margin: '0 0 4px' }}>Bestand Lager: <strong>{selected.lager_bestand} {selected.einheit}</strong></p>
              <p style={{ margin: '0 0 4px' }}>Preis: <strong>€{(selected.letzter_preis || 0).toFixed(2)}</strong></p>
              <p style={{ margin: 0 }}>Lieferant: <strong>{selected.lieferant_name}</strong></p>
            </div>
          )}

          <div>
            <label style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#5a8a80', display: 'block', marginBottom: '6px' }}>Bestellmenge</label>
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

function NeuerArtikelModal({ lieferanten, onClose, onDone }) {
  const [form, setForm] = useState({ name: '', lieferant_id: '', preis: '', menge: 1, kategorie: '' })
  const [saving, setSaving] = useState(false)

  async function hinzufuegen() {
    if (!form.name.trim() || !form.lieferant_id || !form.preis) return
    setSaving(true)

    const artikel = await supabase.from('artikel').insert({
      bezeichnung: form.name.trim(),
      kategorie: form.kategorie.trim() || 'Sonstiges',
      lieferant_id: form.lieferant_id,
      einheit: 'Stück',
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
          einheit: 'Stück',
          preis_pro_einheit: parseFloat(form.preis),
        })
      }
    }

    setSaving(false)
    onDone()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '500px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ padding: '24px 28px' }}>
          <h2 style={{ fontFamily: "'Geist', sans-serif", fontWeight: 400, fontSize: '20px', color: '#1a2e2a', margin: 0 }}>Neuer Artikel</h2>
        </div>

        <div style={{ overflowY: 'auto', padding: '0 28px', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#5a8a80', display: 'block', marginBottom: '6px' }}>Artikel-Name *</label>
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="z.B. Wundpflaster Spezial" autoFocus
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1e0db', borderRadius: '8px', fontFamily: "'Geist', sans-serif", fontSize: '14px', color: '#1a2e2a', boxSizing: 'border-box' }} />
          </div>

          <div>
            <label style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#5a8a80', display: 'block', marginBottom: '6px' }}>Kategorie</label>
            <input type="text" value={form.kategorie} onChange={e => setForm({ ...form, kategorie: e.target.value })}
              placeholder="z.B. Verbandsmaterial"
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1e0db', borderRadius: '8px', fontFamily: "'Geist', sans-serif", fontSize: '14px', color: '#1a2e2a', boxSizing: 'border-box' }} />
          </div>

          <div>
            <label style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#5a8a80', display: 'block', marginBottom: '6px' }}>Lieferant *</label>
            <select value={form.lieferant_id} onChange={e => setForm({ ...form, lieferant_id: e.target.value })}
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1e0db', borderRadius: '8px', fontFamily: "'Geist', sans-serif", fontSize: '14px', color: '#1a2e2a', boxSizing: 'border-box' }}>
              <option value="">– Lieferant auswählen –</option>
              {lieferanten.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#5a8a80', display: 'block', marginBottom: '6px' }}>Preis (€) *</label>
              <input type="number" step="0.01" min="0" value={form.preis} onChange={e => setForm({ ...form, preis: e.target.value })}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1e0db', borderRadius: '8px', fontFamily: "'Geist', sans-serif", fontSize: '14px', color: '#1a2e2a', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#5a8a80', display: 'block', marginBottom: '6px' }}>Menge</label>
              <input type="number" min="1" value={form.menge} onChange={e => setForm({ ...form, menge: Math.max(1, parseInt(e.target.value) || 1) })}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1e0db', borderRadius: '8px', fontFamily: "'Geist', sans-serif", fontSize: '14px', color: '#1a2e2a', boxSizing: 'border-box' }} />
            </div>
          </div>
        </div>

        <div style={{ padding: '16px 28px 24px', display: 'flex', gap: '8px', borderTop: '1px solid #f0f5f4' }}>
          <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: '8px', border: '1px solid #d1e0db', background: '#fff', color: '#3d675e', cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: '14px', fontWeight: 500, flex: 1 }}>
            Abbrechen
          </button>
          <button onClick={hinzufuegen} disabled={!form.name.trim() || !form.lieferant_id || !form.preis || saving} style={{ ...btn(true, !form.name.trim() || !form.lieferant_id || !form.preis || saving), flex: 1 }}>
            {saving ? '…' : 'Hinzufügen'}
          </button>
        </div>
      </div>
    </div>
  )
}
