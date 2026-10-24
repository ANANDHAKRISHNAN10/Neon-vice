import {
  MISSIONS,
  OUTFIT_CATALOG,
  VEHICLE_SPECS,
  WATER_EAST_X,
  WEAPON_SPECS,
} from '../constants';
import {
  fetchPubChemCompound,
  PRESET_LAB_COMPOUNDS,
  PubChemCompoundProfile,
} from '../services/BioChemService';
import {
  ActiveNPC,
  ActiveVehicle,
  BusinessProperty,
  CollectiblePackage,
  GameMode,
  NPCRole,
  VehicleClass,
  WeaponId,
  WeaponState,
  WeatherType,
} from '../types';

export interface HUDCallbacks {
  onStartNewGame: () => void;
  onContinueGame: () => void;
  onSaveGame: () => void;
  onSelectWeapon: (id: WeaponId) => void;
  onBuyWeaponOrAmmo: (id: WeaponId) => void;
  onBuyArmor: () => void;
  onEquipOutfit: (outfitId: string) => void;
  onSpawnGarageVehicle: (vClass: VehicleClass) => void;
  onResprayAndClearWanted: () => void;
  onBuyBusiness: (bizId: string) => void;
  onSetWeather: (weather: WeatherType) => void;
  onCycleRadio: () => void;
  onToggleMute: () => void;
  onSetVolume: (v: number) => void;
  onSetSensitivity: (s: number) => void;
  onSetMode: (mode: GameMode) => void;
  onRestartMission: () => void;
  onCompoundVerified: (compoundName: string) => void;
}

export interface HUDStateSnapshot {
  mode: GameMode;
  hasSaveData: boolean;
  cash: number;
  reputation: number;
  health: number;
  maxHealth: number;
  armor: number;
  maxArmor: number;
  wantedLevel: number;
  wantedCooldownProgress: number;
  activeWeapon: WeaponState;
  allWeapons: WeaponState[];
  isReloading: boolean;
  playerPos: { x: number; z: number };
  playerHeading: number;
  drivingVehicle: ActiveVehicle | null;
  radioName: string;
  radioGenre: string;
  activeMissionTitle: string;
  activeStepInstruction: string;
  missionTargetPos: { x: number; z: number } | null;
  missionTimerRemaining: number | null;
  contextPrompt: string | null;
  activeShopTab: 'armory' | 'safehouse' | 'garage' | 'empire';
  dialogueSpeaker: string | null;
  dialogueText: string | null;
  notificationBanner: string | null;
  districtName: string;
  weather: WeatherType;
  timeOfDay: number;
  muted: boolean;
  volume: number;
  mouseSensitivity: number;
  vehicles: ActiveVehicle[];
  npcs: ActiveNPC[];
  businesses: BusinessProperty[];
  collectibles: CollectiblePackage[];
  ownedOutfitIds: string[];
  activeOutfitId: string;
  storedVehicles: VehicleClass[];
  completedMissionIds: string[];
}

export class GameHUD {
  private root: HTMLElement;
  private callbacks: HUDCallbacks;
  private minimapCanvas!: HTMLCanvasElement;
  private minimapCtx!: CanvasRenderingContext2D;
  private fullMapCanvas!: HTMLCanvasElement;
  private fullMapCtx!: CanvasRenderingContext2D;

  // Dynamic DOM refs for zero-flicker 60fps updates
  private titleOverlay!: HTMLElement;
  private playHudOverlay!: HTMLElement;
  private modalContainer!: HTMLElement;
  private bottomDock!: HTMLElement;
  private dockCollapsed = false;

  private cashEl!: HTMLElement;
  private repEl!: HTMLElement;
  private wantedStarsEl!: HTMLElement;
  private healthBarEl!: HTMLElement;
  private healthNumEl!: HTMLElement;
  private armorBarEl!: HTMLElement;
  private armorNumEl!: HTMLElement;
  private weaponNameEl!: HTMLElement;
  private weaponAmmoEl!: HTMLElement;
  private speedClusterEl!: HTMLElement;
  private speedNumEl!: HTMLElement;
  private vehicleNameEl!: HTMLElement;
  private radioEl!: HTMLElement;
  private districtEl!: HTMLElement;
  private missionBoxEl!: HTMLElement;
  private missionTitleEl!: HTMLElement;
  private missionDescEl!: HTMLElement;
  private missionTimerEl!: HTMLElement;
  private contextPromptEl!: HTMLElement;
  private dialogueBoxEl!: HTMLElement;
  private dialogueSpeakerEl!: HTMLElement;
  private dialogueTextEl!: HTMLElement;
  private toastBannerEl!: HTMLElement;

  private lastRenderedMode: GameMode | null = null;
  private lastShopTab = '';
  private currentLabProfile: PubChemCompoundProfile | null = null;
  private labLoading = false;
  private labError: string | null = null;
  private lastSnapshot: HUDStateSnapshot | null = null;

  constructor(callbacks: HUDCallbacks) {
    this.callbacks = callbacks;
    this.root = document.createElement('div');
    this.root.id = 'neon-vice-ui-shell';
    document.body.appendChild(this.root);
    this.buildDOM();
  }

