// ============================================================
// WURMKIEG - Game Engine
// ============================================================
import {
  Vec2, TerrainConfig, Team, Worm, Projectile, Particle, Explosion,
  PlacedObject, GamePhase, GameConfig, Wind, Camera, InputState,
  GRAVITY, MAX_WORM_HEALTH, WORM_RADIUS, WORM_SPEED, JUMP_FORCE,
  MAX_JUMP_COUNT, WormAnimState, WeaponType, TeamColor, GameStats,
  TerrainMaterial,
} from './types';
import { WEAPONS, getWeaponDef } from './weapons';
import {
  isSolid, isWater, destroyTerrain, getSurfaceY, findValidSpawn,
  getMaterialAt, getMaterialHardness,
  generateOmahaBeach, generateStalingrad, generateDesertFortress, generateMountainFront,
} from './terrain';

let nextId = 0;
function uid(): string { return `id_${nextId++}`; }

function dist(a: Vec2, b: Vec2): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function normalize(v: Vec2): Vec2 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

const WORM_NAMES_POOL = [
  'Wurst', 'Käfer', 'Blitz', 'Donner', 'Fuchs', 'Adler', 'Wolf', 'Bär',
  'Hammer', 'Sturm', 'Flink', 'Eisen', 'Feuer', 'Schatten', 'Geist', 'König',
  'Panzer', 'Rakete', 'Turbo', 'Ninja', 'Viper', 'Falcon', 'Titan', 'Omega',
];

export class GameEngine {
  // State
  terrain!: TerrainConfig;
  teams: Team[] = [];
  projectiles: Projectile[] = [];
  particles: Particle[] = [];
  explosions: Explosion[] = [];
  placedObjects: PlacedObject[] = [];
  wind: Wind = { speed: 0, direction: 0, changeTimer: 0 };
  camera: Camera = { x: 0, y: 0, zoom: 1, targetX: 0, targetY: 0, shakeX: 0, shakeY: 0, shakeIntensity: 0 };
  phase: GamePhase = GamePhase.MENU;
  config!: GameConfig;
  
  // Turn state
  currentTeamIndex: number = 0;
  currentWormIndex: number = 0;
  turnTimer: number = 0;
  totalTurns: number = 0;
  simulationTimer: number = 0;
  turnTransitionTimer: number = 0;
  
  // Input
  input: InputState = {
    keys: new Set(),
    mouseX: 0, mouseY: 0,
    mouseDown: false,
    power: 50,
    angle: -Math.PI / 4,
    charging: false,
  };
  
  // Stats
  stats: GameStats = {
    damageDealt: new Map(),
    kills: new Map(),
    shotsFired: new Map(),
  };
  
  // Timing
  private accumulator: number = 0;
  private lastTime: number = 0;
  private running: boolean = false;
  private animFrameId: number = 0;
  
  // Callbacks
  onStateChange?: () => void;
  onExplosion?: (pos: Vec2, radius: number) => void;
  onDamage?: (wormId: string, damage: number) => void;
  onKill?: (wormId: string, killerId: string) => void;
  onTurnChange?: (teamId: number, wormName: string) => void;
  onGameOver?: (winnerTeam: Team) => void;
  
  // Shield state
  shieldedWorms: Set<string> = new Set();
  stunnedWorms: Set<string> = new Set();
  
  // Beam state for continuous weapons
  beamActive: boolean = false;
  beamStart: Vec2 = { x: 0, y: 0 };
  beamEnd: Vec2 = { x: 0, y: 0 };
  beamWeaponId: string = '';
  beamTimer: number = 0;
  
  // Floating damage numbers
  damageNumbers: { pos: Vec2; value: number; timer: number; color: string }[] = [];
  
  // Gatling state
  gatlingTimer: number = 0;
  gatlingShotsLeft: number = 0;
  
  // Canvas dimensions
  canvasWidth: number = 1200;
  canvasHeight: number = 700;
  
  // Terrain version for renderer
  terrainVersion: number = 0;

  constructor() {}

  init(config: GameConfig): void {
    this.config = config;
    this.teams = [];
    this.projectiles = [];
    this.particles = [];
    this.explosions = [];
    this.placedObjects = [];
    this.shieldedWorms.clear();
    this.stunnedWorms.clear();
    this.stats = { damageDealt: new Map(), kills: new Map(), shotsFired: new Map() };
    this.totalTurns = 0;
    this.beamActive = false;
    this.gatlingTimer = 0;
    this.gatlingShotsLeft = 0;
    
    // Generate terrain
    const seed = Math.floor(Math.random() * 100000);
    switch (config.mapId) {
      case 'omaha':
        this.terrain = generateOmahaBeach(this.canvasWidth, this.canvasHeight, seed);
        break;
      case 'stalingrad':
        this.terrain = generateStalingrad(this.canvasWidth, this.canvasHeight, seed);
        break;
      case 'desert':
        this.terrain = generateDesertFortress(this.canvasWidth, this.canvasHeight, seed);
        break;
      case 'mountain':
        this.terrain = generateMountainFront(this.canvasWidth, this.canvasHeight, seed);
        break;
      default:
        this.terrain = generateOmahaBeach(this.canvasWidth, this.canvasHeight, seed);
    }
    
    // Create teams
    let nameIdx = 0;
    config.teams.forEach((tc, teamIdx) => {
      const team: Team = {
        id: teamIdx,
        name: tc.name,
        color: tc.color,
        worms: [],
        isAI: tc.isAI,
        score: 0,
      };
      
      // Distribute worms across the map
      const spacing = this.canvasWidth / (tc.wormCount + 1);
      const offsetX = teamIdx * (this.canvasWidth / config.teams.length / 2);
      
      for (let i = 0; i < tc.wormCount; i++) {
        const x = offsetX + spacing * (i + 0.5) + (Math.random() - 0.5) * 40;
        const spawn = findValidSpawn(this.terrain, clamp(x, 30, this.canvasWidth - 30));
        
        const wormName = tc.wormNames[i] || WORM_NAMES_POOL[nameIdx++ % WORM_NAMES_POOL.length];
        
        const weapons = Object.keys(WEAPONS).map(id => ({
          weaponId: id,
          ammo: WEAPONS[id].ammo,
          cooldown: 0,
        }));
        
        const worm: Worm = {
          id: uid(),
          name: wormName,
          teamId: teamIdx,
          pos: spawn,
          vel: { x: 0, y: 0 },
          health: MAX_WORM_HEALTH,
          maxHealth: MAX_WORM_HEALTH,
          isAlive: true,
          facingRight: teamIdx === 0,
          isGrounded: false,
          currentWeapon: 'rocketLauncher',
          weapons,
          animState: WormAnimState.IDLE,
          animFrame: 0,
          animTimer: 0,
          stunTimer: 0,
          burnTimer: 0,
          ropeUses: 0,
          jumpUses: MAX_JUMP_COUNT,
        };
        
        team.worms.push(worm);
      }
      
      this.teams.push(team);
    });
    
    // Initialize wind
    this.wind = {
      speed: Math.random() * 3,
      direction: Math.random() < 0.5 ? -1 : 1,
      changeTimer: 5 + Math.random() * 5,
    };
    
    // Start game
    this.currentTeamIndex = 0;
    this.currentWormIndex = 0;
    this.turnTimer = config.turnTime;
    this.phase = GamePhase.PLAYING;
    
    this.findNextAliveWorm();
    this.updateCamera();
  }

