// ============================================================
// WURMKIEG - Core Type Definitions
// ============================================================

export interface Vec2 {
  x: number;
  y: number;
}

export enum TerrainMaterial {
  AIR = 0,
  SAND = 1,
  EARTH = 2,
  ROCK = 3,
  CONCRETE = 4,
  SNOW = 5,
  METAL = 6,
  WATER = 7,
}

export interface TerrainConfig {
  width: number;
  height: number;
  materials: Uint8Array;
}

export enum TeamColor {
  RED = 'red',
  BLUE = 'blue',
  GREEN = 'green',
  YELLOW = 'yellow',
}

export interface Team {
  id: number;
  name: string;
  color: TeamColor;
  worms: Worm[];
  isAI: boolean;
  score: number;
}

export interface Worm {
  id: string;
  name: string;
  teamId: number;
  pos: Vec2;
  vel: Vec2;
  health: number;
  maxHealth: number;
  isAlive: boolean;
  facingRight: boolean;
  isGrounded: boolean;
  currentWeapon: string;
  weapons: WeaponLoadout[];
  animState: WormAnimState;
  animFrame: number;
  animTimer: number;
  stunTimer: number;
  burnTimer: number;
  ropeUses: number;
  jumpUses: number;
}

export enum WormAnimState {
  IDLE = 'idle',
  WALK = 'walk',
  JUMP = 'jump',
  FALL = 'fall',
  AIM = 'aim',
  FIRE = 'fire',
  HIT = 'hit',
  DEATH = 'death',
  BURN = 'burn',
}

export interface WeaponLoadout {
  weaponId: string;
  ammo: number;
  cooldown: number;
}

export enum WeaponType {
  PROJECTILE = 'projectile',
  BEAM = 'beam',
  MELEE = 'melee',
  PLACED = 'placed',
  INSTANT = 'instant',
  UTILITY = 'utility',
}

export interface WeaponDef {
  id: string;
  name: string;
  type: WeaponType;
  icon: string;
  damage: number;
  radius: number;
  range: number;
  ammo: number;
  cooldown: number;
  windAffected: boolean;
  gravity: number;
  speed: number;
  bounces: number;
  fuseTime: number;
  description: string;
}

export interface Projectile {
  id: string;
  weaponId: string;
  pos: Vec2;
  vel: Vec2;
  ownerId: string;
  teamId: number;
  active: boolean;
  bouncesLeft: number;
  fuseTimer: number;
  trail: Vec2[];
  subProjectiles?: Projectile[];
  beamEnd?: Vec2;
  beamActive?: boolean;
  beamTimer?: number;
}

export interface Particle {
  pos: Vec2;
  vel: Vec2;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  type: 'spark' | 'smoke' | 'debris' | 'fire' | 'blood' | 'shell' | 'snow';
  rotation: number;
  rotSpeed: number;
  gravity: number;
  alpha: number;
}

export interface Explosion {
  pos: Vec2;
  radius: number;
  timer: number;
  maxTimer: number;
  intensity: number;
  material: TerrainMaterial;
}

export interface PlacedObject {
  id: string;
  type: 'mine' | 'dynamite' | 'shield';
  pos: Vec2;
  teamId: number;
  timer: number;
  armed: boolean;
  health: number;
}

export enum GamePhase {
  MENU = 'menu',
  PLAYING = 'playing',
  AIMING = 'aiming',
  FIRING = 'firing',
  SIMULATING = 'simulating',
  TURN_TRANSITION = 'transition',
  GAME_OVER = 'gameover',
  PAUSED = 'paused',
}

export interface GameConfig {
  teams: TeamConfig[];
  mapId: string;
  turnTime: number;
  roundTime: number;
  windEnabled: boolean;
  suddenDeathTurns: number;
  splatterLevel: 'off' | 'low' | 'normal' | 'high';
  particleDensity: number;
  screenShake: boolean;
  difficulty: 'easy' | 'normal' | 'hard';
}

export interface TeamConfig {
  name: string;
  color: TeamColor;
  isAI: boolean;
  wormCount: number;
  wormNames: string[];
}

export interface Wind {
  speed: number;
  direction: number; // -1 to 1
  changeTimer: number;
}

export interface Camera {
  x: number;
  y: number;
  zoom: number;
  targetX: number;
  targetY: number;
  shakeX: number;
  shakeY: number;
  shakeIntensity: number;
}

export interface GameStats {
  damageDealt: Map<string, number>;
  kills: Map<string, number>;
  shotsFired: Map<string, number>;
}

export interface MapDef {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  generate: (seed: number) => TerrainConfig;
  decorations: DecorationDef[];
  skyGradient: [string, string, string];
  ambientLight: string;
}

export interface DecorationDef {
  type: string;
  x: number;
  y: number;
  scale: number;
  variant: number;
}

export interface InputState {
  keys: Set<string>;
  mouseX: number;
  mouseY: number;
  mouseDown: boolean;
  power: number;
  angle: number;
  charging: boolean;
}

export const GRAVITY = 0.15;
export const MAX_WORM_HEALTH = 100;
export const WORM_RADIUS = 12;
export const WORM_SPEED = 2.5;
export const JUMP_FORCE = 5.5;
export const MAX_JUMP_COUNT = 3;
export const TERRAIN_DAMAGE_THRESHOLD = 3;
export const FIXED_DT = 1 / 60;
export const SIMULATION_STEPS = 3;
