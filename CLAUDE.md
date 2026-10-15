# CLAUDE.md – Persönlichkeits-Dungeon (Arbeitstitel)

Ein Hobby-Browserspiel im Geist von *Pokémon Mystery Dungeon*, aber mit **eigener Welt und eigenen Wesen**. Das Herzstück ist ein **echter, wissenschaftlich fundierter Persönlichkeitstest (Big Five)** am Spielanfang. Je nach Ergebnis bekommt der Spieler ein niedliches Wesen, mit dem er weiterspielt.

Dieses Dokument enthält alle getroffenen Grundentscheidungen. **Weiche nicht davon ab, ohne nachzufragen.**

---

## 1. Rahmen

- **Ziel:** Hobby- und Lernprojekt für Julian und sein Umfeld. Keine Veröffentlichung geplant, kein Monetarisierungsdruck.
- **Welt:** Komplett eigene Welt, eigene Wesen. Keine Pokémon-Namen, -Designs oder -Begriffe.
- **Sprache:** Deutsch. Alle Texte stehen in Sprachdateien (i18n-fähig), damit Englisch später nachrüstbar ist.
- **Ton:** Gemütlich, mit ernsten, emotionalen Momenten (besonders rund um die Freundschaft zum Partner).
- **Entwicklung:** Julian arbeitet ausschließlich mit Claude Code. Alles muss als Code und Text existieren, ohne grafischen Editor.

## 2. Technik

- **Engine:** Phaser 3 + TypeScript, gebaut mit Vite
- **Architektur-Regel:** Alle Inhalte (Testfragen, Wesen, Dialoge, Aufträge, Dungeon-Regeln, Texte) liegen als **JSON-Daten** vor. Spiel-Logik (Testauswertung, Zuordnung, Kampfregeln, Dungeon-Generierung) ist **reines TypeScript ohne Phaser-Abhängigkeit**. Nur die Darstellung hängt an Phaser. Grund: Ein späterer Wechsel zu Godot soll möglich bleiben.
- **Hosting:** GitHub Pages, Deployment per GitHub Action (Vite `base` passend zum Repo-Namen setzen)
- **Daten:** Spielstände und Testantworten **nur lokal im Browser** (localStorage, mit try/catch). Kein Server, kein Tracking, keine Übertragung von Persönlichkeitsdaten. Einzige Ausnahme nach außen: der Feedback-Knopf am Prototyp-Ende öffnet Julians Google-Formular in einem neuen Tab (Link als Konfigurationswert). Es wird nur übertragen, was der Spieler dort selbst eintippt, nie automatisch Testergebnisse oder Werte (Entscheidung vom 15.10.2026).
- **Tests:** Die reine Logik (Scoring, Zuordnung, Partnervorschlag) bekommt Unit-Tests (Vitest).

Vorgeschlagene Struktur:

```
src/
  core/        # reine Logik, kein Phaser (scoring, matching, dungeon, combat)
  scenes/      # Phaser-Szenen
  ui/          # UI-Komponenten
data/
  ipip50_de.json        # Testfragen + Schlüssel
  norms.json            # Vergleichswerte (mit Quellenangabe)
  archetypes.json       # Wesen-Profile
  i18n/de.json          # alle Texte
public/assets/          # Platzhalter-Grafiken und Sounds
```

## 3. Grafik