  start(): void {
    this.running = true;
    this.lastTime = performance.now();
    this.gameLoop(this.lastTime);
  }

  stop(): void {
    this.running = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
  }

  private gameLoop = (time: number): void => {
    if (!this.running) return;
    
    const dt = Math.min((time - this.lastTime) / 1000, 0.05);
    this.lastTime = time;
    this.accumulator += dt;
    
    const fixedDt = 1 / 60;
    while (this.accumulator >= fixedDt) {
      this.update(fixedDt);
      this.accumulator -= fixedDt;
    }
    
    this.onStateChange?.();
    this.animFrameId = requestAnimationFrame(this.gameLoop);
  };

  private update(dt: number): void {
    if (this.phase === GamePhase.PAUSED) return;
    
    // Update wind
    this.updateWind(dt);
    
    // Update camera
    this.updateCameraSmooth(dt);
    
    // Update based on phase
    switch (this.phase) {
      case GamePhase.PLAYING:
      case GamePhase.AIMING:
        this.updatePlaying(dt);
        break;
      case GamePhase.SIMULATING:
        this.updateSimulation(dt);
        break;
      case GamePhase.TURN_TRANSITION:
        this.updateTransition(dt);
        break;
      case GamePhase.FIRING:
        this.updateFiring(dt);
        break;
    }
    
    // Always update these
    this.updateParticles(dt);
    this.updateExplosions(dt);
    this.updateWormPhysics(dt);
    this.updatePlacedObjects(dt);
    this.updateBeam(dt);
    this.updateGatling(dt);
    this.updateWormAnims(dt);
    this.checkVictory();
  }

  private updateWind(dt: number): void {
    this.wind.changeTimer -= dt;
    if (this.wind.changeTimer <= 0) {
      this.wind.speed = Math.random() * 4;
      this.wind.direction = Math.random() < 0.5 ? -1 : 1;
      this.wind.changeTimer = 4 + Math.random() * 6;
    }
  }

  private updatePlaying(dt: number): void {
    const worm = this.getCurrentWorm();
    if (!worm) return;
    
    if (this.stunnedWorms.has(worm.id)) {
      worm.stunTimer -= dt;
      if (worm.stunTimer <= 0) {
        this.stunnedWorms.delete(worm.id);
      }
      return;
    }
    
    // Turn timer
    this.turnTimer -= dt;
    if (this.turnTimer <= 0) {
      this.endTurn();
      return;
    }
    
    // Handle input for non-AI
    const team = this.teams[this.currentTeamIndex];
    if (team && !team.isAI) {
      this.handlePlayerInput(worm, dt);
    }
  }

  private handlePlayerInput(worm: Worm, dt: number): void {
    if (this.phase !== GamePhase.PLAYING && this.phase !== GamePhase.AIMING) return;
    if (worm.stunTimer > 0) return;
    
    // Movement
    if (this.input.keys.has('ArrowLeft') || this.input.keys.has('a')) {
      worm.vel.x = -WORM_SPEED;
      worm.facingRight = false;
      worm.animState = WormAnimState.WALK;
    } else if (this.input.keys.has('ArrowRight') || this.input.keys.has('d')) {
      worm.vel.x = WORM_SPEED;
      worm.facingRight = true;
      worm.animState = WormAnimState.WALK;
    } else {
      if (worm.isGrounded) worm.vel.x *= 0.7;
      if (worm.animState === WormAnimState.WALK) worm.animState = WormAnimState.IDLE;
    }
    
    // Jump
    if ((this.input.keys.has('ArrowUp') || this.input.keys.has('w') || this.input.keys.has(' ')) && worm.isGrounded && worm.jumpUses > 0) {
      worm.vel.y = -JUMP_FORCE;
      worm.isGrounded = false;
      worm.jumpUses--;
      worm.animState = WormAnimState.JUMP;
      this.input.keys.delete('ArrowUp');
      this.input.keys.delete('w');
      this.input.keys.delete(' ');
    }
    
    // Aiming
    if (this.input.keys.has('ArrowLeft') && this.input.keys.has('Shift')) {
      this.input.angle -= 2 * dt;
    }
    if (this.input.keys.has('ArrowRight') && this.input.keys.has('Shift')) {
      this.input.angle += 2 * dt;
    }
    
    // Power charging
    if (this.input.charging) {
      this.input.power = Math.min(100, this.input.power + 80 * dt);
    }
    
    // Weapon switch
    if (this.input.keys.has('q')) {
      this.cycleWeapon(worm, -1);
      this.input.keys.delete('q');
    }
    if (this.input.keys.has('e')) {
      this.cycleWeapon(worm, 1);
      this.input.keys.delete('e');
    }
  }

  private cycleWeapon(worm: Worm, direction: number): void {
    const available = worm.weapons.filter(w => w.ammo > 0 && w.cooldown <= 0);
    if (available.length === 0) return;
    
    const currentIdx = available.findIndex(w => w.weaponId === worm.currentWeapon);
    let nextIdx: number;
    if (currentIdx === -1) {
      nextIdx = 0;
    } else {
      nextIdx = (currentIdx + direction + available.length) % available.length;
    }
    worm.currentWeapon = available[nextIdx].weaponId;
  }

  fireWeapon(): void {
    const worm = this.getCurrentWorm();
    if (!worm || worm.stunTimer > 0) return;
    
    const weaponDef = getWeaponDef(worm.currentWeapon);
    const loadout = worm.weapons.find(w => w.weaponId === worm.currentWeapon);
    if (!loadout || loadout.ammo <= 0 || loadout.cooldown > 0) return;
    
    const dir = worm.facingRight ? 1 : -1;
    const angle = this.input.angle;
    const power = this.input.power / 100;
    
    // Special weapon handling
    switch (weaponDef.type) {
      case WeaponType.MELEE:
        this.performMeleeAttack(worm, weaponDef);
        break;
      case WeaponType.INSTANT:
        this.performInstantAttack(worm, weaponDef, angle, dir);
        break;
      case WeaponType.UTILITY:
        this.performUtilityAction(worm, weaponDef);
        break;
      case WeaponType.BEAM:
        this.startBeam(worm, weaponDef, angle, dir);
        break;
      case WeaponType.PLACED:
        this.placeObject(worm, weaponDef);
        break;
      default:
        this.fireProjectile(worm, weaponDef, angle, dir, power);
        break;
    }
    
    // Consume ammo
    loadout.ammo--;
    loadout.cooldown = weaponDef.cooldown;
    
    // Track stats
    const key = `${worm.teamId}_${worm.id}`;
    this.stats.shotsFired.set(key, (this.stats.shotsFired.get(key) || 0) + 1);
    
    // Animation
    worm.animState = WormAnimState.FIRE;
    worm.animTimer = 0.3;
    
    // For non-beam, non-gatling weapons, go to simulation
    if (weaponDef.type !== WeaponType.BEAM && weaponDef.id !== 'gatlingGun') {
      this.phase = GamePhase.SIMULATING;
      this.simulationTimer = 0;
    } else if (weaponDef.id === 'gatlingGun') {
      this.gatlingShotsLeft = 30;
      this.gatlingTimer = 0;
      this.phase = GamePhase.FIRING;
    }
    
    this.input.charging = false;
    this.input.power = 50;
  }