  private buildDOM() {
    this.root.innerHTML = `
      <!-- 1. TITLE SCREEN -->
      <div id="nv-title-screen" class="nv-overlay-screen">
        <div class="nv-title-scrim">
          <div class="nv-title-content">
            <div class="nv-kicker">1986 TROPICAL OPEN-WORLD ACTION</div>
            <svg class="nv-logo-svg" viewBox="0 0 680 150" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Neon Vice">
              <defs>
                <linearGradient id="nvGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#00F0FF" />
                  <stop offset="50%" stop-color="#FF2A85" />
                  <stop offset="100%" stop-color="#FFBE0B" />
                </linearGradient>
              </defs>
              <text x="50%" y="92" text-anchor="middle" fill="url(#nvGrad)" font-family="'Chakra Petch', sans-serif" font-weight="700" font-style="italic" font-size="92" letter-spacing="6">NEON VICE</text>
              <line x1="90" y1="114" x2="590" y2="114" stroke="#00F0FF" stroke-width="3" stroke-opacity="0.7" />
              <text x="50%" y="140" text-anchor="middle" fill="#F8FAFC" font-family="'Plus Jakarta Sans', sans-serif" font-weight="600" font-size="16" letter-spacing="10">CITY OF SYNDICATES &amp; SUNSETS</text>
            </svg>
            <p class="nv-title-subtitle">
              Explore Ocean Drive, Vice Downtown, Starlight West, and Port Vice Harbor. Command 6 vehicle classes, tune into 4 procedural synthwave radio stations, survive 5-star police pursuits, and build your empire.
            </p>
            <div class="nv-title-actions">
              <button id="btn-start-game" class="nv-btn nv-btn-primary">Start New Game (Enter)</button>
              <button id="btn-continue-game" class="nv-btn nv-btn-secondary">Continue Saved Empire</button>
              <button id="btn-title-biochem" class="nv-btn nv-btn-ghost">Bio-Chem Forensic Lab</button>
            </div>
            <div class="nv-control-hint-line">
              WASD Move / Drive · Mouse Aim &amp; Look · E / F Enter Vehicle or Interact · Space Jump / Drift · Tab Weapon Wheel · M City Map · Esc Pause
            </div>
          </div>
        </div>
      </div>

      <!-- 2. ACTIVE PLAYFIELD HUD (LOW OCCLUSION) -->
      <div id="nv-play-hud" class="nv-hud-layer" style="display: none;">
        <!-- Top-Left Mission Objective & District -->
        <div class="nv-top-left-cluster">
          <div class="nv-district-line">
            <span id="nv-hud-district">Ocean Drive Beach</span>
            <span aria-hidden="true">·</span>
            <span id="nv-hud-radio">FLASH 86.5 FM</span>
          </div>
          <div id="nv-mission-box" class="nv-mission-card">
            <div class="nv-mission-header">
              <span id="nv-mission-title" class="nv-mission-title">01. Neon Arrival</span>
              <span id="nv-mission-timer" class="nv-mission-timer tabular-nums" style="display: none;">01:30</span>
            </div>
            <div id="nv-mission-desc" class="nv-mission-desc">Head to the Downtown Plaza marker and pick up the stashed Sports Car.</div>
          </div>
        </div>

        <!-- Top-Center Notification Toast -->
        <div id="nv-toast-banner" class="nv-toast-banner" style="display: none;"></div>

        <!-- Top-Right Status Cluster (Wanted, Cash, Health, Armor, Weapon) -->
        <div class="nv-top-right-cluster">
          <div id="nv-wanted-stars" class="nv-wanted-row" aria-label="Wanted level"></div>
          <div class="nv-money-row tabular-nums">
            <span id="nv-hud-cash" class="nv-cash-text">$500</span>
            <span aria-hidden="true">·</span>
            <span id="nv-hud-rep" class="nv-rep-text">REP 0</span>
          </div>
          <div class="nv-bars-stack">
            <div class="nv-bar-row">
              <span class="nv-bar-label">HP</span>
              <div class="nv-bar-track"><div id="nv-health-fill" class="nv-bar-fill nv-fill-health" style="width: 100%;"></div></div>
              <span id="nv-health-num" class="nv-bar-num tabular-nums">100</span>
            </div>
            <div class="nv-bar-row">
              <span class="nv-bar-label">AR</span>
              <div class="nv-bar-track"><div id="nv-armor-fill" class="nv-bar-fill nv-fill-armor" style="width: 50%;"></div></div>
              <span id="nv-armor-num" class="nv-bar-num tabular-nums">50</span>
            </div>
          </div>
          <div class="nv-weapon-readout">
            <span id="nv-weapon-name" class="nv-weapon-name">Vice 9mm Auto</span>
            <span id="nv-weapon-ammo" class="nv-weapon-ammo tabular-nums">15 / 90</span>
          </div>
        </div>

        <!-- Center Crosshair Reticle -->
        <div class="nv-crosshair" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="2" fill="#00F0FF"/>
            <line x1="12" y1="2" x2="12" y2="7" stroke="#F8FAFC" stroke-width="1.5" stroke-opacity="0.8"/>
            <line x1="12" y1="17" x2="12" y2="22" stroke="#F8FAFC" stroke-width="1.5" stroke-opacity="0.8"/>
            <line x1="2" y1="12" x2="7" y2="12" stroke="#F8FAFC" stroke-width="1.5" stroke-opacity="0.8"/>
            <line x1="17" y1="12" x2="22" y2="12" stroke="#F8FAFC" stroke-width="1.5" stroke-opacity="0.8"/>
          </svg>
        </div>

        <!-- Bottom-Left Circular Minimap Radar -->
        <div class="nv-minimap-wrapper">
          <canvas id="nv-minimap-canvas" width="184" height="184"></canvas>
          <div class="nv-minimap-footer">
            <span>N</span>
            <span>·</span>
            <span>Press M for City Map</span>
          </div>
        </div>

        <!-- Bottom-Right Speedometer Cluster (Visible when Driving) -->
        <div id="nv-speed-cluster" class="nv-speed-cluster" style="display: none;">
          <div id="nv-vehicle-name" class="nv-vehicle-label">Cheetah Testarossa 86</div>
          <div class="nv-speed-readout">
            <span id="nv-speed-num" class="nv-speed-num tabular-nums">084</span>
            <span class="nv-speed-unit">MPH</span>
          </div>
          <div class="nv-speed-sub">Q Radio · Space Drift · E Exit</div>
        </div>

        <!-- Contextual Action Prompt & Character Dialogue -->
        <div class="nv-bottom-center-stack">
          <div id="nv-context-prompt" class="nv-context-prompt" style="display: none;"></div>
          <div id="nv-dialogue-box" class="nv-dialogue-box" style="display: none;">
            <span id="nv-dialogue-speaker" class="nv-dialogue-speaker">Sonny Cortez:</span>
            <span id="nv-dialogue-text" class="nv-dialogue-text"></span>
          </div>
        </div>

        <!-- Unified Collapsible Bottom Control Dock -->
        <div id="nv-bottom-dock" class="nv-bottom-dock">
          <button id="btn-toggle-dock" class="nv-dock-toggle">▾ Hide Controls (H)</button>
          <div id="nv-dock-body" class="nv-dock-body">
            <button id="dock-btn-weapons" class="nv-dock-btn">Weapons (Tab)</button>
            <button id="dock-btn-map" class="nv-dock-btn">City Map (M)</button>
            <button id="dock-btn-shop" class="nv-dock-btn">Armory &amp; Empire</button>
            <button id="dock-btn-biochem" class="nv-dock-btn">Bio-Chem Lab</button>
            <button id="dock-btn-weather" class="nv-dock-btn">Atmosphere</button>
            <button id="dock-btn-radio" class="nv-dock-btn">Tune Radio (Q)</button>
            <button id="dock-btn-mute" class="nv-dock-btn">Audio On</button>
            <button id="dock-btn-pause" class="nv-dock-btn">Menu (Esc)</button>
          </div>
        </div>
      </div>

      <!-- 3. MODAL CONTAINER (MAP, WEAPON WHEEL, SHOP, BIO-CHEM LAB, PAUSE, WASTED) -->
      <div id="nv-modal-container" class="nv-modal-backdrop" style="display: none;"></div>
    `;

    this.titleOverlay = this.root.querySelector('#nv-title-screen')!;
    this.playHudOverlay = this.root.querySelector('#nv-play-hud')!;
    this.modalContainer = this.root.querySelector('#nv-modal-container')!;
    this.bottomDock = this.root.querySelector('#nv-bottom-dock')!;

    this.cashEl = this.root.querySelector('#nv-hud-cash')!;
    this.repEl = this.root.querySelector('#nv-hud-rep')!;
    this.wantedStarsEl = this.root.querySelector('#nv-wanted-stars')!;
    this.healthBarEl = this.root.querySelector('#nv-health-fill')!;
    this.healthNumEl = this.root.querySelector('#nv-health-num')!;
    this.armorBarEl = this.root.querySelector('#nv-armor-fill')!;
    this.armorNumEl = this.root.querySelector('#nv-armor-num')!;
    this.weaponNameEl = this.root.querySelector('#nv-weapon-name')!;
    this.weaponAmmoEl = this.root.querySelector('#nv-weapon-ammo')!;
    this.speedClusterEl = this.root.querySelector('#nv-speed-cluster')!;
    this.speedNumEl = this.root.querySelector('#nv-speed-num')!;
    this.vehicleNameEl = this.root.querySelector('#nv-vehicle-name')!;
    this.radioEl = this.root.querySelector('#nv-hud-radio')!;
    this.districtEl = this.root.querySelector('#nv-hud-district')!;
    this.missionBoxEl = this.root.querySelector('#nv-mission-box')!;
    this.missionTitleEl = this.root.querySelector('#nv-mission-title')!;
    this.missionDescEl = this.root.querySelector('#nv-mission-desc')!;
    this.missionTimerEl = this.root.querySelector('#nv-mission-timer')!;
    this.contextPromptEl = this.root.querySelector('#nv-context-prompt')!;
    this.dialogueBoxEl = this.root.querySelector('#nv-dialogue-box')!;
    this.dialogueSpeakerEl = this.root.querySelector('#nv-dialogue-speaker')!;
    this.dialogueTextEl = this.root.querySelector('#nv-dialogue-text')!;
    this.toastBannerEl = this.root.querySelector('#nv-toast-banner')!;

    this.minimapCanvas = this.root.querySelector('#nv-minimap-canvas')!;
    this.minimapCtx = this.minimapCanvas.getContext('2d')!;

    this.bindStaticEvents();
  }

