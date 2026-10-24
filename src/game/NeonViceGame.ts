import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import * as xb from 'xrblocks';
import { SoundEngine } from '../audio/SoundEngine';
import {
  CITY_BOUNDS,
  INITIAL_BUSINESSES,
  MISSIONS,
  OUTFIT_CATALOG,
  PEDESTRIAN_QUIPS,
  VEHICLE_SPECS,
  WATER_EAST_X,
  WEAPON_SPECS,
} from '../constants';
import {
  ActiveNPC,
  ActiveVehicle,
  BusinessProperty,
  CollectiblePackage,
  GameMode,
  NPCRole,
  SaveGameData,
  TrafficSignal,
  VehicleClass,
  WeaponId,
  WeaponState,
  WeatherType,
} from '../types';
import { GameHUD, HUDStateSnapshot } from '../ui/GameHUD';
import { buildNeonViceCity, InteractiveZone } from '../world/CityBuilder';
import {
  createCharacterModel,
  createVehicleModel,
} from '../world/ProceduralModels';

const SAVE_STORAGE_KEY = 'neon_vice_save_v1';

// Pre-allocated scratch vectors for zero-GC 60fps loop
const _scratchVec1 = new THREE.Vector3();
const _scratchVec2 = new THREE.Vector3();
const _scratchForward = new THREE.Vector3();
const _scratchRight = new THREE.Vector3();
const _camTargetPos = new THREE.Vector3();
const _camLookAt = new THREE.Vector3();
const _playerBox = new THREE.Box3();

interface ActiveTracer {
  line: THREE.Line;
  life: number;
}

interface ActiveParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
}

export class NeonViceGame extends xb.Script {
  private sound = new SoundEngine();
  private hud!: GameHUD;

  // Game State
  private mode: GameMode = GameMode.TITLE;
  private cash = 750;
  private reputation = 50;
  private health = 100;
  private maxHealth = 100;
  private armor = 50;
  private maxArmor = 100;
  private wantedLevel = 0;
  private wantedHeatTimer = 0;
  private sirenSoundCooldown = 0;

  // Player & Camera
  private playerGroup!: THREE.Group;
  private playerLeftArm!: THREE.Object3D;
  private playerRightArm!: THREE.Object3D;
  private playerLeftLeg!: THREE.Object3D;
  private playerRightLeg!: THREE.Object3D;
  private playerBlazerMat!: THREE.MeshStandardMaterial;
  private playerShirtMat!: THREE.MeshStandardMaterial;
  private playerPantsMat!: THREE.MeshStandardMaterial;

  private playerPos = new THREE.Vector3(62, 0, 18);
  private playerVel = new THREE.Vector3();
  private playerHeading = 0;
  private playerWalkPhase = 0;
  private isGrounded = true;

  private cameraYaw = -0.6;
  private cameraPitch = 0.28;
  private mouseSensitivity = 1.0;
  private isPointerDownLook = false;
  private isAiming = false;
  private cameraShake = 0;
  private titleCamAngle = 0;

  // Input State
  private keysHeld = new Set<string>();
  private fireHeld = false;
  private fireCooldown = 0;
  private reloadTimer = 0;

  // Weapons & Inventory
  private weapons: WeaponState[] = [];
  private activeWeaponIndex = 1; // Pistol default
  private ownedOutfitIds: string[] = ['miami_pastel'];
  private activeOutfitId = 'miami_pastel';
  private storedVehicles: VehicleClass[] = [VehicleClass.SEDAN];

  // World & Entities
  private buildingColliders: THREE.Box3[] = [];
  private trafficSignals: TrafficSignal[] = [];
  private signalTimer = 0;
  private interactiveZones: InteractiveZone[] = [];
  private collectibles: CollectiblePackage[] = [];
  private businesses: BusinessProperty[] = [];
  private passiveIncomeTimer = 0;

  private vehicles: ActiveVehicle[] = [];
  private drivingVehicle: ActiveVehicle | null = null;
  private npcs: ActiveNPC[] = [];
  private tracers: ActiveTracer[] = [];
  private particles: ActiveParticle[] = [];

  // Environment & Weather
  private sunLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private oceanMesh!: THREE.Mesh;
  private roadMaterial!: THREE.MeshStandardMaterial;
  private rainSystem!: THREE.Points;
  private weather: WeatherType = WeatherType.CLEAR_SUNSET;
  private timeOfDay = 18.2; // Sunset default
  private activeShopTab: HUDStateSnapshot['activeShopTab'] = 'armory';

  // Missions & UI State
  private currentMissionIndex = 0;
  private currentStepIndex = 0;
  private completedMissionIds: string[] = [];
  private missionTimerRemaining: number | null = null;
  private missionWaypointMesh!: THREE.Mesh;
  private dialogueSpeaker: string | null = null;
  private dialogueText: string | null = null;
  private dialogueTimer = 0;
  private notificationBanner: string | null = null;
  private notificationTimer = 0;

  // XR Spatial UI Card
  private spatialCard?: xb.UICard;
  private spatialStatusText?: xb.UIText;

  public init() {
    this.setupRendererAndEnvironment();
    this.initInventoryAndMissions();
    this.buildWorld();
    this.createPlayer();
    this.spawnInitialVehicles();
    this.spawnInitialNPCs();
    this.createSpatialDashboardCard();
    this.setupHUDAndInputs();

    // Hide default XR entry overlay so our Title Screen & HUD own the viewport cleanly
    const xrWrapper = document.getElementById('XRButtonWrapper');
    if (xrWrapper) {
      xrWrapper.style.display = 'none';
    }
  }

  private setupRendererAndEnvironment() {
    const renderer = xb.core.renderer as unknown as
      | THREE.WebGLRenderer
      | undefined;
    if (renderer && 'outputColorSpace' in renderer) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.12;
      if (renderer.shadowMap) {
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      }

      try {
        const pmrem = new THREE.PMREMGenerator(renderer);
        const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        if (xb.core.scene) {
          xb.core.scene.environment = envTex;
        }
        pmrem.dispose();
      } catch {
        // Ignore if non-WebGLRenderer
      }
    }

