# Checkliste – Persönlichkeits-Dungeon

## 1. Das möchte ich ändern

### Kamera und Bedienung
- [x] Kamera-Zoom auf die Spieler reduzieren (zu stark herangezoomt)
- [x] Vorspulen: Shift + Bewegungstasten beschleunigen das Spiel. Gegner, Animationen und die ganze Welt laufen im selben Tempo schneller, damit man im Dungeon schneller vorankommt.

### Fähigkeiten und Kampf-UI
- [x] Fähigkeiten-Text bei Attacken verkürzen: im Kampf nur Name (und Elementsymbol) zeigen
- [x] Neues antippbares Info-Feld pro Fähigkeit, das die ausführliche Beschreibung erst auf Tippen anzeigt
- [x] Fähigkeiten-Bildschirm im Kampf verkleinern, er ist aktuell zu groß
- [x] Ein Wesen hat maximal 4 aktive Fähigkeiten gleichzeitig, die sich austauschen lassen

### Items und Beutel
- [x] Quest-Items nicht im normalen Beutel ablegen, sondern in einer eigenen Quest-Tasche
- [x] Nutzbare Items bekommen einen Infotext, der die genaue Wirkung nennt (wie viel Heilung, wie viel Schaden)

### Fähigkeitssteine
- [x] Fähigkeitssteine liegen im Dungeon verteilt und können aufgesammelt werden
- [x] Pro Dungeon (nicht pro Etage) gibt es insgesamt mindestens 1 und höchstens 3 Steine
- [x] Ein Stein kann für den Spieler oder den Partner eingesetzt werden, um die Fähigkeit zu erlernen
- [x] Steine verbrauchen sich sofort beim Einsatz
- [x] Wesen können unbegrenzt viele Fähigkeiten lernen, müssen dafür aber immer eine der 4 aktiven Fähigkeiten verlernen und sie damit austauschen

### Quests und Belohnungen
- [x] Quest-Belohnungen werden zufällig erwürfelt und sind nie fest vorgegeben
- [x] Mögliche Belohnungs-Arten: Fähigkeitssteine, Geld, Heilungs-Items
- [x] Jede Quest enttäuscht nie: Es gibt immer eine gute Belohnung, auch im schlechtesten Würfelfall

### Dungeons
- [x] Dungeon-Layout ändert sich bei jedem Betreten, keine festen Wege
- [x] Gegner-Level steigen pro Etage: Etage 1 niedrig, Etage 2 höher, und so weiter
- [x] Boss-Level ist pro Dungeon fest vorgegeben und skaliert nicht
- [x] Das Dungeon-Level (Schwierigkeit) wird vor dem Betreten immer angezeigt

### Level, Erfahrung und Schaden
- [x] Erhaltene Erfahrung insgesamt senken
- [x] Erfahrungs-Skalierung am Vorbild von Pokémon Mystery Dungeon orientieren (nur das Prinzip, kein Eins-zu-eins-Kopieren)
- [x] Schaden skaliert mit dem Level

### Elemente (Typen)
- [x] Im Prototyp gibt es 4 spielbare Elemente: Feuer, Erde, Wasser, Luft
- [x] Zusätzlich gibt es **Pflanze** als reinen Monstertyp. Es gibt kein spielbares Pflanzen-Wesen im Prototyp.
- [x] Zuordnung der Wesen: Dachs = Feuer, Capybara = Erde, Otter = Wasser, Eule = Luft
- [x] Wesen und Fähigkeiten haben je ein Element
- [x] Namen der Elemente werden gegenüber dem Original leicht verändert (eigene Elementnamen)
- [x] Das Element hat nichts mit dem Persönlichkeitsprofil zu tun
- [x] Typentabelle für den Prototyp (als Daten in JSON, nicht fest im Code):
  - Wasser ist stark gegen Feuer
  - Wasser ist stark gegen Erde
  - Erde ist stark gegen Feuer
  - Feuer ist stark gegen Pflanze
  - Pflanze ist stark gegen Wasser
  - Luft (Flug) ist stark gegen Pflanze
  - Luft (Flug) hat im Prototyp keine Schwäche und ist sonst gegen alle neutral
  - Alles, was nicht aufgeführt ist, ist neutral (Faktor 1). Die Schwäche ergibt sich jeweils aus der Gegenseite der Stärke.
  - Daraus folgt: Feuer ist schwach gegen Wasser und Erde, Erde ist schwach gegen Wasser, Wasser ist schwach gegen Pflanze, Pflanze ist schwach gegen Feuer und Luft.
