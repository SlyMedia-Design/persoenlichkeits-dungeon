# Plan – Feedback-Runde (aus CHECKLISTE.md, 15.10.2026)

Jedes Paket ist für sich spielbar und wird einzeln committet. Die Logik kommt nach `src/core/` und bekommt Vitest-Tests, die Inhalte kommen als JSON nach `data/`. Nach jedem Paket kurz Julian zeigen.

## A – Bedienung und Kamera (klein, schneller Gewinn)
- [x] Kamera-Zoom in Dorf und Dungeon reduzieren
- [x] Vorspulen: Shift + Bewegung beschleunigt die ganze Welt (Tempo-Faktor in einem zentralen Wert, auch für Gegner und Animationen)

## B – Elemente (Kern, Basis für C und D)
- [x] `data/elements.json`: Glut, Fels, Flut, Wind, Ranke, die Typentabelle und die Faktoren (×1,1 / ×0,9 einstellbar)
- [x] `src/core`: Funktion für den Element-Faktor, mit Tests aus der kompletten Tabelle
- [x] Wesen (`archetypes.json`), Fähigkeiten (`moves.json`) und Gegner bekommen ein Element, im Waldgeist-Wald kommen Ranke-Gegner dazu
- [x] Partnervorschlag neu: zuerst Wesen ohne gemeinsame Schwäche, dann die Persönlichkeits-Ergänzung. Tests für alle 4 Spieler-Wesen.
- [x] Icons für die 5 Elemente (16×16)

## C – Fortschritt und Balance
- [x] EP-Kurve nach dem Prinzip von Mystery Dungeon, insgesamt weniger EP
- [x] Schaden skaliert mit der Stufe
- [x] Gegner-Stufe steigt pro Etage, die Boss-Stufe ist fest (in `dungeon.json`)
- [x] Dungeon-Stufe vor dem Betreten anzeigen
- [x] Prüfen, dass das Layout bei jedem Betreten neu erzeugt wird (sonst fixen)
- [x] Balance-Check per Simulation (Test oder Skript)

## D – Fähigkeiten und Fähigkeitssteine
- [x] Maximal 4 aktive Fähigkeiten, Austausch-Logik in `src/core`
- [x] Fähigkeitssteine: im Prototyp genau 1 (ab mehr als 3 Etagen 1–3) verteilt, einsetzbar für Spieler oder Partner, Verbrauch beim Einsatz, Verlernen-Dialog
- [x] Kampfmenü kompakter: nur Name + Elementsymbol, Beschreibung im Info-Feld per Antippen
- [x] Stein-Icons pro Element (kein Ranke-Stein)

## E – Items und Quests
- [x] Eigene Quest-Tasche, getrennt vom Beutel
- [x] Infotexte für Items mit der genauen Wirkung (Heilung, Schaden)
- [x] Zufällige Quest-Belohnungen mit Mindestwert („enttäuscht nie“), mit Tests
- [x] Quest-Marker über NPCs: orangenes ! → verschwindet bei Annahme → ? bei Erfüllung → weg bei Abgabe
- [x] Icons für Heilbeere und Geld
- [x] Beutelgrenze sichtbar (Füllstand, „Beutel voll“), Ablegen und Tauschen im Dungeon
- [x] Questlog im Menü (Dorf und Dungeon) mit dem nächsten Schritt je Auftrag

## F – Dorf-Ausbau
- [x] Karte erweitern: 5 Gebäude, größerer See mit Angelplatz (Steg, Boot, Eimer, Netze)
- [x] Schwarzes Brett am Gildenhaus, der zuständige NPC steht daneben
- [x] 5 NPCs ausarbeiten (Name, Tierart, Rolle, Persönlichkeit, Dialoge, Figur aus dem Ninja-Pack). **Ich mache Vorschläge, Julian entscheidet.**
- [x] 2 Aufträge: Quest des NPCs im Gemeindehaus + Auftrag vom Schwarzen Brett
- [x] Intro-Kamerafahrt über das Dorf nach der Partnerwahl, überspringbar

## G – Inszenierung und Abschluss
- [x] Boss-Musik + Warnton beim Erscheinen (Ninja-Pack: z. B. „28 - Tension“ oder „14 - Curse“)
- [x] Feedback-Knopf am Prototyp-Ende: öffnet das Google-Formular in einem neuen Tab, mit Hinweis „öffnet sich bei Google“, Link als Konfigurationswert, keine Daten automatisch mitsenden
- [x] Credits prüfen (pixel-boy, Musik)

## Reihenfolge
A → B → C → D → E → F → G. Pakete A und G sind unabhängig und können vorgezogen werden.
