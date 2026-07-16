-- Prozentualer Anteil an einer Ausgabe (z.B. gedrittelt = 33.3333)
alter table finanzposten add column if not exists anteil_prozent numeric not null default 100;
