# WURMKIEG - Taktischer Artillerie-Shooter

Ein vollständiges 2D-Artillerie- und Taktikspiel für den Browser, inspiriert von klassischen rundenbasierten Strategiespielen.

## 🎮 Features

### Kernspielmechanik
- **Rundenbasiertes Gameplay**: 2-4 Teams wechseln sich ab
- **Zerstörbare Landschaft**: Pixelgenaue Terrainzerstörung mit realistischen Kratern
- **Wind-Physik**: Dynamischer Wind beeinflusst Projektilflugbahnen
- **18 verschiedene Waffen** mit einzigartigem Verhalten
- **KI-Gegner** mit drei Schwierigkeitsstufen
- **Lokaler Multiplayer** an einem Gerät

### Waffenarsenal
| Waffe | Typ | Beschreibung |
|-------|-----|-------------|
| 🚀 Raketenwerfer | Projektil | Steuerbare Rakete mit großer Explosion |
| 💣 Bazooka | Projektil | Standard-Panzerabwehrrakete mit Zeitzünder |
| 💥 Handgranate | Projektil | Springende Granate mit Verzögerungszünder |
| 🧨 Splittergranate | Projektil | Explodiert in 6 kleinere Granaten |
| 🧨 Dynamit | Platziert | Platzierbare Ladung mit langem Zünder |
| ⚡ Laserwaffe | Strahl | Sofortiger Energiestrahl |
| 🔫 Gatling Gun | Projektil | 30-Schuss Schnellfeuer |
| 📡 Mikrowelle | Strahl | Kontinuierlicher Hitzestrahl |
| 🪚 Kettensäge | Nahkampf | Verheerender Nahkampfangriff |
| 🎯 Schrotflinte | Projektil | 8 Kugeln mit kurzem Wirkbereich |
| 🎯 Scharfschütze | Instant | Hohe Präzision, hoher Schaden |
| 💀 Mine | Platziert | Annäherungsmine |
| ✈️ Luftangriff | Projektil | 5 Bomben aus der Luft |
| 🔩 Bohrer | Projektil | Bohrt sich durch Terrain |
| 🌀 Teleporter | Utility | Zufällige Positionierung |
| 🛡️ Schutzschild | Utility | 50% Schadensreduktion |
| 🔥 Flammenwerfer | Strahl | Feuer mit Brandeffekt |
| ⚡ EMP-Schocker | Projektil | Betäubt Gegner |

### Karten
- **Omaha Beach**: Inspiriert von der Normandie-Landung 1944
- **Stalingrad**: Zerstörte Winterstadt 1942
- **Wüstenfestung**: Nordafrikanische Festungsanlage
- **Gebirgsfront**: Alpen-Höhenstellung

### Spielmodi
- Einzelspieler gegen KI (3 Schwierigkeitsstufen)
- Lokaler Multiplayer (2-4 Teams)
- Konfigurierbare Zugzeit, Teamgröße und Kartenauswahl

## 🕹️ Steuerung

| Taste | Aktion |
|-------|--------|
| ← → / A D | Bewegen |
| ↑ / W / Leertaste | Springen (3x pro Zug) |
| Maus | Zielen |
| Maustaste halten | Stärke aufladen |
| Maustaste loslassen | Schießen |
| Q / E | Waffen wechseln |
| Tab | Waffenarsenal öffnen |
| Escape | Pause |

## 🏗️ Architektur

```
src/
├── App.tsx              # Hauptkomponente mit Menü, Spiel, Einstellungen
├── main.tsx             # Einstiegspunkt
├── index.css            # Tailwind CSS
└── game/
    ├── types.ts         # Typdefinitionen und Konstanten
    ├── engine.ts        # Spiel-Engine (Physik, Runden, KI)
    ├── weapons.ts       # Waffendefinitionen und Registry
    ├── terrain.ts       # Terrain-Generierung und -Zerstörung
    ├── renderer.ts      # Canvas-Rendering (Terrain, Würmer, Effekte)
    └── audio.ts         # Web Audio API Sounds
```

### Technologie-Stack
- **TypeScript** für Typsicherheit
- **React** für UI-Komponenten
- **Canvas 2D** für Spiel-Rendering
- **Web Audio API** für prozedurale Soundeffekte
- **Tailwind CSS** für UI-Styling
- **Vite** als Build-System

### Design-Entscheidungen
- **Canvas 2D** gewählt statt WebGL: Ausreichend für 2D-Spiel, einfacher zu warten, bessere Browserkompatibilität
- **Pixel-basiertes Terrain**: Ermöglicht präzise Zerstörung und Kollision
- **Offscreen Canvas**: Terrain wird zwischengespeichert, nur bei Änderungen neu gezeichnet
- **Prozedurale Sounds**: Keine externen Audio-Dateien nötig
- **Fixed-Timestep Simulation**: Konsistente Physik unabhängig von Framerate

## 🚀 Entwicklung

```bash
# Installation
npm install

# Entwicklungsserver
npm run dev

# Produktions-Build
npm run build

# Type-Check
npm run typecheck
```

## ⚙️ Einstellungen

- **Master-Lautstärke**: Gesamtlautstärke
- **Effekt-Lautstärke**: Soundeffekte
- **Splatter-Intensität**: Aus / Reduziert / Normal / Hoch
- **Partikeldichte**: 20% - 100%
- **Bildschirmverwacklung**: An / Aus

## 🎯 Spielziele

Eliminiere alle Würmer der gegnerischen Teams. Jeder Wurm hat 100 HP. Ein Team verliert, wenn alle seine Würmer eliminiert sind. Nach 50 Runden beginnt Sudden Death (alle Würmer verlieren langsam HP).

## 📝 Bekannte Einschränkungen

- Terrain-Rendering kann bei häufigen Explosionen kurz verzögern
- KI auf "Schwer" simuliert weniger Kandidaten als ideal
- Online-Multiplayer ist nicht implementiert
- Mobile Touch-Steuerung ist funktional aber nicht optimal

## 📄 Lizenz

Dieses Projekt wurde als eigenständige Kreation entwickelt und kopiert keine geschützten Inhalte bestehender Spiele.
