# BraveLikeNewTab

Eine moderne Neuer-Tab-Startseite für Firefox mit Hintergründen, Brave Search, Schnellzugriffen, Pins und Fokusmodus. Die Erweiterung arbeitet ohne Framework und speichert Einstellungen, eigene Bilder, Shortcuts und Pins lokal über `browser.storage.local`.

Firefox: https://addons.mozilla.org/de/firefox/addon/brave-like-new-tab/

## Version 1.0.3

- Brave-ähnliches Einstellungsfenster mit linker Navigation
- Flüssigere Settings ohne Vollbild-Blur und ohne unnötiges Neurendern versteckter Listen
- Benutzerdefinierte Akzentfarbe für Auswahl, Schalter und Fokuszustände
- Dark Mode als empfohlener Standard, Light Mode ist als Testmodus gekennzeichnet
- Standardsuchmaschine direkt in den Einstellungen änderbar
- Brave Search bleibt die Standardsuchmaschine
- Kostenlose Picsum-Bildquelle ohne API-Key und ohne Wasserzeichen
- Beta-Kategorien für Picsum: Natur, Stadt & Architektur, Technologie, Menschen sowie Ruhig & Minimal
- Eigene direkte Bild-API mit `{width}`, `{height}`, `{seed}` und `{category}`
- Sofortiger lokaler Hintergrund und optionales Vorladen des nächsten Online-Bildes
- Automatischer Offline-Fallback auf vier gebündelte Hintergründe
- Deutsch, Englisch, Spanisch, Italienisch, Polnisch, Russisch und Französisch
- Uhr ein- oder ausblendbar sowie 12-, 24- oder automatisches Format
- Responsive Einstellungen für Desktop und kleine Fenster

## Hintergrundbilder

Neue Installationen verwenden standardmäßig Picsum Photos. Bei fehlender Verbindung oder einem API-Fehler wird automatisch ein lokales Bild verwendet. Bestehende Installationen bleiben nach dem Update zunächst bei lokalen Bildern, bis die Online-Quelle in den Einstellungen aktiviert wird.

Die Online-Bildfunktionen sind als Beta gekennzeichnet. Beim Öffnen eines neuen Tabs erscheint zuerst ohne Wartezeit ein lokaler Hintergrund. Das Online-Bild wird danach weich eingeblendet. Wenn `Nächstes Bild vorladen` aktiv ist, lädt die Erweiterung im Leerlauf bereits den nächsten Hintergrund in den Browser-Cache.

Verfügbare Quellen:

- `Picsum Photos (Beta)`: kostenlos, ohne API-Key, wechselnde Bilder aus dem Unsplash-Bestand
- `Nur lokal`: keine externe Bildanfrage
- `Eigene Bild-API`: eine HTTPS-URL, die direkt ein Bild liefert
- Datei-Upload oder einzelne Bild-URL: wird nach dem Import lokal gespeichert

Beispiel für eine eigene API:

```text
https://example.com/image/{width}/{height}?seed={seed}&category={category}
```

Picsum liefert Bilder ohne eingeblendete Wasserzeichen. Für Bilder externer Dienste gelten die jeweiligen Nutzungs- und Lizenzbedingungen. Die vier gebündelten Bilder wurden mit GPT Image erstellt.

## Suche

Brave Search ist standardmäßig aktiv. Unter `Einstellungen > Suchen` kann jeder gespeicherte Suchanbieter als Standard gewählt werden. Bis zu drei Anbieter können über eine Such-URL verwaltet werden.

```text
https://example.com/search?q={query}
```

`{query}` wird durch den eingegebenen Suchbegriff ersetzt.

## Installation

### Firefox Add-ons

Die veröffentlichte Version über die oben verlinkte Firefox-Add-ons-Seite installieren.

### Lokal testen

1. Repository herunterladen oder klonen.
2. In Firefox `about:debugging#/runtime/this-firefox` öffnen.
3. `Temporäres Add-on laden` wählen.
4. Die Datei `manifest.json` aus diesem Ordner auswählen.
5. Einen neuen Tab öffnen.

Es gibt keinen Build-Schritt, keine Paketinstallation und keinen lokalen Port.

## Entwicklung und Prüfung

Tech Stack: HTML, CSS, Vanilla JavaScript und Firefox WebExtensions Manifest V3.

```bash
node --check js/app.js
node --check js/backgrounds.js
node --check js/storage.js
node --check js/i18n.js
npx web-ext lint --source-dir .
```

## Wichtige Dateien

- `newtab.html`: Startseite und Einstellungsstruktur
- `css/styles.css`: Layout, Themes und responsive Darstellung
- `js/app.js`: Interaktionen, Suche, Settings und Rendering
- `js/storage.js`: lokale Speicherung, Defaults und Migrationen
- `js/backgrounds.js`: lokale Bilder, Importe und Bild-API-Quellen
- `js/i18n.js`: Übersetzungen der Startseiten-UI
- `_locales/`: lokalisierter Erweiterungsname und Beschreibung
- `RELEASE_NOTES_1.0.3.md`: vorbereitete GitHub Release Notes

## Datenschutz

- Keine Tracker, Werbe-SDKs oder externen Favicon-Anfragen
- Einstellungen und importierte Inhalte bleiben lokal
- Online-Anfragen erfolgen nur bei einer aktiven Online-Bildquelle oder beim ausdrücklich gestarteten URL-Import
- Beim Import einer fremden Bild-URL fragt Firefox nur für die betroffene Domain nach einer optionalen Berechtigung

## Bekannte Grenzen

- Die eigene Bild-API muss eine direkte HTTPS-Bildantwort liefern, JSON-APIs werden nicht ausgewertet.
- Online-Suche und Online-Bilder benötigen eine Internetverbindung. Uhr, Einstellungen, lokale Bilder, Shortcuts und Pins funktionieren offline.
- Sehr viele oder sehr große importierte Bilder können den lokalen Erweiterungsspeicher belasten.
- Die Erweiterung ist für Firefox Desktop ausgelegt und wurde nicht für Firefox auf Android freigegeben.

## Tipps

Für eigene Shortcut-Icons eignen sich transparente PNG- oder SVG-Dateien. JPEG funktioniert ebenfalls, besitzt aber keine Transparenz.
