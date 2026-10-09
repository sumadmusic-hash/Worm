// ============================================================
// WURMKIEG - Canvas Renderer
// ============================================================
import { GameEngine } from './engine';
import {
  Vec2, TerrainMaterial, WormAnimState, Worm, Particle, Projectile, Explosion,
  WORM_RADIUS, GamePhase, WeaponType,
} from './types';
import { getWeaponDef } from './weapons';
import { getMaterialAt } from './terrain';
import { drawWormSprite, drawWormShadow, preloadWormSprites, SPRITE_H as WORM_SPRITE_H } from './wormSprite';

// Höhe des sichtbaren Wurms im Spiel (px) – Sprite wird skaliert
const SPRITE_DRAW_H = WORM_SPRITE_H; // 100px natural, wird auf ~24px gescaled

const TEAM_COLORS: Record<string, { body: string; dark: string; light: string; outline: string }> = {
  red: { body: '#cc3333', dark: '#881111', light: '#ff6666', outline: '#440000' },
  blue: { body: '#3355cc', dark: '#112288', light: '#6688ff', outline: '#000044' },
  green: { body: '#33aa33', dark: '#116611', light: '#66dd66', outline: '#003300' },
  yellow: { body: '#ccaa33', dark: '#886611', light: '#ffdd66', outline: '#443300' },
};

export class GameRenderer {
  private ctx: CanvasRenderingContext2D;
  private terrainCanvas: OffscreenCanvas | HTMLCanvasElement;
  private terrainCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  private terrainDirty: boolean = true;
  private lastTerrainVersion: number = -1;
  private bgCanvas: OffscreenCanvas | HTMLCanvasElement;
  private bgCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  private frameCount: number = 0;

  constructor(private canvas: HTMLCanvasElement, private engine: GameEngine) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot get 2D context');
    this.ctx = ctx;
    
    // Create terrain offscreen canvas
    if (typeof OffscreenCanvas !== 'undefined') {
      this.terrainCanvas = new OffscreenCanvas(engine.canvasWidth, engine.canvasHeight);
      this.bgCanvas = new OffscreenCanvas(engine.canvasWidth, engine.canvasHeight);
    } else {
      this.terrainCanvas = document.createElement('canvas');
      this.terrainCanvas.width = engine.canvasWidth;
      this.terrainCanvas.height = engine.canvasHeight;
      this.bgCanvas = document.createElement('canvas');
      this.bgCanvas.width = engine.canvasWidth;
      this.bgCanvas.height = engine.canvasHeight;
    }
    this.terrainCtx = this.terrainCanvas.getContext('2d') as any;
    this.bgCtx = this.bgCanvas.getContext('2d') as any;

    // Wurm-Sprites (SVG) vorladen, damit sie ab Frame 1 bereitstehen
    preloadWormSprites();
    
