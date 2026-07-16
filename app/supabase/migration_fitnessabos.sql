-- Fitness-Abos: Klassen mit Laufzeit, monatliche Zahlung
-- Klasse 1 = 3 Monate (79€/Mon), Klasse 2 = 6 Monate (74€/Mon), Klasse 3 = 12 Monate (69€/Mon)
create table if not exists fitnessabos (
  id          uuid primary key default gen_random_uuid(),
  klasse      int not null,        -- 1 | 2 | 3
  anzahl      int not null default 1,
  startdatum  date not null,
  notiz       text,
  created_at  timestamptz default now()
);

alter table fitnessabos disable row level security;
