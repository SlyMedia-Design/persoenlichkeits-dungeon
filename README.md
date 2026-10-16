# Persönlichkeits-Dungeon (Arbeitstitel)

Hobby-Browserspiel im Geist von *Mystery Dungeon* mit eigener Welt. Am Anfang steht ein echter Big-Five-Persönlichkeitstest; das Ergebnis bestimmt, welches Wesen man wird.

**Stand: Meilenstein 3** – der Test (Intro, 20 Fragen, Enthüllung, Partnerwahl, Namen, Profilseite), das begehbare Dorf Morgentau mit 2 Dorfbewohnern und einem Schwarzen Brett mit 2 Aufträgen sowie der Flüsterwald: 3 zufällige Etagen, rundenbasierter Kampf und der Waldgeist als Boss.

## Entwickeln

```bash
npm install
npm run dev        # lokaler Server auf http://localhost:5173
npm test           # Unit-Tests (Vitest)
npm run simulate   # Verteilungstest der Wesen
npm run balance    # Schwierigkeits-Check des Dungeons (ein Bot spielt 200 Durchgänge)
npm run build      # Typprüfung + Produktions-Build nach dist/
```

> Das Projekt nicht in einem OneDrive-Ordner ablegen – `npm install` hängt dort.

## Aufbau

| Ordner | Inhalt |
|---|---|
| `data/` | Alle Inhalte als JSON: Items, Vergleichswerte, Wesen (inkl. 16×16-Pixel-Sprites), Dorfkarte (`village.json`), Texte (`i18n/de.json`) |
| `src/core/` | Reine Logik ohne Phaser: Scoring, Zuordnung, Partnervorschlag, Simulation, Spielstand, Rasterbewegung und Wegsuche, Dorf (Karte, Interaktionen, Aufträge) |
| `src/scenes/` | Phaser-Szenen |
| `src/ui/` | Darstellung: Knöpfe, Hintergrund, Sprites, Musik (prozedural per WebAudio) |
| `scripts/` | Werkzeuge: Item-Extraktion, Normberechnung, Verteilungssimulation, Porträt-Generator |
| `tests/` | Unit-Tests der Logik und Datenprüfungen |

## Der Test

- **Fragebogen:** IPIP 50-Item Big-Five Factor Markers, deutsche Fassung von Alois Angleitner, Susanne Hempel, Rika Langert und Frank Spinath (Universität Bielefeld), bereitgestellt von Fritz Ostendorf.
  Quelle: <https://ipip.ori.org/German50-itemBigFiveFactorMarkers.htm> · Schlüssel: <https://ipip.ori.org/new_ipip-50-item-scale.htm>
  `data/ipip50_de.json` wurde mit `scripts/extract-ipip.ts` direkt aus der HTML-Seite erzeugt; die Item-Texte sind wortgetreu übernommen (auch kleine Eigenheiten der Quelle wie fehlende Punkte oder „grübel“).
