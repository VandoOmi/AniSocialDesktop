# AniSocial Desktop

Desktop-App für [AniSocial.de](https://anisocial.de) – Die Anime-Community.

Gebaut mit Electron, um AniSocial als native Desktop-Anwendung mit System-Benachrichtigungen, Tastenkürzel und nativem Kontextmenü bereitzustellen.

## Features

- Native Desktop-Benachrichtigungen
- Kontextmenü (Links öffnen, Bilder, Kopieren, Navigation)
- Tastenkürzel für Navigation, Zoom, Vollbild und DevTools
- Externe Links werden im Systembrowser geöffnet
- Fenstergröße und -position werden gespeichert
- Verfügbar für Linux, Windows und macOS

## Installation

### Fertige Pakete

Vorgefertigte Pakete gibt es auf der [Releases-Seite](https://github.com/VandoOmi/AniSocialElectron/releases).

| Plattform | Formate |
|-----------|---------|
| Linux | AppImage, deb, rpm, pacman, tar.gz |
| Windows | Installer |
| macOS | DMG |

### Selber bauen

#### Voraussetzungen

- [Node.js](https://nodejs.org/) (>= 18)
- npm

#### Schritte

```bash
git clone https://github.com/VandoOmi/AniSocialElectron.git
cd AniSocialElectron
npm install
```

Entwicklungsmodus starten:

```bash
npm start
```

Pakete bauen:

```bash
# Für das aktuelle System
npm run build

# Plattform-spezifisch
npm run build:linux
npm run build:win
npm run build:mac
```

Die fertigen Pakete landen im `dist/`-Verzeichnis.

## Tastenkürzel

| Kürzel | Aktion |
|--------|--------|
| `Ctrl+R` | Neu laden |
| `Ctrl+Shift+R` | Hard Reload |
| `Alt+←` | Zurück |
| `Alt+→` | Vor |
| `Ctrl+H` | Startseite |
| `F11` | Vollbild |
| `F12` | DevTools |
| `Ctrl+=` | Zoom + |
| `Ctrl+-` | Zoom - |
| `Ctrl+0` | Zoom zurücksetzen |

## Lizenz

MIT
