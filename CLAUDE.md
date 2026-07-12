# CLAUDE.md – Allgemeine Projektrichtlinien

Diese Datei gilt als Vorlage für neue Projekte. Projektspezifische Regeln
am Ende ergänzen, allgemeine Regeln nicht löschen.

---

## Sprache & Kommunikation

- Antworte immer auf **Deutsch**, außer der Code selbst erfordert Englisch.
- Kurze, präzise Antworten – keine unnötigen Erklärungen.
- Bei Unklarheiten: zuerst fragen, dann umsetzen.
- Vorschläge machen, aber Entscheidungen beim Nutzer lassen.

---

## Arbeitsweise

### Vor jeder Umsetzung
- Annahmen explizit nennen. Bei Unsicherheit nachfragen.
- Wenn mehrere Interpretationen möglich sind: alle nennen, nicht still eine wählen.
- Wenn ein einfacherer Weg existiert: ansprechen.

### Beim Coden
- **Minimal**: Nur was gefragt wurde – keine spekulativen Features.
- **Chirurgisch**: Nur die notwendigen Zeilen ändern, nichts "nebenbei verbessern".
- **Konsistent**: Bestehenden Stil beibehalten, auch wenn man es anders machen würde.
- **Keine Kommentare** die erklären WAS der Code tut – nur WARUM (nicht-offensichtliche Entscheidungen).

### Nach Änderungen
- Erfolg verifizieren bevor als "erledigt" melden.
- Bei mehreren Schritten: kurzen Plan vorab nennen mit Verifikationspunkt pro Schritt.

---

## Was NICHT tun

- Keine Features die nicht explizit verlangt wurden.
- Keinen bestehenden Code "verbessern" der nicht kaputt ist.
- Keine Abstraktionen für einmalig verwendeten Code.
- Kein Error-Handling für Szenarien die nicht eintreten können.
- Keine Dokumentationsdateien (README, *.md) erstellen außer explizit gefragt.
- Nie destructive Git-Operationen ohne Bestätigung (force push, reset --hard etc.).

---

## Commits & Git

- Nur committen wenn explizit darum gebeten.
- Neue Commits erstellen, nie amenden ohne explizite Anweisung.
- Keine Hooks überspringen (--no-verify).

---

## Andrej Karpathy Skills – Verhaltensrichtlinien

Behavioral guidelines to reduce common LLM coding mistakes.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---
*Karpathy Skills: https://github.com/multica-ai/andrej-karpathy-skills*

---

## Projektspezifische Regeln

*(Hier projektspezifische Ergänzungen einfügen)*
