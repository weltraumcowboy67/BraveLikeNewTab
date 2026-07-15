# Version 1.0.3

## NEW

- Brave-style settings dialog with a clear left-side navigation
- Change the default search engine directly from settings
- Brave Search remains the default provider
- Free Picsum Photos background source without an API key
- Custom direct-image API support with `{width}`, `{height}`, and `{seed}` placeholders
- Automatic offline fallback to bundled local backgrounds
- German, English, Spanish, Italian, Polish, Russian, and French UI support
- Clock visibility and automatic, 12-hour, or 24-hour format settings
- Local image import now requests optional access only for the selected image host

## Fixed

- Replaced the narrow settings drawer with a responsive desktop dialog
- Fixed settings controls being keyboard-focusable while the dialog was closed
- Added focus trapping and focus restoration for the settings dialog
- Added an initials fallback when a shortcut icon cannot be loaded
- Improved settings overflow and mobile layout behavior
- Improved search-provider validation and default-provider handling
- Preserved local-only backgrounds for existing users during the v1.0.3 migration

## Privacy

- Settings, shortcuts, pins, and imported files remain in local extension storage
- External image requests occur only when an online source is active or a URL import is started by the user
- No analytics, advertising SDKs, or external favicon requests
