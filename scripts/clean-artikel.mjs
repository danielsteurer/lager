import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

async function cleanArtikel() {
  const { data: artikel, error } = await supabase.from('artikel').select('*')
  if (error) { console.error(error); return }

  let updated = 0
  for (const a of artikel) {
    const updates = {}
    let changed = false

    // Kanülen: extrahiere Gauge + Länge
    if (!a.gauge || !a.länge) {
      const gaugeMatch = a.bezeichnung.match(/(\d{2})G/)
      const laengeMatch = a.bezeichnung.match(/(\d+[.,]\d+|\d+)×(\d+)mm|(\d+[.,]\d+|\d+)\s*mm/)

      if (gaugeMatch && !a.gauge) {
        updates.gauge = parseInt(gaugeMatch[1])
        changed = true
      }
      if (laengeMatch && !a.länge) {
        const mm = laengeMatch[2] || laengeMatch[3]
        updates.länge = parseInt(mm)
        changed = true
      }
    }

    // Spritzen: extrahiere ml + Luer-Lock
    if (!a.syringe_ml || a.luer_lock === null) {
      const mlMatch = a.bezeichnung.match(/(\d+)\s*ml/i)
      const luerMatch = /luer\s*[-\s]*lock|ll/i.test(a.bezeichnung)

      if (mlMatch && !a.syringe_ml) {
        updates.syringe_ml = parseInt(mlMatch[1])
        changed = true
      }
      if (luerMatch && a.luer_lock === null) {
        updates.luer_lock = true
        changed = true
      }
    }

    // Bereinige Bezeichnung: entferne Gauge, Länge, ml, Luer-Lock
    let newBezeichnung = a.bezeichnung
      .replace(/\s*\d{2}G\s*/g, ' ')
      .replace(/\s*\d+[.,]\d+×\d+mm/g, ' ')
      .replace(/\s*\d+\s*mm/g, ' ')
      .replace(/\s*\d+\s*ml\s*/gi, ' ')
      .replace(/\s*luer\s*[-\s]*lock\s*/gi, ' ')
      .replace(/\s*\bll\b\s*/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (newBezeichnung !== a.bezeichnung) {
      updates.bezeichnung = newBezeichnung
      changed = true
    }

    if (changed) {
      console.log(`Updating: ${a.bezeichnung}`)
      console.log(`  → gauge: ${updates.gauge ?? a.gauge}, länge: ${updates.länge ?? a.länge}`)
      console.log(`  → syringe_ml: ${updates.syringe_ml ?? a.syringe_ml}, luer_lock: ${updates.luer_lock ?? a.luer_lock}`)
      console.log(`  → neue Bezeichnung: ${updates.bezeichnung ?? a.bezeichnung}`)

      const { error: updateError } = await supabase.from('artikel').update(updates).eq('id', a.id)
      if (updateError) {
        console.error(`  Error: ${updateError.message}`)
      } else {
        updated++
      }
    }
  }

  console.log(`\n✓ ${updated} Artikel aktualisiert`)
}

cleanArtikel()
