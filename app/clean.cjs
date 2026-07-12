const fs = require('fs')
const { createClient } = require('@supabase/supabase-js')

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf-8').split('\n')
    .filter(l => l.trim() && !l.startsWith('#'))
    .map(l => l.split('='))
)

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

async function clean() {
  const { data: artikel } = await supabase.from('artikel').select('*')
  let updated = 0

  for (const a of artikel) {
    const updates = {}
    let changed = false

    // Kanülen: 18G, 20G oder G18, G20
    if (!a.gauge || !a.länge) {
      const gaugeMatch = a.bezeichnung.match(/(?:(\d{2})G|G(\d{2}))/)
      const gauge = gaugeMatch ? parseInt(gaugeMatch[1] || gaugeMatch[2]) : null

      const laengeMatch = a.bezeichnung.match(/(\d+[.,]\d+|\d+)\s*×\s*(\d+)mm|(?:^|\s)(\d+)\s*mm/)
      const laenge = laengeMatch ? parseInt(laengeMatch[2] || laengeMatch[3]) : null

      if (gauge && !a.gauge) {
        updates.gauge = gauge
        changed = true
      }
      if (laenge && !a.länge) {
        updates.länge = laenge
        changed = true
      }
    }

    // Spritzen: 3ml, 5ml, 20ml
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

    // Bezeichnung bereinigen
    let newBezeichnung = a.bezeichnung
      .replace(/\s*(?:\d{2}G|G\d{2})\s*/g, ' ')
      .replace(/\s*\d+[.,]\d+\s*×\s*\d+\s*mm/g, ' ')
      .replace(/\s+\d+\s*mm(?=\s|$)/g, ' ')
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
      console.log(`✎ ${a.bezeichnung}`)
      console.log(`  → "${updates.bezeichnung || a.bezeichnung}" | G=${updates.gauge ?? a.gauge} L=${updates.länge ?? a.länge}`)
      await supabase.from('artikel').update(updates).eq('id', a.id)
      updated++
    }
  }

  console.log(`\n✓ ${updated}/${artikel.length} aktualisiert`)
}

clean()
