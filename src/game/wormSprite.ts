// ============================================================
// WURMKIEG – Wurm-Sprite (aus SVG, optimiert)
// Ersetzt die alte prozedurale Canvas-Zeichnung durch das
// vektorbasierte Wurm-Design mit Armeehelm.
//
// Optimierungen gegenüber dem Roh-SVG:
//  - Ein einziger Körper-Pfad statt mehrerer überlappender Formen
//  - Gradients werden pro Team-Farbpalette zur Laufzeit generiert
//    (identische Struktur, nur andere Farbstops => wiederverwendbar)
//  - Reduzierte Detailpfade (Rillen, Tarnflecken, Reflexionen)
//  - Keine CSS-Keyframes im Sprite: "Atmen" & Schatten-Puls werden
//    direkt auf dem Canvas transformiert (60fps, kein DOM/Styling-Overhead)
//  - Bilder werden gecached (URL.createObjectBlob pro Farbpalette)
// ============================================================

export interface WormPalette {
  /** Helles Highlight (oben links) */
  light: string;
  /** Mittelton */
  mid: string;
  /** Schatten / dunkler Rand */
  dark: string;
}

const OUTLINE = '#2D1A29';

/** Team-Farben -> rosa/rot-basierte Wurm-Hautpaletten (wie im Referenz-SVG) */
export const WORM_PALETTES: Record<string, WormPalette> = {
  red:    { light: '#FFB3C6', mid: '#FF758F', dark: '#C9184A' },
  blue:   { light: '#B3C6FF', mid: '#758FFF', dark: '#184AC9' },
  green:  { light: '#B3FFC6', mid: '#6FCB85', dark: '#1F8A43' },
  yellow: { light: '#FFE3B3', mid: '#FFC46E', dark: '#D98E1F' },
};

/** Helm bleibt militärisch oliv – passt zu allen Teams */
const HELMET_PALETTE: WormPalette = { light: '#7B9942', mid: '#4B6320', dark: '#24330A' };

/** Natürliche Zeichengröße des Sprites (ViewBox) */
export const SPRITE_W = 100;
export const SPRITE_H = 100;

/** Optimiert: Sprite wird mit 2x Auflösung gerendert => gestochen scharf & glatte Kanten */
const RENDER_SCALE = 2;

/**
 * Baut den optimierten SVG-Markup-String einer Wurm-Figur.
 * Koordinaten: Ursprung (0,0) = Mitte der Fuß-Basislinie,
 * Y-Achse nach oben negativ (Bildschirmkoordinaten).
 * Source: Referenz-SVG (ViewBox 0..100), translation -45/-85.
 */
function buildWormSvg(p: WormPalette, h: WormPalette): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -100 100 100" width="${SPRITE_W * RENDER_SCALE}" height="${SPRITE_H * RENDER_SCALE}">
<defs>
  <radialGradient id="skin" cx="35%" cy="30%" r="70%">
    <stop offset="0%" stop-color="${p.light}"/>
    <stop offset="60%" stop-color="${p.mid}"/>
    <stop offset="100%" stop-color="${p.dark}"/>
  </radialGradient>
  <radialGradient id="helm" cx="35%" cy="25%" r="75%">
    <stop offset="0%" stop-color="${h.light}"/>
    <stop offset="50%" stop-color="${h.mid}"/>
    <stop offset="100%" stop-color="${h.dark}"/>
  </radialGradient>