    // Studio Warm Key Light + Cool Hemisphere Fill
    this.hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x1e1b4b, 1.4);
    this.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xff8c42, 2.8);
    this.sunLight.position.set(85, 95, -60);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    const d = 110;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.camera.near = 5;
    this.sunLight.shadow.camera.far = 280;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.add(this.sunLight);

    // Rain particle system
    const rainCount = 900;
    const rainGeo = new THREE.BufferGeometry();
    const rainPositions = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) {
      rainPositions[i * 3] = (Math.random() - 0.5) * 140;
      rainPositions[i * 3 + 1] = Math.random() * 45;
      rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 140;
    }
    rainGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(rainPositions, 3),
    );
    const rainMat = new THREE.PointsMaterial({
      color: 0x7dd3fc,
      size: 0.22,
      transparent: true,
      opacity: 0.65,
    });
    this.rainSystem = new THREE.Points(rainGeo, rainMat);
    this.rainSystem.visible = false;
    this.add(this.rainSystem);

    this.applyWeatherPreset(WeatherType.CLEAR_SUNSET);
  }

  private initInventoryAndMissions() {
    this.weapons = Object.values(WEAPON_SPECS).map((spec) => ({
      spec,
      unlocked: spec.id === WeaponId.FISTS || spec.id === WeaponId.PISTOL,
      clipAmmo: spec.clipSize,
      reserveAmmo: spec.isMelee ? 999 : spec.clipSize * 4,
    }));

    this.businesses = INITIAL_BUSINESSES.map((b) => ({
      ...b,
      position: b.position.clone(),
    }));
  }

  private buildWorld() {
    const glRenderer = xb.core.renderer as unknown as
      | THREE.WebGLRenderer
      | undefined;
    const maxAniso = glRenderer?.capabilities?.getMaxAnisotropy?.() ?? 4;
    const built = buildNeonViceCity(maxAniso);
    this.add(built.cityGroup);
    this.buildingColliders = built.buildingColliders;
    this.trafficSignals = built.trafficSignals;
    this.interactiveZones = built.interactiveZones;
    this.collectibles = built.collectibles;
    this.oceanMesh = built.oceanMesh;
    this.roadMaterial = built.roadMaterial;

    // Mission Waypoint Pillar
    const wpGeo = new THREE.CylinderGeometry(1.8, 1.8, 16, 20, 1, true);
    const wpMat = new THREE.MeshBasicMaterial({
      color: 0xff2a85,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.missionWaypointMesh = new THREE.Mesh(wpGeo, wpMat);
    this.missionWaypointMesh.position.y = 8;
    this.add(this.missionWaypointMesh);
    this.syncMissionWaypoint();
  }

  private createPlayer() {
    const outfit =
      OUTFIT_CATALOG.find((o) => o.id === this.activeOutfitId) ||
      OUTFIT_CATALOG[0];
    const model = createCharacterModel({ role: 'PLAYER', outfit });
    this.playerGroup = model.group;
    this.playerLeftArm = model.leftArm;
    this.playerRightArm = model.rightArm;
    this.playerLeftLeg = model.leftLeg;
    this.playerRightLeg = model.rightLeg;
    this.playerBlazerMat = model.blazerMat;
    this.playerShirtMat = model.shirtMat;
    this.playerPantsMat = model.pantsMat;

    this.playerGroup.position.copy(this.playerPos);
    this.add(this.playerGroup);
  }

  private spawnInitialVehicles() {
    // 1. Parked Mission Sports Car Downtown (-12, 0, -28)
    this.spawnVehicle(
      VehicleClass.SPORTS,
      new THREE.Vector3(-12, 0, -28),
      0,
      false,
      false,
    );

    // 2. Parked Ocean Drive Cruiser (74, 0, 12)
    this.spawnVehicle(
      VehicleClass.SPORTS,
      new THREE.Vector3(74, 0, 12),
      0,
      false,
      false,
      0x00f0ff,
    );

    // 3. Parked Vortex Motorcycle near Safehouse (68, 0, 29)
    this.spawnVehicle(
      VehicleClass.MOTORCYCLE,
      new THREE.Vector3(68, 0, 29),
      Math.PI / 4,
      false,
      false,
    );

    // 4. Parked Harbor Hauler Truck in Port Vice (-52, 0, 78)
    this.spawnVehicle(
      VehicleClass.TRUCK,
      new THREE.Vector3(-52, 0, 78),
      Math.PI / 2,
      false,
      false,
    );

    // 5. Moored Scarab Speedboat at East Marina Pier (118, 0, 55)
    this.spawnVehicle(
      VehicleClass.BOAT,
      new THREE.Vector3(118, -0.1, 55),
      0,
      false,
      false,
    );

    // 6. Autonomous Traffic AI Cars on Road Lanes
    const trafficSetups: [
      VehicleClass,
      number,
      number,
      'x' | 'z',
      number,
    ][] = [
      [VehicleClass.SEDAN, 40, -55, 'z', 1],
      [VehicleClass.TAXI, 40, 45, 'z', -1],
      [VehicleClass.SEDAN, 0, -30, 'z', 1],
      [VehicleClass.TAXI, -40, 20, 'z', -1],
      [VehicleClass.SEDAN, -25, 0, 'x', 1],
      [VehicleClass.TAXI, 25, 40, 'x', -1],
      [VehicleClass.SEDAN, -15, -40, 'x', 1],
      [VehicleClass.TRUCK, 15, 80, 'x', -1],
    ];

    for (const [vClass, x, z, axis, dir] of trafficSetups) {
      const heading =
        axis === 'z'
          ? dir > 0
            ? 0
            : Math.PI
          : dir > 0
            ? Math.PI / 2
            : -Math.PI / 2;
      const v = this.spawnVehicle(
        vClass,
        new THREE.Vector3(x, 0, z),
        heading,
        true,
        false,
      );
      v.aiLaneAxis = axis;
      v.aiDirection = dir;
    }
  }

  public spawnVehicle(
    vClass: VehicleClass,
    pos: THREE.Vector3,
    heading: number,
    isTrafficAI: boolean,
    isPoliceAI: boolean,
    customColor?: number,
  ): ActiveVehicle {
    const spec = VEHICLE_SPECS[vClass];
    const colorHex = customColor ?? spec.defaultColor;
    const built = createVehicleModel(vClass, colorHex, spec.accentColor);
    built.group.position.copy(pos);
    built.group.rotation.y = heading;
    this.add(built.group);

    const vehicle: ActiveVehicle = {
      id: `veh_${Math.random().toString(36).slice(2, 8)}`,
      spec,
      mesh: built.group,
      wheels: built.wheels,
      sirenLightLeft: built.sirenLightLeft,
      sirenLightRight: built.sirenLightRight,
      headlights: built.headlights,
      position: pos.clone(),
      velocity: new THREE.Vector3(),
      heading,
      speed: 0,
      steerAngle: 0,
      health: spec.maxHealth,
      maxHealth: spec.maxHealth,
      isPlayerDriven: false,
      isTrafficAI,
      isPoliceAI,
      colorHex,
    };
    this.vehicles.push(vehicle);
    return vehicle;
  }

  private spawnInitialNPCs() {
    // 18 Pedestrians across sidewalks
    for (let i = 0; i < 18; i++) {
      const px = (Math.random() - 0.35) * 150;
      const pz = (Math.random() - 0.5) * 160;
      this.spawnNPC(
        NPCRole.PEDESTRIAN,
        new THREE.Vector3(Math.min(WATER_EAST_X - 8, px), 0, pz),
      );
    }

    // 4 Patrol Police Officers
    const policeCoords = [
      [32, -15],
      [-32, 15],
      [68, -25],
      [-15, 65],
    ];
    for (const [px, pz] of policeCoords) {
      this.spawnNPC(NPCRole.POLICE, new THREE.Vector3(px, 0, pz));
    }
  }

  private spawnNPC(
    role: NPCRole,
    pos: THREE.Vector3,
    customName?: string,
  ): ActiveNPC {
    const built = createCharacterModel({ role });
    built.group.position.copy(pos);
    const heading = Math.random() * Math.PI * 2;
    built.group.rotation.y = heading;
    this.add(built.group);

    const npc: ActiveNPC = {
      id: `npc_${Math.random().toString(36).slice(2, 8)}`,
      name:
        customName ||
        (role === NPCRole.POLICE
          ? 'VCPD Officer'
          : role === NPCRole.GANG_SYNDICATE || role === NPCRole.MISSION_TARGET
            ? 'Chrome Syndicate Enforcer'
            : 'Vice Citizen'),
      role,
      mesh: built.group,
      leftArm: built.leftArm,
      rightArm: built.rightArm,
      leftLeg: built.leftLeg,
      rightLeg: built.rightLeg,
      position: pos.clone(),
      velocity: new THREE.Vector3(),
      heading,
      health: role === NPCRole.MISSION_TARGET ? 110 : 75,
      maxHealth: role === NPCRole.MISSION_TARGET ? 110 : 75,
      state:
        role === NPCRole.MISSION_TARGET || role === NPCRole.GANG_SYNDICATE
          ? 'attack'
          : 'walk',
      attackCooldown: 1 + Math.random(),
      dialogueLine:
        PEDESTRIAN_QUIPS[Math.floor(Math.random() * PEDESTRIAN_QUIPS.length)],
      homeDistrict: 'Neon Vice',
      walkPhase: Math.random() * 10,
      hitFlashTimer: 0,
    };
    this.npcs.push(npc);
    return npc;
  }

  private createSpatialDashboardCard() {
    this.spatialStatusText = new xb.UIText({
      text: 'Neon Vice Syndicate Command Board · Ready',
      style: { fontSize: 18, textAlign: 'center', opacity: 0.85 },
    });

    this.spatialCard = new xb.UICard({
      size: { width: 0.72, height: 'auto' },
      manipulation: true,
      edge: true,
      style: {
        flexDirection: 'column',
        gap: 14,
        padding: 20,
        backgroundColor: '#0f172a',
        borderRadius: 20,
      },
      children: [
        new xb.UIText({
          text: 'NEON VICE SPATIAL COMMAND',
          style: { fontSize: 26, fontWeight: 'bold', textAlign: 'center' },
        }),
        this.spatialStatusText,
        new xb.UIPanel({
          style: { width: '100%', flexDirection: 'row', gap: 10 },
          children: [
            new xb.UIButton({
              label: 'Spawn Cheetah GT',
              style: { flexGrow: 1 },
              onClick: () =>
                this.handleSpawnGarageVehicle(VehicleClass.SPORTS),
            }),
            new xb.UIButton({
              label: 'Clear Wanted',
              style: { flexGrow: 1 },
              onClick: () => {
                this.wantedLevel = 0;
                this.showToast('Wanted Level Cleared');
              },
            }),
          ],
        }),
      ],
    });
    this.spatialCard.position.set(65, 2.2, 22);
    this.add(this.spatialCard);
  }

  private setupHUDAndInputs() {
    this.hud = new GameHUD({
      onStartNewGame: () => this.startNewGame(),
      onContinueGame: () => this.loadSavedGame(),
      onSaveGame: () => this.saveGame(),
      onSelectWeapon: (id) => {
        const idx = this.weapons.findIndex((w) => w.spec.id === id);
        if (idx >= 0 && this.weapons[idx].unlocked) {
          this.activeWeaponIndex = idx;
          this.sound.playUIClick();
        }
      },
      onBuyWeaponOrAmmo: (id) => this.buyWeaponOrAmmo(id),
      onBuyArmor: () => {
        if (this.cash >= 250 && this.armor < this.maxArmor) {
          this.cash -= 250;
          this.armor = this.maxArmor;
          this.sound.playCashSound();
          this.showToast('Purchased Kevlar Body Armor (100 AR)');
        }
      },
      onEquipOutfit: (outfitId) => this.equipOrBuyOutfit(outfitId),
      onSpawnGarageVehicle: (vClass) => this.handleSpawnGarageVehicle(vClass),
      onResprayAndClearWanted: () => {
        if (this.cash >= 300) {
          this.cash -= 300;
          this.wantedLevel = 0;
          this.wantedHeatTimer = 0;
          if (this.drivingVehicle) {
            this.drivingVehicle.health = this.drivingVehicle.maxHealth;
          }
          this.sound.playCashSound();
          this.showToast('Vehicle Resprayed & Wanted Stars Cleared!');
        } else {
          this.showToast('Need $300 for Customs Respray');
        }
      },
      onBuyBusiness: (bizId) => this.buyBusiness(bizId),
      onSetWeather: (weather) => this.applyWeatherPreset(weather),
      onCycleRadio: () => {
        const st = this.sound.cycleRadioStation();
        this.showToast(`Radio: ${st.name} (${st.genre})`);
      },
      onToggleMute: () => {
        const muted = this.sound.toggleMute();
        this.showToast(muted ? 'Audio Muted' : 'Audio Enabled');
      },
      onSetVolume: (v) => this.sound.setVolume(v),
      onSetSensitivity: (s) => {
        this.mouseSensitivity = s;
      },
      onSetMode: (nextMode) => {
        if (this.mode === GameMode.WASTED && nextMode === GameMode.PLAYING) {
          this.respawnPlayer();
        }
        this.mode = nextMode;
        this.sound.playUIClick();
      },
      onRestartMission: () => {
        this.currentStepIndex = 0;
        this.syncMissionWaypoint();
        this.showToast('Mission Restarted from Checkpoint 1');
      },
      onCompoundVerified: (compoundName) => {
        const mission = MISSIONS[this.currentMissionIndex];
        const step = mission?.steps[this.currentStepIndex];
        if (step && step.compoundQuery) {
          this.showToast(`PubChem Assay Verified: ${compoundName}`);
        }
      },
    });

    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    window.addEventListener('keyup', (e) => {
      this.keysHeld.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.keysHeld.clear();
      this.fireHeld = false;
      this.isPointerDownLook = false;
    });

    window.addEventListener('mousedown', (e) => {
      if (this.mode !== GameMode.PLAYING) return;
      const target = e.target as HTMLElement | null;
      if (target && target.closest('.nv-bottom-dock, .nv-modal-card, button')) {
        return;
      }
      if (e.button === 0) {
        this.fireHeld = true;
        this.isPointerDownLook = true;
        this.tryAttackOrFire();
      } else if (e.button === 2) {
        this.isAiming = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.fireHeld = false;
        this.isPointerDownLook = false;
      } else if (e.button === 2) {
        this.isAiming = false;
      }
    });

    window.addEventListener('contextmenu', (e) => {
      if (this.mode === GameMode.PLAYING) {
        e.preventDefault();
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.mode !== GameMode.PLAYING) return;
      if (
        document.pointerLockElement ||
        this.isPointerDownLook ||
        this.isAiming
      ) {
        this.cameraYaw -= e.movementX * 0.0032 * this.mouseSensitivity;
        this.cameraPitch = THREE.MathUtils.clamp(
          this.cameraPitch + e.movementY * 0.0025 * this.mouseSensitivity,
          -0.25,
          1.15,
        );
      }
    });
  }

  private handleKeyDown(e: KeyboardEvent) {
    const activeEl = document.activeElement;
    if (activeEl && activeEl.tagName === 'INPUT') return;

    this.keysHeld.add(e.code);

    if (this.mode === GameMode.TITLE) {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        this.startNewGame();
      }
      return;
    }

    if (e.code === 'Escape') {
      e.preventDefault();
      this.mode =
        this.mode === GameMode.PLAYING ? GameMode.PAUSED : GameMode.PLAYING;
      this.sound.playUIClick();
      return;
    }

    if (e.code === 'KeyM') {
      e.preventDefault();
      this.mode =
        this.mode === GameMode.MAP ? GameMode.PLAYING : GameMode.MAP;
      this.sound.playUIClick();
      return;
    }

    if (e.code === 'Tab') {
      e.preventDefault();
      this.mode =
        this.mode === GameMode.WEAPON_WHEEL
          ? GameMode.PLAYING
          : GameMode.WEAPON_WHEEL;
      this.sound.playUIClick();
      return;
    }

    if (e.code === 'KeyH') {
      this.hud.toggleBottomDock();
      return;
    }

    if (this.mode !== GameMode.PLAYING) return;

    if (e.code === 'KeyE' || e.code === 'KeyF') {
      this.handleContextualInteract();
    } else if (e.code === 'KeyQ') {
      const st = this.sound.cycleRadioStation();
      this.showToast(`Radio: ${st.name}`);
    } else if (e.code === 'KeyR') {
      this.startReload();
    } else if (e.code === 'Space' && !this.drivingVehicle && this.isGrounded) {
      this.playerVel.y = 7.8;
      this.isGrounded = false;
    } else if (
      e.code.startsWith('Digit') &&
      Number(e.code.replace('Digit', '')) >= 1 &&
      Number(e.code.replace('Digit', '')) <= this.weapons.length
    ) {
      const idx = Number(e.code.replace('Digit', '')) - 1;
      if (this.weapons[idx]?.unlocked) {
        this.activeWeaponIndex = idx;
        this.showToast(`Equipped ${this.weapons[idx].spec.name}`);
      }
    }
  }

  private startNewGame() {
    this.cash = 1000;
    this.reputation = 50;
    this.health = 100;
    this.armor = 50;
    this.wantedLevel = 0;
    this.currentMissionIndex = 0;
    this.currentStepIndex = 0;
    this.completedMissionIds = [];
    this.playerPos.set(62, 0, 18);
    this.playerGroup.position.copy(this.playerPos);
    if (this.drivingVehicle) {
      this.exitVehicle();
    }
    this.syncMissionWaypoint();
    this.mode = GameMode.PLAYING;
    this.sound.playMissionFanfare();
    this.triggerStepDialogue();
  }

  private saveGame() {
    const data: SaveGameData = {
      cash: this.cash,
      reputation: this.reputation,
      health: this.maxHealth,
      armor: this.armor,
      currentMissionIndex: this.currentMissionIndex,
      completedMissionIds: this.completedMissionIds,
      collectedPackageIds: this.collectibles
        .filter((c) => c.collected)
        .map((c) => c.id),
      ownedBusinessIds: this.businesses
        .filter((b) => b.owned)
        .map((b) => b.id),
      ownedOutfitIds: this.ownedOutfitIds,
      activeOutfitId: this.activeOutfitId,
      storedVehicles: this.storedVehicles,
      weapons: this.weapons.map((w) => ({
        id: w.spec.id,
        unlocked: w.unlocked,
        clipAmmo: w.clipAmmo,
        reserveAmmo: w.reserveAmmo,
      })),
      timeOfDay: this.timeOfDay,
      weather: this.weather,
    };
    try {
      localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(data));
      this.health = this.maxHealth;
      this.sound.playCashSound();
      this.showToast('Progress Saved to Safehouse & Health Restored!');
    } catch {
      this.showToast('Unable to access local storage');
    }
  }

  private loadSavedGame() {
    try {
      const raw = localStorage.getItem(SAVE_STORAGE_KEY);
      if (!raw) {
        this.startNewGame();
        return;
      }
      const data = JSON.parse(raw) as SaveGameData;
      this.cash = data.cash ?? 1000;
      this.reputation = data.reputation ?? 50;
      this.health = data.health ?? 100;
      this.armor = data.armor ?? 50;
      this.currentMissionIndex = data.currentMissionIndex ?? 0;
      this.currentStepIndex = 0;
      this.completedMissionIds = data.completedMissionIds ?? [];
      this.ownedOutfitIds = data.ownedOutfitIds ?? ['miami_pastel'];
      this.activeOutfitId = data.activeOutfitId ?? 'miami_pastel';
      this.storedVehicles = data.storedVehicles ?? [VehicleClass.SEDAN];

      for (const col of this.collectibles) {
        col.collected = data.collectedPackageIds?.includes(col.id) ?? false;
        col.mesh.visible = !col.collected;
      }

      for (const biz of this.businesses) {
        biz.owned = data.ownedBusinessIds?.includes(biz.id) ?? false;
      }

      if (data.weapons) {
        for (const savedW of data.weapons) {
          const match = this.weapons.find((w) => w.spec.id === savedW.id);
          if (match) {
            match.unlocked = savedW.unlocked;
            match.clipAmmo = savedW.clipAmmo;
            match.reserveAmmo = savedW.reserveAmmo;
          }
        }
      }

      this.applyOutfitColors(this.activeOutfitId);
      if (data.weather) this.applyWeatherPreset(data.weather);
      this.syncMissionWaypoint();
      this.mode = GameMode.PLAYING;
      this.sound.playMissionFanfare();
      this.showToast('Loaded Saved Syndicate Empire');
    } catch {
      this.startNewGame();
    }
  }

  private hasSavedGame(): boolean {
    try {
      return Boolean(localStorage.getItem(SAVE_STORAGE_KEY));
    } catch {
      return false;
    }
  }

  private applyWeatherPreset(weather: WeatherType) {
    this.weather = weather;
    const scene = xb.core.scene;
    if (!scene) return;

    if (weather === WeatherType.CLEAR_SUNSET) {
      scene.background = new THREE.Color(0x2e1042);
      scene.fog = new THREE.FogExp2(0x3b1254, 0.0042);
      this.sunLight.color.setHex(0xff7b3a);
      this.sunLight.intensity = 2.8;
      this.hemiLight.color.setHex(0xf43f5e);
      this.hemiLight.groundColor.setHex(0x1e1b4b);
      this.rainSystem.visible = false;
      if (this.roadMaterial) this.roadMaterial.roughness = 0.32;
    } else if (weather === WeatherType.TROPICAL_DAY) {
      scene.background = new THREE.Color(0x38bdf8);
      scene.fog = new THREE.FogExp2(0x7dd3fc, 0.0032);
      this.sunLight.color.setHex(0xfffbeb);
      this.sunLight.intensity = 3.2;
      this.hemiLight.color.setHex(0xbae6fd);
      this.hemiLight.groundColor.setHex(0x334155);
      this.rainSystem.visible = false;
      if (this.roadMaterial) this.roadMaterial.roughness = 0.48;
    } else if (weather === WeatherType.NEON_NIGHT) {
      scene.background = new THREE.Color(0x060913);
      scene.fog = new THREE.FogExp2(0x090d1a, 0.005);
      this.sunLight.color.setHex(0x38bdf8);
      this.sunLight.intensity = 0.9;
      this.hemiLight.color.setHex(0x1e1b4b);
      this.hemiLight.groundColor.setHex(0x090d16);
      this.rainSystem.visible = false;
      if (this.roadMaterial) this.roadMaterial.roughness = 0.25;
    } else if (weather === WeatherType.NEON_RAIN) {
      scene.background = new THREE.Color(0x091326);
      scene.fog = new THREE.FogExp2(0x0f172a, 0.0065);
      this.sunLight.color.setHex(0x60a5fa);
      this.sunLight.intensity = 1.1;
      this.hemiLight.color.setHex(0x1e293b);
      this.hemiLight.groundColor.setHex(0x0f172a);
      this.rainSystem.visible = true;
      if (this.roadMaterial) {
        this.roadMaterial.roughness = 0.12;
        this.roadMaterial.metalness = 0.55;
      }
    }
  }

  public override update() {
    const rawDt = xb.getDeltaTime ? xb.getDeltaTime() : 0.016;
    const dt = Math.min(rawDt || 0.016, 0.05);

    this.animateOceanAndWorld(dt);

    if (this.mode === GameMode.TITLE) {
      this.updateTitleCamera(dt);
      this.hud.update(this.buildHUDSnapshot());
      return;
    }

    if (this.mode === GameMode.PLAYING) {
      this.updatePlayerOrVehicle(dt);
      this.updateTrafficSignals(dt);
      this.updateTrafficVehicles(dt);
      this.updateNPCsAndPolice(dt);
      this.updateCombatAndParticles(dt);
      this.updateCollectiblesAndBusinesses(dt);
      this.updateMissions(dt);
      this.updateChaseCamera(dt);
    }

    if (this.dialogueTimer > 0) {
      this.dialogueTimer -= dt;
      if (this.dialogueTimer <= 0) {
        this.dialogueSpeaker = null;
        this.dialogueText = null;
      }
    }

    if (this.notificationTimer > 0) {
      this.notificationTimer -= dt;
      if (this.notificationTimer <= 0) {
        this.notificationBanner = null;
      }
    }

    this.hud.update(this.buildHUDSnapshot());
  }

  private animateOceanAndWorld(dt: number) {
    const t = performance.now() * 0.001;
    if (this.oceanMesh) {
      this.oceanMesh.position.y = -0.15 + Math.sin(t * 1.8) * 0.07;
    }

    // Rotate collectibles
    for (const col of this.collectibles) {
      if (!col.collected) {
        col.mesh.rotation.y += dt * 2.2;
      }
    }

    // Update rain particles around player
    if (this.rainSystem && this.rainSystem.visible) {
      this.rainSystem.position.x = this.playerPos.x;
      this.rainSystem.position.z = this.playerPos.z;
      const posAttr = this.rainSystem.geometry.attributes
        .position as THREE.BufferAttribute;
      for (let i = 0; i < posAttr.count; i++) {
        let y = posAttr.getY(i) - dt * 28;
        if (y < 0) y = 42;
        posAttr.setY(i, y);
      }
      posAttr.needsUpdate = true;
    }
  }

  private updateTitleCamera(dt: number) {
    this.titleCamAngle += dt * 0.14;
    const cam = xb.core.camera;
    if (!cam) return;
    const r = 78;
    cam.position.set(
      20 + Math.cos(this.titleCamAngle) * r,
      28 + Math.sin(this.titleCamAngle * 0.5) * 6,
      Math.sin(this.titleCamAngle) * r,
    );
    cam.lookAt(18, 8, -10);
  }

  private updatePlayerOrVehicle(dt: number) {
    if (this.drivingVehicle) {
      this.updateDrivenVehicle(this.drivingVehicle, dt);
      this.playerPos.copy(this.drivingVehicle.position);
      this.playerHeading = this.drivingVehicle.heading;
      this.playerGroup.position.copy(this.playerPos);
      this.sound.setDrivingState(
        true,
        this.drivingVehicle.speed / this.drivingVehicle.spec.maxSpeed,
      );
      return;
    }

    this.sound.setDrivingState(false, 0);

    // On-Foot Movement
    let moveZ = 0;
    let moveX = 0;
    if (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp')) moveZ += 1;
    if (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown')) moveZ -= 1;
    if (this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft')) moveX -= 1;
    if (this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight'))
      moveX += 1;

    const isSprinting =
      this.keysHeld.has('ShiftLeft') || this.keysHeld.has('ShiftRight');
    const moveSpeed = isSprinting ? 11.2 : 6.8;

    _scratchForward.set(-Math.sin(this.cameraYaw), 0, -Math.cos(this.cameraYaw));
    _scratchRight.set(Math.cos(this.cameraYaw), 0, -Math.sin(this.cameraYaw));

    _scratchVec1
      .set(0, 0, 0)
      .addScaledVector(_scratchForward, moveZ)
      .addScaledVector(_scratchRight, moveX);

    if (_scratchVec1.lengthSq() > 0.001) {
      _scratchVec1.normalize();
      const targetHeading = Math.atan2(_scratchVec1.x, _scratchVec1.z);
      // Smooth angular interpolation
      let diff = targetHeading - this.playerHeading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.playerHeading += diff * (1 - Math.exp(-14 * dt));

      this.playerVel.x = _scratchVec1.x * moveSpeed;
      this.playerVel.z = _scratchVec1.z * moveSpeed;
      this.playerWalkPhase += dt * (isSprinting ? 14 : 9);
    } else {
      this.playerVel.x *= Math.exp(-12 * dt);
      this.playerVel.z *= Math.exp(-12 * dt);
    }

    if (this.isAiming) {
      this.playerHeading = this.cameraYaw + Math.PI;
    }

    // Gravity & Jump
    if (!this.isGrounded) {
      this.playerVel.y -= 20 * dt;
    }

    const nextX = THREE.MathUtils.clamp(
      this.playerPos.x + this.playerVel.x * dt,
      -CITY_BOUNDS,
      CITY_BOUNDS,
    );
    const nextZ = THREE.MathUtils.clamp(
      this.playerPos.z + this.playerVel.z * dt,
      -CITY_BOUNDS,
      CITY_BOUNDS,
    );

    // Resolve X and Z against building colliders separately for smooth sliding
    if (!this.checkBuildingCollision(nextX, this.playerPos.z, 0.55)) {
      this.playerPos.x = nextX;
    }
    if (!this.checkBuildingCollision(this.playerPos.x, nextZ, 0.55)) {
      this.playerPos.z = nextZ;
    }

    this.playerPos.y += this.playerVel.y * dt;
    const groundY = this.playerPos.x > WATER_EAST_X + 4 ? -0.45 : 0;
    if (this.playerPos.y <= groundY) {
      this.playerPos.y = groundY;
      this.playerVel.y = 0;
      this.isGrounded = true;
    }

    this.playerGroup.position.copy(this.playerPos);
    this.playerGroup.rotation.y = this.playerHeading;

    // Articulated limb walk/aim animation
    const speedHoriz = Math.hypot(this.playerVel.x, this.playerVel.z);
    if (speedHoriz > 0.4) {
      const swing = Math.sin(this.playerWalkPhase) * 0.55;
      this.playerLeftLeg.rotation.x = swing;
      this.playerRightLeg.rotation.x = -swing;
      this.playerLeftArm.rotation.x = -swing * 0.8;
      this.playerRightArm.rotation.x =
        this.isAiming || this.fireCooldown > 0 ? -1.45 : swing * 0.8;
    } else {
      this.playerLeftLeg.rotation.x = 0;
      this.playerRightLeg.rotation.x = 0;
      this.playerLeftArm.rotation.x = 0;
      this.playerRightArm.rotation.x =
        this.isAiming || this.fireCooldown > 0 ? -1.45 : 0;
    }
  }

  private updateDrivenVehicle(v: ActiveVehicle, dt: number) {
    const spec = v.spec;
    let throttle = 0;
    let steer = 0;
    if (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp'))
      throttle += 1;
    if (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown'))
      throttle -= 1;
    if (this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft')) steer += 1;
    if (this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight'))
      steer -= 1;

    const handbrake = this.keysHeld.has('Space');

    if (throttle > 0) {
      v.speed = Math.min(spec.maxSpeed, v.speed + spec.acceleration * dt);
    } else if (throttle < 0) {
      if (v.speed > 1) {
        v.speed = Math.max(0, v.speed - spec.braking * dt);
      } else {
        v.speed = Math.max(
          -spec.maxSpeed * 0.42,
          v.speed - spec.acceleration * 0.7 * dt,
        );
      }
    } else {
      v.speed *= Math.exp(-1.8 * dt);
    }

    if (handbrake) {
      v.speed *= Math.exp(-3.4 * dt);
      if (Math.abs(v.speed) > 9 && Math.abs(steer) > 0.1) {
        this.sound.playTireScreech();
        this.spawnParticleBurst(v.position, 0x94a3b8, 2);
      }
    }

    if (Math.abs(v.speed) > 0.4) {
      const dirSign = v.speed >= 0 ? 1 : -1;
      const turnMultiplier = handbrake ? 1.45 : 1.0;
      v.heading +=
        steer *
        spec.turnSpeed *
        turnMultiplier *
        dirSign *
        Math.min(1, Math.abs(v.speed) / 7) *
        dt;
    }

    const vx = Math.sin(v.heading) * v.speed;
    const vz = Math.cos(v.heading) * v.speed;

    let nextX = THREE.MathUtils.clamp(
      v.position.x + vx * dt,
      -CITY_BOUNDS,
      CITY_BOUNDS,
    );
    let nextZ = THREE.MathUtils.clamp(
      v.position.z + vz * dt,
      -CITY_BOUNDS,
      CITY_BOUNDS,
    );

    if (spec.isWaterOnly) {
      // Boats stay in the Ocean (X >= WATER_EAST_X + 2)
      nextX = Math.max(WATER_EAST_X + 3, nextX);
      v.position.set(
        nextX,
        -0.1 + Math.sin(performance.now() * 0.004) * 0.08,
        nextZ,
      );
    } else {
      // Land vehicles stop before deep ocean water
      nextX = Math.min(WATER_EAST_X - 2, nextX);
      if (!this.checkBuildingCollision(nextX, v.position.z, 1.35)) {
        v.position.x = nextX;
      } else {
        v.speed *= -0.35;
        this.cameraShake = 0.25;
      }
      if (!this.checkBuildingCollision(v.position.x, nextZ, 1.35)) {
        v.position.z = nextZ;
      } else {
        v.speed *= -0.35;
        this.cameraShake = 0.25;
      }
      v.position.y = 0;
    }

    v.mesh.position.copy(v.position);
    v.mesh.rotation.y = v.heading;

    // Spin wheels
    for (const w of v.wheels) {
      w.rotation.x += v.speed * dt * 1.6;
    }

    // Gently align camera behind vehicle when moving
    if (Math.abs(v.speed) > 2.5 && !this.isPointerDownLook) {
      const targetYaw = v.heading + Math.PI;
      let diff = targetYaw - this.cameraYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.cameraYaw += diff * (1 - Math.exp(-3.2 * dt));
    }
  }

  private checkBuildingCollision(x: number, z: number, radius: number): boolean {
    _playerBox.min.set(x - radius, 0.1, z - radius);
    _playerBox.max.set(x + radius, 2.0, z + radius);
    for (const b of this.buildingColliders) {
      if (_playerBox.intersectsBox(b)) {
        return true;
      }
    }
    return false;
  }

  private handleContextualInteract() {
    // 1. If currently driving, exit vehicle
    if (this.drivingVehicle) {
      this.exitVehicle();
      return;
    }

    // 2. Check nearby interactive zones (Safehouse, Armory, Garage, Bio-Chem Lab, Business)
    for (const z of this.interactiveZones) {
      if (this.playerPos.distanceTo(z.position) <= z.radius) {
        if (z.type === 'biochem_lab') {
          this.mode = GameMode.BIOCHEM_LAB;
          this.sound.playUIClick();
          return;
        }
        if (z.type === 'safehouse') {
          this.activeShopTab = 'safehouse';
          this.mode = GameMode.SHOP;
          this.sound.playUIClick();
          return;
        }
        if (z.type === 'weapon_shop') {
          this.activeShopTab = 'armory';
          this.mode = GameMode.SHOP;
          this.sound.playUIClick();
          return;
        }
        if (z.type === 'garage') {
          this.activeShopTab = 'garage';
          this.mode = GameMode.SHOP;
          this.sound.playUIClick();
          return;
        }
        if (z.type === 'business') {
          this.activeShopTab = 'empire';
          this.mode = GameMode.SHOP;
          this.sound.playUIClick();
          return;
        }
      }
    }

    // 3. Check nearby vehicles to enter
    let closestV: ActiveVehicle | null = null;
    let closestDist = 5.5;
    for (const v of this.vehicles) {
      const d = this.playerPos.distanceTo(v.position);
      if (d < closestDist) {
        closestDist = d;
        closestV = v;
      }
    }

    if (closestV) {
      this.enterVehicle(closestV);
    }
  }

  private enterVehicle(v: ActiveVehicle) {
    if (v.isTrafficAI || v.isPoliceAI) {
      // Stealing an occupied traffic or police vehicle triggers Wanted Level
      v.isTrafficAI = false;
      v.isPoliceAI = false;
      this.addWantedHeat(1, 'Grand Theft Auto reported!');
    }
    this.drivingVehicle = v;
    v.isPlayerDriven = true;
    this.playerGroup.visible = false;
    this.cameraYaw = v.heading + Math.PI;
    this.sound.playUIClick();
    this.showToast(
      `Driving ${v.spec.name} · ${this.sound.getCurrentStation().name}`,
    );
  }

  private exitVehicle() {
    if (!this.drivingVehicle) return;
    const v = this.drivingVehicle;
    v.isPlayerDriven = false;
    v.speed = 0;

    // Place player safely to the left of the vehicle (or on the pier if exiting a boat)
    if (v.spec.isWaterOnly) {
      this.playerPos.set(Math.min(WATER_EAST_X - 2, v.position.x - 4), 0, v.position.z);
    } else {
      this.playerPos.set(
        v.position.x - Math.cos(v.heading) * 2.2,
        0,
        v.position.z + Math.sin(v.heading) * 2.2,
      );
    }
    this.playerGroup.position.copy(this.playerPos);
    this.playerGroup.visible = true;
    this.drivingVehicle = null;
    this.sound.setDrivingState(false, 0);
  }

  private updateTrafficSignals(dt: number) {
    this.signalTimer = (this.signalTimer + dt) % 16;
    const state =
      this.signalTimer < 6
        ? 'NS_GREEN'
        : this.signalTimer < 8
          ? 'NS_YELLOW'
          : this.signalTimer < 14
            ? 'EW_GREEN'
            : 'EW_YELLOW';

    for (const sig of this.trafficSignals) {
      if (sig.state === state) continue;
      sig.state = state;
      const isGreen = state === 'NS_GREEN' || state === 'EW_GREEN';
      const isYellow = state === 'NS_YELLOW' || state === 'EW_YELLOW';
      for (const r of sig.redLights) {
        (r.material as THREE.MeshBasicMaterial).color.setHex(
          !isGreen && !isYellow ? 0xff0033 : 0x33000a,
        );
      }
      for (const y of sig.yellowLights) {
        (y.material as THREE.MeshBasicMaterial).color.setHex(
          isYellow ? 0xfbbf24 : 0x332200,
        );
      }
      for (const g of sig.greenLights) {
        (g.material as THREE.MeshBasicMaterial).color.setHex(
          isGreen ? 0x10b981 : 0x003311,
        );
      }
    }
  }

  private updateTrafficVehicles(dt: number) {
    const t = performance.now() * 0.008;

    for (const v of this.vehicles) {
      if (v.isPlayerDriven) continue;

      // Police Cruiser Pursuit AI
      if (v.isPoliceAI) {
        // Flash police lightbar
        if (v.sirenLightLeft && v.sirenLightRight) {
          const phase = Math.sin(t * 2.5) > 0;
          (v.sirenLightLeft.material as THREE.MeshBasicMaterial).color.setHex(
            phase ? 0xff0033 : 0x0044ff,
          );
          (v.sirenLightRight.material as THREE.MeshBasicMaterial).color.setHex(
            phase ? 0x0044ff : 0xff0033,
          );
        }

        if (this.wantedLevel > 0) {
          const dx = this.playerPos.x - v.position.x;
          const dz = this.playerPos.z - v.position.z;
          const dist = Math.hypot(dx, dz);
          if (dist > 7) {
            const targetH = Math.atan2(dx, dz);
            v.heading = targetH;
            const step = 16 * dt;
            const nx = v.position.x + Math.sin(v.heading) * step;
            const nz = v.position.z + Math.cos(v.heading) * step;
            if (
              nx < WATER_EAST_X - 4 &&
              !this.checkBuildingCollision(nx, nz, 1.4)
            ) {
              v.position.set(nx, 0, nz);
              v.mesh.position.copy(v.position);
              v.mesh.rotation.y = v.heading;
            }
          }
        }
        continue;
      }

      if (!v.isTrafficAI || !v.aiLaneAxis || !v.aiDirection) continue;

      // Check if approaching a red traffic signal or player
      const distToPlayer = v.position.distanceTo(this.playerPos);
      if (distToPlayer < 6.5) {
        v.speed = 0;
        continue;
      }

      v.speed = 11.5;
      if (v.aiLaneAxis === 'z') {
        v.position.z += v.aiDirection * v.speed * dt;
        if (v.position.z > 95) v.position.z = -95;
        if (v.position.z < -95) v.position.z = 95;
      } else {
        v.position.x += v.aiDirection * v.speed * dt;
        if (v.position.x > 72) v.position.x = -85;
        if (v.position.x < -85) v.position.x = 72;
      }

      v.mesh.position.copy(v.position);
      for (const w of v.wheels) {
        w.rotation.x += v.speed * dt * 1.4;
      }
    }
  }

  private updateNPCsAndPolice(dt: number) {
    // Wanted Heat Cooldown & Siren Audio
    if (this.wantedLevel > 0) {
      this.wantedHeatTimer += dt;
      this.sirenSoundCooldown -= dt;
      if (this.sirenSoundCooldown <= 0) {
        this.sound.playPoliceSirenBlip();
        this.sirenSoundCooldown = 1.4;
      }
      // If player avoids further crimes for 32 seconds, reduce 1 star
      if (this.wantedHeatTimer > 32) {
        this.wantedLevel = Math.max(0, this.wantedLevel - 1);
        this.wantedHeatTimer = 0;
        this.showToast(
          this.wantedLevel === 0
            ? 'VCPD Lost Visual — Wanted Level Cleared'
            : `Wanted Level Decreased to ${this.wantedLevel} ★`,
        );
      }
    }

    for (const npc of this.npcs) {
      if (npc.state === 'dead') continue;

      if (npc.hitFlashTimer > 0) {
        npc.hitFlashTimer -= dt;
      }

      // Check vehicle roadkill collision if player is driving fast
      if (
        this.drivingVehicle &&
        Math.abs(this.drivingVehicle.speed) > 9 &&
        npc.position.distanceTo(this.drivingVehicle.position) < 2.2
      ) {
        this.damageNPC(npc, 90, true);
        continue;
      }

      const distToPlayer = npc.position.distanceTo(this.playerPos);

      // Police pursue when wantedLevel > 0; Gang / Mission Targets attack when close
      const isHostile =
        (npc.role === NPCRole.POLICE && this.wantedLevel > 0) ||
        npc.role === NPCRole.GANG_SYNDICATE ||
        npc.role === NPCRole.MISSION_TARGET;

      if (isHostile && distToPlayer < 36) {
        const dx = this.playerPos.x - npc.position.x;
        const dz = this.playerPos.z - npc.position.z;
        npc.heading = Math.atan2(dx, dz);
        npc.mesh.rotation.y = npc.heading;

        if (distToPlayer > 11) {
          const step = 5.2 * dt;
          const nx = npc.position.x + Math.sin(npc.heading) * step;
          const nz = npc.position.z + Math.cos(npc.heading) * step;
          if (!this.checkBuildingCollision(nx, nz, 0.5)) {
            npc.position.set(nx, 0, nz);
            npc.mesh.position.copy(npc.position);
          }
          npc.walkPhase += dt * 10;
          npc.leftLeg.rotation.x = Math.sin(npc.walkPhase) * 0.5;
          npc.rightLeg.rotation.x = -Math.sin(npc.walkPhase) * 0.5;
          npc.rightArm.rotation.x = -1.4;
        } else {
          npc.leftLeg.rotation.x = 0;
          npc.rightLeg.rotation.x = 0;
          npc.rightArm.rotation.x = -1.45;
          npc.attackCooldown -= dt;
          if (npc.attackCooldown <= 0) {
            npc.attackCooldown = 1.35 + Math.random() * 0.6;
            this.enemyFireAtPlayer(npc);
          }
        }
      } else {
        // Pedestrian stroll or flee
        const moveSpd = npc.state === 'flee' ? 6.2 : 2.1;
        const nx = npc.position.x + Math.sin(npc.heading) * moveSpd * dt;
        const nz = npc.position.z + Math.cos(npc.heading) * moveSpd * dt;

        if (
          nx > WATER_EAST_X - 6 ||
          Math.abs(nx) > 105 ||
          Math.abs(nz) > 105 ||
          this.checkBuildingCollision(nx, nz, 0.55)
        ) {
          npc.heading += Math.PI * 0.65;
        } else {
          npc.position.set(nx, 0, nz);
          npc.mesh.position.copy(npc.position);
          npc.mesh.rotation.y = npc.heading;
        }

        npc.walkPhase += dt * (npc.state === 'flee' ? 12 : 5);
        const swing = Math.sin(npc.walkPhase) * 0.42;
        npc.leftLeg.rotation.x = swing;
        npc.rightLeg.rotation.x = -swing;
        npc.leftArm.rotation.x = -swing * 0.6;
        npc.rightArm.rotation.x = swing * 0.6;
      }
    }
  }

  private enemyFireAtPlayer(npc: ActiveNPC) {
    const start = npc.position.clone().add(new THREE.Vector3(0, 1.35, 0));
    const end = this.playerPos
      .clone()
      .add(
        new THREE.Vector3(
          (Math.random() - 0.5) * 1.4,
          1.1,
          (Math.random() - 0.5) * 1.4,
        ),
      );
    this.spawnBulletTracer(start, end, 0xfbbf24);

    if (Math.random() < 0.55) {
      this.applyDamageToPlayer(6);
    }
  }

  private applyDamageToPlayer(dmg: number) {
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, dmg * 0.7);
      this.armor -= absorbed;
      this.health -= dmg - absorbed;
    } else {
      this.health -= dmg;
    }

    if (this.health <= 0) {
      this.health = 0;
      this.mode = GameMode.WASTED;
      if (this.drivingVehicle) {
        this.exitVehicle();
      }
    }
  }

  private respawnPlayer() {
    this.health = this.maxHealth;
    this.armor = 50;
    this.wantedLevel = 0;
    this.wantedHeatTimer = 0;
    this.cash = Math.max(0, this.cash - 100);
    this.playerPos.set(62, 0, 18);
    this.playerGroup.position.copy(this.playerPos);
    this.showToast('Patched up at Ocean Drive Clinic (-$100)');
  }

  private startReload() {
    const w = this.weapons[this.activeWeaponIndex];
    if (
      !w ||
      w.spec.isMelee ||
      this.reloadTimer > 0 ||
      w.clipAmmo >= w.spec.clipSize ||
      w.reserveAmmo <= 0
    ) {
      return;
    }
    this.reloadTimer = w.spec.reloadTime;
    this.sound.playUIClick();
  }

  private tryAttackOrFire() {
    if (this.reloadTimer > 0 || this.fireCooldown > 0 || this.drivingVehicle) {
      return;
    }

    const w = this.weapons[this.activeWeaponIndex];
    if (!w) return;

    if (!w.spec.isMelee && w.clipAmmo <= 0) {
      this.startReload();
      return;
    }

    this.fireCooldown = 1 / w.spec.fireRate;
    if (!w.spec.isMelee) {
      w.clipAmmo--;
      if (w.clipAmmo === 0 && w.reserveAmmo > 0) {
        this.startReload();
      }
    }

    this.sound.playWeaponFire(w.spec.id);
    this.cameraShake = w.spec.isMelee ? 0.08 : 0.14;

    // Alert nearby pedestrians to flee
    if (!w.spec.isMelee) {
      for (const npc of this.npcs) {
        if (
          npc.role === NPCRole.PEDESTRIAN &&
          npc.state !== 'dead' &&
          npc.position.distanceTo(this.playerPos) < 28
        ) {
          npc.state = 'flee';
        }
      }
    }

    // Raycast / Cone check against NPCs in camera look direction
    const forward = new THREE.Vector3(
      -Math.sin(this.cameraYaw),
      0,
      -Math.cos(this.cameraYaw),
    ).normalize();
    this.playerHeading = this.cameraYaw + Math.PI;
    this.playerGroup.rotation.y = this.playerHeading;

    const muzzlePos = this.playerPos
      .clone()
      .add(new THREE.Vector3(0, 1.38, 0))
      .addScaledVector(forward, 0.5);

    for (let p = 0; p < w.spec.pellets; p++) {
      const spreadDir = forward
        .clone()
        .add(
          new THREE.Vector3(
            (Math.random() - 0.5) * w.spec.spread,
            (Math.random() - 0.5) * w.spec.spread * 0.5,
            (Math.random() - 0.5) * w.spec.spread,
          ),
        )
        .normalize();

      let hitNpc: ActiveNPC | null = null;
      let bestDist = w.spec.range;

      for (const npc of this.npcs) {
        if (npc.state === 'dead') continue;
        _scratchVec1.subVectors(npc.position, this.playerPos);
        _scratchVec1.y = 0;
        const d = _scratchVec1.length();
        if (d > bestDist || d < 0.2) continue;
        _scratchVec1.normalize();
        const dot = _scratchVec1.dot(spreadDir);
        const angleThreshold = w.spec.isMelee ? 0.55 : 0.94;
        if (dot >= angleThreshold) {
          bestDist = d;
          hitNpc = npc;
        }
      }

      const endPoint = hitNpc
        ? hitNpc.position.clone().add(new THREE.Vector3(0, 1.2, 0))
        : muzzlePos.clone().addScaledVector(spreadDir, w.spec.range);

      if (!w.spec.isMelee) {
        this.spawnBulletTracer(muzzlePos, endPoint, w.spec.color);
      }

      if (hitNpc) {
        this.damageNPC(hitNpc, w.spec.damage, true);
        this.spawnParticleBurst(endPoint, w.spec.color, 5);
      }
    }
  }

  private damageNPC(npc: ActiveNPC, dmg: number, byPlayer: boolean) {
    if (npc.state === 'dead') return;
    npc.health -= dmg;
    npc.hitFlashTimer = 0.15;

    if (npc.health <= 0) {
      npc.state = 'dead';
      npc.mesh.rotation.x = -Math.PI / 2;
      npc.mesh.position.y = 0.22;
      if (byPlayer) {
        const dropCash =
          npc.role === NPCRole.MISSION_TARGET ||
          npc.role === NPCRole.GANG_SYNDICATE
            ? 250
            : 45;
        this.cash += dropCash;
        this.reputation += 15;
        this.sound.playCashSound();
        if (npc.role === NPCRole.POLICE) {
          this.addWantedHeat(2, 'Police Officer Down — VCPD Reinforcement Dispatched!');
        } else if (npc.role === NPCRole.PEDESTRIAN) {
          this.addWantedHeat(1, 'Assault Witnessed — VCPD Alerted!');
        }
      }
    }
  }

  private addWantedHeat(starsDelta: number, reason: string) {
    this.wantedHeatTimer = 0;
    const prev = this.wantedLevel;
    this.wantedLevel = Math.min(5, Math.max(this.wantedLevel, prev + starsDelta));
    this.showToast(`★ WANTED LEVEL ${this.wantedLevel}: ${reason}`);

    // Spawn a pursuing Police Interceptor Cruiser if Wanted >= 2
    if (this.wantedLevel >= 2) {
      const activePoliceCars = this.vehicles.filter((v) => v.isPoliceAI).length;
      if (activePoliceCars < this.wantedLevel) {
        const spawnPos = new THREE.Vector3(
          THREE.MathUtils.clamp(this.playerPos.x - 28, -80, 65),
          0,
          THREE.MathUtils.clamp(this.playerPos.z - 28, -80, 80),
        );
        this.spawnVehicle(VehicleClass.POLICE, spawnPos, 0, false, true);
      }
    }
  }

  private spawnBulletTracer(
    start: THREE.Vector3,
    end: THREE.Vector3,
    colorHex: number,
  ) {
    const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
    const mat = new THREE.LineBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.9,
    });
    const line = new THREE.Line(geo, mat);
    this.add(line);
    this.tracers.push({ line, life: 0.08 });
  }

  private spawnParticleBurst(
    pos: THREE.Vector3,
    colorHex: number,
    count: number,
  ) {
    const geo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
    const mat = new THREE.MeshBasicMaterial({ color: colorHex });
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 6,
        2 + Math.random() * 4,
        (Math.random() - 0.5) * 6,
      );
      this.add(mesh);
      this.particles.push({ mesh, velocity, life: 0.35 });
    }
  }

  private updateCombatAndParticles(dt: number) {
    if (this.fireCooldown > 0) {
      this.fireCooldown -= dt;
    }

    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        const w = this.weapons[this.activeWeaponIndex];
        if (w) {
          const needed = w.spec.clipSize - w.clipAmmo;
          const load = Math.min(needed, w.reserveAmmo);
          w.clipAmmo += load;
          w.reserveAmmo -= load;
        }
      }
    }

    if (this.fireHeld && this.fireCooldown <= 0) {
      this.tryAttackOrFire();
    }

    for (let i = this.tracers.length - 1; i >= 0; i--) {
      this.tracers[i].life -= dt;
      if (this.tracers[i].life <= 0) {
        this.remove(this.tracers[i].line);
        this.tracers[i].line.geometry.dispose();
        this.tracers.splice(i, 1);
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.mesh.position.addScaledVector(p.velocity, dt);
      p.mesh.scale.setScalar(Math.max(0.01, p.life * 2.8));
      if (p.life <= 0) {
        this.remove(p.mesh);
        this.particles.splice(i, 1);
      }
    }
  }

  private updateCollectiblesAndBusinesses(dt: number) {
    // Check Hidden Neon Package Pickups
    for (const col of this.collectibles) {
      if (col.collected) continue;
      if (this.playerPos.distanceTo(col.position) < 2.6) {
        col.collected = true;
        col.mesh.visible = false;
        this.cash += 500;
        this.reputation += 50;
        this.health = Math.min(this.maxHealth, this.health + 25);
        this.sound.playCashSound();
        const total = this.collectibles.filter((c) => c.collected).length;
        this.showToast(
          `Hidden Neon Package Found (${total}/${this.collectibles.length})! +$500 & +50 REP`,
        );
      }
    }

    // Passive Income from Owned Syndicate Properties every 15 seconds
    this.passiveIncomeTimer += dt;
    if (this.passiveIncomeTimer >= 15) {
      this.passiveIncomeTimer = 0;
      const owned = this.businesses.filter((b) => b.owned);
      if (owned.length > 0) {
        const payout = Math.round(
          owned.reduce((acc, b) => acc + b.incomePerMinute, 0) / 4,
        );
        this.cash += payout;
        this.showToast(`Syndicate Property Payout: +$${payout.toLocaleString()}`);
      }
    }
  }

  private syncMissionWaypoint() {
    const mission = MISSIONS[this.currentMissionIndex];
    if (!mission) {
      this.missionWaypointMesh.visible = false;
      return;
    }
    const step = mission.steps[this.currentStepIndex];
    if (!step) {
      this.missionWaypointMesh.visible = false;
      return;
    }
    this.missionWaypointMesh.visible = true;
    this.missionWaypointMesh.position.set(
      step.targetPosition.x,
      8,
      step.targetPosition.z,
    );
    this.missionTimerRemaining = step.timeLimitSeconds ?? null;

    if (step.spawnEnemiesCount && step.spawnEnemiesCount > 0) {
      // Remove old mission targets first
      for (const npc of this.npcs) {
        if (npc.role === NPCRole.MISSION_TARGET) {
          this.remove(npc.mesh);
          npc.state = 'dead';
        }
      }
      for (let i = 0; i < step.spawnEnemiesCount; i++) {
        const angle = (i / step.spawnEnemiesCount) * Math.PI * 2;
        const pos = new THREE.Vector3(
          step.targetPosition.x + Math.cos(angle) * 6,
          0,
          step.targetPosition.z + Math.sin(angle) * 6,
        );
        this.spawnNPC(NPCRole.MISSION_TARGET, pos, 'Chrome Syndicate Guard');
      }
    }

    if (step.wantedStarsTrigger) {
      this.addWantedHeat(
        step.wantedStarsTrigger,
        'Syndicate Ambush Alerted VCPD!',
      );
    }
  }

  private triggerStepDialogue() {
    const mission = MISSIONS[this.currentMissionIndex];
    const step = mission?.steps[this.currentStepIndex];
    if (step) {
      this.dialogueSpeaker = step.dialogueSpeaker;
      this.dialogueText = step.dialogueText;
      this.dialogueTimer = 8.5;
    }
  }

  private updateMissions(dt: number) {
    const mission = MISSIONS[this.currentMissionIndex];
    if (!mission) return;
    const step = mission.steps[this.currentStepIndex];
    if (!step) return;

    if (this.missionTimerRemaining !== null) {
      this.missionTimerRemaining -= dt;
      if (this.missionTimerRemaining <= 0) {
        this.missionTimerRemaining = null;
        this.currentStepIndex = 0;
        this.syncMissionWaypoint();
        this.showToast('Time Expired! Mission Reset to Checkpoint 1');
        return;
      }
    }

    const dist = Math.hypot(
      this.playerPos.x - step.targetPosition.x,
      this.playerPos.z - step.targetPosition.z,
    );

    let stepComplete = false;
    if (step.type === 'goto' || step.type === 'race_checkpoint') {
      if (dist <= step.targetRadius) {
        stepComplete = true;
      }
    } else if (step.type === 'enter_vehicle') {
      if (this.drivingVehicle) {
        stepComplete = true;
      }
    } else if (step.type === 'eliminate_targets') {
      const aliveTargets = this.npcs.filter(
        (n) => n.role === NPCRole.MISSION_TARGET && n.state !== 'dead',
      );
      if (aliveTargets.length === 0) {
        stepComplete = true;
      }
    } else if (step.type === 'escape_wanted') {
      if (this.wantedLevel === 0 || dist <= step.targetRadius) {
        this.wantedLevel = 0;
        stepComplete = true;
      }
    }

    if (stepComplete) {
      if (step.compoundQuery) {
        // Open Bio-Chem Lab and verify the mission compound automatically
        void this.hud.triggerLabQuery(step.compoundQuery);
      }

      this.currentStepIndex++;
      if (this.currentStepIndex >= mission.steps.length) {
        // Mission Complete!
        this.cash += mission.rewardCash;
        this.reputation += mission.rewardReputation;
        if (!this.completedMissionIds.includes(mission.id)) {
          this.completedMissionIds.push(mission.id);
        }
        this.sound.playMissionFanfare();
        this.showToast(
          `MISSION PASSED: ${mission.title} (+$${mission.rewardCash.toLocaleString()} & +${mission.rewardReputation} REP)`,
        );
        this.currentMissionIndex = Math.min(
          MISSIONS.length - 1,
          this.currentMissionIndex + 1,
        );
        this.currentStepIndex = 0;
        this.syncMissionWaypoint();
        this.triggerStepDialogue();
      } else {
        this.sound.playCashSound();
        this.syncMissionWaypoint();
        this.triggerStepDialogue();
      }
    }
  }

  private updateChaseCamera(dt: number) {
    const cam = xb.core.camera;
    if (!cam) return;

    const isDriving = Boolean(this.drivingVehicle);
    const dist = isDriving ? 8.2 : this.isAiming ? 2.6 : 4.8;
    const height = isDriving ? 2.9 : this.isAiming ? 1.65 : 2.15;
    const shoulderOffset = this.isAiming ? 0.55 : 0.25;

    const sinY = Math.sin(this.cameraYaw);
    const cosY = Math.cos(this.cameraYaw);

    _camTargetPos.set(
      this.playerPos.x + sinY * dist + cosY * shoulderOffset,
      Math.max(0.8, this.playerPos.y + height + Math.sin(this.cameraPitch) * 2.2),
      this.playerPos.z + cosY * dist - sinY * shoulderOffset,
    );

    if (this.cameraShake > 0) {
      this.cameraShake = Math.max(0, this.cameraShake - dt * 1.5);
      _camTargetPos.x += (Math.random() - 0.5) * this.cameraShake;
      _camTargetPos.y += (Math.random() - 0.5) * this.cameraShake;
    }

    const damp = 1 - Math.exp(-12 * dt);
    cam.position.lerp(_camTargetPos, damp);

    _camLookAt.set(
      this.playerPos.x - sinY * 6,
      this.playerPos.y + 1.45 - Math.sin(this.cameraPitch) * 3.2,
      this.playerPos.z - cosY * 6,
    );
    cam.lookAt(_camLookAt);
  }

  private buyWeaponOrAmmo(id: WeaponId) {
    const w = this.weapons.find((item) => item.spec.id === id);
    if (!w) return;
    if (!w.unlocked) {
      if (this.cash >= w.spec.price) {
        this.cash -= w.spec.price;
        w.unlocked = true;
        w.clipAmmo = w.spec.clipSize;
        w.reserveAmmo = w.spec.clipSize * 3;
        this.activeWeaponIndex = this.weapons.indexOf(w);
        this.sound.playCashSound();
        this.showToast(`Unlocked ${w.spec.name}!`);
      } else {
        this.showToast(`Need $${w.spec.price} to unlock ${w.spec.name}`);
      }
    } else {
      if (this.cash >= w.spec.ammoCost) {
        this.cash -= w.spec.ammoCost;
        w.reserveAmmo += w.spec.clipSize * 2;
        this.sound.playCashSound();
        this.showToast(`Purchased Ammo for ${w.spec.name}`);
      } else {
        this.showToast(`Need $${w.spec.ammoCost} for Ammo`);
      }
    }
  }

  private equipOrBuyOutfit(outfitId: string) {
    const out = OUTFIT_CATALOG.find((o) => o.id === outfitId);
    if (!out) return;
    if (!this.ownedOutfitIds.includes(outfitId)) {
      if (this.cash < out.price) {
        this.showToast(`Need $${out.price} for ${out.name}`);
        return;
      }
      this.cash -= out.price;
      this.ownedOutfitIds.push(outfitId);
      this.sound.playCashSound();
    }
    this.activeOutfitId = outfitId;
    this.applyOutfitColors(outfitId);
    this.showToast(`Wearing ${out.name}`);
  }

  private applyOutfitColors(outfitId: string) {
    const out = OUTFIT_CATALOG.find((o) => o.id === outfitId);
    if (!out) return;
    this.playerBlazerMat?.color.setHex(out.blazerColor);
    this.playerShirtMat?.color.setHex(out.shirtColor);
    this.playerPantsMat?.color.setHex(out.pantsColor);
  }

  private handleSpawnGarageVehicle(vClass: VehicleClass) {
    const spec = VEHICLE_SPECS[vClass];
    if (!this.storedVehicles.includes(vClass)) {
      if (this.cash < spec.price) {
        this.showToast(`Need $${spec.price.toLocaleString()} for ${spec.name}`);
        return;
      }
      this.cash -= spec.price;
      this.storedVehicles.push(vClass);
      this.sound.playCashSound();
    }

    const spawnPos = spec.isWaterOnly
      ? new THREE.Vector3(118, -0.1, 55)
      : new THREE.Vector3(
          Math.min(WATER_EAST_X - 6, this.playerPos.x + 4),
          0,
          this.playerPos.z + 4,
        );
    const v = this.spawnVehicle(vClass, spawnPos, this.playerHeading, false, false);
    this.enterVehicle(v);
    this.showToast(`Delivered ${spec.name}!`);
  }

  private buyBusiness(bizId: string) {
    const biz = this.businesses.find((b) => b.id === bizId);
    if (!biz || biz.owned) return;
    if (this.cash < biz.price) {
      this.showToast(`Need $${biz.price.toLocaleString()} to acquire ${biz.name}`);
      return;
    }
    this.cash -= biz.price;
    biz.owned = true;
    this.reputation += 250;
    this.sound.playMissionFanfare();
    this.showToast(
      `Acquired ${biz.name}! Passive Income +$${biz.incomePerMinute}/min`,
    );
  }

  private showToast(msg: string) {
    this.notificationBanner = msg;
    this.notificationTimer = 4.2;
    if (this.spatialStatusText) {
      this.spatialStatusText.text = msg;
    }
  }

  private getCurrentDistrictName(): string {
    if (this.playerPos.x > 48) return 'Ocean Drive Beachfront';
    if (this.playerPos.x < -90) return 'Vice International Airport';
    if (this.playerPos.z > 52) return 'Port Vice Harbor & Labs';
    if (this.playerPos.x < -38) return 'Starlight West';
    return 'Vice Downtown Skyline';
  }

  private getContextPrompt(): string | null {
    if (this.drivingVehicle) return null;

    for (const z of this.interactiveZones) {
      if (this.playerPos.distanceTo(z.position) <= z.radius) {
        return z.prompt;
      }
    }

    for (const v of this.vehicles) {
      if (this.playerPos.distanceTo(v.position) <= 5.0) {
        return `Press E or F to Enter ${v.spec.name}`;
      }
    }

    return null;
  }

  private buildHUDSnapshot(): HUDStateSnapshot {
    const mission = MISSIONS[this.currentMissionIndex] || MISSIONS[0];
    const step = mission.steps[this.currentStepIndex] || mission.steps[0];
    const station = this.sound.getCurrentStation();

    return {
      mode: this.mode,
      hasSaveData: this.hasSavedGame(),
      cash: this.cash,
      reputation: this.reputation,
      health: this.health,
      maxHealth: this.maxHealth,
      armor: this.armor,
      maxArmor: this.maxArmor,
      wantedLevel: this.wantedLevel,
      wantedCooldownProgress: this.wantedHeatTimer / 32,
      activeWeapon: this.weapons[this.activeWeaponIndex] || this.weapons[0],
      allWeapons: this.weapons,
      isReloading: this.reloadTimer > 0,
      playerPos: { x: this.playerPos.x, z: this.playerPos.z },
      playerHeading: this.playerHeading,
      drivingVehicle: this.drivingVehicle,
      radioName: station.name,
      radioGenre: station.genre,
      activeMissionTitle: mission.title,
      activeStepInstruction: step.instruction,
      missionTargetPos: {
        x: step.targetPosition.x,
        z: step.targetPosition.z,
      },
      missionTimerRemaining: this.missionTimerRemaining,
      contextPrompt: this.getContextPrompt(),
      activeShopTab: this.activeShopTab,
      dialogueSpeaker: this.dialogueSpeaker,
      dialogueText: this.dialogueText,
      notificationBanner: this.notificationBanner,
      districtName: this.getCurrentDistrictName(),
      weather: this.weather,
      timeOfDay: this.timeOfDay,
      muted: this.sound.muted,
      volume: this.sound.masterVolume,
      mouseSensitivity: this.mouseSensitivity,
      vehicles: this.vehicles,
      npcs: this.npcs,
      businesses: this.businesses,
      collectibles: this.collectibles,
      ownedOutfitIds: this.ownedOutfitIds,
      activeOutfitId: this.activeOutfitId,
      storedVehicles: this.storedVehicles,
      completedMissionIds: this.completedMissionIds,
    };
  }

  public override dispose() {
    this.sound.dispose();
  }
}
