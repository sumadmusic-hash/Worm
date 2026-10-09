import { useState, useEffect, useRef, useCallback } from 'react';
import { GameEngine } from './game/engine';
import { GameRenderer } from './game/renderer';
import { audioManager } from './game/audio';
import { GamePhase, GameConfig, TeamColor, Team } from './game/types';
import { WEAPONS } from './game/weapons';

type Screen = 'menu' | 'game' | 'settings' | 'results';

function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null);
  const [winner, setWinner] = useState<Team | null>(null);
  const [settings, setSettings] = useState({
    masterVolume: 0.7,
    sfxVolume: 0.8,
    splatter: 'normal' as 'off' | 'low' | 'normal' | 'high',
    particles: 1.0,
    screenShake: true,
  });

  const startGame = (config: GameConfig) => {
    setGameConfig(config);
    setScreen('game');
  };

  const handleGameOver = (team: Team) => {
    setWinner(team);
    audioManager.playVictory();
    setTimeout(() => setScreen('results'), 2000);
  };

  return (
    <div className="w-screen h-screen overflow-hidden bg-gray-900 select-none">
      {screen === 'menu' && (
        <MainMenu onStart={startGame} onSettings={() => setScreen('settings')} settings={settings} />
      )}
      {screen === 'game' && gameConfig && (
        <GameScreen
          config={gameConfig}
          onBack={() => setScreen('menu')}
          onGameOver={handleGameOver}
          settings={settings}
        />
      )}
      {screen === 'settings' && (
        <SettingsScreen
          settings={settings}
          onChange={setSettings}
          onBack={() => setScreen('menu')}
        />
      )}
      {screen === 'results' && winner && (
        <ResultsScreen
          winner={winner}
          config={gameConfig!}
          onRestart={() => { if (gameConfig) startGame(gameConfig); }}
          onMenu={() => setScreen('menu')}
        />
      )}
    </div>
  );
}

