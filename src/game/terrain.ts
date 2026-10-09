// ============================================================
// WURMKIEG - Terrain System
// ============================================================
import { TerrainConfig, TerrainMaterial, Vec2 } from './types';

// Simple seeded random
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// Perlin-like noise
function noise1D(x: number, seed: number): number {
  const rng = seededRandom(Math.floor(x) * 1000 + seed);
  const a = rng();
  const rng2 = seededRandom((Math.floor(x) + 1) * 1000 + seed);
  const b = rng2();
  const t = x - Math.floor(x);
  const smooth = t * t * (3 - 2 * t);
  return a + (b - a) * smooth;
}

function fractalNoise(x: number, octaves: number, seed: number): number {
  let val = 0, amp = 1, freq = 1, maxAmp = 0;
  for (let i = 0; i < octaves; i++) {
    val += noise1D(x * freq, seed + i * 100) * amp;
    maxAmp += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return val / maxAmp;
}

export function generateOmahaBeach(width: number, height: number, seed: number): TerrainConfig {
  const materials = new Uint8Array(width * height);
  const rng = seededRandom(seed);
  
  const baseHeight = height * 0.55;
  const cliffStart = width * 0.6;
  
  for (let x = 0; x < width; x++) {
    const noise = fractalNoise(x * 0.008, 5, seed) * 80;
    const noise2 = fractalNoise(x * 0.02, 3, seed + 500) * 20;
    
    let surfaceY: number;
    if (x < cliffStart * 0.3) {
      // Beach - flat
      surfaceY = baseHeight + 30 + noise * 0.3 + noise2;
    } else if (x < cliffStart) {
      // Rising slope
      const t = (x - cliffStart * 0.3) / (cliffStart * 0.7);
      surfaceY = baseHeight + 30 - t * 120 + noise * (0.3 + t * 0.7) + noise2;
    } else {
      // Cliff top
      surfaceY = baseHeight - 90 + noise + noise2 * 0.5;
      // Add some cliff features
      if (rng() < 0.01) {
        surfaceY -= 20 + rng() * 30;
      }
    }
    
    surfaceY = Math.max(80, Math.min(height - 40, surfaceY));
    
    for (let y = Math.floor(surfaceY); y < height; y++) {
      const depth = y - surfaceY;
      let mat: TerrainMaterial;
      
      if (x < cliffStart * 0.4) {
        // Beach materials
        if (depth < 8) mat = TerrainMaterial.SAND;
        else if (depth < 40) mat = TerrainMaterial.EARTH;
        else mat = TerrainMaterial.ROCK;
      } else if (x < cliffStart) {
        // Transition
        if (depth < 5) mat = TerrainMaterial.SAND;
        else if (depth < 20) mat = TerrainMaterial.EARTH;
        else mat = TerrainMaterial.CONCRETE;
      } else {
        // Cliff - mostly concrete and rock
        if (depth < 5) mat = TerrainMaterial.EARTH;
        else if (depth < 30) mat = TerrainMaterial.CONCRETE;
        else mat = TerrainMaterial.ROCK;
      }
      
      materials[y * width + x] = mat;
    }
    
    // Add water at beach level
    const waterLevel = baseHeight + 50;
    if (x < cliffStart * 0.25) {
      for (let y = Math.floor(waterLevel); y < height; y++) {
        if (materials[y * width + x] === TerrainMaterial.AIR) {
          materials[y * width + x] = TerrainMaterial.WATER;
        }
      }
    }
  }
  
  return { width, height, materials };
}

export function generateStalingrad(width: number, height: number, seed: number): TerrainConfig {
  const materials = new Uint8Array(width * height);
  const rng = seededRandom(seed);
  
  const baseHeight = height * 0.65;
  
  for (let x = 0; x < width; x++) {
    const noise = fractalNoise(x * 0.006, 4, seed) * 60;
    const noise2 = fractalNoise(x * 0.015, 3, seed + 300) * 25;
    const noise3 = fractalNoise(x * 0.04, 2, seed + 700) * 10;
    
    let surfaceY = baseHeight + noise + noise2 + noise3;
    
    // Add building-like structures
    const buildingZone1 = width * 0.2;
    const buildingZone2 = width * 0.5;
    const buildingZone3 = width * 0.8;
    
    const nearBuilding = Math.abs(x - buildingZone1) < 60 || 
                         Math.abs(x - buildingZone2) < 80 ||
                         Math.abs(x - buildingZone3) < 50;
    
    if (nearBuilding) {
      surfaceY -= 40 + rng() * 30;
    }
    
    // Craters
    const craterChance = fractalNoise(x * 0.03, 2, seed + 900);
    if (craterChance > 0.7) {
      surfaceY += 15 + (craterChance - 0.7) * 50;
    }
    
    surfaceY = Math.max(100, Math.min(height - 30, surfaceY));
    
    for (let y = Math.floor(surfaceY); y < height; y++) {
      const depth = y - surfaceY;
      let mat: TerrainMaterial;
      
      if (nearBuilding && depth < 50) {
        mat = TerrainMaterial.CONCRETE;
      } else if (depth < 10) {
        mat = TerrainMaterial.SNOW;
      } else if (depth < 50) {
        mat = TerrainMaterial.EARTH;
      } else {
        mat = TerrainMaterial.ROCK;
      }
      
      materials[y * width + x] = mat;
    }
    
    // Add metal structures (beams, etc.)
    if (nearBuilding && rng() < 0.03) {
      const beamTop = Math.floor(surfaceY - 20 - rng() * 40);
      const beamHeight = 20 + Math.floor(rng() * 30);
      for (let y = beamTop; y < beamTop + beamHeight && y < height; y++) {
        if (y >= 0) {
          materials[y * width + x] = TerrainMaterial.METAL;
        }
      }
    }
  }
  
  return { width, height, materials };
}

export function generateDesertFortress(width: number, height: number, seed: number): TerrainConfig {
  const materials = new Uint8Array(width * height);
  const baseHeight = height * 0.6;
  
  for (let x = 0; x < width; x++) {
    const noise = fractalNoise(x * 0.005, 5, seed) * 100;
    const dunes = fractalNoise(x * 0.012, 3, seed + 200) * 40;
    
    let surfaceY = baseHeight + noise + dunes;
    
    // Fortress walls
    const wall1 = width * 0.35;
    const wall2 = width * 0.65;
    if ((Math.abs(x - wall1) < 15 || Math.abs(x - wall2) < 15)) {
      surfaceY -= 80;
    }
    
    surfaceY = Math.max(80, Math.min(height - 30, surfaceY));
    
    for (let y = Math.floor(surfaceY); y < height; y++) {
      const depth = y - surfaceY;
      let mat: TerrainMaterial;
      
      if ((Math.abs(x - width * 0.35) < 15 || Math.abs(x - width * 0.65) < 15) && depth < 80) {
        mat = TerrainMaterial.CONCRETE;
      } else if (depth < 15) {
        mat = TerrainMaterial.SAND;
      } else if (depth < 60) {
        mat = TerrainMaterial.EARTH;
      } else {
        mat = TerrainMaterial.ROCK;
      }
      
      materials[y * width + x] = mat;
    }
  }
  
  return { width, height, materials };
}

export function generateMountainFront(width: number, height: number, seed: number): TerrainConfig {
  const materials = new Uint8Array(width * height);
  const baseHeight = height * 0.5;
  
  for (let x = 0; x < width; x++) {
    const peaks = fractalNoise(x * 0.004, 6, seed) * 150;
    const detail = fractalNoise(x * 0.02, 3, seed + 400) * 20;
    
    let surfaceY = baseHeight + peaks + detail;
    
    // Valley in middle
    const centerDist = Math.abs(x - width * 0.5) / (width * 0.5);
    surfaceY += (1 - centerDist) * 60;
    
    surfaceY = Math.max(60, Math.min(height - 20, surfaceY));
    
    for (let y = Math.floor(surfaceY); y < height; y++) {
      const depth = y - surfaceY;
      let mat: TerrainMaterial;
      
      if (depth < 8) {
        mat = TerrainMaterial.SNOW;
      } else if (depth < 30) {
        mat = TerrainMaterial.ROCK;
      } else {
        mat = TerrainMaterial.EARTH;
      }
      
      materials[y * width + x] = mat;
    }
  }
  
  return { width, height, materials };
}

// Terrain operations
export function getMaterialAt(terrain: TerrainConfig, x: number, y: number): TerrainMaterial {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  if (ix < 0 || ix >= terrain.width || iy < 0 || iy >= terrain.height) return TerrainMaterial.AIR;
  return terrain.materials[iy * terrain.width + ix];
}

export function isSolid(terrain: TerrainConfig, x: number, y: number): boolean {
  const mat = getMaterialAt(terrain, x, y);
  return mat !== TerrainMaterial.AIR && mat !== TerrainMaterial.WATER;
}

export function isWater(terrain: TerrainConfig, x: number, y: number): boolean {
  return getMaterialAt(terrain, x, y) === TerrainMaterial.WATER;
}

export function destroyTerrain(terrain: TerrainConfig, center: Vec2, radius: number, intensity: number = 1): void {
  const rng = seededRandom(center.x * 1000 + center.y);
  const cx = Math.floor(center.x);
  const cy = Math.floor(center.y);
  const r = Math.ceil(radius);
  
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      const noise = (rng() - 0.5) * radius * 0.3;
      const effectiveRadius = radius + noise;
      
      if (dist <= effectiveRadius) {
        const px = cx + dx;
        const py = cy + dy;
        
        if (px >= 0 && px < terrain.width && py >= 0 && py < terrain.height) {
          const idx = py * terrain.width + px;
          const mat = terrain.materials[idx];
          
          if (mat !== TerrainMaterial.AIR && mat !== TerrainMaterial.WATER) {
            // Different materials have different resistance
            let destructionChance = intensity;
            if (mat === TerrainMaterial.ROCK) destructionChance *= 0.5;
            else if (mat === TerrainMaterial.CONCRETE) destructionChance *= 0.6;
            else if (mat === TerrainMaterial.METAL) destructionChance *= 0.4;
            else if (mat === TerrainMaterial.SAND) destructionChance *= 1.2;
            
            if (rng() < destructionChance) {
              terrain.materials[idx] = TerrainMaterial.AIR;
            }
          }
        }
      }
    }
  }
}

export function getSurfaceY(terrain: TerrainConfig, x: number): number {
  const ix = Math.floor(x);
  if (ix < 0 || ix >= terrain.width) return terrain.height;
  
  for (let y = 0; y < terrain.height; y++) {
    if (isSolid(terrain, ix, y)) return y;
  }
  return terrain.height;
}

export function findValidSpawn(terrain: TerrainConfig, x: number): Vec2 {
  const surfaceY = getSurfaceY(terrain, x);
  return { x, y: surfaceY - 20 };
}

export function getMaterialHardness(mat: TerrainMaterial): number {
  switch (mat) {
    case TerrainMaterial.SAND: return 0.5;
    case TerrainMaterial.EARTH: return 0.8;
    case TerrainMaterial.SNOW: return 0.4;
    case TerrainMaterial.ROCK: return 1.5;
    case TerrainMaterial.CONCRETE: return 1.3;
    case TerrainMaterial.METAL: return 2.0;
    case TerrainMaterial.WATER: return 0.1;
    default: return 0;
  }
}
