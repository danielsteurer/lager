import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import LieferantFormModal from '../components/LieferantFormModal'

const BESTELLWEG_LABEL = { email: 'E-Mail', online: 'Online-Shop', telefon: 'Telefon' }

export default function Lieferanten() {
  const [lieferanten, setLieferanten] = useState([])
  const [loading, setLoading] = useState(true)
  const [formModal, setFormModal] = useState(null) // null=zu, false=neu, obj=bearbeiten

  function laden() {
    supabase.from('lieferanten').select('*').is('deleted_at', null).order('name')
      .then(({ data }) => { setLieferanten(data ?? []); setLoading(false) })
  }
  useEffect(() => { laden() }, [])

  return (
    <div style={{ position: 'relative' }}>
      <div className="mb-6">
        <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '12px', letterSpacing: '0.06em', color: '#3d675e', textTransform: 'uppercase', marginBottom: '6px' }}>
          werkeins PG · Lager
        </p>
        <h1 style={{ fontFamily: "'Geist', sans-serif", fontWeight: 300, fontSize: '32px', color: '#1a2e2a', margin: 0, lineHeight: 1.05 }}>
          Lieferanten
        </h1>
      </div>

      <button onClick={() => setFormModal(false)}
        style={{ position: 'absolute', top: '0', right: '0', fontFamily: "'Geist', sans-serif", fontSize: '14px', fontWeight: 500, padding: '9px 20px', borderRadius: '8px', border: 'none', background: '#3d675e', color: '#fff', cursor: 'pointer' }}>
        + Neuer Lieferant
      </button>

      {loading ? (
        <p style={{ color: '#8aada5', fontFamily: "'Geist', sans-serif", fontSize: '14px' }}>Lade…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {lieferanten.map(l => (
            <div key={l.id} style={{ background: '#fff', border: '1px solid #e2ebe8', borderRadius: '12px', padding: '20px 24px', position: 'relative' }}>

              <button onClick={() => setFormModal(l)}
                style={{ position: 'absolute', top: '16px', right: '16px', fontFamily: "'Geist', sans-serif", fontSize: '12px', padding: '4px 10px', borderRadius: '6px', border: '1px solid #d1e0db', background: '#fff', color: '#5a8a80', cursor: 'pointer' }}>
                ✎
              </button>

              <div style={{ marginBottom: '12px', paddingRight: '40px' }}>
                <h2 style={{ fontFamily: "'Geist', sans-serif", fontWeight: 500, fontSize: '16px', color: '#1a2e2a', margin: '0 0 6px' }}>{l.name}</h2>
                <span style={{ background: '#f0f5f4', color: '#3d675e', fontSize: '11px', fontFamily: "'Geist Mono', monospace", padding: '2px 8px', borderRadius: '4px' }}>
                  {BESTELLWEG_LABEL[l.bestellweg] ?? l.bestellweg}
                </span>
              </div>

              <div style={{ fontSize: '13px', color: '#5a8a80', fontFamily: "'Geist', sans-serif", display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {l.email && <a href={`mailto:${l.email}`} style={{ color: '#3d675e', textDecoration: 'none' }}>{l.email}</a>}
                {l.telefon && <span>{l.telefon}</span>}
                {l.webshop_url && (
                  <a href={l.webshop_url} target="_blank" rel="noreferrer" style={{ color: '#3d675e', textDecoration: 'none' }}>
                    {l.webshop_url.replace('https://', '')}
                  </a>
                )}
                {l.kundennummer && <span style={{ color: '#8aada5' }}>Kundennr. {l.kundennummer}</span>}
                {l.lieferzeit && <span style={{ color: '#8aada5' }}>Lieferzeit: {l.lieferzeit}</span>}
              </div>

              {l.notiz && (
                <p style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f0f5f4', fontSize: '12px', color: '#8aada5', fontFamily: "'Geist', sans-serif", margin: '12px 0 0' }}>
                  {l.notiz}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {formModal !== null && (
        <LieferantFormModal
          lieferant={formModal || null}
          onClose={() => setFormModal(null)}
          onDone={() => { setFormModal(null); setLoading(true); laden() }}
        />
      )}
    </div>
  )
}
