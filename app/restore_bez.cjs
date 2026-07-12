const fs = require('fs')
const { createClient } = require('@supabase/supabase-js')

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf-8').split('\n')
    .filter(l => l.trim() && !l.startsWith('#'))
    .map(l => l.split('='))
)

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

async function restore() {
  const { data: artikel } = await supabase.from('artikel').select('*')
  
  for (const a of artikel) {
    if (a.bezeichnung_original && a.bezeichnung !== a.bezeichnung_original) {
      await supabase.from('artikel')
        .update({ bezeichnung: a.bezeichnung_original })
        .eq('id', a.id)
      console.log(`✓ ${a.bezeichnung} → ${a.bezeichnung_original}`)
    }
  }
  
  console.log('✓ Fertig')
}

restore()
