-- Finanzen: monatliche Ausgaben (Fixkosten) + Einnahmen (z.B. Fitnessabos)
create table if not exists finanzposten (
  id              uuid primary key default gen_random_uuid(),
  -- 'ausgabe' | 'einnahme'
  typ             text not null default 'ausgabe',
  bezeichnung     text not null,
  kategorie       text,
  anbieter        text,
  betrag          numeric not null default 0,
  -- 'monatlich' | 'quartalsweise' | 'jaehrlich'
  intervall       text not null default 'monatlich',
  naechste_zahlung date,
  vertragsnr      text,
  notiz           text,
  created_at      timestamptz default now()
);

alter table finanzposten disable row level security;
