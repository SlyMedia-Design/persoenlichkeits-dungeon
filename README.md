# Persönlichkeits-Dungeon (Arbeitstitel)

Hobby-Browserspiel im Geist von *Mystery Dungeon* mit eigener Welt. Am Anfang steht ein echter Big-Five-Persönlichkeitstest; das Ergebnis bestimmt, welches Wesen man wird.

**Stand: Meilenstein 1** – der Test als eigenständig spielbares Stück (Intro, 50 Fragen, Enthüllung, Partnerwahl, Namen, Profilseite).

## Entwickeln

```bash
npm install
npm run dev        # lokaler Server auf http://localhost:5173
npm test           # Unit-Tests (Vitest)
npm run simulate   # Verteilungstest der Wesen
npm run build      # Typprüfung + Produktions-Build nach dist/
```

> Das Projekt nicht in einem OneDrive-Ordner ablegen – `npm install` hängt dort.

## Aufbau

| Ordner | Inhalt |
|---|---|
| `data/` | Alle Inhalte als JSON: Items, Vergleichswerte, Wesen (inkl. 16×16-Pixel-Sprites), Texte (`i18n/de.json`) |
| `src/core/` | Reine Logik ohne Phaser: Scoring, Zuordnung, Partnervorschlag, Simulation, Spielstand |
| `src/scenes/` | Phaser-Szenen |
| `src/ui/` | Darstellung: Knöpfe, Hintergrund, Sprites, Musik (prozedural per WebAudio) |
| `scripts/` | Werkzeuge: Item-Extraktion, Normberechnung, Verteilungssimulation |
| `tests/` | Unit-Tests der Logik und Datenprüfungen |

## Der Test

- **Fragebogen:** IPIP 50-Item Big-Five Factor Markers, deutsche Fassung von Alois Angleitner, Susanne Hempel, Rika Langert und Frank Spinath (Universität Bielefeld), bereitgestellt von Fritz Ostendorf.
  Quelle: <https://ipip.ori.org/German50-itemBigFiveFactorMarkers.htm> · Schlüssel: <https://ipip.ori.org/new_ipip-50-item-scale.htm>
  `data/ipip50_de.json` wurde mit `scripts/extract-ipip.ts` direkt aus der HTML-Seite erzeugt; die Item-Texte sind wortgetreu übernommen (auch kleine Eigenheiten der Quelle wie fehlende Punkte oder „grübel“).
- **Lizenz:** Die IPIP-Items sind gemeinfrei (Public Domain), siehe <https://ipip.ori.org/>.
- **Auswertung:** Antwortskala 1–5, umgepolte Items werden invertiert, Mittelwert aus 10 Items je Dimension, dann z-Werte gegen die Vergleichswerte. Intern wird Neurotizismus gerechnet (Faktor 4 „Emotionale Stabilität“ also umgepolt); im Spiel heißt die Dimension „Feingefühl“.
- **Vergleichswerte** (`data/norms.json`): berechnet mit `scripts/compute-norms.ts` aus dem offenen Datensatz „Answers to the IPIP Big Five Factor Markers“ des Open-Source Psychometrics Project (<https://openpsychometrics.org/_rawdata/>, BIG5.zip). Gefiltert auf englische Muttersprache aus US/GB/CA/AU/NZ/IE, Alter 16–80, vollständige Antworten (n = 10 039). Vorläufig: Online-Stichprobe, nicht repräsentativ; die Werte werden später mit Ergebnissen aus dem Freundeskreis nachjustiert.
- **Zuordnung:** nächstes Wesen per euklidischer Distanz im z-Raum; der Partnervorschlag ist das fernste andere Wesen.
- **Kein klinischer oder diagnostischer Test.**

## Datenschutz

Antworten und Spielstand liegen nur im `localStorage` des Browsers. Es gibt keinen Server, kein Tracking und keine externen Anfragen (die Schrift ist mitgebündelt). „Ergebnis teilen“ kopiert nur die fünf Mittelwerte in die Zwischenablage.

## Deployment

Jeder Push auf `main` testet, baut und veröffentlicht über `.github/workflows/deploy.yml` auf GitHub Pages. Einmalig nötig: im Repository unter *Settings → Pages → Source* „GitHub Actions“ wählen. Die Vite-`base` ist auf `/persoenlichkeits-dungeon/` gesetzt.

## Credits

- Fragebogen: International Personality Item Pool (Goldberg), Public Domain
- Deutsche Übersetzung: A. Angleitner, S. Hempel, R. Langert, F. Spinath (Universität Bielefeld)
- Vergleichsdaten: Open-Source Psychometrics Project
- Geplante Platzhaltergrafik: [Ninja Adventure Asset Pack](https://pixel-boy.itch.io/ninja-adventure-asset-pack) von pixel-boy (CC0) – im Meilenstein 1 noch nicht eingebunden, die Wesen sind eigene 16×16-Pixel-Sprites aus `data/archetypes.json`
- Schrift: [Pixelify Sans](https://fonts.google.com/specimen/Pixelify+Sans) (SIL Open Font License), gebündelt über `@fontsource/pixelify-sans`
- Engine: [Phaser 3](https://phaser.io/)
