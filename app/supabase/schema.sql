-- =============================================================
-- werkeins Lagerverwaltung – Supabase Schema
-- Dieses Script in den Supabase SQL Editor einfügen & ausführen.
-- =============================================================

-- -------------------------------------------------------
-- 1. LIEFERANTEN
-- -------------------------------------------------------
create table lieferanten (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text,
  telefon     text,
  -- 'email' | 'online' | 'telefon'
  bestellweg  text not null default 'email',
  webshop_url text,
  kundennummer text,
  -- z.B. "3–5 Werktage"
  lieferzeit  text,
  notiz       text,
  created_at  timestamptz default now()
);

-- -------------------------------------------------------
-- 2. ARTIKEL
-- -------------------------------------------------------
create table artikel (
  id                    uuid primary key default gen_random_uuid(),
  bezeichnung           text not null,
  -- frei definierbar, z.B. "Handschuhe", "Kanülen/Spritzen"
  kategorie             text,
  lieferant_id          uuid references lieferanten(id) on delete set null,
  -- Artikelnummer beim Lieferanten (für Webshop-Suche / Pickliste)
  lieferant_artikelnr   text,
  -- frei, z.B. "Stück", "P/100", "Flasche"
  einheit               text not null default 'Stück',
  mindestbestand        numeric not null default 0,
  -- Kritischer Artikel (z.B. Notfallmedikament) → oben in Warnungen
  kritisch              boolean not null default false,
  -- Manuell auf Nachbestell-Merkliste setzen
  auf_merkliste         boolean not null default false,
  letzter_preis         numeric,
  notiz                 text,
  created_at            timestamptz default now()
);

-- -------------------------------------------------------
-- 3. CHARGEN  (mehrere Chargen pro Artikel, FEFO)
-- -------------------------------------------------------
create table chargen (
  id             uuid primary key default gen_random_uuid(),
  artikel_id     uuid not null references artikel(id) on delete cascade,
  charge_nr      text,
  menge          numeric not null default 0,
  verfallsdatum  date,
  created_at     timestamptz default now()
);

-- Index damit FEFO-Abfragen schnell sind
create index chargen_artikel_verfall on chargen(artikel_id, verfallsdatum asc nulls last);

-- View: aktueller Bestand pro Artikel (Summe der Chargen)
create view artikel_bestand as
  select
    a.*,
    coalesce(sum(c.menge), 0)      as bestand,
    min(c.verfallsdatum)            as naechstes_verfallsdatum,
    l.name                          as lieferant_name,
    l.bestellweg                    as lieferant_bestellweg,
    l.email                         as lieferant_email,
    l.webshop_url                   as lieferant_webshop
  from artikel a
  left join chargen c on c.artikel_id = a.id
  left join lieferanten l on l.id = a.lieferant_id
  group by a.id, l.name, l.bestellweg, l.email, l.webshop_url;

-- -------------------------------------------------------
-- 4. BEWEGUNGEN  (Verbrauch + Zugänge → Statistik)
-- -------------------------------------------------------
create table bewegungen (
  id          uuid primary key default gen_random_uuid(),
  artikel_id  uuid not null references artikel(id) on delete cascade,
  charge_id   uuid references chargen(id) on delete set null,
  -- positiv = Zugang (Wareneingang), negativ = Abgang (Verbrauch)
  menge       numeric not null,
  -- 'verbrauch' | 'wareneingang' | 'korrektur'
  typ         text not null default 'verbrauch',
  notiz       text,
  erstellt_von text,  -- 'daniel' | 'vanessa'
  created_at  timestamptz default now()
);

-- -------------------------------------------------------
-- 5. BESTELLUNGEN  (Nachbestell-Historie)
-- -------------------------------------------------------
create table bestellungen (
  id            uuid primary key default gen_random_uuid(),
  lieferant_id  uuid references lieferanten(id) on delete set null,
  -- 'offen' | 'bestellt' | 'geliefert'
  status        text not null default 'offen',
  bestellt_am   date,
  geliefert_am  date,
  notiz         text,
  created_at    timestamptz default now()
);

-- Positionen einer Bestellung
create table bestellpositionen (
  id              uuid primary key default gen_random_uuid(),
  bestellung_id   uuid not null references bestellungen(id) on delete cascade,
  artikel_id      uuid not null references artikel(id) on delete cascade,
  -- Charge-Nr. aus dem Lager (für Pickliste Online-Shop)
  referenz_charge text,
  menge           numeric not null,
  einheit         text,
  preis_pro_einheit numeric
);

-- -------------------------------------------------------
-- Startkategorien (anpassbar über die App)
-- -------------------------------------------------------
-- Kategorien sind freie Text-Felder in artikel.kategorie.
-- Die folgenden Werte dienen nur als Orientierung beim ersten Befüllen:
-- 'Handschuhe'
-- 'Kanülen / Spritzen'
-- 'Verbandsmaterial'
-- 'Desinfektion'
-- 'Medikamente'
-- 'Ultraschall / EKG'
-- 'Sonstiges'
