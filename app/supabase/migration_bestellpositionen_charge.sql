-- Chargennummer + Verfallsdatum für Bestellpositionen
-- (damit beim Wareneingang die Charge korrekt ins Lager übernommen werden kann)
alter table bestellpositionen add column if not exists charge_nr text;
alter table bestellpositionen add column if not exists verfallsdatum date;