</defs>
<g stroke="${OUTLINE}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">
  <!-- Koerper (S-Kurve, ein Pfad) -->
  <path d="M-15,0 C-20,-20 -10,-30 -5,-45 C-10,-70 30,-70 25,-45 C20,-30 20,-20 15,0 Q0,5 -15,0 Z" fill="url(#skin)"/>
  <!-- Koerper-Rillen -->
  <path d="M-7,-35 Q7,-31 20,-35 M-11,-23 Q3,-19 15,-23 M-13,-11 Q0,-7 13,-11" fill="none" opacity="0.35"/>
  <!-- Tarnschminke -->
  <path d="M15,-49 L21,-47 M16,-46 L20,-44" stroke="#800F2F" opacity="0.55"/>
  <!-- Augen -->
  <circle cx="3" cy="-57" r="8" fill="#FFF"/><circle cx="7" cy="-57" r="2.5" fill="${OUTLINE}" stroke="none"/><circle cx="6" cy="-58" r="1" fill="#FFF" stroke="none"/>
  <circle cx="17" cy="-57" r="8" fill="#FFF"/><circle cx="21" cy="-57" r="2.5" fill="${OUTLINE}" stroke="none"/><circle cx="20" cy="-58" r="1" fill="#FFF" stroke="none"/>
  <!-- Zornige Augenbrauen -->
  <path d="M-7,-63 L7,-60 M27,-63 L13,-60" stroke-width="2.5"/>
  <!-- Grinsender Mund + Lachfalte -->
  <path d="M5,-45 Q13,-40 20,-47 M20,-47 Q22,-49 23,-48" fill="none"/>
  <!-- Helm (Kuppel + Krempe) -->
  <path d="M-13,-69 C-13,-89 33,-89 33,-69 C37,-69 41,-68 41,-66 C41,-63 25,-59 10,-59 C-5,-59 -21,-63 -21,-66 C-21,-68 -17,-69 -13,-69 Z" fill="url(#helm)"/>
  <path d="M-18,-66 C-5,-62 25,-62 38,-66" fill="none" stroke="${h.dark}" opacity="0.7"/>
  <path d="M-7,-78 C0,-82 10,-82 17,-78" fill="none" stroke="#A9C773" stroke-width="2" opacity="0.6"/>
  <!-- Tarnflecken -->
  <path d="M-5,-81 Q0,-85 5,-80 Q3,-75 -3,-77 Z" fill="${h.dark}" opacity="0.4" stroke="none"/>
  <path d="M15,-77 Q25,-80 27,-73 Q20,-70 15,-77 Z" fill="#3B4F1A" opacity="0.5" stroke="none"/>
  <!-- Kinnriemen -->
  <path d="M-15,-64 Q-20,-50 -11,-40" fill="none" stroke="#4A3F35" stroke-width="3"/>
  <rect x="-13.5" y="-42" width="5" height="4" rx="1" fill="#E0E0E0" transform="rotate(-20,-11,-40)"/>
  <path d="M35,-64 Q40,-57 32,-51" fill="none" stroke="#4A3F35" stroke-width="3"/>
</g>
</svg>`;
}

/** Cache: Paletten-Key -> fertiges HTMLImageElement */
const imageCache = new Map<string, HTMLImageElement>();

function getSpriteImage(paletteKey: string): HTMLImageElement | null {
  const cached = imageCache.get(paletteKey);
  if (cached) return cached;

  const palette = WORM_PALETTES[paletteKey] ?? WORM_PALETTES.red;
  const svg = buildWormSvg(palette, HELMET_PALETTE);

  let img: HTMLImageElement;
  try {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    img = new Image();
    img.src = URL.createObjectURL(blob);
  } catch {
    // Fallback falls Blob-URLs nicht verfuegbar
    img = new Image();
    img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  imageCache.set(paletteKey, img);
  return img;
}

/** Lädt alle Team-Sprites vor Spielstart (vermeidet Flackern in Frame 1) */
export function preloadWormSprites(): void {
  for (const key of Object.keys(WORM_PALETTES)) getSpriteImage(key);
}

/**
 * Zeichnet den Wurm zentriert an (x, y), wobei y = Fuß-Basislinie ist.
 * scale: 1 = Originalgröße (100px hoch). facingRight spiegelt horizontal.
 * breathPhase: 0..2π – erzeugt den sanften "Atmen"-Effekt (Skalierung).
 * alpha: Deckkraft für Tod/Treffer-Animationen.
 */
export function drawWormSprite(
  ctx: CanvasRenderingContext2D,
  paletteKey: string,
  x: number,
  y: number,
  scale: number,
  facingRight: boolean,
  breathPhase: number,
  alpha: number = 1,
): boolean {
  const img = getSpriteImage(paletteKey);
  if (!img || !(img.complete && img.naturalWidth > 0)) return false;

  ctx.save();
  ctx.globalAlpha = alpha;
  // Kanten glätten beim Hoch/Runterskalieren
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(x, y);
  if (!facingRight) ctx.scale(-1, 1);

  // Atmen: minimales scaleY/scaleX wie in der SVG-Animation
  const breathe = Math.sin(breathPhase);
  ctx.scale(1 + breathe * 0.02, 1 - breathe * 0.04);
  ctx.scale(scale, scale);

  // Viewbox (-50,-100)..(50,0): Füße bei y=0; Sprite nativ 200x200 (2x) => scharf
  ctx.drawImage(img, -SPRITE_W / 2, -SPRITE_H, SPRITE_W, SPRITE_H);
  ctx.restore();
  return true;
}

/** Bodenschatten unter dem Wurm (pulsiert synchron zum Atmen) */
export function drawWormShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  scale: number,
  breathPhase: number,
): void {
  const pulse = 1 + Math.sin(breathPhase) * 0.05;
  ctx.save();
  ctx.translate(x, groundY);
  ctx.scale(pulse, pulse);
  const grad = ctx.createRadialGradient(0, 0, 1, 0, 0, 22 * scale);
  grad.addColorStop(0, 'rgba(0,0,0,0.5)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, 0, 22 * scale, 5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
