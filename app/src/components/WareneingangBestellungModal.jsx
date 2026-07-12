import { useState } from 'react'
import { supabase } from '../lib/supabase'

const inp = { padding: '7px 10px', border: '1px solid #d1e0db', borderRadius: '7px', fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#1a2e2a', outline: 'none', width: '100%', boxSizing: 'border-box' }

function stueckProEinheit(einheit) {
  const m = einheit?.match(/^P\/(\d+)/)
  return m ? parseInt(m[1]) : null
}

export default function WareneingangBestellungModal({ bestellung, onClose, onDone }) {
  const [positionen, setPositionen] = useState(
    bestellung.positionen.map(p => ({
      ...p,
      // Empfangene Menge (vorausgefüllt mit bestellter Menge)
      erhalten: p.menge,
      lager: p.menge,
      bz: 0,
      charge_nr: '',
      keine_charge: false,
      verfallsdatum: '',
      kein_verfall: false,
    }))
  )
  const [saving, setSaving] = useState(false)
  const [fehler, setFehler] = useState(null)

  function updatePos(idx, key, val) {
    setPositionen(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], [key]: val }

      // Wenn Lager geändert: BZ automatisch auf Rest setzen
      if (key === 'lager') {
        const rest = Math.max(0, parseFloat(next[idx].erhalten || 0) - parseFloat(val || 0))
        next[idx].bz = rest
      }
      // Wenn BZ geändert: Lager automatisch auf Rest setzen
      if (key === 'bz') {
        const rest = Math.max(0, parseFloat(next[idx].erhalten || 0) - parseFloat(val || 0))
        next[idx].lager = rest
      }
      // Wenn erhalten geändert: alles ins Lager
      if (key === 'erhalten') {
        next[idx].lager = parseFloat(val || 0)
        next[idx].bz = 0
      }
      return next
    })
  }

  async function einbuchen() {
    setFehler(null)
    for (const p of positionen) {
      if (!p.keine_charge && !p.charge_nr.trim()) {
        setFehler(`Bitte Charge-Nr. für „${p.bezeichnung}" eingeben oder „nicht vorhanden" wählen.`)
        return
      }
      if (!p.kein_verfall && !p.verfallsdatum) {
        setFehler(`Bitte Verfallsdatum für „${p.bezeichnung}" eingeben oder „nicht vorhanden" wählen.`)
        return
      }
      const total = parseFloat(p.lager || 0) + parseFloat(p.bz || 0)
      if (Math.abs(total - parseFloat(p.erhalten || 0)) > 0.001) {
        setFehler(`Lager + Behandlungsraum muss gleich der erhaltenen Menge sein bei „${p.bezeichnung}".`)
        return
      }
    }
    setSaving(true)

    for (const p of positionen) {
      const chargeNr = p.keine_charge ? null : p.charge_nr.trim()
      const verfall = p.kein_verfall ? null : p.verfallsdatum

      if (parseFloat(p.lager) > 0) {
        await supabase.from('chargen').insert({
          artikel_id: p.artikel_id, charge_nr: chargeNr,
          menge: parseFloat(p.lager), verfallsdatum: verfall, lagerort: 'lager',
        })
        await supabase.from('bewegungen').insert({
          artikel_id: p.artikel_id, menge: parseFloat(p.lager), typ: 'wareneingang', notiz: 'Wareneingang aus Bestellung',
        })
      }
      if (parseFloat(p.bz) > 0) {
        await supabase.from('chargen').insert({
          artikel_id: p.artikel_id, charge_nr: chargeNr,
          menge: parseFloat(p.bz), verfallsdatum: verfall, lagerort: 'behandlungsraum',
        })
        await supabase.from('bewegungen').insert({
          artikel_id: p.artikel_id, menge: parseFloat(p.bz), typ: 'wareneingang', notiz: 'Wareneingang → Behandlungsraum',
        })
      }
    }

    // Bestellung als geliefert markieren, Merkliste zurücksetzen
    await supabase.from('bestellungen').update({ status: 'geliefert', geliefert_am: new Date().toISOString().split('T')[0] }).eq('id', bestellung.id)
    await supabase.from('artikel').update({ auf_merkliste: false, bestellmenge: null })
      .in('id', positionen.map(p => p.artikel_id))

    setSaving(false)
    onDone()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '680px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>

        <div style={{ padding: '24px 28px 16px' }}>
          <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: '#3d675e', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 4px' }}>Wareneingang buchen</p>
          <h2 style={{ fontFamily: "'Geist', sans-serif", fontWeight: 400, fontSize: '20px', color: '#1a2e2a', margin: '0 0 4px' }}>{bestellung.lieferant_name}</h2>
          <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#8aada5', margin: 0 }}>Bestellt am {new Date(bestellung.bestellt_am).toLocaleDateString('de-AT')} · {positionen.length} Artikel</p>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '0 28px' }}>
          {positionen.map((p, idx) => {
            const spE = stueckProEinheit(p.einheit)
            const lagerStk = spE ? Math.round(parseFloat(p.lager || 0) * spE) : null
            const bzStk = spE ? Math.round(parseFloat(p.bz || 0) * spE) : null

            return (
              <div key={p.id} style={{ borderBottom: idx < positionen.length - 1 ? '1px solid #f0f5f4' : 'none', padding: '16px 0' }}>
                <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '14px', fontWeight: 500, color: '#1a2e2a', margin: '0 0 10px' }}>
                  {p.bezeichnung}
                  <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: '#8aada5', fontWeight: 400, marginLeft: '8px' }}>bestellt: {p.menge} {p.einheit}</span>
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <div>
                    <label style={{ fontFamily: "'Geist', sans-serif", fontSize: '12px', color: '#5a8a80', display: 'block', marginBottom: '3px' }}>Erhalten ({p.einheit})</label>
                    <input type="number" min="0" step="0.5" value={p.erhalten}
                      onChange={e => updatePos(idx, 'erhalten', e.target.value)} style={inp} />
                  </div>
                  <div>
                    <label style={{ fontFamily: "'Geist', sans-serif", fontSize: '12px', color: '#3d675e', display: 'block', marginBottom: '3px' }}>
                      → Lager {lagerStk !== null ? <span style={{ color: '#8aada5' }}>({lagerStk} Stk)</span> : ''}
                    </label>
                    <input type="number" min="0" step="0.5" value={p.lager}
                      onChange={e => updatePos(idx, 'lager', e.target.value)} style={{ ...inp, borderColor: '#9ad89e' }} />
                  </div>
                  <div>
                    <label style={{ fontFamily: "'Geist', sans-serif", fontSize: '12px', color: '#5a8a80', display: 'block', marginBottom: '3px' }}>
                      → Behandlungsraum {bzStk !== null ? <span style={{ color: '#8aada5' }}>({bzStk} Stk)</span> : ''}
                    </label>
                    <input type="number" min="0" step="0.5" value={p.bz}
                      onChange={e => updatePos(idx, 'bz', e.target.value)} style={{ ...inp, borderColor: '#d1e0db' }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ fontFamily: "'Geist', sans-serif", fontSize: '12px', color: '#5a8a80', display: 'block', marginBottom: '3px' }}>Charge-Nr. {p.keine_charge ? '' : '*'}</label>
                    <input type="text" value={p.charge_nr} disabled={p.keine_charge}
                      onChange={e => updatePos(idx, 'charge_nr', e.target.value)}
                      placeholder="z.B. 50012543" style={{ ...inp, opacity: p.keine_charge ? 0.4 : 1 }} />
                    <label style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px', cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: '11px', color: '#8aada5' }}>
                      <input type="checkbox" checked={p.keine_charge} onChange={e => updatePos(idx, 'keine_charge', e.target.checked)} />
                      Nicht vorhanden
                    </label>
                  </div>
                  <div>
                    <label style={{ fontFamily: "'Geist', sans-serif", fontSize: '12px', color: '#5a8a80', display: 'block', marginBottom: '3px' }}>Verfallsdatum {p.kein_verfall ? '' : '*'}</label>
                    <input type="date" value={p.verfallsdatum} disabled={p.kein_verfall}
                      onChange={e => updatePos(idx, 'verfallsdatum', e.target.value)}
                      style={{ ...inp, opacity: p.kein_verfall ? 0.4 : 1 }} />
                    <label style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px', cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: '11px', color: '#8aada5' }}>
                      <input type="checkbox" checked={p.kein_verfall} onChange={e => updatePos(idx, 'kein_verfall', e.target.checked)} />
                      Nicht vorhanden
                    </label>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {fehler && (
          <div style={{ margin: '0 28px', padding: '10px 14px', background: '#fee2e2', borderRadius: '8px' }}>
            <p style={{ fontFamily: "'Geist', sans-serif", fontSize: '13px', color: '#991b1b', margin: 0 }}>{fehler}</p>
          </div>
        )}

        <div style={{ padding: '16px 28px 24px', display: 'flex', gap: '8px', justifyContent: 'flex-end', borderTop: '1px solid #f0f5f4', marginTop: '8px' }}>
          <button onClick={onClose} style={{ fontFamily: "'Geist', sans-serif", fontSize: '14px', fontWeight: 500, padding: '9px 20px', borderRadius: '8px', border: '1px solid #d1e0db', background: '#fff', color: '#3d675e', cursor: 'pointer' }}>
            Abbrechen
          </button>
          <button onClick={einbuchen} disabled={saving} style={{ fontFamily: "'Geist', sans-serif", fontSize: '14px', fontWeight: 500, padding: '9px 20px', borderRadius: '8px', border: 'none', background: '#3d675e', color: '#fff', cursor: 'pointer' }}>
            {saving ? '…' : '✓ Wareneingang einbuchen'}
          </button>
        </div>
      </div>
    </div>
  )
}