// ============ MAIN MENU ============
function MainMenu({ onStart, onSettings, settings }: {
  onStart: (config: GameConfig) => void;
  onSettings: () => void;
  settings: any;
}) {
  const [mapId, setMapId] = useState('omaha');
  const [difficulty, setDifficulty] = useState<'easy' | 'normal' | 'hard'>('normal');
  const [teamCount, setTeamCount] = useState(2);
  const [wormCount, setWormCount] = useState(3);
  const [turnTime, setTurnTime] = useState(30);
  const [gameMode, setGameMode] = useState<'ai' | 'local'>('ai');

  const maps = [
    { id: 'omaha', name: 'Omaha Beach', desc: 'Normandie 1944 - Küstenlandung' },
    { id: 'stalingrad', name: 'Stalingrad', desc: 'Winter 1942 - Ruinenstadt' },
    { id: 'desert', name: 'Wüstenfestung', desc: 'Nordafrika - Festungsanlage' },
    { id: 'mountain', name: 'Gebirgsfront', desc: 'Alpen - Höhenstellung' },
  ];

  const handleStart = () => {
    audioManager.init();
    audioManager.resume();
    
    const teams = [];
    const colors = [TeamColor.RED, TeamColor.BLUE, TeamColor.GREEN, TeamColor.YELLOW];
    const names = ['Alpha', 'Bravo', 'Charlie', 'Delta'];
    const wormNames = [
      ['Wurst', 'Käfer', 'Blitz', 'Donner'],
      ['Fuchs', 'Adler', 'Wolf', 'Bär'],
      ['Hammer', 'Sturm', 'Flink', 'Eisen'],
      ['Feuer', 'Schatten', 'Geist', 'König'],
    ];
    
    for (let i = 0; i < teamCount; i++) {
      teams.push({
        name: names[i],
        color: colors[i],
        isAI: gameMode === 'ai' && i > 0,
        wormCount,
        wormNames: wormNames[i],
      });
    }
    
    const config: GameConfig = {
      teams,
      mapId,
      turnTime,
      roundTime: 600,
      windEnabled: true,
      suddenDeathTurns: 50,
      splatterLevel: settings.splatter,
      particleDensity: settings.particles,
      screenShake: settings.screenShake,
      difficulty,
    };
    
    onStart(config);
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900" />
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-full h-full" style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 50px, rgba(255,255,255,0.03) 50px, rgba(255,255,255,0.03) 51px), repeating-linear-gradient(90deg, transparent, transparent 50px, rgba(255,255,255,0.03) 50px, rgba(255,255,255,0.03) 51px)',
        }} />
      </div>
      
      {/* Title */}
      <div className="relative z-10 text-center mb-8">
        <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-yellow-500 to-red-500 tracking-wider drop-shadow-lg"
          style={{ textShadow: '0 0 40px rgba(255,100,0,0.3)' }}>
          WURMKIEG
        </h1>
        <p className="text-gray-400 text-sm mt-2 tracking-widest uppercase">Taktischer Artillerie-Shooter</p>
      </div>
      
      {/* Game Setup */}
      <div className="relative z-10 bg-gray-800/80 backdrop-blur-sm border border-gray-700 rounded-xl p-6 w-[500px] max-w-[90vw] shadow-2xl">
        {/* Game Mode */}
        <div className="mb-4">
          <label className="text-gray-300 text-sm font-medium block mb-2">Spielmodus</label>
          <div className="flex gap-2">
            <button
              onClick={() => setGameMode('ai')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                gameMode === 'ai' ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              🤖 Gegen KI
            </button>
            <button
              onClick={() => setGameMode('local')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                gameMode === 'local' ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              👥 Lokal Multiplayer
            </button>
          </div>
        </div>
        
        {/* Map Selection */}
        <div className="mb-4">
          <label className="text-gray-300 text-sm font-medium block mb-2">Karte</label>
          <div className="grid grid-cols-2 gap-2">
            {maps.map(m => (
              <button
                key={m.id}
                onClick={() => setMapId(m.id)}
                className={`py-2 px-3 rounded-lg text-left transition-all ${
                  mapId === m.id ? 'bg-red-600/80 text-white border border-red-400' : 'bg-gray-700 text-gray-300 hover:bg-gray-600 border border-transparent'
                }`}
              >
                <div className="font-medium text-sm">{m.name}</div>
                <div className="text-xs opacity-70">{m.desc}</div>
              </button>
            ))}
          </div>
        </div>
        
        {/* Settings Row */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-gray-300 text-sm font-medium block mb-1">Schwierigkeit</label>
            <select
              value={difficulty}
              onChange={e => setDifficulty(e.target.value as any)}
              className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm border border-gray-600"
            >
              <option value="easy">Einfach</option>
              <option value="normal">Normal</option>
              <option value="hard">Schwer</option>
            </select>
          </div>
          <div>
            <label className="text-gray-300 text-sm font-medium block mb-1">Teams</label>
            <select
              value={teamCount}
              onChange={e => setTeamCount(Number(e.target.value))}
              className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm border border-gray-600"
            >
              <option value={2}>2 Teams</option>
              <option value={3}>3 Teams</option>
              <option value={4}>4 Teams</option>
            </select>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="text-gray-300 text-sm font-medium block mb-1">Würmer pro Team</label>
            <select
              value={wormCount}
              onChange={e => setWormCount(Number(e.target.value))}
              className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm border border-gray-600"
            >
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
            </select>
          </div>
          <div>
            <label className="text-gray-300 text-sm font-medium block mb-1">Zugzeit (Sek.)</label>
            <select
              value={turnTime}
              onChange={e => setTurnTime(Number(e.target.value))}
              className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm border border-gray-600"
            >
              <option value={15}>15</option>
              <option value={30}>30</option>
              <option value={45}>45</option>
              <option value={60}>60</option>
            </select>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleStart}
            className="flex-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold py-3 px-6 rounded-lg transition-all shadow-lg hover:shadow-red-500/20 active:scale-95"
          >
            ⚔️ GEFECHT STARTEN
          </button>
          <button
            onClick={onSettings}
            className="bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium py-3 px-4 rounded-lg transition-all"
          >
            ⚙️
          </button>
        </div>
      </div>
      
      {/* Controls hint */}
      <div className="relative z-10 mt-6 text-center text-gray-500 text-xs">
        <p>Steuerung: ← → Bewegen | ↑ Springen | Maus Zielen | Klick Schießen | Q/E Waffen wechseln</p>
      </div>
    </div>
  );
}

