# BraveLikeNewTab

Eine moderne Neuer-Tab-Startseite für Firefox mit Hintergründen, Brave Search, Schnellzugriffen, Pins und Fokusmodus. Die Erweiterung arbeitet ohne Framework und speichert Einstellungen, eigene Bilder, Shortcuts und Pins nur lokal.

Firefox: https://addons.mozilla.org/de/firefox/addon/brave-like-new-tab/

## Version 1.0.6

- Brave-ähnliches Einstellungsfenster
- Benutzerdefinierte Akzentfarbe für Auswahl und Schalter
- Dark Mode als Standard, Light Mode (Testmodus)
- Standardsuchmaschine direkt in den Einstellungen änderbar
- Brave Search ist die Standardsuchmaschine
- Kostenlose Picsum-Bildquelle ohne API-Key
- Beta-Kategorien für Picsum: Natur, Stadt & Architektur, Technologie, Menschen sowie Ruhig & Minimal
- Eigene Bild-API mit `{width}`, `{height}`, `{seed}` und `{category}`
- Sofortiger Hintergrund und optionales Vorladen des nächsten Online-Bildes
- Automatischer Offline-Fallback auf vier gebündelte Hintergründe
- Deutsch, Englisch, Spanisch, Italienisch, Polnisch, Russisch und Französisch sind Unterstützt
- Uhr ein- oder ausblendbar sowie 12-, 24- oder automatisches Format
- Handy Support (Testing)

## Hintergrundbilder

Neue Installationen verwenden standardmäßig Picsum Photos. Bei fehlender Verbindung oder einem API-Fehler wird automatisch ein lokales Bild verwendet. Bestehende Installationen bleiben nach dem Update zunächst bei lokalen Bildern, bis die Online-Quelle in den Einstellungen aktiviert wird.

Die Online-Bildfunktionen sind als Beta gekennzeichnet. Beim Öffnen eines neuen Tabs erscheint ein lokaler Hintergrund. Das Online-Bild wird danach eingeblendet. Wenn `Nächstes Bild vorladen` aktiv ist, lädt die Erweiterung im Leerlauf bereits den nächsten Hintergrund in den Browser-Cache.

Verfügbare Quellen:

- `Picsum Photos (Beta)`: kostenlos, ohne API-Key, wechselnde Bilder aus dem Unsplash
- `Nur lokal`: keine externe Bildanfrage
- `Eigene Bild-API`: eine HTTPS-URL, die direkt ein Bild liefert
- Datei-Upload oder einzelne Bild-URL: wird nach dem Import lokal gespeichert

Beispiel für eine eigene API:

```text
https://example.com/image/{width}/{height}?seed={seed}&category={category}
```

Picsum liefert Bilder ohne Wasserzeichen. Für Bilder externer Dienste gelten die jeweiligen Nutzungs- und Lizenzbedingungen. Die vier gebündelten Bilder wurden mit GPT Image erstellt.

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

## Datenschutz

- Einstellungen und importierte Inhalte bleiben lokal
- Online-Anfragen erfolgen nur bei einer aktiven Online-Bildquelle oder beim ausdrücklich gestarteten URL-Import
- Beim Import einer fremden Bild-URL fragt Firefox nur für die betroffene Domain nach einer optionalen Berechtigung

## Bekannte Grenzen

- Die eigene Bild-API muss eine direkte HTTPS-Bildantwort liefern, JSON-APIs werden nicht ausgewertet.
- Online-Suche und Online-Bilder benötigen eine Internetverbindung. Uhr, Einstellungen, lokale Bilder, Shortcuts und Pins funktionieren offline.
- Sehr viele oder sehr große importierte Bilder können den lokalen Erweiterungsspeicher belasten.
- Die Erweiterung ist für Firefox Desktop ausgelegt und wurde nicht für Firefox auf Android freigegeben.

## Tipps

Für eigene Shortcut-Icons eignen sich transparente PNG- oder SVG-Dateien besser. JPEG funktioniert ebenfalls, besitzt aber keine Transparenz.

## Credits / Drittanbieter

Online background images are provided through Lorem Picsum (picsum.photos).
Lorem Picsum uses images from Unsplash.

YouTube and the YouTube logo are trademarks of Google LLC.
BraveLikeNewTab is not affiliated with or endorsed by YouTube or Google.

Brave and the Brave logo are trademarks of Brave Software, Inc.
BraveLikeNewTab is an independent project and is not affiliated with,
endorsed by, or sponsored by Brave Software, Inc.

Copyright © 2026 Benni (weltraumcowboy67)
