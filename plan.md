# Umsetzungsplan: Lagerverwaltung werkeins

Basierend auf dem ausgefüllten [Fragebogen](fragebogen.md) und der Analyse der 3 Bestellungen
(DocCheck, Scherer, Hofsteig-Apotheke).

---

## Leitprinzip

> **So wenig hartcodiert wie möglich.**
> Lieferanten, Kategorien, Einheiten, Mindestbestände, Lieferzeiten – alles sind **Daten**,
> die du in der App selbst anlegen und ändern kannst. Kein Code-Eingriff nötig.

Das zieht sich durch jede Phase.

---

## Grundentscheidung: Technik (Phase 0 – hier brauche ich dein OK)

Du willst: eigene Web-App, online, PC + Handy, 2 Nutzer mit gemeinsamen Daten, GitHub,
Statistiken über Zeit. Das bedeutet: es braucht eine **Datenbank im Hintergrund** (nicht nur
eine Excel-/JSON-Datei), damit du und Vanessa immer denselben Stand seht.

**Meine Empfehlung:**

| Baustein | Wahl | Warum |
|----------|------|-------|
| Frontend (die App) | **React + Vite** | Modern, flexibel, riesiges Ökosystem, gut auf GitHub |
| Datenbank + Login | **Supabase** (Postgres, EU-Hosting) | Kostenlos für unsere Größe, **Server in der EU** (DSGVO), Login für 2 Nutzer eingebaut |
| Hosting | **Vercel** oder GitHub Pages | Kostenlos, ein Klick pro Update |

**Warum kein Google Sheets / Airtable?** Ginge für den Anfang, aber begrenzt deine Wunsch-
Flexibilität (eigene Nachbestell-Logik, Statistik, Warnungen) und die spätere Anpassbarkeit.

> **Kosten:** Im kostenlosen Rahmen von Supabase + Vercel. Für eine 2-Personen-Praxis
> reicht das dauerhaft locker.

➡️ **Diese eine Entscheidung besprechen wir kurz, bevor es losgeht.** Alles Weitere baut darauf auf.

---

## Datenmodell (das Fundament)

Fünf Tabellen. Bewusst schlank, aber auf deine Wünsche zugeschnitten:

### 1. `lieferanten`
- Name, E-Mail, Telefon
- **Bestellweg**: E-Mail / Online-Shop / Telefon
- Webshop-Link (bei Online)
- **Kundennummer** (deine Nr. beim Lieferanten – z.B. Scherer 214447, DocCheck 4076909)
- **Lieferzeit** (z.B. "3–5 Tage")
- Notiz

### 2. `artikel`
- Bezeichnung, Kategorie (frei wählbar)
- Lieferant (Verweis auf Tabelle 1)
- **Artikelnummer beim Lieferanten** (zum schnellen Finden im Shop)
- **Einheit** (Stück, Packung à 100, Rolle, Flasche … frei definierbar)
- **Mindestbestand** (dein manueller Schwellwert)
- **Kritisch-Markierung** (Notfall-/Schlüsselartikel → in Warnungen ganz oben)
- **Auf Merkliste** (manuell zum Nachbestellen vormerken, auch ohne Schwelle)
- Letzter Preis
- Notiz
- *(Aktueller Bestand = Summe der Chargen, siehe Tabelle 3 – nicht separat gepflegt)*

### 3. `chargen` (mehrere Chargen pro Artikel, FEFO)
- Verweis auf Artikel
- **Menge**, **Charge-Nr.**, **Verfallsdatum**
- Bestand eines Artikels = Summe seiner Chargen
- Verbrauch geht automatisch von der **ältesten** Charge ab (First-Expired-First-Out)
- Warnung nutzt das **früheste** Verfallsdatum
- Chargen-Nr. landet auf der Nachbestell-Pickliste (zum Wiederfinden + Rückruf-Check)

### 4. `bewegungen` (Verbrauchs-Historie → Grundlage der Statistik)
- Welcher Artikel/Charge, wann, +/- Menge, wer (du / Vanessa), Grund
- Jede Entnahme/Zugang wird hier geloggt → daraus entsteht die Verbrauchsprognose

### 5. `bestellungen` (Nachbestell-Historie)
- Lieferant, Datum, Positionen, Status (offen / bestellt / geliefert)
- Bei „geliefert" → Wareneingang bucht Bestand als neue Charge ein

---

## Zwei-Orte-Idee → digitale Lösung

Deine Idee (Behandlungszimmer + 2. Ort mit Mindestmenge, Umräumen = nachbestellen) ist ein
klassisches **Zwei-Behälter-Prinzip**. Digital wird das **einfacher**:

- Du trackst **einen Gesamtbestand** pro Artikel.
- Fällt er auf/unter den **Mindestbestand**, springt der Artikel automatisch auf die
  **Nachbestell-Liste** – egal wo er physisch liegt.

Du musst also nicht mehr zwei Orte im Kopf abgleichen. Wenn du den physischen 2. Ort trotzdem
behalten willst, funktioniert er weiter – die App ersetzt nur das „im Kopf nachhalten".

---

## Umsetzung Schritt für Schritt

### Phase 1 – Fundament & Datenmodell
- Projekt aufsetzen (React + Supabase + GitHub-Repo)
- Die 4 Tabellen anlegen
- **Verifikation:** Testdatensatz anlegen und in der App sichtbar