  private bindStaticEvents() {
    this.root
      .querySelector('#btn-start-game')
      ?.addEventListener('click', () => this.callbacks.onStartNewGame());
    this.root
      .querySelector('#btn-continue-game')
      ?.addEventListener('click', () => this.callbacks.onContinueGame());
    this.root
      .querySelector('#btn-title-biochem')
      ?.addEventListener('click', () =>
        this.callbacks.onSetMode(GameMode.BIOCHEM_LAB),
      );

    const toggleDockBtn = this.root.querySelector('#btn-toggle-dock')!;
    const dockBody = this.root.querySelector('#nv-dock-body') as HTMLElement;
    toggleDockBtn.addEventListener('click', () => {
      this.toggleBottomDock(toggleDockBtn as HTMLElement, dockBody);
    });

    this.root
      .querySelector('#dock-btn-weapons')
      ?.addEventListener('click', () =>
        this.callbacks.onSetMode(GameMode.WEAPON_WHEEL),
      );
    this.root
      .querySelector('#dock-btn-map')
      ?.addEventListener('click', () => this.callbacks.onSetMode(GameMode.MAP));
    this.root
      .querySelector('#dock-btn-shop')
      ?.addEventListener('click', () =>
        this.callbacks.onSetMode(GameMode.SHOP),
      );
    this.root
      .querySelector('#dock-btn-biochem')
      ?.addEventListener('click', () =>
        this.callbacks.onSetMode(GameMode.BIOCHEM_LAB),
      );
    this.root
      .querySelector('#dock-btn-weather')
      ?.addEventListener('click', () => {
        if (!this.lastSnapshot) return;
        const order = [
          WeatherType.CLEAR_SUNSET,
          WeatherType.NEON_NIGHT,
          WeatherType.NEON_RAIN,
          WeatherType.TROPICAL_DAY,
        ];
        const next =
          order[(order.indexOf(this.lastSnapshot.weather) + 1) % order.length];
        this.callbacks.onSetWeather(next);
      });
    this.root
      .querySelector('#dock-btn-radio')
      ?.addEventListener('click', () => this.callbacks.onCycleRadio());
    this.root
      .querySelector('#dock-btn-mute')
      ?.addEventListener('click', () => this.callbacks.onToggleMute());
    this.root
      .querySelector('#dock-btn-pause')
      ?.addEventListener('click', () =>
        this.callbacks.onSetMode(GameMode.PAUSED),
      );
  }

  public toggleBottomDock(btnEl?: HTMLElement, bodyEl?: HTMLElement) {
    const btn =
      btnEl || (this.root.querySelector('#btn-toggle-dock') as HTMLElement);
    const body =
      bodyEl || (this.root.querySelector('#nv-dock-body') as HTMLElement);
    this.dockCollapsed = !this.dockCollapsed;
    body.style.display = this.dockCollapsed ? 'none' : 'flex';
    btn.textContent = this.dockCollapsed
      ? '▴ Show Controls (H)'
      : '▾ Hide Controls (H)';
  }

