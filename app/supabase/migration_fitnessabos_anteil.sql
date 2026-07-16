-- Prozentualer Anteil an einem Fitness-Abo (z.B. gedrittelt = 33.3333)
alter table fitnessabos add column if not exists anteil_prozent numeric not null default 100;