### Phase 2 – Startbestand aus deinen 3 Rechnungen
- Ich extrahiere alle ~60 Artikel aus DocCheck / Scherer / Apotheke inkl. Menge, Einheit,
  Charge, Verfallsdatum, Preis, Lieferant in eine Import-Liste (Artikel + zugehörige Chargen)
- Du prüfst/korrigierst die Liste einmal → wird als Startbestand geladen
- **Verifikation:** Alle Artikel mit korrektem Bestand + Chargen in der App

### Phase 3 – Artikel- & Lieferantenverwaltung (das Herzstück)
- Übersichtsliste aller Artikel: suchen, filtern (Kategorie/Lieferant), sortieren
- Artikel anlegen/bearbeiten/löschen – inkl. Mindestbestand pro Artikel
- Lieferanten anlegen/bearbeiten (neue Lieferanten jederzeit, nichts hartcodiert)
- **Verifikation:** Neuen Artikel + neuen Lieferanten komplett über die Oberfläche anlegen

### Phase 4 – Bestand pflegen (Verbrauch + Wareneingang)
- **Verbrauch:** Schnell-Buchung „−1 Packung Handschuhe M" mit einem Tipp (handytauglich),
  geht automatisch von der ältesten Charge ab (FEFO)
- **Wareneingang:** gelieferte Ware einbuchen → Bestand rauf **als neue Charge**
  (Menge + Charge-Nr. + Verfallsdatum)
- Jede Buchung landet in `bewegungen` (wer/wann)
- **Verifikation:** Entnahme senkt Bestand (älteste Charge zuerst), Wareneingang legt neue Charge an

### Phase 5 – Warnungen (automatisch, ohne Benachrichtigung)
- Dashboard zeigt automatisch:
  - 🔴 Artikel **unter Mindestbestand** (kritische Artikel ganz oben)
  - 🟡 Chargen mit **baldigem Verfall** (Schwelle 3 Monate, einstellbar)
- **Verifikation:** Artikel unter Schwelle bzw. bald ablaufende Charge taucht automatisch auf

### Phase 6 – Nachbestell-Prozess (dein Kernwunsch)
- Nachbestell-Liste speist sich aus: Artikel unter Mindestbestand **+ manueller Merkliste**
- Button „Nachbestellung vorbereiten" → gruppiert fällige Artikel **pro Lieferant**
- **Mengenvorschlag** („auffüllen auf Zielbestand"), pro Artikel frei anpassbar
- Ausgabe je nach Bestellweg:
  - **E-Mail-Lieferant** (Scherer, Apotheke): fertige E-Mail (Empfänger, Betreff, Liste) →
    du prüfst und schickst manuell ab
  - **Online-Shop** (DocCheck): **Pickliste mit Artikelnummer + Charge**, damit du die
    Produkte im Shop sofort findest
- Bestellung landet in `bestellungen` (Historie); bei Lieferung → Wareneingang (Phase 4)
- **Verifikation:** Fällige Artikel → korrekte E-Mail bzw. Pickliste erzeugt

### Phase 7 – Statistik, Prognose & Export
- Verbrauch pro Artikel über Zeit (aus `bewegungen`)
- **Prognose:** „reicht noch ca. X Wochen" / voraussichtliches Ausgehen
- **Mindestbestand-Vorschlag:** aus Verbrauch × Lieferzeit + Puffer (nutzt Statistik + Lieferzeit)
- **Export** von Bestand + Bestellungen als Excel/CSV (Datenhoheit, Steuerberater)
- Optional: Ausgaben pro Lieferant
- **Verifikation:** Nach einigen Buchungen erscheint sinnvolle Prognose + Export funktioniert

### Phase 8 – Login & Live schalten
- Login für dich + Vanessa (Supabase Auth)
- Deploy auf Vercel → von PC & Handy erreichbar
- Optional: Repo auf GitHub veröffentlichen
- **Verifikation:** Beide könnt euch einloggen, gleicher Datenstand, Handy + PC

---

## Reihenfolge-Logik

Phase 1–2 schaffen die Datenbasis. Phase 3–4 machen die App im Alltag nutzbar
(anlegen + Bestand pflegen). Phase 5–6 liefern deinen eigentlichen Mehrwert
(Warnungen + einfache Nachbestellung). Phase 7–8 sind Komfort + Go-Live.

**Nutzbar ab Phase 4**, kompletter Wunschumfang nach Phase 6. Wir bauen und testen
Phase für Phase – du siehst nach jedem Schritt ein Ergebnis.

---

## Entscheidungen (bestätigt)

1. ✅ **Technik**: React + Supabase (EU) + Vercel
2. ✅ **Verfall-Warnschwelle**: 3 Monate (später einstellbar)
3. ✅ **Chargen-Modell**: Chargen-Liste pro Artikel, FEFO
4. ✅ **Suchtgift**: keines im Lager → keine Sonderdokumentation nötig
5. ⬜ **Kategorien**: Vorschlag als Start – Handschuhe, Kanülen/Spritzen, Verbandsmaterial,
   Desinfektion, Medikamente, Ultraschall/EKG, Sonstiges. Jederzeit anpassbar.
   → falls dir eine Kategorie fehlt/stört, kurz sagen; sonst nehme ich diese.