  public update(snap: HUDStateSnapshot) {
    this.lastSnapshot = snap;

    // 1. Toggle screen visibility
    this.titleOverlay.style.display =
      snap.mode === GameMode.TITLE ? 'flex' : 'none';
    this.playHudOverlay.style.display =
      snap.mode === GameMode.TITLE ? 'none' : 'block';

    const continueBtn = this.root.querySelector(
      '#btn-continue-game',
    ) as HTMLButtonElement | null;
    if (continueBtn) {
      continueBtn.style.display = snap.hasSaveData ? 'inline-flex' : 'none';
    }

    if (snap.mode === GameMode.TITLE) {
      this.modalContainer.style.display = 'none';
      this.lastRenderedMode = GameMode.TITLE;
      return;
    }

    // 2. Update perimeter readouts
    this.cashEl.textContent = `$${snap.cash.toLocaleString()}`;
    this.repEl.textContent = `REP ${snap.reputation}`;
    this.districtEl.textContent = snap.districtName;
    this.radioEl.textContent = snap.drivingVehicle
      ? `${snap.radioName}`
      : 'ON FOOT';

    const hpPct = Math.max(
      0,
      Math.min(100, (snap.health / snap.maxHealth) * 100),
    );
    this.healthBarEl.style.width = `${hpPct}%`;
    this.healthNumEl.textContent = `${Math.ceil(snap.health)}`;

    const arPct = Math.max(
      0,
      Math.min(100, (snap.armor / snap.maxArmor) * 100),
    );
    this.armorBarEl.style.width = `${arPct}%`;
    this.armorNumEl.textContent = `${Math.ceil(snap.armor)}`;

    this.weaponNameEl.textContent = snap.activeWeapon.spec.name;
    this.weaponAmmoEl.textContent = snap.activeWeapon.spec.isMelee
      ? 'MELEE'
      : snap.isReloading
        ? 'RELOADING...'
        : `${snap.activeWeapon.clipAmmo} / ${snap.activeWeapon.reserveAmmo}`;

    // Wanted stars
    let starsHtml = '';
    for (let i = 1; i <= 5; i++) {
      const active = i <= snap.wantedLevel;
      starsHtml += `<span class="nv-star ${active ? 'nv-star-active' : ''}">★</span>`;
    }
    if (this.wantedStarsEl.innerHTML !== starsHtml) {
      this.wantedStarsEl.innerHTML = starsHtml;
    }

    // Speedometer when driving
    if (snap.drivingVehicle) {
      this.speedClusterEl.style.display = 'flex';
      const mph = Math.round(Math.abs(snap.drivingVehicle.speed) * 3.2);
      this.speedNumEl.textContent = String(mph).padStart(3, '0');
      this.vehicleNameEl.textContent = snap.drivingVehicle.spec.name;
    } else {
      this.speedClusterEl.style.display = 'none';
    }

    // Mission box
    this.missionTitleEl.textContent = snap.activeMissionTitle;
    this.missionDescEl.textContent = snap.activeStepInstruction;
    if (snap.missionTimerRemaining !== null) {
      this.missionTimerEl.style.display = 'inline';
      const mins = Math.floor(snap.missionTimerRemaining / 60);
      const secs = Math.floor(snap.missionTimerRemaining % 60);
      this.missionTimerEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    } else {
      this.missionTimerEl.style.display = 'none';
    }

    // Contextual Prompt
    if (snap.contextPrompt) {
      this.contextPromptEl.style.display = 'block';
      this.contextPromptEl.textContent = snap.contextPrompt;
    } else {
      this.contextPromptEl.style.display = 'none';
    }

    // Dialogue Subtitle
    if (snap.dialogueText && snap.dialogueSpeaker) {
      this.dialogueBoxEl.style.display = 'block';
      this.dialogueSpeakerEl.textContent = `${snap.dialogueSpeaker}: `;
      this.dialogueTextEl.textContent = snap.dialogueText;
    } else {
      this.dialogueBoxEl.style.display = 'none';
    }

    // Notification Toast
    if (snap.notificationBanner) {
      this.toastBannerEl.style.display = 'block';
      this.toastBannerEl.textContent = snap.notificationBanner;
    } else {
      this.toastBannerEl.style.display = 'none';
    }

    const muteBtn = this.root.querySelector('#dock-btn-mute');
    if (muteBtn) {
      muteBtn.textContent = snap.muted ? 'Audio Muted' : 'Audio On';
    }

    // 3. Draw Circular Minimap
    this.drawMinimap(snap);

    // 4. Render Active Modal if needed
    if (snap.mode === GameMode.PLAYING) {
      this.modalContainer.style.display = 'none';
      this.lastRenderedMode = GameMode.PLAYING;
    } else {
      this.modalContainer.style.display = 'flex';
      if (
        this.lastRenderedMode !== snap.mode ||
        (snap.mode === GameMode.SHOP && this.lastShopTab !== snap.activeShopTab)
      ) {
        this.lastRenderedMode = snap.mode;
        this.lastShopTab = snap.activeShopTab;
        this.renderModalContent(snap);
      }
      if (snap.mode === GameMode.MAP && this.fullMapCanvas) {
        this.drawFullMap(snap);
      }
    }
  }

  private drawMinimap(snap: HUDStateSnapshot) {
    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const scale = 0.85; // pixels per world meter

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, w / 2 - 2, 0, Math.PI * 2);
    ctx.clip();

    // Background turf
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    // Ocean East Coast
    const oceanScreenX = cx + (WATER_EAST_X - snap.playerPos.x) * scale;
    if (oceanScreenX < w) {
      ctx.fillStyle = '#0369a1';
      ctx.fillRect(Math.max(0, oceanScreenX), 0, w, h);
      ctx.fillStyle = '#eab308';
      ctx.fillRect(Math.max(0, oceanScreenX - 18), 0, 18, h);
    }

