const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const envPath = path.join(__dirname, '.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')
const env = Object.fromEntries(
  envContent.split('\n')
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

    // Kanülen extrahieren
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

    // Spritzen extrahieren
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
      console.log(`✎ ${a.bezeichnung}`)
      console.log(`  → ${updates.bezeichnung || a.bezeichnung}`)
      console.log(`  gauge=${updates.gauge ?? a.gauge} länge=${updates.länge ?? a.länge}`)
      console.log(`  ml=${updates.syringe_ml ?? a.syringe_ml} luer=${updates.luer_lock ?? a.luer_lock}`)

      await supabase.from('artikel').update(updates).eq('id', a.id)
      updated++
    }
  }

  console.log(`\n✓ ${updated}/${artikel.length} aktualisiert`)
  process.exit(0)
}

clean().catch(e => { console.error(e); process.exit(1) })