  private fireProjectile(worm: Worm, weaponDef: typeof WEAPONS[string], angle: number, dir: number, power: number): void {
    const speed = weaponDef.speed * (0.5 + power * 0.5);
    const vx = Math.cos(angle) * speed * dir;
    const vy = Math.sin(angle) * speed;
    
    // Handle special projectiles
    if (weaponDef.id === 'airstrike') {
      // Fire 5 bombs from above
      for (let i = 0; i < 5; i++) {
        const targetX = worm.pos.x + (i - 2) * 40;
        const proj: Projectile = {
          id: uid(),
          weaponId: weaponDef.id,
          pos: { x: targetX + (Math.random() - 0.5) * 30, y: -20 - i * 30 },
          vel: { x: this.wind.direction * this.wind.speed * 0.5, y: 5 },
          ownerId: worm.id,
          teamId: worm.teamId,
          active: true,
          bouncesLeft: 0,
          fuseTimer: 0,
          trail: [],
        };
        this.projectiles.push(proj);
      }
    } else if (weaponDef.id === 'shotgun') {
      // Fire 8 pellets
      for (let i = 0; i < 8; i++) {
        const spread = (i - 3.5) * 0.06;
        const proj: Projectile = {
          id: uid(),
          weaponId: weaponDef.id,
          pos: { x: worm.pos.x + dir * 15, y: worm.pos.y - 5 },
          vel: { x: (vx + Math.sin(spread) * 3) * 1.2, y: vy + Math.cos(spread) * 2 - 2 },
          ownerId: worm.id,
          teamId: worm.teamId,
          active: true,
          bouncesLeft: 0,
          fuseTimer: 0,
          trail: [],
        };
        this.projectiles.push(proj);
      }
    } else if (weaponDef.id === 'clusterGrenade') {
      // Fire main grenade that splits
      const proj: Projectile = {
        id: uid(),
        weaponId: weaponDef.id,
        pos: { x: worm.pos.x + dir * 15, y: worm.pos.y - 5 },
        vel: { x: vx, y: vy },
        ownerId: worm.id,
        teamId: worm.teamId,
        active: true,
        bouncesLeft: weaponDef.bounces,
        fuseTimer: weaponDef.fuseTime,
        trail: [],
        subProjectiles: [],
      };
      this.projectiles.push(proj);
    } else {
      const proj: Projectile = {
        id: uid(),
        weaponId: weaponDef.id,
        pos: { x: worm.pos.x + dir * 15, y: worm.pos.y - 5 },
        vel: { x: vx, y: vy },
        ownerId: worm.id,
        teamId: worm.teamId,
        active: true,
        bouncesLeft: weaponDef.bounces,
        fuseTimer: weaponDef.fuseTime,
        trail: [],
      };
      this.projectiles.push(proj);
    }
    
    // Recoil
    worm.vel.x -= dir * 2 * power;
    
    // Spawn muzzle particles
    this.spawnMuzzleFlash(worm.pos.x + dir * 15, worm.pos.y - 5, dir);
  }

  private performMeleeAttack(worm: Worm, weaponDef: typeof WEAPONS[string]): void {
    const dir = worm.facingRight ? 1 : -1;
    const attackPos = { x: worm.pos.x + dir * 20, y: worm.pos.y };
    
    // Check for hits
    this.teams.forEach(team => {
      team.worms.forEach(target => {
        if (!target.isAlive || target.teamId === worm.teamId) return;
        if (dist(attackPos, target.pos) < weaponDef.radius + WORM_RADIUS) {
          this.damageWorm(target, weaponDef.damage, worm.id);
          // Knockback
          target.vel.x += dir * 8;
          target.vel.y -= 4;
          // Blood particles
          this.spawnBlood(target.pos, 15);
        }
      });
    });
    
    // Destroy terrain in range
    destroyTerrain(this.terrain, attackPos, weaponDef.radius * 0.5, 0.8);
    this.terrainVersion++;
    
    // Chainsaw particles
    for (let i = 0; i < 10; i++) {
      this.particles.push({
        pos: { ...attackPos },
        vel: { x: (Math.random() - 0.5) * 6, y: -Math.random() * 4 },
        life: 0.5,
        maxLife: 0.5,
        size: 3 + Math.random() * 3,
        color: '#8B4513',
        type: 'debris',
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 10,
        gravity: 0.2,
        alpha: 1,
      });
    }
    
    this.phase = GamePhase.SIMULATING;
    this.simulationTimer = 0;
  }

  private performInstantAttack(worm: Worm, weaponDef: typeof WEAPONS[string], angle: number, dir: number): void {
    // Sniper - raycast
    const start = { x: worm.pos.x + dir * 15, y: worm.pos.y - 5 };
    const direction = normalize({ x: Math.cos(angle) * dir, y: Math.sin(angle) });
    
    let hitPos: Vec2 | null = null;
    let maxDist = weaponDef.range;
    
    // Check terrain
    for (let d = 0; d < maxDist; d += 2) {
      const px = start.x + direction.x * d;
      const py = start.y + direction.y * d;
      if (isSolid(this.terrain, px, py)) {
        hitPos = { x: px, y: py };
        break;
      }
    }
    
    // Check worms (closest hit)
    let closestWormDist = maxDist;
    let hitWorm: Worm | null = null;
    
    for (const team of this.teams) {
      for (const target of team.worms) {
        if (!target.isAlive) continue;
        // Ray-circle intersection
        const oc = { x: start.x - target.pos.x, y: start.y - target.pos.y };
        const b = 2 * (oc.x * direction.x + oc.y * direction.y);
        const c = oc.x * oc.x + oc.y * oc.y - (WORM_RADIUS + 5) ** 2;
        const disc = b * b - 4 * c;
        if (disc >= 0) {
          const t = (-b - Math.sqrt(disc)) / 2;
          if (t > 0 && t < closestWormDist) {
            closestWormDist = t;
            hitWorm = target;
          }
        }
      }
    }
    
    if (hitWorm && closestWormDist < (hitPos ? dist(start, hitPos) : maxDist)) {
      this.damageWorm(hitWorm, weaponDef.damage, worm.id);
      hitPos = { x: hitWorm.pos.x, y: hitWorm.pos.y };
      this.spawnBlood(hitWorm.pos, 8);
    }
    
    if (hitPos) {
      destroyTerrain(this.terrain, hitPos, weaponDef.radius, 0.5);
      this.terrainVersion++;
      // Laser trail effect
      for (let d = 0; d < dist(start, hitPos); d += 5) {
        this.particles.push({
          pos: { x: start.x + direction.x * d, y: start.y + direction.y * d },
          vel: { x: (Math.random() - 0.5) * 0.5, y: (Math.random() - 0.5) * 0.5 },
          life: 0.3,
          maxLife: 0.3,
          size: 2,
          color: '#ff0',
          type: 'spark',
          rotation: 0,
          rotSpeed: 0,
          gravity: 0,
          alpha: 1,
        });
      }
    }
    
    this.phase = GamePhase.SIMULATING;
    this.simulationTimer = 0.5;
  }

