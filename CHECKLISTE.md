# Checkliste – Persönlichkeits-Dungeon

## 1. Das möchte ich ändern

### Kamera und Bedienung
- [ ] Kamera-Zoom auf die Spieler reduzieren (zu stark herangezoomt)
- [ ] Vorspulen: Shift + Bewegungstasten beschleunigen das Spiel. Gegner, Animationen und die ganze Welt laufen im selben Tempo schneller, damit man im Dungeon schneller vorankommt.

### Fähigkeiten und Kampf-UI
- [ ] Fähigkeiten-Text bei Attacken verkürzen: im Kampf nur Name (und Elementsymbol) zeigen
- [ ] Neues antippbares Info-Feld pro Fähigkeit, das die ausführliche Beschreibung erst auf Tippen anzeigt
- [ ] Fähigkeiten-Bildschirm im Kampf verkleinern, er ist aktuell zu groß
- [ ] Ein Wesen hat maximal 4 aktive Fähigkeiten gleichzeitig, die sich austauschen lassen

### Items und Beutel
- [ ] Quest-Items nicht im normalen Beutel ablegen, sondern in einer eigenen Quest-Tasche
- [ ] Nutzbare Items bekommen einen Infotext, der die genaue Wirkung nennt (wie viel Heilung, wie viel Schaden)

### Fähigkeitssteine
- [ ] Fähigkeitssteine liegen im Dungeon verteilt und können aufgesammelt werden
- [ ] Pro Dungeon (nicht pro Etage) gibt es insgesamt mindestens 1 und höchstens 3 Steine
- [ ] Ein Stein kann für den Spieler oder den Partner eingesetzt werden, um die Fähigkeit zu erlernen
- [ ] Steine verbrauchen sich sofort beim Einsatz
- [ ] Wesen können unbegrenzt viele Fähigkeiten lernen, müssen dafür aber immer eine der 4 aktiven Fähigkeiten verlernen und sie damit austauschen

### Quests und Belohnungen
- [ ] Quest-Belohnungen werden zufällig erwürfelt und sind nie fest vorgegeben
- [ ] Mögliche Belohnungs-Arten: Fähigkeitssteine, Geld, Heilungs-Items
- [ ] Jede Quest enttäuscht nie: Es gibt immer eine gute Belohnung, auch im schlechtesten Würfelfall

### Dungeons
- [ ] Dungeon-Layout ändert sich bei jedem Betreten, keine festen Wege
- [ ] Gegner-Level steigen pro Etage: Etage 1 niedrig, Etage 2 höher, und so weiter
- [ ] Boss-Level ist pro Dungeon fest vorgegeben und skaliert nicht
- [ ] Das Dungeon-Level (Schwierigkeit) wird vor dem Betreten immer angezeigt

### Level, Erfahrung und Schaden
- [ ] Erhaltene Erfahrung insgesamt senken
- [ ] Erfahrungs-Skalierung am Vorbild von Pokémon Mystery Dungeon orientieren (nur das Prinzip, kein Eins-zu-eins-Kopieren)
- [ ] Schaden skaliert mit dem Level

### Elemente (Typen)
- [ ] Im Prototyp gibt es 4 spielbare Elemente: Feuer, Erde, Wasser, Luft
- [ ] Zusätzlich gibt es **Pflanze** als reinen Monstertyp. Es gibt kein spielbares Pflanzen-Wesen im Prototyp.
- [ ] Zuordnung der Wesen: Dachs = Feuer, Capybara = Erde, Otter = Wasser, Eule = Luft
- [ ] Wesen und Fähigkeiten haben je ein Element
- [ ] Namen der Elemente werden gegenüber dem Original leicht verändert (eigene Elementnamen)
- [ ] Das Element hat nichts mit dem Persönlichkeitsprofil zu tun
- [ ] Typentabelle für den Prototyp (als Daten in JSON, nicht fest im Code):
  - Wasser ist stark gegen Feuer
  - Wasser ist stark gegen Erde
  - Erde ist stark gegen Feuer
  - Feuer ist stark gegen Pflanze
  - Pflanze ist stark gegen Wasser
  - Luft (Flug) ist stark gegen Pflanze
  - Luft (Flug) hat im Prototyp keine Schwäche und ist sonst gegen alle neutral
  - Alles, was nicht aufgeführt ist, ist neutral (Faktor 1). Die Schwäche ergibt sich jeweils aus der Gegenseite der Stärke.
  - Daraus folgt: Feuer ist schwach gegen Wasser und Erde, Erde ist schwach gegen Wasser, Wasser ist schwach gegen Pflanze, Pflanze ist schwach gegen Feuer und Luft.
- [ ] Schadensfaktor als einstellbarer Konfigurationswert (JSON):
  - Prototyp: ×1,1 bei Stärke und ×0,9 bei Schwäche
  - Später: wie im Original, ×1,5 bei Stärke und ×0,5 bei Schwäche

### Partnervorschlag
- [ ] Der Vorschlag prüft Element und Persönlichkeit
- [ ] Hauptkriterium: das Element. Der Partner soll die Elementschwächen des Spielers ausgleichen.
- [ ] Zweitkriterium: die Persönlichkeits-Ergänzung aus dem Test (das Wesen mit dem am weitesten entfernten Profil)
- [ ] Hat das Wesen des Spielers keine Elementschwäche (die Eule mit Luft/Flug), entscheidet allein die Persönlichkeits-Ergänzung
- [ ] Der Spieler darf den Vorschlag weiterhin frei ändern