- **Kurzform im Spiel:** Mini-IPIP mit 20 Items, 4 je Dimension (Donnellan, Oswald, Baird & Lucas, 2006, *Psychological Assessment, 18*, 192–203). Alle 20 Items stammen aus der IPIP-50; `data/mini_ipip20.json` legt nur fest, welche und in welcher Reihenfolge. Ein Test vergleicht die Auswahl mit der veröffentlichten Itemliste.
- **Lizenz:** Die IPIP-Items sind gemeinfrei (Public Domain), siehe <https://ipip.ori.org/>.
- **Auswertung:** Antwortskala 1–5, umgepolte Items werden invertiert, Mittelwert aus den 4 Mini-IPIP-Items je Dimension, dann z-Werte gegen die Vergleichswerte. Intern wird Neurotizismus gerechnet (Faktor 4 „Emotionale Stabilität“ also umgepolt); im Spiel heißt die Dimension „Feingefühl“.
- **Vergleichswerte** (`data/norms.json`): berechnet mit `scripts/compute-norms.ts` aus dem offenen Datensatz „Answers to the IPIP Big Five Factor Markers“ des Open-Source Psychometrics Project (<https://openpsychometrics.org/_rawdata/>, BIG5.zip). Gefiltert auf englische Muttersprache aus US/GB/CA/AU/NZ/IE, Alter 16–80, vollständige Antworten (n = 10 039), ausgewertet mit genau den 20 Mini-IPIP-Items. Vorläufig: Online-Stichprobe, nicht repräsentativ; die Werte werden später mit Ergebnissen aus dem Freundeskreis nachjustiert.
- **Zuordnung:** nächstes Wesen per euklidischer Distanz im z-Raum; der Partnervorschlag ist das fernste andere Wesen.
- **Kein klinischer oder diagnostischer Test.**

## Das Dorf

Die Karte steht als Textraster in `data/village.json`: Jedes Zeichen ist ein 16×16-Feld, die Legende sagt, was es ist (Gras, Weg, Baum, Dach, Brett …), ob man darauf laufen kann und welcher Text beim Untersuchen erscheint. Dorfbewohner, ihre Dialoge (abhängig vom Stand der Aufträge) und die Aufträge selbst stehen ebenfalls dort, die Texte in `data/i18n/de.json` unter `village`. Die Tests prüfen, dass alle Bewohner, das Brett und alle Untersuchungsfelder vom Startpunkt aus erreichbar sind.

Steuerung: am Handy auf ein Feld oder eine Figur tippen, am Rechner Pfeiltasten/WASD und Leertaste. Bewegt wird in 8 Richtungen: zwei Tasten zusammen (z. B. W + A) ergeben einen Schrägschritt, die Wegsuche nutzt ebenfalls Schrägschritte, schneidet aber keine Ecken. Unsere Wesen laufen mit zwei Laufbildern (abwechselnd ein Fuß angehoben), die aus ihrem 16×16-Sprite erzeugt werden.

Grafik: `data/tileset.json` ordnet jeder Bedeutung (Gras, Weg, Wasser, Hecke, Haus …) eine Kachel aus dem Ninja Adventure Pack zu. Wege und Wasser bekommen automatisch passende Ränder und Ecken (`src/core/autotile.ts`), Baumflächen werden mit großen 2×2-Bäumen gefüllt (`src/core/tileset.ts`). Die verwendeten Bilder liegen in `public/assets/ninja/` (nur die nötigen Dateien, samt Lizenz). Unsere vier Wesen bleiben eigene Pixel-Sprites.

## Der Flüsterwald (Dungeon)

Aufbruch am Nordtor des Dorfs. Rundenbasiert wie bei *Mystery Dungeon*: Jeder Schritt oder Angriff ist ein Zug, danach handeln Partner, Begleiter und Gegner.

- **Etagen:** 3 zufällig erzeugte Etagen (Räume und Gänge, `src/core/dungeon/generate.ts`), danach die handgebaute Lichtung des Waldgeists (Textraster in `data/dungeon.json`).
- **Kampf:** Jedes Wesen kennt bis zu 4 Fähigkeiten mit Energie (`data/moves.json`), sammelt Erfahrung und steigt Stufen auf; mit Stufe 8 lernt es eine vierte Fähigkeit (`data/battle.json`). Statuseffekte: geblendet, schläft, festgehalten, geschützt, konzentriert, gestärkt.
- **Persönlichkeit:** Die z-Werte des Tests geben passive Boni; jeder Pol einer Dimension hat einen eigenen Vorteil (`data/bonuses.json`).
- **Aufträge:** Stups wartet auf Etage 2 und folgt euch bis zur Treppe; Leuchtmoos liegt auf jeder Etage. Belohnungen gibt es danach bei Fips bzw. Oma Wurzel.
- **Beerenfeld:** Nach dem Leuchtmoos-Auftrag gehört das Beet neben Oma Wurzels Laden dem Spieler. Samen gibt es von ihr (Heilbeere, Sternbeere, Kraftbeere); nach 4 Ausflügen sind die Pflanzen reif (`src/core/garden.ts`, Werte in `data/village.json` unter `garden`). Die Kraftbeere stärkt bis zur nächsten Etage die Fähigkeiten im eigenen Element.
- **Niederlage:** zurück ins Dorf; Stufen bleiben, der Beutel ist wieder wie vor dem Aufbruch.
- **Speichern:** Der Durchgang wird nach jedem Zug gesichert und lässt sich über das Titelbild fortsetzen.
- **Steuerung:** am Handy neben die Figur tippen (laufen/angreifen) oder auf ein bekanntes Feld (hinlaufen), Knöpfe für Fähigkeiten, Beutel, Warten und Menü; am Rechner WASD/Pfeiltasten (zwei Tasten für schräg), Leertaste Angriff, 1–4 Fähigkeiten, B Beutel, Q Warten, Enter Treppe.

Die gesamte Logik liegt Phaser-frei in `src/core/dungeon/` und ist getestet, darunter ein Härtetest mit 400 Zufallszügen. Die Werte lassen sich in den JSON-Dateien anpassen; `npm run balance` lässt danach zwei Bots (einfach und geübt) einzelne Ausflüge und ganze Kampagnen spielen: Wie oft wird der Waldgeist beim ersten Ausflug besänftigt, und wie viele Ausflüge braucht es im Schnitt (Stand 16.10.2026, geübter Bot: 62 % beim ersten Ausflug, im Schnitt 1,5 Ausflüge, alle Kampagnen geschafft).

## Datenschutz

Antworten und Spielstand liegen nur im `localStorage` des Browsers. Es gibt keinen Server, kein Tracking und keine externen Anfragen (die Schrift ist mitgebündelt). „Ergebnis teilen“ kopiert nur die fünf Mittelwerte in die Zwischenablage.

## Deployment

Jeder Push auf `main` testet, baut und veröffentlicht über `.github/workflows/deploy.yml` auf GitHub Pages. Einmalig nötig: im Repository unter *Settings → Pages → Source* „GitHub Actions“ wählen. Die Vite-`base` ist auf `/persoenlichkeits-dungeon/` gesetzt.

## Credits

- Fragebogen: International Personality Item Pool (Goldberg), Public Domain
- Deutsche Übersetzung: A. Angleitner, S. Hempel, R. Langert, F. Spinath (Universität Bielefeld)
- Vergleichsdaten: Open-Source Psychometrics Project
- Grafik in Dorf und Dungeon: [Ninja Adventure Asset Pack](https://pixel-boy.itch.io/ninja-adventure-asset-pack) von Pixel-boy und AAA (CC0). Die Wesen sind eigene Pixel-Sprites aus `data/archetypes.json`: 16×16 fürs Spielfeld, 32×32-Porträts für Menüs (erzeugt mit `scripts/draw-creatures.ts`)
- Musik und Geräusche: Boss-Musik „Tension“ und Warnton „Alert“ aus dem [Ninja Adventure Asset Pack](https://pixel-boy.itch.io/ninja-adventure-asset-pack) (CC0), eingetragen in `data/audio.json`; die ruhige Hintergrundmusik wird im Spiel erzeugt (`src/ui/ambient.ts`)
- Eigene Pixel-Grafiken: Element-Icons und Fähigkeitssteine (`data/elements.json`), Quest-Zeichen (`src/ui/markers.ts`)
- Schrift: [DotGothic16](https://fonts.google.com/specimen/DotGothic16) von Fontworks (SIL Open Font License), gebündelt über `@fontsource/dotgothic16`, Datei und Lizenz in `src/ui/fonts/` (im Code heißt sie weiter „Dorfschrift“)
- Engine: [Phaser 3](https://phaser.io/)

## Rechte

© 2026 Julian (SlyMedia-Design). **Alle Rechte vorbehalten.**

Der Quelltext ist öffentlich einsehbar, damit das Spiel über GitHub Pages laufen kann. Das ist **keine** Erlaubnis zur Weiterverwendung: Code, Spielkonzept, Texte, Wesen und eigene Grafiken dürfen ohne ausdrückliche schriftliche Erlaubnis nicht kopiert, verändert, veröffentlicht oder anderweitig genutzt werden.

Ausgenommen sind die oben unter „Credits“ genannten Inhalte Dritter; für sie gelten weiterhin ihre eigenen Lizenzen (IPIP-Items: Public Domain, Ninja Adventure Asset Pack: CC0, DotGothic16: SIL Open Font License, Phaser: MIT).