- [x] Schadensfaktor als einstellbarer Konfigurationswert (JSON):
  - Prototyp: ×1,1 bei Stärke und ×0,9 bei Schwäche
  - Später: wie im Original, ×1,5 bei Stärke und ×0,5 bei Schwäche

### Partnervorschlag
- [x] Der Vorschlag prüft Element und Persönlichkeit
- [x] Hauptkriterium: das Element. Der Partner soll die Elementschwächen des Spielers ausgleichen.
- [x] Zweitkriterium: die Persönlichkeits-Ergänzung aus dem Test (das Wesen mit dem am weitesten entfernten Profil)
- [x] Hat das Wesen des Spielers keine Elementschwäche (die Eule mit Luft/Flug), entscheidet allein die Persönlichkeits-Ergänzung
- [x] Der Spieler darf den Vorschlag weiterhin frei ändern

## 2. Das brauche ich

### Dorf
- [x] Mehr Gebäude im Dorf, insgesamt fünf:
  - Haus des Partners
  - Gildenhaus, an dem das Schwarze Brett hängt
  - Gemeindehaus
  - Laden im Stil eines Heilkräuterladens. Im Prototyp nur optisch vorhanden: kein Kaufen, kein Verkaufen. Das Handelssystem kommt nach dem Prototyp.
  - Altes, kaputtes Haus für den Spieler. Im Prototyp bleibt es kaputt. Später wird es über die Freundschaft zu den Bewohnern aufgebaut, die durch erledigte Quests wächst.
- [x] Ein Angelplatz als reine Deko, mit den typischen Elementen und Details eines kleinen Angelplatzes (z. B. Steg, Boot, Angeln, Eimer, Netze). Der vorhandene See im Dorf wird dafür leicht vergrößert. Angeln selbst gibt es nicht.
- [x] Das Schwarze Brett ist an einem Gebäude angebracht. Der NPC, der dafür verantwortlich ist, steht direkt neben dem Brett.
- [x] NPCs mit Quests, die nicht über das Schwarze Brett laufen, haben ein orangenes Ausrufezeichen über dem Kopf
  - Sobald die Quest angenommen wird, verschwindet das Ausrufezeichen
  - Sobald die Quest erfüllt ist, erscheint ein Fragezeichen über dem Kopf
  - Bei der Abgabe (Beenden der Quest) verschwindet das Fragezeichen

### Intro
- [x] Intro-Sequenz: Eine Animation zeigt das Dorf einmal von links nach rechts
- [x] Auslöser: Sie läuft, sobald der Partner dem Spieler sein Dorf zeigen will (nach Test, Enthüllung und Partnerwahl)
- [x] Die Sequenz lässt sich überspringen

### Sound
- [x] Soundfiles für Boss-Gegner mit bedrohlichem Klang im Pixel-Stil (8-Bit/Chiptune)
- [x] Beides einbauen: ein Musikstück für den Boss-Raum und ein kurzes Warngeräusch beim Erscheinen des Bosses

### Nach dem Prototyp (bewusst verschoben)
- [x] Freundschaft durch erledigte Quests, die das kaputte Haus Schritt für Schritt aufbaut
- [x] Handelssystem im Heilkräuterladen (Kaufen und Verkaufen von Items)

## 3. Das ist nötig

### Icons
- [x] Icons für Fähigkeitssteine: Das Element muss auf den ersten Blick erkennbar sein. Jeder Stein bekommt eine eigene Farbe oder ein eigenes Symbol seines Elements (Feuer, Erde, Wasser, Luft). Es gibt im Prototyp keinen Pflanzenstein.
- [x] Icon für Heilbeeren
- [x] Icon für Geld
- [x] Icons für die Fähigkeitstypen: Feuer, Erde, Wasser, Luft und Pflanze (auch Pflanze, weil sie als Monstertyp vorkommt)
- [x] Alle Icons im Pixel-Stil (16×16), passend zum restlichen Spiel. Passende Vorlagen aus dem Ninja-Adventure-Pack verwenden, sonst selbst zeichnen.

### NPCs
- [x] Im Prototyp gibt es 5 NPCs im Dorf:
  - 1 NPC vor dem Gemeindehaus
  - 1 NPC im Gemeindehaus
  - 1 NPC beim Schwarzen Brett (am Gildenhaus)
  - 1 NPC im Heilkräuterladen
  - 1 NPC am Angelplatz