// ============ GAME SCREEN ============
function GameScreen({ config, onBack, onGameOver, settings }: {
  config: GameConfig;
  onBack: () => void;
  onGameOver: (team: Team) => void;
  settings: any;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const rendererRef = useRef<GameRenderer | null>(null);
  const [hudState, setHudState] = useState({
    phase: GamePhase.MENU,
    turnTimer: 30,
    currentTeam: 0,
    currentWorm: '',
    wind: 0,
    weapons: [] as { id: string; ammo: number; cooldown: number }[],
    currentWeapon: '',
    power: 50,
    angle: 0,
    teams: [] as { name: string; color: string; worms: { name: string; health: number; alive: boolean }[] }[],
  });
  const [paused, setPaused] = useState(false);
  const [showWeaponPanel, setShowWeaponPanel] = useState(false);
  const [turnNotification, setTurnNotification] = useState<string | null>(null);
  const prevTeamRef = useRef<number>(-1);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Set canvas size
    const w = Math.min(1200, window.innerWidth);
    const h = Math.min(700, window.innerHeight - 80);
    canvas.width = w;
    canvas.height = h;
    
    // Create engine
    const engine = new GameEngine();
    engine.setCanvasSize(w, h);
    engine.init(config);
    engineRef.current = engine;
    
    // Create renderer
    const renderer = new GameRenderer(canvas, engine);
    rendererRef.current = renderer;
    
    // Callbacks
    engine.onExplosion = (pos, radius) => {
      audioManager.playExplosion(radius / 50);
      renderer.markTerrainDirty();
    };
    
    engine.onDamage = () => {
      audioManager.playHit();
    };
    
    engine.onTurnChange = (teamId, wormName) => {
      audioManager.playTurnStart();
      const team = engine.teams[teamId];
      if (team) {
        setTurnNotification(`${team.name}: ${wormName} ist am Zug`);
        setTimeout(() => setTurnNotification(null), 1500);
      }
    };
    
    engine.onGameOver = (team) => {
      onGameOver(team);
    };
    
    engine.onStateChange = () => {
      // Update HUD state
      const worm = engine.getCurrentWorm();
      setHudState({
        phase: engine.phase,
        turnTimer: engine.turnTimer,
        currentTeam: engine.currentTeamIndex,
        currentWorm: worm?.name || '',
        wind: engine.getWindForce(),
        weapons: worm?.weapons.filter(w => w.ammo > 0).map(w => ({
          id: w.weaponId,
          ammo: w.ammo,
          cooldown: w.cooldown,
        })) || [],
        currentWeapon: worm?.currentWeapon || '',
        power: engine.input.power,
        angle: engine.input.angle,
        teams: engine.teams.map(t => ({
          name: t.name,
          color: t.color,
          worms: t.worms.map(w => ({
            name: w.name,
            health: w.health,
            alive: w.isAlive,
          })),
        })),
      });
      
      // Terrain re-rendering is handled by version tracking in renderer
    };
    
    // Input handling
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPaused(p => !p);
        engine.phase = engine.phase === GamePhase.PAUSED ? GamePhase.PLAYING : GamePhase.PAUSED;
        return;
      }
      engine.input.keys.add(e.key);
      
      if (e.key === 'Tab') {
        e.preventDefault();
        setShowWeaponPanel(p => !p);
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      engine.input.keys.delete(e.key);
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      engine.input.mouseX = mx;
      engine.input.mouseY = my;
      
      // Update aim angle based on mouse
      const worm = engine.getCurrentWorm();
      if (worm && (engine.phase === GamePhase.PLAYING || engine.phase === GamePhase.AIMING)) {
        const dx = mx - (worm.pos.x - engine.camera.x);
        const dy = my - (worm.pos.y - engine.camera.y);
        engine.input.angle = Math.atan2(dy, Math.abs(dx));
        engine.input.angle = Math.max(-Math.PI * 0.8, Math.min(Math.PI * 0.3, engine.input.angle));
        engine.input.angle = Math.max(-Math.PI / 2 - 0.3, Math.min(0.3, engine.input.angle));
      }
    };
    
    const handleMouseDown = (e: MouseEvent) => {
      audioManager.init();
      audioManager.resume();
      engine.input.mouseDown = true;
      
      if (engine.phase === GamePhase.PLAYING || engine.phase === GamePhase.AIMING) {
        const team = engine.getActiveTeam();
        if (team && !team.isAI) {
          engine.input.charging = true;
          engine.phase = GamePhase.AIMING;
        }
      }
    };
    
    const handleMouseUp = () => {
      engine.input.mouseDown = false;
      
      if (engine.input.charging && (engine.phase === GamePhase.AIMING)) {
        engine.input.charging = false;
        const team = engine.getActiveTeam();
        if (team && !team.isAI) {
          const weaponDef = WEAPONS[engine.getCurrentWorm()?.currentWeapon || ''];
          if (weaponDef?.type === 'beam') {
            engine.fireWeapon();
          } else {
            engine.fireWeapon();
          }
          const weaponType = engine.getCurrentWorm()?.currentWeapon || '';
          if (weaponType.includes('rocket') || weaponType.includes('bazooka')) {
            audioManager.playShoot('rocket');
          } else if (weaponType === 'laser') {
            audioManager.playShoot('laser');
          } else if (weaponType === 'gatlingGun') {
            audioManager.playShoot('gatling');
          } else if (weaponType === 'shotgun') {
            audioManager.playShoot('shotgun');
          } else if (weaponType === 'chainsaw') {
            audioManager.playShoot('chainsaw');
          } else {
            audioManager.playShoot();
          }
        }
      }
    };
    
    // Touch handling
    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      audioManager.init();
      audioManager.resume();
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      engine.input.mouseX = touch.clientX - rect.left;
      engine.input.mouseY = touch.clientY - rect.top;
      engine.input.mouseDown = true;
      
      if (engine.phase === GamePhase.PLAYING || engine.phase === GamePhase.AIMING) {
        const team = engine.getActiveTeam();
        if (team && !team.isAI) {
          engine.input.charging = true;
          engine.phase = GamePhase.AIMING;
        }
      }
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const mx = touch.clientX - rect.left;
      const my = touch.clientY - rect.top;
      engine.input.mouseX = mx;
      engine.input.mouseY = my;
      
      const worm = engine.getCurrentWorm();
      if (worm) {
        const dx = mx - (worm.pos.x - engine.camera.x);
        const dy = my - (worm.pos.y - engine.camera.y);
        engine.input.angle = Math.atan2(dy, Math.abs(dx));
        engine.input.angle = Math.max(-Math.PI / 2 - 0.3, Math.min(0.3, engine.input.angle));
      }
    };
    
    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      engine.input.mouseDown = false;
      if (engine.input.charging) {
        engine.input.charging = false;
        engine.fireWeapon();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    
    // Prevent context menu
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    
    // Start game loop
    engine.start();
    
    // Render loop
    let renderId: number;
    const renderLoop = () => {
      renderer.render();
      renderId = requestAnimationFrame(renderLoop);
    };
    renderId = requestAnimationFrame(renderLoop);
    
    return () => {
      engine.stop();
      cancelAnimationFrame(renderId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, [config]);

  const handleWeaponSelect = (weaponId: string) => {
    const engine = engineRef.current;
    if (!engine) return;
    const worm = engine.getCurrentWorm();
    if (worm) {
      worm.currentWeapon = weaponId;
      audioManager.playSelect();
    }
    setShowWeaponPanel(false);
  };

  const teamColors: Record<string, string> = {
    red: '#cc3333',
    blue: '#3355cc',
    green: '#33aa33',
    yellow: '#ccaa33',
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Top HUD */}
      <div className="h-16 bg-gray-900/90 border-b border-gray-700 flex items-center px-4 gap-4 shrink-0">
        {/* Team info */}
        <div className="flex gap-3">
          {hudState.teams.map((team, i) => (
            <div key={i} className={`flex items-center gap-1 px-2 py-1 rounded ${
              i === hudState.currentTeam ? 'bg-gray-700 ring-1 ring-white/30' : ''
            }`}>
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: teamColors[team.color] }} />
              <span className="text-white text-xs font-medium">{team.name}</span>
              <span className="text-gray-400 text-xs">
                {team.worms.filter(w => w.alive).length}/{team.worms.length}
              </span>
            </div>
          ))}
        </div>
        
        {/* Turn info */}
        <div className="flex-1 text-center">
          {hudState.phase === GamePhase.GAME_OVER ? (
            <span className="text-yellow-400 font-bold text-lg">GEFECHT BEENDET</span>
          ) : (
            <>
              <div className="text-white text-sm font-medium">{hudState.currentWorm}</div>
              <div className={`text-lg font-mono font-bold ${
                hudState.turnTimer < 10 ? 'text-red-400 animate-pulse' : 'text-gray-300'
              }`}>
                {Math.ceil(hudState.turnTimer)}s
              </div>
            </>
          )}
        </div>
        
        {/* Phase indicator */}
        <div className="text-right">
          <div className="text-xs text-gray-400">
            {hudState.phase === GamePhase.PLAYING && 'Bewegen / Zielen'}
            {hudState.phase === GamePhase.AIMING && '⚡ Aufladen...'}
            {hudState.phase === GamePhase.SIMULATING && '⏳ Simulation...'}
            {hudState.phase === GamePhase.FIRING && '🔥 Feuern!'}
            {hudState.phase === GamePhase.TURN_TRANSITION && 'Wechsel...'}
            {hudState.phase === GamePhase.PAUSED && '⏸ PAUSE'}
          </div>
          <button
            onClick={() => {
              setPaused(p => !p);
              if (engineRef.current) {
                engineRef.current.phase = engineRef.current.phase === GamePhase.PAUSED ? GamePhase.PLAYING : GamePhase.PAUSED;
              }
            }}
            className="text-gray-400 hover:text-white text-sm mt-1"
          >
            {paused ? '▶ Weiter' : '⏸ Pause'}
          </button>
        </div>
      </div>
      
      {/* Game Canvas */}
      <div className="flex-1 flex items-center justify-center bg-black relative">
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-full cursor-crosshair"
          style={{ imageRendering: 'auto' }}
        />
        
        {/* Weapon Panel Overlay */}
        {showWeaponPanel && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20">
            <div className="bg-gray-800 border border-gray-600 rounded-xl p-4 max-w-[600px] max-h-[80vh] overflow-y-auto">
              <h3 className="text-white font-bold mb-3 text-center">Waffenarsenal</h3>
              <div className="grid grid-cols-3 gap-2">
                {hudState.weapons.map(w => {
                  const def = WEAPONS[w.id];
                  if (!def) return null;
                  return (
                    <button
                      key={w.id}
                      onClick={() => handleWeaponSelect(w.id)}
                      className={`p-2 rounded-lg text-left transition-all ${
                        w.id === hudState.currentWeapon
                          ? 'bg-red-600/50 border border-red-400'
                          : 'bg-gray-700 hover:bg-gray-600 border border-transparent'
                      }`}
                    >
                      <div className="text-lg">{def.icon}</div>
                      <div className="text-white text-xs font-medium truncate">{def.name}</div>
                      <div className="text-gray-400 text-xs">×{w.ammo}</div>
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setShowWeaponPanel(false)}
                className="mt-3 w-full bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg text-sm"
              >
                Schließen (Tab)
              </button>
            </div>
          </div>
        )}
        
        {/* Turn Notification */}
        {turnNotification && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 animate-bounce">
            <div className="bg-black/80 border border-yellow-500/50 rounded-lg px-6 py-3 text-center shadow-lg">
              <div className="text-yellow-400 font-bold text-lg">{turnNotification}</div>
            </div>
          </div>
        )}
        
        {/* Pause Overlay */}
        {paused && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-30">
            <div className="bg-gray-800 border border-gray-600 rounded-xl p-8 text-center">
              <h2 className="text-white text-2xl font-bold mb-4">⏸ PAUSE</h2>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    setPaused(false);
                    if (engineRef.current) engineRef.current.phase = GamePhase.PLAYING;
                  }}
                  className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-6 rounded-lg"
                >
                  Weiterspielen
                </button>
                <button
                  onClick={() => {
                    if (engineRef.current) {
                      engineRef.current.restart();
                      setPaused(false);
                    }
                  }}
                  className="bg-gray-700 hover:bg-gray-600 text-white py-2 px-6 rounded-lg"
                >
                  Neustart
                </button>
                <button
                  onClick={onBack}
                  className="bg-gray-700 hover:bg-gray-600 text-white py-2 px-6 rounded-lg"
                >
                  Hauptmenü
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Bottom HUD */}
      <div className="h-16 bg-gray-900/90 border-t border-gray-700 flex items-center px-4 gap-4 shrink-0">
        {/* Current weapon */}
        <div className="flex items-center gap-2">
          {hudState.currentWeapon && WEAPONS[hudState.currentWeapon] && (
            <>
              <span className="text-2xl">{WEAPONS[hudState.currentWeapon].icon}</span>
              <div>
                <div className="text-white text-sm font-medium">{WEAPONS[hudState.currentWeapon].name}</div>
                <div className="text-gray-400 text-xs">
                  {hudState.weapons.find(w => w.id === hudState.currentWeapon)?.ammo || 0} übrig
                </div>
              </div>
            </>
          )}
        </div>
        
        {/* Power bar */}
        <div className="flex-1 max-w-[200px]">
          <div className="text-gray-400 text-xs mb-1">Stärke</div>
          <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${hudState.power}%`,
                backgroundColor: hudState.power < 30 ? '#44ff44' : hudState.power < 70 ? '#ffaa00' : '#ff3333',
              }}
            />
          </div>
        </div>
        
        {/* Quick weapon switch */}
        <div className="flex gap-1 overflow-x-auto">
          {hudState.weapons.slice(0, 8).map(w => {
            const def = WEAPONS[w.id];
            if (!def) return null;
            return (
              <button
                key={w.id}
                onClick={() => handleWeaponSelect(w.id)}
                className={`w-8 h-8 flex items-center justify-center rounded text-sm transition-all ${
                  w.id === hudState.currentWeapon
                    ? 'bg-red-600 ring-1 ring-red-400'
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
                title={def.name}
              >
                {def.icon}
              </button>
            );
          })}
          <button
            onClick={() => setShowWeaponPanel(true)}
            className="w-8 h-8 flex items-center justify-center rounded text-sm bg-gray-700 hover:bg-gray-600 text-gray-300"
            title="Alle Waffen (Tab)"
          >
            ⋯
          </button>
        </div>
        
        {/* Back button */}
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-white text-sm ml-auto"
        >
          ← Menü
        </button>
      </div>
    </div>
  );
}