    // Force initial terrain render
    this.terrainDirty = true;
  }

  render(): void {
    this.frameCount++;
    const { engine } = this;
    const ctx = this.ctx;
    
    // Clear
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw sky
    this.drawSky(ctx);
    
    // Draw background elements
    this.drawBackground(ctx);
    
    // Apply camera
    ctx.save();
    const camX = -engine.camera.x + engine.camera.shakeX;
    const camY = -engine.camera.y + engine.camera.shakeY;
    ctx.translate(camX, camY);
    
    // Draw terrain
    this.drawTerrain(ctx);
    
    // Draw placed objects
    this.drawPlacedObjects(ctx);
    
    // Draw worms
    this.drawWorms(ctx);
    
    // Draw projectiles
    this.drawProjectiles(ctx);
    
    // Draw beam
    this.drawBeam(ctx);
    
    // Draw particles
    this.drawParticles(ctx);
    
    // Draw explosions
    this.drawExplosions(ctx);
    
    // Draw trajectory prediction
    if (engine.phase === GamePhase.PLAYING || engine.phase === GamePhase.AIMING) {
      this.drawTrajectory(ctx);
    }
    
    // Draw aim indicator
    if (engine.phase === GamePhase.PLAYING || engine.phase === GamePhase.AIMING) {
      this.drawAimIndicator(ctx);
    }
    
    ctx.restore();
    
    // Draw HUD elements
    this.drawWindIndicator(ctx);
  }

  private drawSky(ctx: CanvasRenderingContext2D): void {
    const { engine } = this;
    const mapId = engine.config?.mapId || 'omaha';
    
    let colors: [string, string, string];
    switch (mapId) {
      case 'stalingrad':
        colors = ['#2a3a4a', '#4a5a6a', '#6a7a8a'];
        break;
      case 'desert':
        colors = ['#ff8844', '#ffaa66', '#ffddaa'];
        break;
      case 'mountain':
        colors = ['#1a2a4a', '#3a5a7a', '#8ab4d4'];
        break;
      default: // omaha
        colors = ['#4a6080', '#7090b0', '#a0c0d8'];
    }
    
    const gradient = ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    gradient.addColorStop(0, colors[0]);
    gradient.addColorStop(0.5, colors[1]);
    gradient.addColorStop(1, colors[2]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Clouds
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    const time = this.frameCount * 0.3;
    for (let i = 0; i < 5; i++) {
      const cx = ((i * 300 + time) % (this.canvas.width + 200)) - 100;
      const cy = 40 + i * 30;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 80 + i * 20, 20 + i * 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawBackground(ctx: CanvasRenderingContext2D): void {
    const { engine } = this;
    const mapId = engine.config?.mapId || 'omaha';
    
    // Distant mountains/structures based on map
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    for (let i = 0; i < 8; i++) {
      const x = i * (this.canvas.width / 8);
      const h = 50 + Math.sin(i * 1.5) * 30;
      ctx.beginPath();
      ctx.moveTo(x, engine.canvasHeight * 0.5);
      ctx.lineTo(x + 60, engine.canvasHeight * 0.5 - h);
      ctx.lineTo(x + 120, engine.canvasHeight * 0.5);
      ctx.fill();
    }
    
    if (mapId === 'omaha') {
      // Ships in background
      ctx.fillStyle = '#334455';
      for (let i = 0; i < 3; i++) {
        const sx = 100 + i * 200;
        const sy = engine.canvasHeight * 0.45;
        ctx.fillRect(sx, sy, 60, 15);
        ctx.fillRect(sx + 20, sy - 15, 8, 15);
      }
    }
    
    if (mapId === 'stalingrad') {
      // Snow particles
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      const time = this.frameCount;
      for (let i = 0; i < 30; i++) {
        const sx = (i * 47 + time * 0.5) % this.canvas.width;
        const sy = (i * 31 + time * 0.8) % engine.canvasHeight;
        ctx.fillRect(sx, sy, 2, 2);
      }
    }
  }

  private drawTerrain(ctx: CanvasRenderingContext2D): void {
    const { engine } = this;
    const terrain = engine.terrain;
    if (!terrain) return;
    
    // Check if terrain has changed
    if (engine.terrainVersion !== this.lastTerrainVersion) {
      this.terrainDirty = true;
      this.lastTerrainVersion = engine.terrainVersion;
    }
    
    // Render terrain to offscreen canvas if dirty
    if (this.terrainDirty) {
      this.renderTerrainToCanvas();
      this.terrainDirty = false;
    }
    
    // Draw from offscreen
    ctx.drawImage(this.terrainCanvas as any, 0, 0);
  }

  renderTerrainToCanvas(): void {
    const { engine } = this;
    const terrain = engine.terrain;
    if (!terrain) return;
    
    const tCtx = this.terrainCtx;
    const imageData = tCtx.createImageData(terrain.width, terrain.height);
    const data = imageData.data;
    
    const MATERIAL_COLORS: Record<number, [number, number, number]> = {
      [TerrainMaterial.AIR]: [0, 0, 0],
      [TerrainMaterial.SAND]: [210, 180, 110],
      [TerrainMaterial.EARTH]: [110, 75, 45],
      [TerrainMaterial.ROCK]: [95, 95, 100],
      [TerrainMaterial.CONCRETE]: [140, 140, 145],
      [TerrainMaterial.SNOW]: [230, 235, 240],
      [TerrainMaterial.METAL]: [110, 120, 130],
      [TerrainMaterial.WATER]: [50, 90, 170],
    };
    
    // Simple hash function for noise
    const hash = (x: number, y: number) => {
      let h = x * 374761393 + y * 668265263;
      h = (h ^ (h >> 13)) * 1274126177;
      return ((h ^ (h >> 16)) & 0xff) / 255;
    };
    
    for (let y = 0; y < terrain.height; y++) {
      for (let x = 0; x < terrain.width; x++) {
        const mat = terrain.materials[y * terrain.width + x];
        if (mat === TerrainMaterial.AIR) continue;
        
        const [r, g, b] = MATERIAL_COLORS[mat] || [100, 100, 100];
        
        // Multi-layer noise for texture
        const n1 = hash(x, y) * 25 - 12;
        const n2 = hash(x >> 2, y >> 2) * 15 - 7;
        const noise = n1 + n2;
        
        // Depth shading (darker deeper)
        const depth = y / terrain.height;
        const depthFactor = 1 - depth * 0.25;
        
        // Surface highlight (top edge gets lighter)
        let highlight = 0;
        if (y > 0) {
          const above = terrain.materials[(y - 1) * terrain.width + x];
          if (above === TerrainMaterial.AIR || above === TerrainMaterial.WATER) {
            highlight = 40;
          } else if (y > 1) {
            const above2 = terrain.materials[(y - 2) * terrain.width + x];
            if (above2 === TerrainMaterial.AIR) {
              highlight = 20;
            }
          }
        }
        
        // Side edge shading
        let sideShade = 0;
        if (x > 0 && terrain.materials[y * terrain.width + (x - 1)] === TerrainMaterial.AIR) {
          sideShade = 15;
        }
        if (x < terrain.width - 1 && terrain.materials[y * terrain.width + (x + 1)] === TerrainMaterial.AIR) {
          sideShade = -10;
        }
        
        // Water animation hint
        let waterVar = 0;
        if (mat === TerrainMaterial.WATER) {
          waterVar = Math.sin(x * 0.1 + y * 0.05) * 10;
        }
        
        const idx = (y * terrain.width + x) * 4;
        data[idx] = Math.min(255, Math.max(0, r * depthFactor + noise + highlight + sideShade + waterVar));
        data[idx + 1] = Math.min(255, Math.max(0, g * depthFactor + noise + highlight + sideShade + waterVar));
        data[idx + 2] = Math.min(255, Math.max(0, b * depthFactor + noise * 0.8 + highlight + sideShade + waterVar));
        data[idx + 3] = mat === TerrainMaterial.WATER ? 190 : 255;
      }
    }
    
    tCtx.putImageData(imageData, 0, 0);
    
    // Draw grass/vegetation on surface edges
    tCtx.strokeStyle = '#3a7a2a';
    tCtx.lineWidth = 1;
    for (let x = 0; x < terrain.width; x += 3) {
      for (let y = 1; y < terrain.height - 1; y++) {
        const mat = terrain.materials[y * terrain.width + x];
        const above = terrain.materials[(y - 1) * terrain.width + x];
        if ((mat === TerrainMaterial.EARTH || mat === TerrainMaterial.SAND) && above === TerrainMaterial.AIR) {
          if (hash(x, y) > 0.6) {
            const grassHeight = 2 + hash(x * 3, y * 7) * 4;
            tCtx.beginPath();
            tCtx.moveTo(x, y);
            tCtx.lineTo(x + (hash(x, y * 2) - 0.5) * 3, y - grassHeight);
            tCtx.strokeStyle = hash(x * 5, y) > 0.5 ? '#4a8a3a' : '#2a6a1a';
            tCtx.stroke();
          }
        }
      }
    }
  }

  markTerrainDirty(): void {
    this.terrainDirty = true;
  }

  private drawWorms(ctx: CanvasRenderingContext2D): void {
    const { engine } = this;
    
    for (const team of engine.teams) {
      for (const worm of team.worms) {
        if (!worm.isAlive && worm.animTimer <= 0) continue;
        this.drawWorm(ctx, worm, team.color);
      }
    }
  }

  private drawWorm(ctx: CanvasRenderingContext2D, worm: Worm, colorKey: string): void {
    const { pos, facingRight, animState, animFrame } = worm;
    const dir = facingRight ? 1 : -1;

    ctx.save();
    ctx.translate(pos.x, pos.y);

    // Death animation
    if (animState === WormAnimState.DEATH) {
      const progress = 1 - worm.animTimer;
      ctx.globalAlpha = Math.max(0, 1 - progress);
      ctx.translate(0, progress * 20);
      ctx.rotate(progress * Math.PI * dir);
    }

    // Hit flash
    if (animState === WormAnimState.HIT) {
      ctx.globalAlpha = 0.7 + Math.sin(animFrame * 20) * 0.3;
    }

    // Bobbing / breathing phase
    let breathPhase = this.frameCount * 0.042; // ~2.5s Zyklus bei 60fps
    let bodyOffset = 0;
    if (animState === WormAnimState.IDLE) {
      bodyOffset = Math.sin(animFrame * 2) * 1;
    } else if (animState === WormAnimState.WALK) {
      bodyOffset = Math.sin(animFrame * 8) * 2;
      breathPhase += Math.sin(animFrame * 8) * 0.5; // schneller beim Laufen
    }

    // --- SVG-basiertes Wurm-Sprite (ersetzt die prozedurale Zeichnung) ---
    const spriteScale = (WORM_RADIUS * 2) / SPRITE_DRAW_H; // Figur ~24px hoch
    const footY = WORM_RADIUS - 2 + bodyOffset;            // Fuß-Basislinie

    // Bodenschatten mit pulsierendem Radial-Gradient (wie im Referenz-SVG)
    drawWormShadow(ctx, 0, footY, spriteScale, breathPhase);

    const drawn = drawWormSprite(
      ctx,
      colorKey,
      0,
      footY,
      spriteScale,
      facingRight,
      breathPhase,
      ctx.globalAlpha,
    );

    if (!drawn) {
      // Fallback: einfache Silhouette bis das Sprite geladen ist
      ctx.fillStyle = TEAM_COLORS[colorKey]?.body || TEAM_COLORS.red.body;
      ctx.beginPath();
      ctx.ellipse(0, bodyOffset, WORM_RADIUS - 2, WORM_RADIUS, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Positionen relativ zur neuen, höheren Sprite-Figur
    const topY = footY - SPRITE_DRAW_H * spriteScale; // Oberkante Helm

    // Health bar
    if (worm.isAlive && worm.health < worm.maxHealth) {
      const barWidth = 26;
      const barHeight = 4;
      const healthPct = worm.health / worm.maxHealth;
      
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(-barWidth / 2, topY - 10, barWidth, barHeight);
      
      ctx.fillStyle = healthPct > 0.5 ? '#44ff44' : healthPct > 0.25 ? '#ffaa00' : '#ff3333';
      ctx.fillRect(-barWidth / 2, topY - 10, barWidth * healthPct, barHeight);
      
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.strokeRect(-barWidth / 2, topY - 10, barWidth, barHeight);
    }
    
    // Stun indicator
    if (worm.stunTimer > 0) {
      ctx.fillStyle = '#ffff00';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('💫', 0, topY - 14);
    }
    
    // Shield indicator
    if (this.engine.shieldedWorms.has(worm.id)) {
      ctx.strokeStyle = 'rgba(0,255,255,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, bodyOffset - 4, WORM_RADIUS + 8, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    // Active worm indicator
    const currentWorm = this.engine.getCurrentWorm();
    if (currentWorm && currentWorm.id === worm.id) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(0, bodyOffset - 4, WORM_RADIUS + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Arrow above
      const arrowY = topY - 22 + Math.sin(this.frameCount * 0.1) * 3;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(0, arrowY + 8);
      ctx.lineTo(-5, arrowY);
      ctx.lineTo(5, arrowY);
      ctx.closePath();
      ctx.fill();
    }
    
    // Weapon display – Icon neben der Figur statt auf dem Körper
    if (worm.isAlive && (currentWorm?.id === worm.id)) {
      const weaponDef = getWeaponDef(worm.currentWeapon);
      ctx.font = '11px Arial';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(weaponDef.icon, dir * (WORM_RADIUS + 9), footY - 12 + bodyOffset);
    }
    
    // Name tag
    if (worm.isAlive) {
      ctx.font = 'bold 9px Arial';
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.textAlign = 'center';
      ctx.strokeText(worm.name, 0, WORM_RADIUS + 12);
      ctx.fillText(worm.name, 0, WORM_RADIUS + 12);
    }
    
    ctx.restore();
  }

  private drawProjectiles(ctx: CanvasRenderingContext2D): void {
    const { engine } = this;
    
    for (const proj of engine.projectiles) {
      if (!proj.active) continue;
      
      // Trail
      if (proj.trail.length > 1) {
        ctx.strokeStyle = proj.weaponId === 'laser' ? 'rgba(255,255,0,0.3)' :
          proj.weaponId === 'gatlingGun' ? 'rgba(255,200,0,0.2)' :
          'rgba(255,150,50,0.3)';
        ctx.lineWidth = proj.weaponId === 'gatlingGun' ? 1 : 2;
        ctx.beginPath();
        ctx.moveTo(proj.trail[0].x, proj.trail[0].y);
        for (let i = 1; i < proj.trail.length; i++) {
          ctx.lineTo(proj.trail[i].x, proj.trail[i].y);
        }
        ctx.stroke();
      }
      
      // Projectile body
      ctx.save();
      ctx.translate(proj.pos.x, proj.pos.y);
      
      const angle = Math.atan2(proj.vel.y, proj.vel.x);
      ctx.rotate(angle);
      
      switch (proj.weaponId) {
        case 'rocketLauncher':
        case 'bazooka':
          // Rocket body
          ctx.fillStyle = '#666';
          ctx.fillRect(-8, -3, 16, 6);
          ctx.fillStyle = '#c00';
          ctx.fillRect(-8, -3, 6, 6);
          // Flame
          ctx.fillStyle = '#f80';
          ctx.beginPath();
          ctx.moveTo(-8, -2);
          ctx.lineTo(-14 - Math.random() * 4, 0);
          ctx.lineTo(-8, 2);
          ctx.fill();
          break;
          
        case 'grenade':
        case 'clusterGrenade':
          ctx.fillStyle = '#3a5';
          ctx.beginPath();
          ctx.arc(0, 0, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#283';
          ctx.lineWidth = 1;
          ctx.stroke();
          break;
          
        case 'dynamite':
          ctx.fillStyle = '#c00';
          ctx.fillRect(-6, -3, 12, 6);
          ctx.fillStyle = '#ff0';
          ctx.fillRect(-2, -5, 4, 3);
          break;
          
        case 'shotgun':
          ctx.fillStyle = '#ff8';
          ctx.beginPath();
          ctx.arc(0, 0, 2, 0, Math.PI * 2);
          ctx.fill();
          break;
          
        case 'airstrike':
          ctx.fillStyle = '#555';
          ctx.fillRect(-10, -4, 20, 8);
          ctx.fillStyle = '#333';
          ctx.beginPath();
          ctx.moveTo(10, -4);
          ctx.lineTo(14, 0);
          ctx.lineTo(10, 4);
          ctx.fill();
          break;
          
        case 'drill':
          ctx.fillStyle = '#888';
          ctx.fillRect(-6, -3, 12, 6);
          ctx.fillStyle = '#ff0';
          ctx.beginPath();
          ctx.moveTo(6, -4);
          ctx.lineTo(10, 0);
          ctx.lineTo(6, 4);
          ctx.fill();
          break;
          
        case 'emp':
          ctx.fillStyle = '#0ff';
          ctx.beginPath();
          ctx.arc(0, 0, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#088';
          ctx.lineWidth = 1;
          ctx.stroke();
          break;
          
        default:
          ctx.fillStyle = '#888';
          ctx.beginPath();
          ctx.arc(0, 0, 4, 0, Math.PI * 2);
          ctx.fill();
      }
      
      ctx.restore();
    }
  }

  private drawBeam(ctx: CanvasRenderingContext2D): void {
    const { engine } = this;
    if (!engine.beamActive) return;
    
    const { beamStart, beamEnd, beamWeaponId } = engine;
    
    ctx.save();
    
    // Beam glow
    const beamColor = beamWeaponId === 'laser' ? '#ff0' :
      beamWeaponId === 'microwave' ? '#f0f' :
      beamWeaponId === 'flamethrower' ? '#f80' : '#fff';
    
    ctx.strokeStyle = beamColor;
    ctx.lineWidth = beamWeaponId === 'microwave' ? 12 : beamWeaponId === 'flamethrower' ? 8 : 4;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(beamStart.x, beamStart.y);
    ctx.lineTo(beamEnd.x, beamEnd.y);
    ctx.stroke();
    
    // Core beam
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = beamWeaponId === 'microwave' ? 4 : beamWeaponId === 'flamethrower' ? 3 : 2;
    ctx.strokeStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(beamStart.x, beamStart.y);
    ctx.lineTo(beamEnd.x, beamEnd.y);
    ctx.stroke();
    
    // Impact point
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = beamColor;
    ctx.beginPath();
    ctx.arc(beamEnd.x, beamEnd.y, 8 + Math.sin(this.frameCount * 0.5) * 3, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }

  private drawParticles(ctx: CanvasRenderingContext2D): void {
    const { engine } = this;
    
    for (const p of engine.particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.pos.x, p.pos.y);
      ctx.rotate(p.rotation);
      
      switch (p.type) {
        case 'fire':
          const fireGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size);
          fireGrad.addColorStop(0, '#fff');
          fireGrad.addColorStop(0.3, p.color);
          fireGrad.addColorStop(1, 'rgba(255,0,0,0)');
          ctx.fillStyle = fireGrad;
          ctx.fillRect(-p.size, -p.size, p.size * 2, p.size * 2);
          break;
          
        case 'smoke':
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.alpha * 0.5;
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
          break;
          
        case 'debris':
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          break;
          
        case 'spark':
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(0, 0, p.size * 0.5, 0, Math.PI * 2);
          ctx.fill();
          break;
          
        case 'blood':
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
          break;
          
        case 'shell':
          ctx.fillStyle = p.color;
          ctx.fillRect(-1, -3, 2, 6);
          break;
          
        default:
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
      }
      
      ctx.restore();
    }
  }

  private drawExplosions(ctx: CanvasRenderingContext2D): void {
    const { engine } = this;
    
    for (const exp of engine.explosions) {
      const progress = 1 - exp.timer / exp.maxTimer;
      
      ctx.save();
      ctx.translate(exp.pos.x, exp.pos.y);
      
      // Flash
      if (progress < 0.1) {
        const flashAlpha = 1 - progress * 10;
        ctx.fillStyle = `rgba(255,255,255,${flashAlpha})`;
        ctx.beginPath();
        ctx.arc(0, 0, exp.radius * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Fireball
      if (progress < 0.5) {
        const fireAlpha = 1 - progress * 2;
        const fireSize = exp.radius * (0.5 + progress);
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, fireSize);
        grad.addColorStop(0, `rgba(255,255,200,${fireAlpha})`);
        grad.addColorStop(0.3, `rgba(255,150,0,${fireAlpha * 0.8})`);
        grad.addColorStop(0.7, `rgba(255,50,0,${fireAlpha * 0.5})`);
        grad.addColorStop(1, `rgba(100,0,0,0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, fireSize, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Shockwave ring
      if (progress < 0.4) {
        const ringAlpha = 1 - progress * 2.5;
        const ringRadius = exp.radius * progress * 3;
        ctx.strokeStyle = `rgba(255,200,100,${ringAlpha})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
      }
      
      ctx.restore();
    }
  }

  private drawTrajectory(ctx: CanvasRenderingContext2D): void {
    const { engine } = this;
    const points = engine.getTrajectoryPrediction();
    if (points.length === 0) return;
    
    ctx.save();
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    
    const worm = engine.getCurrentWorm();
    if (worm) {
      ctx.moveTo(worm.pos.x, worm.pos.y - 5);
    }
    
    for (const p of points) {
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Dots along trajectory
    for (let i = 0; i < points.length; i += 4) {
      ctx.fillStyle = `rgba(255,255,255,${0.7 - i / points.length * 0.5})`;
      ctx.beginPath();
      ctx.arc(points[i].x, points[i].y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.restore();
  }

  private drawAimIndicator(ctx: CanvasRenderingContext2D): void {
    const { engine } = this;
    const worm = engine.getCurrentWorm();
    if (!worm) return;
    
    const dir = worm.facingRight ? 1 : -1;
    const angle = engine.input.angle;
    const power = engine.input.power;
    
    // Aim line
    const lineLen = 30 + power * 0.3;
    const startX = worm.pos.x + dir * 12;
    const startY = worm.pos.y - 5;
    const endX = startX + Math.cos(angle) * lineLen * dir;
    const endY = startY + Math.sin(angle) * lineLen;
    
    ctx.save();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    
    // Arrow head
    const arrowAngle = Math.atan2(endY - startY, endX - startX);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - 8 * Math.cos(arrowAngle - 0.4), endY - 8 * Math.sin(arrowAngle - 0.4));
    ctx.lineTo(endX - 8 * Math.cos(arrowAngle + 0.4), endY - 8 * Math.sin(arrowAngle + 0.4));
    ctx.closePath();
    ctx.fill();
    
    // Power bar
    const barX = worm.pos.x - 15;
    const barY = worm.pos.y + WORM_RADIUS + 16;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(barX, barY, 30, 5);
    
    const powerColor = power < 30 ? '#44ff44' : power < 70 ? '#ffaa00' : '#ff3333';
    ctx.fillStyle = powerColor;
    ctx.fillRect(barX, barY, 30 * (power / 100), 5);
    
    ctx.restore();
  }

  private drawPlacedObjects(ctx: CanvasRenderingContext2D): void {
    const { engine } = this;
    
    for (const obj of engine.placedObjects) {
      ctx.save();
      ctx.translate(obj.pos.x, obj.pos.y);
      
      if (obj.type === 'mine') {
        ctx.fillStyle = '#555';
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#c00';
        ctx.beginPath();
        ctx.arc(0, -3, 3, 0, Math.PI * 2);
        ctx.fill();
        // Blinking light
        if (Math.sin(this.frameCount * 0.2) > 0) {
          ctx.fillStyle = '#f00';
          ctx.beginPath();
          ctx.arc(0, -3, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (obj.type === 'dynamite') {
        ctx.fillStyle = '#c00';
        ctx.fillRect(-5, -8, 10, 16);
        ctx.fillStyle = '#ff0';
        // Fuse spark
        if (obj.timer < 2 && Math.sin(this.frameCount * 0.5) > 0) {
          ctx.fillStyle = '#f80';
          ctx.beginPath();
          ctx.arc(0, -10, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        // Timer display
        ctx.fillStyle = '#fff';
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(Math.ceil(obj.timer).toString(), 0, 3);
      }
      
      ctx.restore();
    }
  }

  private drawWindIndicator(ctx: CanvasRenderingContext2D): void {
    const { engine } = this;
    const wind = engine.wind;
    
    const x = this.canvas.width - 100;
    const y = 20;
    
    ctx.save();
    
    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.moveTo(x - 10 + 5, y - 5);
    ctx.lineTo(x - 10 + 100 - 5, y - 5);
    ctx.quadraticCurveTo(x - 10 + 100, y - 5, x - 10 + 100, y - 5 + 5);
    ctx.lineTo(x - 10 + 100, y - 5 + 35 - 5);
    ctx.quadraticCurveTo(x - 10 + 100, y - 5 + 35, x - 10 + 100 - 5, y - 5 + 35);
    ctx.lineTo(x - 10 + 5, y - 5 + 35);
    ctx.quadraticCurveTo(x - 10, y - 5 + 35, x - 10, y - 5 + 35 - 5);
    ctx.lineTo(x - 10, y - 5 + 5);
    ctx.quadraticCurveTo(x - 10, y - 5, x - 10 + 5, y - 5);
    ctx.closePath();
    ctx.fill();
    
    // Label
    ctx.fillStyle = '#fff';
    ctx.font = '10px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('WIND', x, y + 8);
    
    // Wind arrow
    const arrowLen = wind.speed * 10;
    const arrowX = x + 45;
    const arrowY = y + 15;
    
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(arrowX - arrowLen * wind.direction * 0.5, arrowY);
    ctx.lineTo(arrowX + arrowLen * wind.direction * 0.5, arrowY);
    ctx.stroke();
    
    // Arrow head
    const tipX = arrowX + arrowLen * wind.direction * 0.5;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(tipX, arrowY);
    ctx.lineTo(tipX - wind.direction * 6, arrowY - 4);
    ctx.lineTo(tipX - wind.direction * 6, arrowY + 4);
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();
  }

  getFrameCount(): number {
    return this.frameCount;
  }
}