  private performUtilityAction(worm: Worm, weaponDef: typeof WEAPONS[string]): void {
    if (weaponDef.id === 'teleporter') {
      // Find random valid position
      const attempts = 50;
      for (let i = 0; i < attempts; i++) {
        const rx = Math.random() * this.canvasWidth;
        const surfaceY = getSurfaceY(this.terrain, rx);
        if (surfaceY < this.canvasHeight - 50) {
          // Teleport effect at old position
          this.spawnTeleportEffect(worm.pos);
          worm.pos = { x: rx, y: surfaceY - WORM_RADIUS - 2 };
          worm.vel = { x: 0, y: 0 };
          // Teleport effect at new position
          this.spawnTeleportEffect(worm.pos);
          break;
        }
      }
    } else if (weaponDef.id === 'shield') {
      this.shieldedWorms.add(worm.id);
      // Shield visual
      for (let i = 0; i < 20; i++) {
        const angle = (i / 20) * Math.PI * 2;
        this.particles.push({
          pos: { x: worm.pos.x + Math.cos(angle) * 25, y: worm.pos.y + Math.sin(angle) * 25 },
          vel: { x: Math.cos(angle) * 0.5, y: Math.sin(angle) * 0.5 },
          life: 1,
          maxLife: 1,
          size: 4,
          color: '#00ffff',
          type: 'spark',
          rotation: 0,
          rotSpeed: 0,
          gravity: 0,
          alpha: 0.8,
        });
      }
    }
    
    this.phase = GamePhase.SIMULATING;
    this.simulationTimer = 0.3;
  }

  private startBeam(worm: Worm, weaponDef: typeof WEAPONS[string], angle: number, dir: number): void {
    this.beamActive = true;
    this.beamWeaponId = weaponDef.id;
    this.beamStart = { x: worm.pos.x + dir * 15, y: worm.pos.y - 5 };
    const direction = { x: Math.cos(angle) * dir, y: Math.sin(angle) };
    this.beamEnd = { x: this.beamStart.x + direction.x * weaponDef.range, y: this.beamStart.y + direction.y * weaponDef.range };
    this.beamTimer = weaponDef.id === 'microwave' ? 2.0 : 1.5;
    this.phase = GamePhase.FIRING;
  }

  private placeObject(worm: Worm, weaponDef: typeof WEAPONS[string]): void {
    const dir = worm.facingRight ? 1 : -1;
    const placePos = { x: worm.pos.x + dir * 20, y: worm.pos.y + 5 };
    
    const obj: PlacedObject = {
      id: uid(),
      type: weaponDef.id === 'mine' ? 'mine' : 'dynamite',
      pos: placePos,
      teamId: worm.teamId,
      timer: weaponDef.fuseTime,
      armed: weaponDef.id === 'mine',
      health: 1,
    };
    this.placedObjects.push(obj);
    
    this.phase = GamePhase.SIMULATING;
    this.simulationTimer = 0.3;
  }

  private updateSimulation(dt: number): void {
    this.simulationTimer += dt;
    
    // Update projectiles
    this.updateProjectiles(dt);
    
    // Check if simulation is done
    const activeProjectiles = this.projectiles.filter(p => p.active);
    if (activeProjectiles.length === 0 && !this.beamActive && this.gatlingShotsLeft <= 0) {
      if (this.simulationTimer > 0.5) {
        this.endTurn();
      }
    }
    
    // Timeout safety
    if (this.simulationTimer > 15) {
      this.projectiles.forEach(p => p.active = false);
      this.endTurn();
    }
  }

  private updateFiring(dt: number): void {
    // Beam weapons
    if (this.beamActive) {
      this.updateBeam(dt);
    }
    
    // Gatling
    if (this.gatlingShotsLeft > 0) {
      this.updateGatling(dt);
    }
    
    // Check if firing is done
    if (!this.beamActive && this.gatlingShotsLeft <= 0) {
      this.phase = GamePhase.SIMULATING;
      this.simulationTimer = 0;
    }
  }

  private updateProjectiles(dt: number): void {
    const steps = 3;
    const subDt = dt / steps;
    
    for (const proj of this.projectiles) {
      if (!proj.active) continue;
      
      const weaponDef = getWeaponDef(proj.weaponId);
      
      for (let step = 0; step < steps; step++) {
        // Apply gravity
        proj.vel.y += (weaponDef.gravity || GRAVITY) * subDt * 60;
        
        // Apply wind
        if (weaponDef.windAffected) {
          proj.vel.x += this.wind.direction * this.wind.speed * 0.01 * subDt * 60;
        }
        
        // Move
        proj.pos.x += proj.vel.x * subDt * 60;
        proj.pos.y += proj.vel.y * subDt * 60;
        
        // Trail
        proj.trail.push({ ...proj.pos });
        if (proj.trail.length > 20) proj.trail.shift();
        
        // Check bounds
        if (proj.pos.x < -50 || proj.pos.x > this.canvasWidth + 50 || proj.pos.y > this.canvasHeight + 50) {
          proj.active = false;
          continue;
        }
        
        // Check terrain collision
        if (isSolid(this.terrain, proj.pos.x, proj.pos.y)) {
          if (proj.bouncesLeft > 0) {
            proj.bouncesLeft--;
            proj.vel.y = -Math.abs(proj.vel.y) * 0.5;
            proj.vel.x *= 0.7;
            proj.pos.y -= 3;
          } else {
            // Explode or impact
            this.handleProjectileImpact(proj, weaponDef);
            break;
          }
        }
        
        // Check water
        if (isWater(this.terrain, proj.pos.x, proj.pos.y)) {
          proj.active = false;
          this.spawnWaterSplash(proj.pos);
          break;
        }
        
        // Check worm collision
        let hitWorm = false;
        for (const team of this.teams) {
          for (const worm of team.worms) {
            if (!worm.isAlive) continue;
            if (dist(proj.pos, worm.pos) < WORM_RADIUS + 5) {
              this.handleProjectileImpact(proj, weaponDef);
              hitWorm = true;
              break;
            }
          }
          if (hitWorm) break;
        }
        if (hitWorm) break;
        
        // Fuse timer
        if (proj.fuseTimer > 0) {
          proj.fuseTimer -= subDt;
          if (proj.fuseTimer <= 0) {
            this.handleProjectileImpact(proj, weaponDef);
            break;
          }
        }
        
        // Drill weapon - destroy terrain along path
        if (proj.weaponId === 'drill' && isSolid(this.terrain, proj.pos.x, proj.pos.y)) {
          destroyTerrain(this.terrain, proj.pos, 12, 1.0);
          this.terrainVersion++;
        }
      }
    }
    
    // Clean up inactive projectiles
    this.projectiles = this.projectiles.filter(p => p.active);
  }

