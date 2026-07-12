// Startbestand-Import: seed.json → Supabase
// Ausführen mit: node supabase/import.js

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))

const SUPABASE_URL = 'https://vcmshoeuctzfhlvsciir.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjbXNob2V1Y3R6ZmhsdnNjaWlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3ODEzNTIsImV4cCI6MjA5OTM1NzM1Mn0.nSDPlQO6G8TjzVhuY_WMP5MAZlJBSRMEjIdRXXNPSiU'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const seed = JSON.parse(readFileSync(join(__dir, 'seed.json'), 'utf8'))

async function run() {
  // Verbindungstest
  console.log('→ Verbindungstest...')
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: { apikey: SUPABASE_KEY }
    })
    console.log('  Status:', res.status, res.statusText)
  } catch (e) {
    console.error('  Verbindung fehlgeschlagen:', e.message)
    console.error('  Ursache:', e.cause?.message ?? e.cause ?? '(unbekannt)')
    process.exit(1)
  }

  console.log('\n→ Importiere Lieferanten...')
  const lieferantenMap = {}

  for (const l of seed.lieferanten) {
    const { _id, ...data } = l
    const { data: row, error } = await supabase
      .from('lieferanten')
      .insert(data)
      .select('id')
      .single()
    if (error) { console.error(`  ✗ ${data.name}:`, error.message); continue }
    lieferantenMap[_id] = row.id
    console.log(`  ✓ ${data.name}`)
  }

  console.log('\n→ Importiere Artikel + Chargen...')
  for (const a of seed.artikel) {
    const { _lieferant, chargen, ...data } = a
    data.lieferant_id = lieferantenMap[_lieferant]

    const { data: artikel, error: ae } = await supabase
      .from('artikel')
      .insert(data)
      .select('id')
      .single()
    if (ae) { console.error(`  ✗ ${data.bezeichnung}:`, ae.message); continue }

    for (const c of chargen) {
      const { error: ce } = await supabase
        .from('chargen')
        .insert({ artikel_id: artikel.id, ...c })
      if (ce) console.error(`    ✗ Charge für ${data.bezeichnung}:`, ce.message)
    }
    console.log(`  ✓ ${data.bezeichnung} (${chargen.reduce((s, c) => s + c.menge, 0)} ${data.einheit})`)
  }

  console.log('\n✅ Import abgeschlossen.')
}

run()
