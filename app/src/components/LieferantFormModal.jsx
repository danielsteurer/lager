import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useUndo } from '../lib/UndoContext'
import { defaultEmailVorlage } from '../lib/emailVorlage'

const field = { display: 'flex', flexDirection: 'column', gap: '4px' }
const lbl = { fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#5a8a80' }
const inp = (err) => ({
  padding: '9px 12px', border: `1px solid ${err ? '#fca5a5' : '#d1e0db'}`,
  borderRadius: '8px', fontFamily: "'Geist', sans-serif", fontSize: '14px',
  color: '#1a2e2a', outline: 'none', background: '#fff', width: '100%', boxSizing: 'border-box',
})
const row2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }

export default function LieferantFormModal({ lieferant, onClose, onDone }) {
  const isNeu = !lieferant
  const { push } = useUndo()
  const [saving, setSaving] = useState(false)
  const [autoSaveStatus, setAutoSaveStatus] = useState(null)
  const [fehler, setFehler] = useState({})

  const [form, setForm] = useState({
    name: lieferant?.name ?? '',
    email: lieferant?.email ?? '',
    telefon: lieferant?.telefon ?? '',
    bestellweg: lieferant?.bestellweg ?? 'email',
    webshop_url: lieferant?.webshop_url ?? '',
    kundennummer: lieferant?.kundennummer ?? '',
    lieferzeit: lieferant?.lieferzeit ?? '',
    notiz: lieferant?.notiz ?? '',
  })

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setFehler(e => ({ ...e, [k]: null })) }

  useEffect(() => {
    if (isNeu) return
    const timer = setTimeout(() => { autoSave() }, 1000)
    return () => clearTimeout(timer)
  }, [form])

  async function autoSave() {
    if (isNeu || !lieferant?.id) return
    setAutoSaveStatus('speichert...')

    const data = {
      name: form.name.trim() || 'Unbenannt',
      email: form.email.trim() || null,
      telefon: form.telefon.trim() || null,
      bestellweg: form.bestellweg,
      webshop_url: form.webshop_url.trim() || null,
      kundennummer: form.kundennummer.trim() || null,
      lieferzeit: form.lieferzeit.trim() || null,
      notiz: form.notiz.trim() || null,
    }

    try {
      await supabase.from('lieferanten').update(data).eq('id', lieferant.id)
      setAutoSaveStatus('✓ Gespeichert')
      setTimeout(() => setAutoSaveStatus(null), 2000)
    } catch (err) {
      setAutoSaveStatus('❌ Fehler')
      setTimeout(() => setAutoSaveStatus(null), 3000)
    }
  }

  async function speichern() {
    const err = {}
    if (!form.name.trim()) err.name = 'Pflichtfeld'
    if (form.bestellweg !== 'telefon' && !form.email.trim()) err.email = 'E-Mail ist erforderlich für diesen Bestellweg'
    if (Object.keys(err).length) { setFehler(err); return }
    setSaving(true)

    const data = {
      name: form.name.trim(),
      email: form.email.trim() || null,
      telefon: form.telefon.trim() || null,
      bestellweg: form.bestellweg,
      webshop_url: form.webshop_url.trim() || null,
      kundennummer: form.kundennummer.trim() || null,
      lieferzeit: form.lieferzeit.trim() || null,
      notiz: form.notiz.trim() || null,
      // Beim ersten Anlegen automatisch Standard-Vorlage setzen wenn E-Mail vorhanden
      ...(isNeu && form.email.trim() ? { email_vorlage: defaultEmailVorlage(form.name.trim()) } : {}),
    }

    if (isNeu) {
      await supabase.from('lieferanten').insert(data)
    } else {
      await supabase.from('lieferanten').update(data).eq('id', lieferant.id)
    }
    setSaving(false)
    onDone()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '500px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>

        <div style={{ padding: '24px 28px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: '#3d675e', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 4px' }}>
                {isNeu ? 'Neuer Lieferant' : 'Lieferant bearbeiten'}
              </p>
              <h2 style={{ fontFamily: "'Geist', sans-serif", fontWeight: 400, fontSize: '20px', color: '#1a2e2a', margin: '0 0 20px' }}>
                {isNeu ? 'Lieferant anlegen' : form.name}
              </h2>
            </div>
            {autoSaveStatus && !isNeu && (
              <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '12px', color: autoSaveStatus.startsWith('✓') ? '#166534' : '#991b1b', margin: '4px 0 0', fontWeight: 500 }}>
                {autoSaveStatus}
              </p>
            )}
          </div>
        </div>

        <div style={{ overflowY: 'auto', padding: '0 28px', flex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingBottom: '8px' }}>

            <div style={field}>
              <label style={lbl}>Name *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="z.B. Hofsteig-Apotheke" autoFocus style={inp(fehler.name)} />
              {fehler.name && <span style={{ fontSize: '12px', color: '#991b1b', fontFamily: "'Geist', sans-serif" }}>{fehler.name}</span>}
            </div>

            <div style={field}>
              <label style={lbl}>Bestellweg</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[['email', 'E-Mail'], ['online', 'Online-Shop'], ['telefon', 'Telefon']].map(([val, lab]) => (
                  <button key={val} onClick={() => set('bestellweg', val)}
                    style={{ flex: 1, padding: '8px', borderRadius: '8px', border: `1px solid ${form.bestellweg === val ? '#3d675e' : '#d1e0db'}`, background: form.bestellweg === val ? '#f0f5f4' : '#fff', color: form.bestellweg === val ? '#3d675e' : '#8aada5', fontFamily: "'Geist', sans-serif", fontSize: '13px', fontWeight: form.bestellweg === val ? 500 : 400, cursor: 'pointer' }}>
                    {lab}
                  </button>
                ))}
              </div>
            </div>

            <div style={row2}>
              <div style={field}>
                <label style={lbl}>E-Mail {form.bestellweg !== 'telefon' ? '*' : ''}</label>
                <input value={form.email} onChange={e => set('email', e.target.value)}
                  placeholder="office@lieferant.at" type="email" style={inp(fehler.email)} />
                {fehler.email && <span style={{ fontSize: '12px', color: '#991b1b', fontFamily: "'Geist', sans-serif" }}>{fehler.email}</span>}
              </div>
              <div style={field}>
                <label style={lbl}>Telefon</label>
                <input value={form.telefon} onChange={e => set('telefon', e.target.value)}
                  placeholder="+43 5574 ..." style={inp(false)} />
              </div>
            </div>

            {form.bestellweg === 'online' && (
              <div style={field}>
                <label style={lbl}>Webshop URL</label>
                <input value={form.webshop_url} onChange={e => set('webshop_url', e.target.value)}
                  placeholder="https://www.shop.at" style={inp(false)} />
              </div>
            )}

            <div style={row2}>
              <div style={field}>
                <label style={lbl}>Kundennummer</label>
                <input value={form.kundennummer} onChange={e => set('kundennummer', e.target.value)}
                  placeholder="z.B. 214447" style={inp(false)} />
              </div>
              <div style={field}>
                <label style={lbl}>Lieferzeit</label>
                <input value={form.lieferzeit} onChange={e => set('lieferzeit', e.target.value)}
                  placeholder="z.B. 1–2 Werktage" style={inp(false)} />
              </div>
            </div>

            <div style={field}>
              <label style={lbl}>Notiz</label>
              <textarea value={form.notiz} onChange={e => set('notiz', e.target.value)}
                rows={2} placeholder="z.B. Ansprechpartner, Rabatt, Mindestbestellwert ..."
                style={{ ...inp(false), resize: 'vertical', lineHeight: 1.5 }} />
            </div>

          </div>
        </div>

        <div style={{ padding: '16px 28px 24px', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f0f5f4', marginTop: '8px' }}>
          {!isNeu && (
            <button onClick={async () => {
              if (!confirm('Lieferant in den Papierkorb verschieben? Du kannst ihn unter Einstellungen → Papierkorb wiederherstellen.')) return
              await supabase.from('lieferanten').update({ deleted_at: new Date().toISOString() }).eq('id', lieferant.id)
              push({ label: `Lieferant "${form.name}" gelöscht`, undo: async () => {
                await supabase.from('lieferanten').update({ deleted_at: null }).eq('id', lieferant.id)
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
              {saving ? '…' : isNeu ? 'Lieferant anlegen' : 'Speichern'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