  private handleProjectileImpact(proj: Projectile, weaponDef: typeof WEAPONS[string]): void {
    proj.active = false;
    
    const impactPos = { ...proj.pos };
    
    // Create explosion
    if (weaponDef.radius > 0) {
      this.createExplosion(impactPos, weaponDef.radius, weaponDef.damage, proj.ownerId, proj.teamId);
    } else {
      // Direct hit damage
      this.applyDirectDamage(impactPos, weaponDef.damage, 15, proj.ownerId, proj.teamId);
    }
    
    // Cluster grenade - spawn sub-projectiles
    if (proj.weaponId === 'clusterGrenade') {
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 + Math.random() * 0.5;
        const speed = 4 + Math.random() * 3;
        const sub: Projectile = {
          id: uid(),
          weaponId: 'grenade',
          pos: { ...impactPos },
          vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed - 3 },
          ownerId: proj.ownerId,
          teamId: proj.teamId,
          active: true,
          bouncesLeft: 1,
          fuseTimer: 1.5 + Math.random(),
          trail: [],
        };
        this.projectiles.push(sub);
      }
    }
    
    // EMP - stun nearby worms
    if (proj.weaponId === 'emp') {
      this.teams.forEach(team => {
        team.worms.forEach(worm => {
          if (!worm.isAlive) return;
          if (dist(impactPos, worm.pos) < weaponDef.radius + WORM_RADIUS) {
            worm.stunTimer = 3;
            this.stunnedWorms.add(worm.id);
          }
        });
      });
    }
  }

  private createExplosion(pos: Vec2, radius: number, damage: number, ownerId: string, teamId: number): void {
    // Destroy terrain
    const mat = getMaterialAt(this.terrain, pos.x, pos.y);
    destroyTerrain(this.terrain, pos, radius, 0.9);
    this.terrainVersion++;
    
    // Damage worms
    this.teams.forEach(team => {
      team.worms.forEach(worm => {
        if (!worm.isAlive) return;
        const d = dist(pos, worm.pos);
        if (d < radius + WORM_RADIUS) {
          const falloff = 1 - (d / (radius + WORM_RADIUS));
          let dmg = damage * falloff;
          
          // Same team - reduced damage (friendly fire)
          if (worm.teamId === teamId && ownerId) {
            const ownerWorm = this.findWormById(ownerId);
            if (ownerWorm && ownerWorm.teamId === worm.teamId) {
              dmg *= 0.5;
            }
          }
          
          // Shield
          if (this.shieldedWorms.has(worm.id)) {
            dmg *= 0.5;
          }
          
          this.damageWorm(worm, Math.floor(dmg), ownerId);
          
          // Knockback
          const dir = normalize({ x: worm.pos.x - pos.x, y: worm.pos.y - pos.y });
          const force = falloff * 8;
          worm.vel.x += dir.x * force;
          worm.vel.y += dir.y * force - 3;
          worm.isGrounded = false;
        }
      });
    });
    
    // Visual explosion
    this.explosions.push({
      pos: { ...pos },
      radius,
      timer: 0.6,
      maxTimer: 0.6,
      intensity: damage / 50,
      material: mat,
    });
    
    // Particles
    this.spawnExplosionParticles(pos, radius, mat);
    
    // Camera shake
    this.camera.shakeIntensity = Math.min(15, radius * 0.2);
    
    // Callback
    this.onExplosion?.(pos, radius);
  }

  private applyDirectDamage(pos: Vec2, damage: number, radius: number, ownerId: string, teamId: number): void {
    this.teams.forEach(team => {
      team.worms.forEach(worm => {
        if (!worm.isAlive) return;
        if (dist(pos, worm.pos) < radius + WORM_RADIUS) {
          this.damageWorm(worm, damage, ownerId);
        }
      });
    });
  }

  private damageWorm(worm: Worm, damage: number, attackerId: string): void {
    if (!worm.isAlive) return;
    
    worm.health -= damage;
    worm.animState = WormAnimState.HIT;
    worm.animTimer = 0.3;
    
    // Track stats
    const key = `${worm.teamId}_${attackerId}`;
    this.stats.damageDealt.set(key, (this.stats.damageDealt.get(key) || 0) + damage);
    
    this.onDamage?.(worm.id, damage);
    
    if (worm.health <= 0) {
      worm.health = 0;
      worm.isAlive = false;
      worm.animState = WormAnimState.DEATH;
      worm.animTimer = 1.0;
      
      // Track kill
      const killKey = attackerId;
      this.stats.kills.set(killKey, (this.stats.kills.get(killKey) || 0) + 1);
      
      this.onKill?.(worm.id, attackerId);
      
      // Death particles
      this.spawnBlood(worm.pos, 20);
    }
  }

  private updateWormPhysics(dt: number): void {
    for (const team of this.teams) {
      for (const worm of team.worms) {
        if (!worm.isAlive) continue;
        
        // Gravity
        if (!worm.isGrounded) {
          worm.vel.y += GRAVITY * dt * 60;
        }
        
        // Friction
        if (worm.isGrounded) {
          worm.vel.x *= 0.85;
        }
        
        // Move
        worm.pos.x += worm.vel.x * dt * 60;
        worm.pos.y += worm.vel.y * dt * 60;
        
        // Bounds
        worm.pos.x = clamp(worm.pos.x, WORM_RADIUS, this.canvasWidth - WORM_RADIUS);
        
        // Terrain collision
        worm.isGrounded = false;
        
        // Check below
        if (isSolid(this.terrain, worm.pos.x, worm.pos.y + WORM_RADIUS)) {
          worm.pos.y = this.findGroundY(worm.pos.x, worm.pos.y) - WORM_RADIUS;
          worm.vel.y = 0;
          worm.isGrounded = true;
          worm.jumpUses = MAX_JUMP_COUNT;
          if (worm.animState === WormAnimState.FALL || worm.animState === WormAnimState.JUMP) {
            worm.animState = WormAnimState.IDLE;
          }
        }
        
        // Check sides
        if (isSolid(this.terrain, worm.pos.x - WORM_RADIUS, worm.pos.y)) {
          worm.pos.x += 2;
          worm.vel.x = Math.abs(worm.vel.x) * 0.3;
        }
        if (isSolid(this.terrain, worm.pos.x + WORM_RADIUS, worm.pos.y)) {
          worm.pos.x -= 2;
          worm.vel.x = -Math.abs(worm.vel.x) * 0.3;
        }
        
        // Check above
        if (isSolid(this.terrain, worm.pos.x, worm.pos.y - WORM_RADIUS)) {
          worm.pos.y += 2;
          worm.vel.y = Math.abs(worm.vel.y) * 0.3;
        }
        
        // Water damage
        if (isWater(this.terrain, worm.pos.x, worm.pos.y + WORM_RADIUS)) {
          worm.health -= 2;
          if (worm.health <= 0) {
            worm.isAlive = false;
            worm.animState = WormAnimState.DEATH;
          }
          this.spawnWaterSplash(worm.pos);
        }
        
        // Fall off map
        if (worm.pos.y > this.canvasHeight + 50) {
          worm.health = 0;
          worm.isAlive = false;
          worm.animState = WormAnimState.DEATH;
        }
        
        // Update grounded state
        if (!worm.isGrounded && worm.vel.y > 0.5) {
          if (worm.animState !== WormAnimState.FIRE && worm.animState !== WormAnimState.HIT) {
            worm.animState = WormAnimState.FALL;
          }
        }
        
        // Burn timer
        if (worm.burnTimer > 0) {
          worm.burnTimer -= dt;
          worm.health -= 3 * dt;
          if (worm.health <= 0) {
            worm.isAlive = false;
            worm.animState = WormAnimState.DEATH;
          }
        }
      }
    }
  }

  private findGroundY(x: number, currentY: number): number {
    for (let y = Math.floor(currentY); y < Math.floor(currentY) + 20; y++) {
      if (isSolid(this.terrain, x, y)) return y;
    }
    return currentY;
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      
      p.vel.y += p.gravity * dt * 60;
      p.pos.x += p.vel.x * dt * 60;
      p.pos.y += p.vel.y * dt * 60;
      p.rotation += p.rotSpeed * dt;
      p.alpha = p.life / p.maxLife;
      
      // Smoke rises
      if (p.type === 'smoke') {
        p.vel.y -= 0.05 * dt * 60;
        p.vel.x += this.wind.direction * this.wind.speed * 0.02 * dt * 60;
        p.size += dt * 3;
      }
    }
    
    // Limit particles
    if (this.particles.length > 500) {
      this.particles = this.particles.slice(-400);
    }
  }

  private updateExplosions(dt: number): void {
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      this.explosions[i].timer -= dt;
      if (this.explosions[i].timer <= 0) {
        this.explosions.splice(i, 1);
      }
    }
  }

  private updateBeam(dt: number): void {
    if (!this.beamActive) return;
    
    this.beamTimer -= dt;
    if (this.beamTimer <= 0) {
      this.beamActive = false;
      return;
    }
    
    const worm = this.getCurrentWorm();
    if (!worm) { this.beamActive = false; return; }
    
    const weaponDef = getWeaponDef(this.beamWeaponId);
    const dir = worm.facingRight ? 1 : -1;
    this.beamStart = { x: worm.pos.x + dir * 15, y: worm.pos.y - 5 };
    
    // Calculate beam end using angle
    const angle = this.input.angle;
    const direction = normalize({ x: Math.cos(angle) * dir, y: Math.sin(angle) });
    
    // Raycast to find beam end
    let beamLength = weaponDef.range;
    for (let d = 0; d < weaponDef.range; d += 3) {
      const px = this.beamStart.x + direction.x * d;
      const py = this.beamStart.y + direction.y * d;
      if (isSolid(this.terrain, px, py)) {
        beamLength = d;
        destroyTerrain(this.terrain, { x: px, y: py }, 5, 0.3);
        this.terrainVersion++;
        break;
      }
    }
    
    this.beamEnd = {
      x: this.beamStart.x + direction.x * beamLength,
      y: this.beamStart.y + direction.y * beamLength,
    };
    
    // Damage worms in beam path
    const damagePerTick = weaponDef.damage * dt;
    this.teams.forEach(team => {
      team.worms.forEach(target => {
        if (!target.isAlive) return;
        // Point-line distance
        const dx = this.beamEnd.x - this.beamStart.x;
        const dy = this.beamEnd.y - this.beamStart.y;
        const len2 = dx * dx + dy * dy;
        if (len2 === 0) return;
        
        let t = ((target.pos.x - this.beamStart.x) * dx + (target.pos.y - this.beamStart.y) * dy) / len2;
        t = clamp(t, 0, 1);
        const closest = { x: this.beamStart.x + t * dx, y: this.beamStart.y + t * dy };
        const d = dist(target.pos, closest);
        
        if (d < weaponDef.radius + WORM_RADIUS) {
          let dmg = damagePerTick;
          if (this.shieldedWorms.has(target.id)) dmg *= 0.5;
          this.damageWorm(target, dmg, worm.id);
          
          if (this.beamWeaponId === 'flamethrower') {
            target.burnTimer = 2;
          }
          
          // Hit particles
          if (Math.random() < 0.3) {
            this.particles.push({
              pos: { ...target.pos },
              vel: { x: (Math.random() - 0.5) * 3, y: -Math.random() * 3 },
              life: 0.3,
              maxLife: 0.3,
              size: 3,
              color: this.beamWeaponId === 'laser' ? '#ff0' : this.beamWeaponId === 'flamethrower' ? '#f80' : '#f0f',
              type: 'spark',
              rotation: 0,
              rotSpeed: 0,
              gravity: 0,
              alpha: 1,
            });
          }
        }
      });
    });
    
    // Beam particles
    if (Math.random() < 0.5) {
      const t = Math.random();
      this.particles.push({
        pos: {
          x: lerp(this.beamStart.x, this.beamEnd.x, t),
          y: lerp(this.beamStart.y, this.beamEnd.y, t),
        },
        vel: { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2 },
        life: 0.2,
        maxLife: 0.2,
        size: 2 + Math.random() * 2,
        color: this.beamWeaponId === 'laser' ? '#ff0' : this.beamWeaponId === 'microwave' ? '#f0f' : '#f80',
        type: 'spark',
        rotation: 0,
        rotSpeed: 0,
        gravity: 0,
        alpha: 0.8,
      });
    }
  }

  private updateGatling(dt: number): void {
    if (this.gatlingShotsLeft <= 0) return;
    
    const worm = this.getCurrentWorm();
    if (!worm) { this.gatlingShotsLeft = 0; return; }
    
    this.gatlingTimer -= dt;
    if (this.gatlingTimer <= 0) {
      this.gatlingTimer = 0.05; // Fire rate
      this.gatlingShotsLeft--;
      
      const dir = worm.facingRight ? 1 : -1;
      const angle = this.input.angle;
      const spread = (Math.random() - 0.5) * 0.15;
      const speed = 15;
      
      const proj: Projectile = {
        id: uid(),
        weaponId: 'gatlingGun',
        pos: { x: worm.pos.x + dir * 15, y: worm.pos.y - 5 },
        vel: {
          x: Math.cos(angle + spread) * speed * dir,
          y: Math.sin(angle + spread) * speed,
        },
        ownerId: worm.id,
        teamId: worm.teamId,
        active: true,
        bouncesLeft: 0,
        fuseTimer: 0,
        trail: [],
      };
      this.projectiles.push(proj);
      
      // Shell casing
      this.particles.push({
        pos: { x: worm.pos.x, y: worm.pos.y - 8 },
        vel: { x: -dir * (2 + Math.random() * 2), y: -(2 + Math.random() * 2) },
        life: 1.5,
        maxLife: 1.5,
        size: 2,
        color: '#c8a000',
        type: 'shell',
        rotation: 0,
        rotSpeed: 10,
        gravity: 0.3,
        alpha: 1,
      });
      
      // Muzzle flash
      this.particles.push({
        pos: { x: worm.pos.x + dir * 18, y: worm.pos.y - 5 },
        vel: { x: dir * 3, y: (Math.random() - 0.5) * 2 },
        life: 0.08,
        maxLife: 0.08,
        size: 6 + Math.random() * 4,
        color: '#ff8',
        type: 'fire',
        rotation: 0,
        rotSpeed: 0,
        gravity: 0,
        alpha: 1,
      });
      
      // Recoil
      worm.vel.x -= dir * 0.3;
    }
  }

  private updatePlacedObjects(dt: number): void {
    for (let i = this.placedObjects.length - 1; i >= 0; i--) {
      const obj = this.placedObjects[i];
      
      // Gravity for placed objects
      if (!isSolid(this.terrain, obj.pos.x, obj.pos.y + 10)) {
        obj.pos.y += 3 * dt * 60;
      }
      
      // Fuse timer for dynamite
      if (obj.type === 'dynamite') {
        obj.timer -= dt;
        if (obj.timer <= 0) {
          this.createExplosion(obj.pos, 70, 60, '', obj.teamId);
          this.placedObjects.splice(i, 1);
          continue;
        }
      }
      
      // Mine detection
      if (obj.type === 'mine' && obj.armed) {
        for (const team of this.teams) {
          for (const worm of team.worms) {
            if (!worm.isAlive || worm.teamId === obj.teamId) continue;
            if (dist(obj.pos, worm.pos) < 25) {
              this.createExplosion(obj.pos, 40, 45, '', obj.teamId);
              this.placedObjects.splice(i, 1);
              break;
            }
          }
        }
      }
      
      // Remove if off map
      if (obj.pos.y > this.canvasHeight + 50) {
        this.placedObjects.splice(i, 1);
      }
    }
  }

  private updateWormAnims(dt: number): void {
    for (const team of this.teams) {
      for (const worm of team.worms) {
        worm.animTimer -= dt;
        if (worm.animTimer <= 0) {
          if (worm.animState === WormAnimState.FIRE || worm.animState === WormAnimState.HIT) {
            worm.animState = WormAnimState.IDLE;
          }
          if (worm.animState === WormAnimState.DEATH) {
            // Death animation complete
          }
        }
        worm.animFrame += dt * 8;
      }
    }
  }

  private updateTransition(dt: number): void {
    this.turnTransitionTimer -= dt;
    
    // Update camera to track new worm during transition
    const worm = this.getCurrentWorm();
    if (worm) {
      this.camera.targetX = worm.pos.x - this.canvasWidth / 2;
      this.camera.targetY = worm.pos.y - this.canvasHeight / 2;
    }
    
    if (this.turnTransitionTimer <= 0) {
      this.startNewTurn();
    }
  }

  private endTurn(): void {
    // Remove shield after turn
    const worm = this.getCurrentWorm();
    if (worm) {
      this.shieldedWorms.delete(worm.id);
    }
    
    // Reduce cooldowns
    if (worm) {
      worm.weapons.forEach(w => {
        if (w.cooldown > 0) w.cooldown--;
      });
    }
    
    this.phase = GamePhase.TURN_TRANSITION;
    this.turnTransitionTimer = 1.5;
    
    // Move to next team/worm
    this.advanceToNextWorm();
  }

  private advanceToNextWorm(): void {
    const startTeam = this.currentTeamIndex;
    let attempts = 0;
    
    do {
      this.currentTeamIndex = (this.currentTeamIndex + 1) % this.teams.length;
      attempts++;
      if (attempts > this.teams.length * 10) break;
    } while (!this.teamHasAliveWorms(this.currentTeamIndex));
    
    this.findNextAliveWorm();
    this.totalTurns++;
  }

  private startNewTurn(): void {
    this.turnTimer = this.config.turnTime;
    this.phase = GamePhase.PLAYING;
    this.input.power = 50;
    this.input.charging = false;
    
    const worm = this.getCurrentWorm();
    if (worm) {
      worm.jumpUses = MAX_JUMP_COUNT;
      this.onTurnChange?.(this.currentTeamIndex, worm.name);
      
      // If AI, start AI turn
      const team = this.teams[this.currentTeamIndex];
      if (team && team.isAI) {
        this.executeAITurn();
      }
    }
  }

  private findNextAliveWorm(): void {
    const team = this.teams[this.currentTeamIndex];
    if (!team) return;
    
    const aliveWorms = team.worms.filter(w => w.isAlive);
    if (aliveWorms.length === 0) return;
    
    // Pick the worm with most health, or random
    this.currentWormIndex = team.worms.indexOf(
      aliveWorms.reduce((best, w) => w.health > best.health ? w : best, aliveWorms[0])
    );
  }

  private teamHasAliveWorms(teamIdx: number): boolean {
    return this.teams[teamIdx]?.worms.some(w => w.isAlive) ?? false;
  }

  getCurrentWorm(): Worm | null {
    const team = this.teams[this.currentTeamIndex];
    if (!team) return null;
    const worm = team.worms[this.currentWormIndex];
    if (!worm || !worm.isAlive) {
      this.findNextAliveWorm();
      return team.worms[this.currentWormIndex] || null;
    }
    return worm;
  }

  private checkVictory(): void {
    const aliveTeams = this.teams.filter(t => t.worms.some(w => w.isAlive));
    if (aliveTeams.length <= 1 && this.phase !== GamePhase.GAME_OVER && this.phase !== GamePhase.MENU) {
      this.phase = GamePhase.GAME_OVER;
      if (aliveTeams.length === 1) {
        this.onGameOver?.(aliveTeams[0]);
      }
    }
    
    // Sudden death
    if (this.config.suddenDeathTurns > 0 && this.totalTurns > this.config.suddenDeathTurns) {
      // Damage all worms slowly
      if (this.totalTurns % 5 === 0) {
        this.teams.forEach(team => {
          team.worms.forEach(worm => {
            if (worm.isAlive) {
              worm.health -= 5;
              if (worm.health <= 0) {
                worm.isAlive = false;
                worm.animState = WormAnimState.DEATH;
              }
            }
          });
        });
      }
    }
  }

  private findWormById(id: string): Worm | null {
    for (const team of this.teams) {
      for (const worm of team.worms) {
        if (worm.id === id) return worm;
      }
    }
    return null;
  }

  // ---- AI ----
  private executeAITurn(): void {
    const worm = this.getCurrentWorm();
    if (!worm) return;
    
    const difficulty = this.config.difficulty;
    const accuracy = difficulty === 'easy' ? 0.4 : difficulty === 'normal' ? 0.7 : 0.9;
    
    // Find best target
    let bestTarget: Worm | null = null;
    let bestScore = -Infinity;
    
    for (const team of this.teams) {
      if (team.id === worm.teamId) continue;
      for (const target of team.worms) {
        if (!target.isAlive) continue;
        const d = dist(worm.pos, target.pos);
        const score = -d + target.health * 0.5; // Prefer closer, weaker targets
        if (score > bestScore) {
          bestScore = score;
          bestTarget = target;
        }
      }
    }
    
    if (!bestTarget) {
      this.endTurn();
      return;
    }
    
    // Choose weapon
    const availableWeapons = worm.weapons.filter(w => w.ammo > 0 && w.cooldown <= 0);
    const d = dist(worm.pos, bestTarget.pos);
    
    let chosenWeapon: string;
    if (d < 30) {
      chosenWeapon = 'chainsaw';
    } else if (d < 150) {
      chosenWeapon = Math.random() < 0.5 ? 'shotgun' : 'grenade';
    } else if (d < 400) {
      chosenWeapon = Math.random() < 0.6 ? 'rocketLauncher' : 'bazooka';
    } else {
      chosenWeapon = Math.random() < 0.5 ? 'sniper' : 'airstrike';
    }
    
    // Make sure we have the weapon
    const hasWeapon = availableWeapons.find(w => w.weaponId === chosenWeapon);
    if (!hasWeapon) {
      chosenWeapon = availableWeapons[0]?.weaponId || 'grenade';
    }
    
    worm.currentWeapon = chosenWeapon;
    
    // Calculate aim
    const dx = bestTarget.pos.x - worm.pos.x;
    const dy = bestTarget.pos.y - worm.pos.y;
    let targetAngle = Math.atan2(dy, Math.abs(dx));
    
    // Face target
    worm.facingRight = dx > 0;
    
    // Add inaccuracy based on difficulty
    const inaccuracy = (1 - accuracy) * 0.5;
    targetAngle += (Math.random() - 0.5) * inaccuracy;
    
    this.input.angle = targetAngle;
    this.input.power = clamp(30 + (d / 10) + (Math.random() - 0.5) * 20 * (1 - accuracy), 20, 95);
    
    // Move towards better position (hard AI)
    if (difficulty === 'hard' && Math.random() < 0.4) {
      const moveDir = dx > 0 ? 1 : -1;
      for (let i = 0; i < 5; i++) {
        worm.vel.x = moveDir * WORM_SPEED;
        this.updateWormPhysics(1/60);
      }
    }
    
    // Fire after a short delay
    setTimeout(() => {
      if (this.phase === GamePhase.PLAYING || this.phase === GamePhase.AIMING) {
        this.fireWeapon();
      }
    }, 800 + Math.random() * 500);
  }

  // ---- Camera ----
  private updateCamera(): void {
    const worm = this.getCurrentWorm();
    if (worm) {
      this.camera.targetX = worm.pos.x - this.canvasWidth / 2;
      this.camera.targetY = worm.pos.y - this.canvasHeight / 2;
    }
    this.camera.targetX = clamp(this.camera.targetX, 0, Math.max(0, this.canvasWidth - this.canvasWidth));
    this.camera.targetY = clamp(this.camera.targetY, 0, Math.max(0, this.canvasHeight - this.canvasHeight));
  }

  private updateCameraSmooth(dt: number): void {
    this.camera.x = lerp(this.camera.x, this.camera.targetX, 3 * dt);
    this.camera.y = lerp(this.camera.y, this.camera.targetY, 3 * dt);
    
    // Shake decay
    if (this.camera.shakeIntensity > 0) {
      this.camera.shakeX = (Math.random() - 0.5) * this.camera.shakeIntensity;
      this.camera.shakeY = (Math.random() - 0.5) * this.camera.shakeIntensity;
      this.camera.shakeIntensity *= 0.9;
      if (this.camera.shakeIntensity < 0.5) this.camera.shakeIntensity = 0;
    } else {
      this.camera.shakeX = 0;
      this.camera.shakeY = 0;
    }
  }

  // ---- Particle Spawning ----
  private spawnExplosionParticles(pos: Vec2, radius: number, material: TerrainMaterial): void {
    const count = Math.min(40, radius);
    
    // Fire
    for (let i = 0; i < count * 0.4; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      this.particles.push({
        pos: { ...pos },
        vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        life: 0.3 + Math.random() * 0.4,
        maxLife: 0.7,
        size: 4 + Math.random() * 6,
        color: Math.random() < 0.5 ? '#ff4400' : '#ff8800',
        type: 'fire',
        rotation: 0,
        rotSpeed: 0,
        gravity: -0.05,
        alpha: 1,
      });
    }
    
    // Smoke
    for (let i = 0; i < count * 0.3; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3;
      this.particles.push({
        pos: { x: pos.x + (Math.random() - 0.5) * radius * 0.5, y: pos.y + (Math.random() - 0.5) * radius * 0.5 },
        vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed - 2 },
        life: 1 + Math.random() * 2,
        maxLife: 3,
        size: 5 + Math.random() * 8,
        color: '#333',
        type: 'smoke',
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 2,
        gravity: -0.02,
        alpha: 0.6,
      });
    }
    
    // Debris (material colored)
    const debrisColor = material === TerrainMaterial.SAND ? '#c8a858' :
      material === TerrainMaterial.ROCK ? '#666' :
      material === TerrainMaterial.CONCRETE ? '#888' :
      material === TerrainMaterial.SNOW ? '#ddd' : '#8B4513';
    
    for (let i = 0; i < count * 0.3; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 6;
      this.particles.push({
        pos: { ...pos },
        vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed - 3 },
        life: 0.5 + Math.random() * 1,
        maxLife: 1.5,
        size: 2 + Math.random() * 4,
        color: debrisColor,
        type: 'debris',
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 15,
        gravity: 0.2,
        alpha: 1,
      });
    }
    
    // Sparks
    for (let i = 0; i < count * 0.2; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 5 + Math.random() * 8;
      this.particles.push({
        pos: { ...pos },
        vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        life: 0.2 + Math.random() * 0.3,
        maxLife: 0.5,
        size: 1 + Math.random() * 2,
        color: '#fff',
        type: 'spark',
        rotation: 0,
        rotSpeed: 0,
        gravity: 0.1,
        alpha: 1,
      });
    }
  }

  private spawnMuzzleFlash(x: number, y: number, dir: number): void {
    for (let i = 0; i < 5; i++) {
      this.particles.push({
        pos: { x, y },
        vel: { x: dir * (3 + Math.random() * 4), y: (Math.random() - 0.5) * 3 },
        life: 0.1,
        maxLife: 0.1,
        size: 4 + Math.random() * 4,
        color: '#ff8',
        type: 'fire',
        rotation: 0,
        rotSpeed: 0,
        gravity: 0,
        alpha: 1,
      });
    }
  }

  private spawnBlood(pos: Vec2, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      this.particles.push({
        pos: { ...pos },
        vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed - 2 },
        life: 0.5 + Math.random() * 0.5,
        maxLife: 1,
        size: 2 + Math.random() * 3,
        color: Math.random() < 0.5 ? '#cc0000' : '#880000',
        type: 'blood',
        rotation: 0,
        rotSpeed: (Math.random() - 0.5) * 5,
        gravity: 0.15,
        alpha: 1,
      });
    }
  }

  private spawnWaterSplash(pos: Vec2): void {
    for (let i = 0; i < 8; i++) {
      const angle = -Math.PI * 0.2 - Math.random() * Math.PI * 0.6;
      const speed = 2 + Math.random() * 4;
      this.particles.push({
        pos: { ...pos },
        vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        life: 0.5 + Math.random() * 0.5,
        maxLife: 1,
        size: 2 + Math.random() * 3,
        color: '#4488ff',
        type: 'spark',
        rotation: 0,
        rotSpeed: 0,
        gravity: 0.2,
        alpha: 0.8,
      });
    }
  }

  private spawnTeleportEffect(pos: Vec2): void {
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      this.particles.push({
        pos: { x: pos.x + Math.cos(angle) * 15, y: pos.y + Math.sin(angle) * 15 },
        vel: { x: Math.cos(angle) * 2, y: Math.sin(angle) * 2 },
        life: 0.5,
        maxLife: 0.5,
        size: 3,
        color: '#00ffff',
        type: 'spark',
        rotation: 0,
        rotSpeed: 0,
        gravity: 0,
        alpha: 1,
      });
    }
  }

  // ---- Public API ----
  getWindForce(): number {
    return this.wind.direction * this.wind.speed;
  }

  getActiveTeam(): Team | null {
    return this.teams[this.currentTeamIndex] || null;
  }

  getTrajectoryPrediction(): Vec2[] {
    const worm = this.getCurrentWorm();
    if (!worm) return [];
    
    const weaponDef = getWeaponDef(worm.currentWeapon);
    if (weaponDef.type !== WeaponType.PROJECTILE) return [];
    
    const dir = worm.facingRight ? 1 : -1;
    const power = this.input.power / 100;
    const speed = weaponDef.speed * (0.5 + power * 0.5);
    const angle = this.input.angle;
    
    let px = worm.pos.x + dir * 15;
    let py = worm.pos.y - 5;
    let vx = Math.cos(angle) * speed * dir;
    let vy = Math.sin(angle) * speed;
    
    const points: Vec2[] = [];
    for (let i = 0; i < 40; i++) {
      vy += (weaponDef.gravity || GRAVITY);
      if (weaponDef.windAffected) {
        vx += this.wind.direction * this.wind.speed * 0.01;
      }
      px += vx;
      py += vy;
      points.push({ x: px, y: py });
      
      if (isSolid(this.terrain, px, py) || py > this.canvasHeight) break;
    }
    
    return points;
  }

  restart(): void {
    this.stop();
    this.init(this.config);
    this.start();
  }

  setCanvasSize(w: number, h: number): void {
    this.canvasWidth = w;
    this.canvasHeight = h;
  }
}