## 2. Das brauche ich

### Dorf
- [ ] Mehr Gebäude im Dorf, insgesamt fünf:
  - Haus des Partners
  - Gildenhaus, an dem das Schwarze Brett hängt
  - Gemeindehaus
  - Laden im Stil eines Heilkräuterladens. Im Prototyp nur optisch vorhanden: kein Kaufen, kein Verkaufen. Das Handelssystem kommt nach dem Prototyp.
  - Altes, kaputtes Haus für den Spieler. Im Prototyp bleibt es kaputt. Später wird es über die Freundschaft zu den Bewohnern aufgebaut, die durch erledigte Quests wächst.
- [ ] Ein Angelplatz als reine Deko, mit den typischen Elementen und Details eines kleinen Angelplatzes (z. B. Steg, Boot, Angeln, Eimer, Netze). Der vorhandene See im Dorf wird dafür leicht vergrößert. Angeln selbst gibt es nicht.
- [ ] Das Schwarze Brett ist an einem Gebäude angebracht. Der NPC, der dafür verantwortlich ist, steht direkt neben dem Brett.
- [ ] NPCs mit Quests, die nicht über das Schwarze Brett laufen, haben ein orangenes Ausrufezeichen über dem Kopf
  - Sobald die Quest angenommen wird, verschwindet das Ausrufezeichen
  - Sobald die Quest erfüllt ist, erscheint ein Fragezeichen über dem Kopf
  - Bei der Abgabe (Beenden der Quest) verschwindet das Fragezeichen

### Intro
- [ ] Intro-Sequenz: Eine Animation zeigt das Dorf einmal von links nach rechts
- [ ] Auslöser: Sie läuft, sobald der Partner dem Spieler sein Dorf zeigen will (nach Test, Enthüllung und Partnerwahl)
- [ ] Die Sequenz lässt sich überspringen

### Sound
- [ ] Soundfiles für Boss-Gegner mit bedrohlichem Klang im Pixel-Stil (8-Bit/Chiptune)
- [ ] Beides einbauen: ein Musikstück für den Boss-Raum und ein kurzes Warngeräusch beim Erscheinen des Bosses

### Nach dem Prototyp (bewusst verschoben)
- [ ] Freundschaft durch erledigte Quests, die das kaputte Haus Schritt für Schritt aufbaut
- [ ] Handelssystem im Heilkräuterladen (Kaufen und Verkaufen von Items)

## 3. Das ist nötig

### Icons
- [ ] Icons für Fähigkeitssteine: Das Element muss auf den ersten Blick erkennbar sein. Jeder Stein bekommt eine eigene Farbe oder ein eigenes Symbol seines Elements (Feuer, Erde, Wasser, Luft). Es gibt im Prototyp keinen Pflanzenstein.
- [ ] Icon für Heilbeeren
- [ ] Icon für Geld
- [ ] Icons für die Fähigkeitstypen: Feuer, Erde, Wasser, Luft und Pflanze (auch Pflanze, weil sie als Monstertyp vorkommt)
- [ ] Alle Icons im Pixel-Stil (16×16), passend zum restlichen Spiel. Passende Vorlagen aus dem Ninja-Adventure-Pack verwenden, sonst selbst zeichnen.

### NPCs
- [ ] Im Prototyp gibt es 5 NPCs im Dorf:
  - 1 NPC vor dem Gemeindehaus
  - 1 NPC im Gemeindehaus
  - 1 NPC beim Schwarzen Brett (am Gildenhaus)
  - 1 NPC im Heilkräuterladen
  - 1 NPC am Angelplatz
- [ ] Quests im Prototyp: Nur der NPC im Gemeindehaus gibt eine Quest (mit orangenem Ausrufezeichen). Die zweite Aufgabe läuft über das Schwarze Brett. Alle anderen NPCs sind nur zum Reden da.
- [ ] NPCs ausarbeiten: Name, Tierart, Rolle im Dorf, Persönlichkeit, Dialoge und Aussehen
- [ ] Jeder NPC bekommt ein eigenes, wiedererkennbares Aussehen im Stil der restlichen Wesen (rund, großer Kopf, kurze Beine)

### Feedback
- [ ] Nach dem Ende des Prototyps erscheint ein Feedback-Button
- [ ] Der Button öffnet ein Google-Forms-Formular in einem neuen Tab. Das Feedback kommt so bei Julian an.
- [ ] Der Link zum Formular ist ein Konfigurationswert, den Julian selbst einträgt, sobald das Formular erstellt ist
- [ ] Kurzer Hinweis am Button: Das Formular öffnet sich bei Google
- [ ] Wichtig: Es wird nur das gesendet, was der Spieler selbst eintippt. Testergebnisse und Persönlichkeitswerte werden nie automatisch mitgeschickt (die Daten bleiben weiter nur lokal im Browser).

### Offene Rückfragen an mich selbst
- [ ] Formular-Link für den Button (als Konfigurationswert hinterlegen): https://docs.google.com/forms/d/e/1FAIpQLSdiEITpgJ0Kpi2pSUYsX-BbkqurzSu1Fa1wnujg4jVbAys_qA/viewform