// ============ SETTINGS SCREEN ============
function SettingsScreen({ settings, onChange, onBack }: {
  settings: any;
  onChange: (s: any) => void;
  onBack: () => void;
}) {
  return (
    <div className="w-full h-full flex items-center justify-center bg-gray-900">
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 w-[400px] max-w-[90vw]">
        <h2 className="text-white text-2xl font-bold mb-6 text-center">⚙️ Einstellungen</h2>
        
        <div className="space-y-4">
          <div>
            <label className="text-gray-300 text-sm block mb-1">Master-Lautstärke</label>
            <input
              type="range"
              min="0"
              max="100"
              value={settings.masterVolume * 100}
              onChange={e => {
                const v = Number(e.target.value) / 100;
                onChange({ ...settings, masterVolume: v });
                audioManager.setMasterVolume(v);
              }}
              className="w-full"
            />
          </div>
          
          <div>
            <label className="text-gray-300 text-sm block mb-1">Effekt-Lautstärke</label>
            <input
              type="range"
              min="0"
              max="100"
              value={settings.sfxVolume * 100}
              onChange={e => {
                const v = Number(e.target.value) / 100;
                onChange({ ...settings, sfxVolume: v });
                audioManager.setSfxVolume(v);
              }}
              className="w-full"
            />
          </div>
          
          <div>
            <label className="text-gray-300 text-sm block mb-1">Splatter-Intensität</label>
            <select
              value={settings.splatter}
              onChange={e => onChange({ ...settings, splatter: e.target.value })}
              className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 border border-gray-600"
            >
              <option value="off">Aus</option>
              <option value="low">Reduziert</option>
              <option value="normal">Normal</option>
              <option value="high">Hoch</option>
            </select>
          </div>
          
          <div>
            <label className="text-gray-300 text-sm block mb-1">Partikeldichte</label>
            <input
              type="range"
              min="20"
              max="100"
              value={settings.particles * 100}
              onChange={e => onChange({ ...settings, particles: Number(e.target.value) / 100 })}
              className="w-full"
            />
          </div>
          
          <div className="flex items-center justify-between">
            <label className="text-gray-300 text-sm">Bildschirmverwacklung</label>
            <input
              type="checkbox"
              checked={settings.screenShake}
              onChange={e => onChange({ ...settings, screenShake: e.target.checked })}
              className="w-5 h-5"
            />
          </div>
        </div>
        
        <button
          onClick={onBack}
          className="mt-6 w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 rounded-lg transition-all"
        >
          Zurück
        </button>
      </div>
    </div>
  );
}