    // Roads
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 8;
    const roadCoords = [-80, -40, 0, 40, 80];
    for (const rc of roadCoords) {
      const sy = cy + (rc - snap.playerPos.z) * scale;
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(w, sy);
      ctx.stroke();

      const sx = cx + (rc - snap.playerPos.x) * scale;
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, h);
      ctx.stroke();
    }

    // Collectibles (uncollected)
    for (const col of snap.collectibles) {
      if (col.collected) continue;
      const sx = cx + (col.position.x - snap.playerPos.x) * scale;
      const sy = cy + (col.position.z - snap.playerPos.z) * scale;
      ctx.fillStyle = '#00f0ff';
      ctx.fillRect(sx - 2, sy - 2, 4, 4);
    }

    // Vehicles
    for (const v of snap.vehicles) {
      if (v.isPlayerDriven) continue;
      const sx = cx + (v.position.x - snap.playerPos.x) * scale;
      const sy = cy + (v.position.z - snap.playerPos.z) * scale;
      ctx.fillStyle = v.isPoliceAI ? '#ef4444' : '#94a3b8';
      ctx.fillRect(sx - 2.5, sy - 2.5, 5, 5);
    }

    // Hostile NPCs / Police
    for (const npc of snap.npcs) {
      if (npc.state === 'dead') continue;
      if (
        npc.role === NPCRole.POLICE ||
        npc.role === NPCRole.GANG_SYNDICATE ||
        npc.role === NPCRole.MISSION_TARGET
      ) {
        const sx = cx + (npc.position.x - snap.playerPos.x) * scale;
        const sy = cy + (npc.position.z - snap.playerPos.z) * scale;
        ctx.fillStyle = npc.role === NPCRole.POLICE ? '#3b82f6' : '#f43f5e';
        ctx.beginPath();
        ctx.arc(sx, sy, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Active Mission Target Waypoint
    if (snap.missionTargetPos) {
      const tx = cx + (snap.missionTargetPos.x - snap.playerPos.x) * scale;
      const ty = cy + (snap.missionTargetPos.z - snap.playerPos.z) * scale;

      ctx.strokeStyle = '#ff2a85';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.setLineDash([]);

      const clampedX = Math.max(12, Math.min(w - 12, tx));
      const clampedY = Math.max(12, Math.min(h - 12, ty));
      ctx.fillStyle = '#ffbe0b';
      ctx.beginPath();
      ctx.arc(clampedX, clampedY, 5.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player Arrow at Center
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-snap.playerHeading + Math.PI);
    ctx.fillStyle = '#00f0ff';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5.5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5.5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  private drawFullMap(snap: HUDStateSnapshot) {
    const ctx = this.fullMapCtx;
    const w = this.fullMapCanvas.width;
    const h = this.fullMapCanvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const scale = 1.75;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    // Ocean East
    const oceanX = cx + WATER_EAST_X * scale;
    ctx.fillStyle = '#0369a1';
    ctx.fillRect(oceanX, 0, w - oceanX, h);
    ctx.fillStyle = '#eab308';
    ctx.fillRect(oceanX - 24, 0, 24, h);

    // Airport Runway West
    const runwayX = cx - 118 * scale;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(runwayX - 18, cy - 180, 36, 360);

    // Roads
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 14;
    for (const rc of [-80, -40, 0, 40, 80]) {
      ctx.beginPath();
      ctx.moveTo(cx - 160, cy + rc * scale);
      ctx.lineTo(oceanX, cy + rc * scale);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx + rc * scale, cy - 190);
      ctx.lineTo(cx + rc * scale, cy + 190);
      ctx.stroke();
    }

    // District Labels
    ctx.fillStyle = 'rgba(248, 250, 252, 0.55)';
    ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('OCEAN DRIVE BEACH', cx + 52 * scale, cy - 95 * scale);
    ctx.fillText('VICE DOWNTOWN', cx - 25 * scale, cy - 15 * scale);
    ctx.fillText('STARLIGHT WEST', cx - 85 * scale, cy - 50 * scale);
    ctx.fillText('PORT VICE HARBOR', cx - 35 * scale, cy + 95 * scale);
    ctx.fillText('VICE AIRPORT', cx - 135 * scale, cy - 95 * scale);

    // Businesses
    for (const biz of snap.businesses) {
      const bx = cx + biz.position.x * scale;
      const bz = cy + biz.position.z * scale;
      ctx.fillStyle = biz.owned ? '#10b981' : '#a855f7';
      ctx.beginPath();
      ctx.arc(bx, bz, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Collectibles
    for (const col of snap.collectibles) {
      if (col.collected) continue;
      const kx = cx + col.position.x * scale;
      const kz = cy + col.position.z * scale;
      ctx.fillStyle = '#00f0ff';
      ctx.fillRect(kx - 3, kz - 3, 6, 6);
    }

    // Mission Waypoint
    if (snap.missionTargetPos) {
      const mx = cx + snap.missionTargetPos.x * scale;
      const mz = cy + snap.missionTargetPos.z * scale;
      ctx.fillStyle = '#ffbe0b';
      ctx.beginPath();
      ctx.arc(mx, mz, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player Position
    const px = cx + snap.playerPos.x * scale;
    const pz = cy + snap.playerPos.z * scale;
    ctx.fillStyle = '#ff2a85';
    ctx.beginPath();
    ctx.arc(px, pz, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  public refreshCurrentModal() {
    if (this.lastSnapshot && this.lastSnapshot.mode !== GameMode.PLAYING) {
      this.renderModalContent(this.lastSnapshot);
    }
  }

  private renderModalContent(snap: HUDStateSnapshot) {
    if (snap.mode === GameMode.WEAPON_WHEEL) {
      this.modalContainer.innerHTML = `
        <div class="nv-modal-card">
          <div class="nv-modal-header">
            <h2 class="nv-modal-title">Weapon Arsenal</h2>
            <button class="nv-close-btn" id="modal-close">Resume (Tab / Esc)</button>
          </div>
          <div class="nv-grid-list">
            ${snap.allWeapons
              .map((w) => {
                const isSelected = w.spec.id === snap.activeWeapon.spec.id;
                return `
                  <div class="nv-item-row ${isSelected ? 'nv-item-active' : ''}">
                    <div>
                      <div class="nv-item-name">${w.spec.name}</div>
                      <div class="nv-item-meta">
                        <span>Damage ${w.spec.damage}</span>
                        <span>·</span>
                        <span>Range ${w.spec.range}m</span>
                        <span>·</span>
                        <span>${w.spec.isMelee ? 'Unlimited' : `Ammo ${w.clipAmmo}/${w.reserveAmmo}`}</span>
                      </div>
                    </div>
                    <div>
                      ${
                        w.unlocked
                          ? `<button class="nv-btn nv-btn-sm ${isSelected ? 'nv-btn-primary' : 'nv-btn-secondary'}" data-equip-weapon="${w.spec.id}">${isSelected ? 'Equipped' : 'Equip'}</button>`
                          : `<button class="nv-btn nv-btn-sm nv-btn-primary" data-buy-weapon="${w.spec.id}">Buy ($${w.spec.price})</button>`
                      }
                    </div>
                  </div>
                `;
              })
              .join('')}
          </div>
        </div>
      `;
    } else if (snap.mode === GameMode.MAP) {
      const collectedCount = snap.collectibles.filter((c) => c.collected).length;
      const ownedBizCount = snap.businesses.filter((b) => b.owned).length;
      this.modalContainer.innerHTML = `
        <div class="nv-modal-card nv-modal-wide">
          <div class="nv-modal-header">
            <div>
              <h2 class="nv-modal-title">Neon Vice City Radar &amp; Telemetry</h2>
              <div class="nv-item-meta">
                <span>Packages ${collectedCount} / ${snap.collectibles.length}</span>
                <span>·</span>
                <span>Properties Owned ${ownedBizCount} / ${snap.businesses.length}</span>
                <span>·</span>
                <span>Missions Completed ${snap.completedMissionIds.length} / ${MISSIONS.length}</span>
              </div>
            </div>
            <button class="nv-close-btn" id="modal-close">Close Map (M)</button>
          </div>
          <div class="nv-map-layout">
            <canvas id="nv-fullmap-canvas" width="520" height="420" class="nv-fullmap-canvas"></canvas>
            <div class="nv-map-legend">
              <h3 class="nv-section-sub">Active Objective</h3>
              <p class="nv-legend-desc">${snap.activeMissionTitle} — ${snap.activeStepInstruction}</p>
              <h3 class="nv-section-sub">City Legend</h3>
              <div class="nv-legend-list">
                <div><span style="color:#ff2a85;">●</span> Player Location (${Math.round(snap.playerPos.x)}, ${Math.round(snap.playerPos.z)})</div>
                <div><span style="color:#ffbe0b;">●</span> Active Mission Waypoint</div>
                <div><span style="color:#10b981;">●</span> Owned Syndicate Property</div>
                <div><span style="color:#a855f7;">●</span> Available Property for Purchase</div>
                <div><span style="color:#00f0ff;">■</span> Hidden Neon Package ($500)</div>
              </div>
              <div style="margin-top: 16px;">
                <button class="nv-btn nv-btn-sm nv-btn-secondary" id="btn-restart-mission">Restart Current Mission</button>
              </div>
            </div>
          </div>
        </div>
      `;
      this.fullMapCanvas = this.modalContainer.querySelector(
        '#nv-fullmap-canvas',
      )!;
      this.fullMapCtx = this.fullMapCanvas.getContext('2d')!;
      this.drawFullMap(snap);
    } else if (snap.mode === GameMode.SHOP) {
      this.renderShopModal(snap);
    } else if (snap.mode === GameMode.BIOCHEM_LAB) {
      this.renderBioChemModal(snap);
    } else if (snap.mode === GameMode.PAUSED) {
      this.modalContainer.innerHTML = `
        <div class="nv-modal-card">
          <div class="nv-modal-header">
            <h2 class="nv-modal-title">Pause &amp; System Settings</h2>
            <button class="nv-close-btn" id="modal-close">Resume Game (Esc)</button>
          </div>
          <div class="nv-settings-stack">
            <div class="nv-setting-row">
              <label>Master Audio Volume (${Math.round(snap.volume * 100)}%)</label>
              <input type="range" id="slider-volume" min="0" max="1" step="0.05" value="${snap.volume}" />
            </div>
            <div class="nv-setting-row">
              <label>Mouse Look Sensitivity (${snap.mouseSensitivity.toFixed(1)}x)</label>
              <input type="range" id="slider-sens" min="0.4" max="2.5" step="0.1" value="${snap.mouseSensitivity}" />
            </div>
            <div class="nv-setting-row">
              <label>Weather &amp; Atmosphere</label>
              <div class="nv-segmented-bar">
                <button class="nv-seg-btn ${snap.weather === WeatherType.CLEAR_SUNSET ? 'active' : ''}" data-weather="${WeatherType.CLEAR_SUNSET}">Sunset</button>
                <button class="nv-seg-btn ${snap.weather === WeatherType.TROPICAL_DAY ? 'active' : ''}" data-weather="${WeatherType.TROPICAL_DAY}">Daylight</button>
                <button class="nv-seg-btn ${snap.weather === WeatherType.NEON_NIGHT ? 'active' : ''}" data-weather="${WeatherType.NEON_NIGHT}">Neon Night</button>
                <button class="nv-seg-btn ${snap.weather === WeatherType.NEON_RAIN ? 'active' : ''}" data-weather="${WeatherType.NEON_RAIN}">Storm Rain</button>
              </div>
            </div>
            <div class="nv-modal-actions">
              <button class="nv-btn nv-btn-primary" id="btn-save-game">Save Progress to Safehouse</button>
              <button class="nv-btn nv-btn-secondary" id="btn-restart-mission">Restart Active Mission</button>
              <button class="nv-btn nv-btn-ghost" id="btn-exit-title">Exit to Title Screen</button>
            </div>
          </div>
        </div>
      `;
    } else if (snap.mode === GameMode.WASTED) {
      this.modalContainer.innerHTML = `
        <div class="nv-modal-card" style="text-align: center;">
          <h2 class="nv-modal-title" style="color: #f43f5e; font-size: 2.2rem;">WASTED</h2>
          <p class="nv-legend-desc" style="margin: 14px 0 24px;">
            Ocean Drive Paramedics patched you up at the nearest clinic. Medical fee: $100.
          </p>
          <button class="nv-btn nv-btn-primary" id="modal-close">Respawn at Safehouse</button>
        </div>
      `;
    }

    this.bindModalDynamicEvents(snap);
  }

  private renderShopModal(snap: HUDStateSnapshot) {
    const tab = snap.activeShopTab;
    let bodyHtml = '';

    if (tab === 'armory') {
      bodyHtml = `
        <div class="nv-item-row">
          <div>
            <div class="nv-item-name">Kevlar Tactical Body Armor</div>
            <div class="nv-item-meta">Restores Armor to 100 · Current Armor ${Math.ceil(snap.armor)}</div>
          </div>
          <button class="nv-btn nv-btn-sm nv-btn-primary" id="btn-buy-armor">Buy Armor ($250)</button>
        </div>
        ${Object.values(WEAPON_SPECS)
          .filter((w) => !w.isMelee)
          .map((spec) => {
            const st = snap.allWeapons.find((w) => w.spec.id === spec.id);
            const unlocked = st?.unlocked ?? false;
            return `
              <div class="nv-item-row">
                <div>
                  <div class="nv-item-name">${spec.name}</div>
                  <div class="nv-item-meta">
                    <span>Damage ${spec.damage}</span>
                    <span>·</span>
                    <span>Clip ${spec.clipSize}</span>
                    <span>·</span>
                    <span>${unlocked ? `Owned (${st?.reserveAmmo} reserve)` : `Unlock $${spec.price}`}</span>
                  </div>
                </div>
                <button class="nv-btn nv-btn-sm nv-btn-primary" data-buy-weapon="${spec.id}">
                  ${unlocked ? `Buy Ammo ($${spec.ammoCost})` : `Buy Weapon ($${spec.price})`}
                </button>
              </div>
            `;
          })
          .join('')}
      `;
    } else if (tab === 'safehouse') {
      bodyHtml = `
        <div class="nv-item-row">
          <div>
            <div class="nv-item-name">Safehouse Save &amp; Full Medical Recovery</div>
            <div class="nv-item-meta">Saves your Empire, Cash, Missions &amp; Restores 100 HP</div>
          </div>
          <button class="nv-btn nv-btn-sm nv-btn-primary" id="btn-save-game">Save &amp; Heal (Free)</button>
        </div>
        ${OUTFIT_CATALOG.map((out) => {
          const owned = snap.ownedOutfitIds.includes(out.id);
          const active = snap.activeOutfitId === out.id;
          return `
            <div class="nv-item-row ${active ? 'nv-item-active' : ''}">
              <div>
                <div class="nv-item-name">${out.name}</div>
                <div class="nv-item-meta">${owned ? 'Unlocked in Wardrobe' : `Price $${out.price}`}</div>
              </div>
              <button class="nv-btn nv-btn-sm ${active ? 'nv-btn-secondary' : 'nv-btn-primary'}" data-outfit="${out.id}">
                ${active ? 'Wearing' : owned ? 'Wear Outfit' : `Buy ($${out.price})`}
              </button>
            </div>
          `;
        }).join('')}
      `;
    } else if (tab === 'garage') {
      bodyHtml = `
        <div class="nv-item-row">
          <div>
            <div class="nv-item-name">Emergency Respray &amp; Engine Repair</div>
            <div class="nv-item-meta">Clears All Wanted Stars Immediately &amp; Restores Vehicle Health</div>
          </div>
          <button class="nv-btn nv-btn-sm nv-btn-primary" id="btn-respray">Respray &amp; Clear Heat ($300)</button>
        </div>
        ${Object.values(VEHICLE_SPECS).map((v) => {
          const owned = snap.storedVehicles.includes(v.id);
          return `
            <div class="nv-item-row">
              <div>
                <div class="nv-item-name">${v.name}</div>
                <div class="nv-item-meta">
                  <span>Top Speed ${Math.round(v.maxSpeed * 3.2)} MPH</span>
                  <span>·</span>
                  <span>${v.isWaterOnly ? 'Delivers to Marina Pier' : 'Delivers to Street'}</span>
                </div>
              </div>
              <button class="nv-btn nv-btn-sm nv-btn-primary" data-spawn-vehicle="${v.id}">
                ${owned ? 'Summon Free' : `Buy &amp; Deliver ($${v.price.toLocaleString()})`}
              </button>
            </div>
          `;
        }).join('')}
      `;
    } else {
      bodyHtml = snap.businesses
        .map((biz) => {
          return `
            <div class="nv-item-row ${biz.owned ? 'nv-item-active' : ''}">
              <div>
                <div class="nv-item-name">${biz.name}</div>
                <div class="nv-item-meta">
                  <span>${biz.district}</span>
                  <span>·</span>
                  <span>Generates $${biz.incomePerMinute}/min</span>
                </div>
                <div style="font-size: 12px; color: #94a3b8; margin-top: 2px;">${biz.description}</div>
              </div>
              <button class="nv-btn nv-btn-sm ${biz.owned ? 'nv-btn-secondary' : 'nv-btn-primary'}" data-buy-biz="${biz.id}" ${biz.owned ? 'disabled' : ''}>
                ${biz.owned ? 'Owned Asset' : `Acquire ($${biz.price.toLocaleString()})`}
              </button>
            </div>
          `;
        })
        .join('');
    }

    this.modalContainer.innerHTML = `
      <div class="nv-modal-card nv-modal-wide">
        <div class="nv-modal-header">
          <div>
            <h2 class="nv-modal-title">Syndicate Hub · Cash $${snap.cash.toLocaleString()}</h2>
          </div>
          <button class="nv-close-btn" id="modal-close">Return to Street (Esc)</button>
        </div>
        <div class="nv-segmented-bar" style="margin-bottom: 16px;">
          <button class="nv-seg-btn ${tab === 'armory' ? 'active' : ''}" data-shop-tab="armory">Armory &amp; Ammo</button>
          <button class="nv-seg-btn ${tab === 'safehouse' ? 'active' : ''}" data-shop-tab="safehouse">Safehouse &amp; Wardrobe</button>
          <button class="nv-seg-btn ${tab === 'garage' ? 'active' : ''}" data-shop-tab="garage">Vice Customs Garage</button>
          <button class="nv-seg-btn ${tab === 'empire' ? 'active' : ''}" data-shop-tab="empire">Empire Real Estate</button>
        </div>
        <div class="nv-grid-list">
          ${bodyHtml}
        </div>
      </div>
    `;
  }

  private renderBioChemModal(snap: HUDStateSnapshot) {
    const p = this.currentLabProfile;
    this.modalContainer.innerHTML = `
      <div class="nv-modal-card nv-modal-wide nv-sci-workbench">
        <div class="nv-modal-header">
          <div>
            <h2 class="nv-modal-title">Port Vice Bio-Chem Synthesis &amp; PubChem Workbench</h2>
            <div class="nv-item-meta">
              <span>Live NCBI PubChem PUG REST Connector</span>
              <span>·</span>
              <span>Lipinski Rule of Five &amp; Veber Bioavailability</span>
            </div>
          </div>
          <button class="nv-close-btn" id="modal-close">Exit Terminal (Esc)</button>
        </div>

        <div class="nv-sci-chip-bar">
          <span class="nv-sci-label">Quick-Try Compounds:</span>
          ${PRESET_LAB_COMPOUNDS.map(
            (name) =>
              `<button class="nv-seg-btn ${p?.queryName.toLowerCase() === name.toLowerCase() ? 'active' : ''}" data-chem-chip="${name}">${name}</button>`,
          ).join('')}
        </div>

        <div class="nv-sci-search-row">
          <input id="chem-input" type="text" class="nv-sci-input" placeholder="Enter compound name (e.g. Lidocaine, Epinephrine, Caffeine)..." value="${p?.queryName ?? 'Lidocaine'}" />
          <button id="btn-chem-search" class="nv-btn nv-btn-sm nv-btn-primary">Run PubChem Assay</button>
        </div>

        ${
          this.labLoading
            ? `<div class="nv-sci-status">Querying NCBI PubChem PUG REST API...</div>`
            : this.labError
              ? `<div class="nv-sci-status" style="color:#f43f5e;">${this.labError}</div>`
              : p
                ? `
          <div class="nv-sci-split">
            <div class="nv-sci-structure-box">
              <img src="${p.image2dUrl}" alt="2D chemical structure of ${p.queryName}" referrerpolicy="no-referrer" class="nv-sci-img" />
              <div class="nv-sci-provenance">
                <span>[Calculated by PubChem PUG REST]</span>
                <span>·</span>
                <a href="${p.pubchemRecordUrl}" target="_blank" rel="noopener noreferrer">CID ${p.cid} Record ↗</a>
              </div>
            </div>
            <div class="nv-sci-metrics">
              <div class="nv-sci-title-row">
                <h3>${p.queryName} (CID ${p.cid})</h3>
                <span>${p.lipinskiPass ? 'Lipinski Pass (Oral Bioavailable)' : 'Lipinski Alert'}</span>
              </div>
              <div class="nv-sci-table tabular-nums">
                <div><span>Molecular Formula</span><strong>${p.molecularFormula}</strong></div>
                <div><span>Molecular Weight</span><strong>${p.molecularWeight.toFixed(2)} g/mol</strong></div>
                <div><span>Lipophilicity (XLogP)</span><strong>${p.xLogP.toFixed(2)}</strong></div>
                <div><span>Topological PSA (TPSA)</span><strong>${p.tpsa.toFixed(1)} Å²</strong></div>
                <div><span>H-Bond Donors / Acceptors</span><strong>${p.hBondDonorCount} / ${p.hBondAcceptorCount}</strong></div>
                <div><span>Rotatable Bonds</span><strong>${p.rotatableBondCount} (${p.veberPass ? 'Veber Pass' : 'High Flex'})</strong></div>
                <div><span>BBB Permeability Forecast</span><strong>${p.bbbPermeable ? 'Likely CNS Active (TPSA < 90 Å²)' : 'Peripheral Target'}</strong></div>
              </div>
              <div class="nv-sci-smiles">
                <span>Canonical SMILES:</span>
                <code>${p.canonicalSmiles}</code>
              </div>
            </div>
          </div>
        `
                : `<div class="nv-sci-status">Select a compound above to run molecular analysis.</div>`
        }
      </div>
    `;

    if (!this.currentLabProfile && !this.labLoading && !this.labError) {
      void this.triggerLabQuery('Lidocaine');
    }

    const searchBtn = this.modalContainer.querySelector('#btn-chem-search');
    const searchInput = this.modalContainer.querySelector(
      '#chem-input',
    ) as HTMLInputElement | null;
    searchBtn?.addEventListener('click', () => {
      if (searchInput?.value.trim()) {
        void this.triggerLabQuery(searchInput.value.trim());
      }
    });
    searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && searchInput.value.trim()) {
        void this.triggerLabQuery(searchInput.value.trim());
      }
    });

    this.modalContainer.querySelectorAll('[data-chem-chip]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const name = (btn as HTMLElement).dataset.chemChip!;
        void this.triggerLabQuery(name);
      });
    });

    this.bindModalDynamicEvents(snap);
  }

  public async triggerLabQuery(compoundName: string) {
    this.labLoading = true;
    this.labError = null;
    this.refreshCurrentModal();
    try {
      const profile = await fetchPubChemCompound(compoundName);
      this.currentLabProfile = profile;
      this.callbacks.onCompoundVerified(profile.queryName);
    } catch (err) {
      this.labError =
        err instanceof Error ? err.message : 'Failed to query PubChem.';
    } finally {
      this.labLoading = false;
      this.refreshCurrentModal();
    }
  }

  private bindModalDynamicEvents(snap: HUDStateSnapshot) {
    this.modalContainer
      .querySelector('#modal-close')
      ?.addEventListener('click', () =>
        this.callbacks.onSetMode(GameMode.PLAYING),
      );

    this.modalContainer.querySelectorAll('[data-shop-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nextTab = (btn as HTMLElement).dataset
          .shopTab as HUDStateSnapshot['activeShopTab'];
        if (this.lastSnapshot) {
          this.lastSnapshot.activeShopTab = nextTab;
          this.renderShopModal(this.lastSnapshot);
          this.bindModalDynamicEvents(this.lastSnapshot);
        }
      });
    });

    this.modalContainer
      .querySelectorAll('[data-equip-weapon]')
      .forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = (btn as HTMLElement).dataset.equipWeapon as WeaponId;
          this.callbacks.onSelectWeapon(id);
          this.callbacks.onSetMode(GameMode.PLAYING);
        });
      });

    this.modalContainer.querySelectorAll('[data-buy-weapon]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.buyWeapon as WeaponId;
        this.callbacks.onBuyWeaponOrAmmo(id);
        this.refreshCurrentModal();
      });
    });

    this.modalContainer
      .querySelector('#btn-buy-armor')
      ?.addEventListener('click', () => {
        this.callbacks.onBuyArmor();
        this.refreshCurrentModal();
      });

    this.modalContainer.querySelectorAll('[data-outfit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.outfit!;
        this.callbacks.onEquipOutfit(id);
        this.refreshCurrentModal();
      });
    });

    this.modalContainer
      .querySelectorAll('[data-spawn-vehicle]')
      .forEach((btn) => {
        btn.addEventListener('click', () => {
          const vClass = (btn as HTMLElement).dataset
            .spawnVehicle as VehicleClass;
          this.callbacks.onSpawnGarageVehicle(vClass);
          this.callbacks.onSetMode(GameMode.PLAYING);
        });
      });

    this.modalContainer
      .querySelector('#btn-respray')
      ?.addEventListener('click', () => {
        this.callbacks.onResprayAndClearWanted();
        this.refreshCurrentModal();
      });

    this.modalContainer.querySelectorAll('[data-buy-biz]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.buyBiz!;
        this.callbacks.onBuyBusiness(id);
        this.refreshCurrentModal();
      });
    });

    this.modalContainer
      .querySelector('#btn-save-game')
      ?.addEventListener('click', () => {
        this.callbacks.onSaveGame();
        this.refreshCurrentModal();
      });

    this.modalContainer
      .querySelector('#btn-restart-mission')
      ?.addEventListener('click', () => {
        this.callbacks.onRestartMission();
        this.callbacks.onSetMode(GameMode.PLAYING);
      });

    this.modalContainer
      .querySelector('#btn-exit-title')
      ?.addEventListener('click', () => {
        this.callbacks.onSetMode(GameMode.TITLE);
      });

    const volSlider = this.modalContainer.querySelector(
      '#slider-volume',
    ) as HTMLInputElement | null;
    volSlider?.addEventListener('input', () => {
      this.callbacks.onSetVolume(Number(volSlider.value));
    });

    const sensSlider = this.modalContainer.querySelector(
      '#slider-sens',
    ) as HTMLInputElement | null;
    sensSlider?.addEventListener('input', () => {
      this.callbacks.onSetSensitivity(Number(sensSlider.value));
    });

    this.modalContainer.querySelectorAll('[data-weather]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const w = (btn as HTMLElement).dataset.weather as WeatherType;
        this.callbacks.onSetWeather(w);
        this.refreshCurrentModal();
      });
    });
  }
}
