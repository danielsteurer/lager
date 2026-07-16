-- RLS ausschalten (behebt "violates row-level security policy")
alter table finanzposten disable row level security;
alter table fitnessabos disable row level security;

-- MwSt-Satz (%) für Netto/Brutto-Rechnung
-- Einnahmen: brutto erfasst → Netto = Brutto / (1 + MwSt), Differenz wird abgeführt
-- (unecht steuerbefreit: Vorsteuer bei Ausgaben nicht rückholbar, Brutto = echte Kosten)
alter table finanzposten add column if not exists mwst_prozent numeric not null default 20;
alter table fitnessabos add column if not exists mwst_prozent numeric not null default 20;