- **Stil:** Pixel-Art von schräg oben, **16×16-Kacheln**, wie Mystery Dungeon auf GBA/DS
- **Platzhalter:** [Ninja Adventure Asset Pack von pixel-boy](https://pixel-boy.itch.io/ninja-adventure-asset-pack) (CC0). Wo es kein passendes Wesen gibt: einfache Farbkreise mit Augen, ein Farbcode pro Wesen. Den Credit für pixel-boy trotzdem in den Credits nennen.
- **Stand Meilenstein 2:** Das Pack liegt entpackt in `D:Projekte
inja-adventure` (außerhalb des Repos). Ins Projekt kopiert werden nur die genutzten Bilder nach `public/assets/ninja/`; welche Kachel wofür steht, regelt `data/tileset.json`. Dorfbewohner nutzen Figuren aus dem Pack (Oma Wurzel = Pilz, Fips = Maus), unsere Wesen bleiben eigene Sprites.
- **Farben:** Das Dorf warm und pastellig. Jeder Dungeon bekommt eine eigene, kräftigere Farbwelt (Wald grün, Höhle violett …).
- **Wesen:** Tierähnlich mit Fantasy-Note, rund, großer Kopf, kurze Beine
- **Formsprache für die Big Five** (gilt für alle Wesen):
  - Verträglichkeit → runde, weiche Formen
  - Extraversion → warme, kräftige Farben, aufrechte Haltung
  - Offenheit → ungewöhnliche Details (Muster, Leuchten)
  - Gewissenhaftigkeit → ordentliche, symmetrische Zeichnung
  - Feingefühl (Neurotizismus) → große Augen, Ohren oder Antennen

## 4. Der Persönlichkeitstest (Herzstück)

- **Modell:** Big Five (OCEAN)
- **Fragebogen:** IPIP 50-Item Big-Five Factor Markers, **deutsche Fassung** (Angleitner, Hempel, Langert, Spinath, Uni Bielefeld; in Ich-Form gebracht)
  - Quelle: https://ipip.ori.org/German50-itemBigFiveFactorMarkers.htm
  - Englisches Original mit Schlüssel (welche Items umgepolt werden): https://ipip.ori.org/new_ipip-50-item-scale.htm
  - **Die Items wortgetreu aus der Quelle übernehmen, nichts selbst übersetzen oder umformulieren.** Fehlt etwas oder ist etwas unklar: nachfragen, nicht erfinden.
  - **Im Spiel gestellt wird die Kurzform Mini-IPIP** (Donnellan et al. 2006): 20 der 50 Items, 4 pro Dimension (Entscheidung vom 14.10.2026 nach Feedback: 50 Fragen waren zu viele). Die Auswahl steht in `data/mini_ipip20.json`, die Texte bleiben die aus `data/ipip50_de.json`.
- **Antwortskala:** 5-stufig (trifft gar nicht zu … trifft voll zu). Umgepolte Items werden invertiert, und pro Dimension wird der Mittelwert aus den 4 Mini-IPIP-Items gebildet.
- **Vergleichswerte:** Mittelwerte und Standardabweichungen aus veröffentlichten englischsprachigen Studien zum IPIP-50 übernehmen, **mit Quellenangabe in `norms.json`**. (Umgesetzt mit dem offenen IPIP-50-Datensatz von openpsychometrics.org, ausgewertet für die Mini-IPIP-Items – mit Julian abgestimmt.) Daraus z-Werte berechnen. Nicht die Skalenmitte als Durchschnitt verwenden. Später werden die Werte mit freiwillig geteilten Ergebnissen aus dem Freundeskreis nachjustiert.
- **Benennung im Spiel:** Neurotizismus heißt **„Feingefühl“**, mit positiver Lesart. Intern wird mit dem Original gerechnet.
- **Inszenierung:** Der Test ist Teil der Story. Ein Mensch wacht als Wesen auf, und der Test zeigt, welches Wesen er geworden ist. Er ist stimmungsvoll gestaltet (Musik, Atmosphäre, Erzählstimme als Text), eine Frage pro Bildschirm, mit sichtbarem Fortschritt. Er darf sich nicht wie ein Formular anfühlen.
- **Ergebnis:** Zuerst die Enthüllung des Wesens. Das volle Big-Five-Profil mit verständlicher Erklärung jeder Dimension ist danach im Menü nachlesbar, zusammen mit dem Hinweis: *kein klinischer oder diagnostischer Test*.

## 5. Wesen und Zuordnung

- **Fertiges Spiel:** 12 Archetypen, frei gestaltet und gleichmäßig über den Profilraum verteilt
- **Prototyp:** 4 Archetypen (siehe unten)
- **Zuordnung:** Der Spieler bekommt das Wesen, dessen Profil seinem z-Profil am nächsten liegt (euklidische Distanz).
- **Verteilungstest:** Ein Skript simuliert viele zufällige, realistisch verteilte Profile und prüft, dass jedes Wesen ungefähr gleich oft herauskommt.
- **Passive Eigenschaften:** Die genauen Werte des Spielers färben kleine passive Boni, z. B. Verträglichkeit → Heilung, Extraversion → Team-Boni, Gewissenhaftigkeit → Genauigkeit, Offenheit → mehr Fähigkeiten, Feingefühl → Gespür für Gefahren.
- **Grundregel: Kein Profil ist schwächer.** Jeder Pol einer Dimension hat Vorteile, auch niedrige Werte.
- **Partnervorschlag (geändert am 15.10.2026):** Hauptkriterium ist das Element: In Frage kommen nur Wesen, die **keine Elementschwäche mit dem Spieler teilen**. Unter diesen entscheidet die Persönlichkeits-Ergänzung (das am weitesten entfernte Profil). Hat der Spieler keine Schwäche (Eule/Wind), entscheidet allein die Persönlichkeit. Der Spieler darf frei wählen.
- **Namen:** Jede Art bekommt einen erfundenen Artnamen (noch festzulegen). Spieler und Partner bekommen zusätzlich eigene Namen vom Spieler.

### Die 4 Prototyp-Archetypen

Werte als Ziel-z-Profil: hoch = +1, niedrig = −1.

| | Otter | Eule | Dachs | Capybara |
|---|---|---|---|---|
| Offenheit | +1 neugierig | +1 fantasievoll | −1 bodenständig | −1 beständig |
| Gewissenhaftigkeit | −1 spontan | +1 gründlich | +1 verlässlich | −1 unbeschwert |
| Extraversion | +1 gesellig | −1 still | +1 tatkräftig | −1 ruhig |
| Verträglichkeit | +1 herzlich | −1 eigenständig | −1 direkt | +1 sanftmütig |
| Feingefühl | −1 gelassen | +1 feinfühlig | +1 wachsam | −1 tiefenentspannt |
| Fantasy-Note | Muschelpanzer, Wasserblasen | nachts leuchtende Federn | Steinkrallen, Erzflecken | Moos und Blüten auf dem Rücken |
| Kurz | der gesellige Abenteurer | die stille Denkerin | der verlässliche Beschützer | die ruhende Mitte |

Jede Dimension hat zwei hohe und zwei niedrige Wesen. Die Artnamen sind Platzhalter, bis Julian eigene festlegt – sie bleiben es während des gesamten Prototyps (Entscheidung vom 14.10.2026). Ebenso Platzhalter: Dorfname „Morgentau“ und die Dorfbewohner „Oma Wurzel“ und „Fips“.

## 6. Gameplay

- **Dungeons:** Rundenbasiert auf dem Raster. Jeder Schritt ist ein Zug, danach ziehen die Gegner.
- **Aufbau:** Zufällig generierte Etagen, handgebaute Boss-Räume
- **Im Kampf:** Spieler + Partner. **Gerettete NPCs** werden zum Ausgang eskortiert und **kämpfen nicht**.
- **Dorf:** Frei begehbar, Bewegung auf dem Raster in 8 Richtungen (auch schräg, ohne Eckenschneiden), flüssig animiert (laufen, nicht hüpfen) und ohne Züge
- **Freundschaft mit NPCs:** Wächst durch gemeinsame Abenteuer und Persönlichkeits-Passung (passende Profile mögen dich schneller). Freundschafts-Szenen gibt es ab bestimmten Stufen.
- **Hohe Freundschaft** schaltet frei: besondere Items in der Stadt und den **Partnertausch**
- **Partnertausch:** Erst **nach Ende der Hauptgeschichte**. Der alte Partner bleibt als NPC im Dorf, und man kann jederzeit zurücktauschen.
- **Stand Meilenstein 3 (mit Julian abgestimmt, 14.10.2026):** Kampf Mystery-Dungeon-artig (4 Fähigkeiten mit Energie, Stufen und Erfahrung); Niederlage = zurück ins Dorf (Stufen bleiben, Beutel wie vor dem Aufbruch); Boss ist der Waldgeist (wird besänftigt, nicht vernichtet); Persönlichkeits-Boni wie in `data/bonuses.json`. Stups (Axolotl) ist der gerettete NPC auf Etage 2.
- **Struktur:** Hauptgeschichte plus Aufträge vom Schwarzen Brett. Nach dem Ende der Hauptgeschichte folgt ein Endlos-Modus.

## 6a. Erweiterung nach Julians Feedback (15.10.2026)

Die Einzelheiten stehen in `CHECKLISTE.md`. **Sie ist die verbindliche Quelle für diese Erweiterung.** Hier sind die Grundentscheidungen:

- **Elemente:** Wesen und Fähigkeiten haben je ein Element. Das Element hat **nichts** mit dem Persönlichkeitsprofil zu tun. Die Namen hat Julian am 15.10.2026 gewählt:
  - **Glut** (Feuer) = Dachs
  - **Fels** (Erde) = Capybara
  - **Flut** (Wasser) = Otter
  - **Wind** (Luft) = Eule
  - **Ranke** (Pflanze) gibt es nur bei Gegnern, nicht als spielbares Wesen.
  - Jede Fähigkeit hat das Element ihres Wesens, der Grundangriff ist neutral. Die Elemente der Arten stehen in `data/battle.json`.
  - Die Fähigkeiten des Dachses sind auf Glut umgebaut: Glutkralle, Glutpanzer, Glutstoß (Entscheidung vom 15.10.2026).
  - Der Waldgeist (Boss) ist Glut. Im fertigen Spiel bekommt er die Typ-Kombination Geist/Glut (Entscheidung vom 15.10.2026).
- **Typentabelle** als JSON (z. B. `data/elements.json`), nicht fest im Code:
  - Flut > Glut, Flut > Fels, Fels > Glut, Glut > Ranke, Ranke > Flut, Wind > Ranke
  - Wind hat keine Schwäche. Alles andere ist neutral.
  - Der Faktor ist einstellbar: im Prototyp ×1,1 bei Stärke und ×0,9 bei Schwäche, später ×1,5 und ×0,5.
- **Fähigkeiten:**
  - Maximal 4 aktive Fähigkeiten.
  - Fähigkeitssteine: 1–3 pro Dungeon, für Spieler oder Partner einsetzbar, werden beim Einsatz verbraucht.
  - Neues Lernen ersetzt immer eine der 4 aktiven Fähigkeiten.
  - Ein Stein lehrt eine zufällige Fähigkeit seines Elements. Jedes Wesen darf Fähigkeiten jedes Elements lernen. Ist beim Stufenaufstieg kein Platz frei, wählt der Spieler, was er verlernt, oder er lässt die neue Fähigkeit aus. Gelernte Fähigkeiten bleiben über Ausflüge hinweg erhalten (Entscheidungen vom 15.10.2026).
- **Fortschritt:**
  - Weniger Erfahrung, die Skalierung folgt dem Prinzip von Mystery Dungeon.
  - Schaden skaliert mit der Stufe.
  - Gegner-Stufen steigen pro Etage, die Boss-Stufe ist fest.
  - Die Dungeon-Stufe wird vor dem Betreten angezeigt.
  - Das Layout ist bei jedem Betreten neu.
- **Quests:**
  - Belohnungen werden zufällig erwürfelt (Steine, Geld, Heilitems), sind aber immer lohnend.
  - Quest-Items kommen in eine eigene Quest-Tasche.
  - NPC-Quests zeigen ein orangenes ! (offen) und ein ? (erfüllt, abgeben).
- **Dorf:**
  - 5 Gebäude: Partnerhaus, Gildenhaus mit Schwarzem Brett, Gemeindehaus, Heilkräuterladen (im Prototyp nur Optik) und das kaputte Haus des Spielers.
  - Dazu ein Angelplatz als Deko, dafür wird der See vergrößert.
  - 5 NPCs, Figuren aus dem Ninja-Pack.
  - Nur der NPC im Gemeindehaus gibt eine Quest, die zweite kommt vom Schwarzen Brett.
- **Inszenierung:**
  - Eine überspringbare Kamerafahrt über das Dorf nach der Partnerwahl.
  - Boss-Musik und ein Warnton (Chiptune, aus dem Ninja-Pack).
- **Bedienung:**
  - Weniger Kamera-Zoom.
  - Vorspulen mit Shift (die ganze Welt läuft schneller).
  - Kompakteres Fähigkeiten-Menü, die Beschreibung erscheint per Antippen.
  - Infotexte für Items.

## 7. Prototyp-Umfang (nicht mehr!)

1. Intro + Test (20 Fragen, Mini-IPIP), Enthüllung, Partnervorschlag und -wahl, Namensvergabe
2. 4 Wesen (Otter, Eule, Dachs, Capybara)
3. Begehbares Dorf mit 5 Gebäuden, Angelplatz, 5 NPCs und einem Schwarzen Brett; 2 Aufträge (1 NPC-Quest, 1 vom Brett) – erweitert am 15.10.2026
4. 1 Dungeon mit **3 Etagen** und 1 Boss, mit Elementen und Fähigkeitssteinen
5. Kurzes Kapitelende mit Feedback-Knopf

**Nicht im Prototyp:** Freundschaftsstufen (auch nicht der Aufbau des kaputten Hauses), Handel im Laden, Angeln, Partnertausch, Endlos-Modus, weitere Wesen, spielbare Ranke-Wesen

## 8. Bau-Reihenfolge

1. **Meilenstein 1: Der Test als eigenständig spielbares Stück** (siehe unten)
2. Meilenstein 2: Dorf (begehbar, NPCs, Schwarzes Brett)
3. Meilenstein 3: Dungeon (3 Etagen, Kampf, Boss)
4. Meilenstein 4: Story-Rahmen und Kapitelende
5. Feedback-Runde: Arbeitspakete A–G in `PLAN-FEEDBACK.md` (aus `CHECKLISTE.md`)

---

## ▶ Erster Auftrag: Meilenstein 1 – der Test

Baue den Persönlichkeitstest als eigenständig spielbare Web-App, deployt auf GitHub Pages, sodass Julian den Link an Freunde schicken kann.

1. Projekt aufsetzen: Vite + TypeScript + Phaser 3, Vitest, GitHub Action für GitHub Pages
2. `data/ipip50_de.json` aus der deutschen IPIP-Quelle erstellen (Item-Text, Dimension, Polung). Quellen und Lizenzhinweis im README vermerken.
3. `data/norms.json` mit recherchierten Vergleichswerten **inklusive Quellenangabe** anlegen
4. `src/core/`: Scoring (Umpolung, Mittelwerte, z-Werte), Archetyp-Zuordnung, Partnervorschlag. Alles mit Unit-Tests.
5. Verteilungs-Simulation als Skript (`npm run simulate`)
6. Phaser-Szenen:
   - kurzes stimmungsvolles Intro
   - eine Frage pro Bildschirm mit Fortschritt
   - Enthüllung des Wesens (Platzhalter-Grafik)
   - Partnervorschlag und Auswahl
   - Namensvergabe
   - Profilseite mit Erklärungen und Hinweis „kein klinischer Test“
7. Ergebnis lokal speichern. Optional: ein „Ergebnis teilen“-Knopf, der die fünf Werte als Text in die Zwischenablage kopiert (für die spätere Norm-Justierung), ohne Server.
8. Spielbar auf Desktop **und** Handy (Touch, schmale Bildschirme)

Danach stoppen und Julian zeigen, bevor Meilenstein 2 beginnt.
