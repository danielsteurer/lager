const fs = require('fs')
const { createClient } = require('@supabase/supabase-js')

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf-8').split('\n')
    .filter(l => l.trim() && !l.startsWith('#'))
    .map(l => l.split('='))
)

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

async function fill() {
  const { data: artikel } = await supabase.from('artikel').select('*')
  let count = 0
  
  for (const a of artikel) {
    let original = a.bezeichnung
    
    if (a.gauge) {
      original += ` ${a.gauge}G ${a.länge || 0}mm`
    }
    if (a.syringe_ml) {
      original += ` ${a.syringe_ml}ml`
      if (a.luer_lock) original += ' Luer-Lock'
    }
    
    if (original !== a.bezeichnung_original) {
      const { error } = await supabase.from('artikel').update({ bezeichnung_original: original }).eq('id', a.id)
      if (error) console.error(`Fehler bei ${a.id}: ${error.message}`)
      else {
        console.log(`✓ ${a.bezeichnung}`)
        count++
      }
    }
  }
  
  console.log(`\n✓ ${count} gefüllt`)
}

fill()