- [x] Quests im Prototyp: Nur der NPC im Gemeindehaus gibt eine Quest (mit orangenem Ausrufezeichen). Die zweite Aufgabe läuft über das Schwarze Brett. Alle anderen NPCs sind nur zum Reden da.
- [x] NPCs ausarbeiten: Name, Tierart, Rolle im Dorf, Persönlichkeit, Dialoge und Aussehen
- [x] Jeder NPC bekommt ein eigenes, wiedererkennbares Aussehen im Stil der restlichen Wesen (rund, großer Kopf, kurze Beine)

### Feedback
- [x] Nach dem Ende des Prototyps erscheint ein Feedback-Button
- [x] Der Button öffnet ein Google-Forms-Formular in einem neuen Tab. Das Feedback kommt so bei Julian an.
- [x] Der Link zum Formular ist ein Konfigurationswert, den Julian selbst einträgt, sobald das Formular erstellt ist
- [x] Kurzer Hinweis am Button: Das Formular öffnet sich bei Google
- [x] Wichtig: Es wird nur das gesendet, was der Spieler selbst eintippt. Testergebnisse und Persönlichkeitswerte werden nie automatisch mitgeschickt (die Daten bleiben weiter nur lokal im Browser).

### Offene Rückfragen an mich selbst
- [x] Formular-Link für den Button (als Konfigurationswert hinterlegen): https://docs.google.com/forms/d/e/1FAIpQLSdiEITpgJ0Kpi2pSUYsX-BbkqurzSu1Fa1wnujg4jVbAys_qA/viewform

---

# Runde 2 – Spielerfeedback (2 Antworten, 15.10.2026)

Kurzbild: Test 5/5 und 5/5, Länge „genau richtig“ (2×), Wesen passt 3/5 und 4/5, Dorf 4/5 und 3/5, Partnervorschlag „hat gut gepasst“ (2×), Prototyp insgesamt 4/5 und 4/5, beide würden weiterspielen. Beide auf dem PC.

## 1. Das möchte ich ändern

### Lesbarkeit
- [ ] Schrift ist schwer zu lesen, besonders die Zahlen sind kaum zu unterscheiden → lesbarere Schrift, zumindest für Zahlen

### Dorf-Bewohner erkennbar machen
- [ ] Nicht alle Bewohner sind als Personen zu erkennen
- [ ] Käpt’n Kiesel auf dem Steg ist von hinten nicht als Person zu erkennen
- [ ] Oma Wurzel (Pilz) wirkt nicht lebendig
- [ ] Idee: Namensschild oder kleines Symbol über NPCs, leichte Idle-Animation, Blickrichtung zum Spieler

### Dungeon
- [ ] Alles sieht sehr ähnlich aus, man verläuft sich leicht → mehr Orientierung (abwechslungsreichere Räume, Deko, deutlichere Minikarte)
- [ ] Die Treppe sieht nicht wie eine Treppe aus → deutlicheres Treppen-Symbol

## 2. Das brauche ich

### Sound
- [ ] Lautstärkeregler (statt nur Ton an/aus), getrennt für Musik und Effekte?

## 3. Das ist nötig (Fehler)

- [x] Gerettete Figur (Stups) bleibt mitten im Wald stehen, statt dem Team zu folgen
- [x] Glutstoß geht nicht an Ecken: Angriffe auf alle Nachbarfelder (Glutstoß, Planschwelle usw.) treffen immer das ganze 1-Feld-Umfeld, auch schräg um Ecken und Wände herum

## Entschieden (16.10.2026)
- [x] Angriffe auf alle Nachbarfelder treffen jeden Gegner im 1-Feld-Radius, auch wenn eine Wand dazwischen an der Ecke steht
- [x] „Besseres Haus“: Das Haus des Spielers bleibt kaputt
- [x] Wesen passt 3/5 und 4/5: Zwei Antworten reichen nicht als Auswertung, erst mehr Feedback sammeln

## Neu: Beerenfeld (aus dem Feedback, entschieden am 16.10.2026)
- [ ] Beerenfeld im Dorf, Oma Wurzel ist dafür zuständig
- [ ] Wird nach dem Leuchtmoos-Auftrag freigeschaltet
- [ ] Die Samen gibt es von Oma Wurzel
- [ ] Anbau von Beeren für Heilung (Heilbeere), Energie (Sternbeere) und Schaden (neue Beere)
- [ ] Nach 4 Dungeon-Ausflügen sind die Pflanzen ausgewachsen und können geerntet werden
- [ ] Neue Schadens-Beere: Erhöht für eine Etage den Schaden der Fähigkeiten im eigenen Element des Wesens, auch im Bosskampf. Fähigkeiten anderer Elemente (z. B. per Stein gelernt) werden nicht verstärkt.