// ============ RESULTS SCREEN ============
function ResultsScreen({ winner, config, onRestart, onMenu }: {
  winner: Team;
  config: GameConfig;
  onRestart: () => void;
  onMenu: () => void;
}) {
  const teamColors: Record<string, string> = {
    red: '#cc3333',
    blue: '#3355cc',
    green: '#33aa33',
    yellow: '#ccaa33',
  };

  return (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900">
      <div className="text-center">
        <div className="text-6xl mb-4">🏆</div>
        <h1 className="text-4xl font-black text-white mb-2">SIEG!</h1>
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-5 h-5 rounded-full" style={{ backgroundColor: teamColors[winner.color] }} />
          <span className="text-2xl font-bold" style={{ color: teamColors[winner.color] }}>
            {winner.name}
          </span>
        </div>
        
        <div className="bg-gray-800/50 rounded-xl p-4 mb-6 inline-block">
          <div className="text-gray-300 text-sm mb-2">Überlebende Würmer:</div>
          <div className="flex gap-2 justify-center">
            {winner.worms.filter(w => w.isAlive).map(w => (
              <span key={w.id} className="bg-gray-700 px-2 py-1 rounded text-white text-sm">
                {w.name} ({w.health}HP)
              </span>
            ))}
          </div>
        </div>
        
        <div className="flex gap-3 justify-center">
          <button
            onClick={onRestart}
            className="bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-8 rounded-lg transition-all"
          >
            🔄 Nochmal spielen
          </button>
          <button
            onClick={onMenu}
            className="bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 px-6 rounded-lg transition-all"
          >
            Hauptmenü
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
