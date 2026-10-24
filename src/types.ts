import * as THREE from 'three';

export enum GameMode {
  TITLE = 'TITLE',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  MAP = 'MAP',
  WEAPON_WHEEL = 'WEAPON_WHEEL',
  SHOP = 'SHOP',
  BIOCHEM_LAB = 'BIOCHEM_LAB',
  MISSION_COMPLETE = 'MISSION_COMPLETE',
  WASTED = 'WASTED',
}

export enum WeatherType {
  CLEAR_SUNSET = 'CLEAR_SUNSET',
  TROPICAL_DAY = 'TROPICAL_DAY',
  NEON_NIGHT = 'NEON_NIGHT',
  NEON_RAIN = 'NEON_RAIN',
}

export enum VehicleClass {
  SPORTS = 'SPORTS',
  SEDAN = 'SEDAN',
  MOTORCYCLE = 'MOTORCYCLE',
  TAXI = 'TAXI',
  TRUCK = 'TRUCK',
  BOAT = 'BOAT',
  POLICE = 'POLICE',
}

export interface VehicleSpec {
  id: VehicleClass;
  name: string;
  maxSpeed: number;
  acceleration: number;
  braking: number;
  turnSpeed: number;
  driftFactor: number;
  maxHealth: number;
  isWaterOnly?: boolean;
  price: number;
  defaultColor: number;
  accentColor: number;
}

export interface ActiveVehicle {
  id: string;
  spec: VehicleSpec;
  mesh: THREE.Group;
  wheels: THREE.Object3D[];
  sirenLightLeft?: THREE.Mesh;
  sirenLightRight?: THREE.Mesh;
  headlights: THREE.Light[];
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  heading: number;
  speed: number;
  steerAngle: number;
  health: number;
  maxHealth: number;
  isPlayerDriven: boolean;
  isTrafficAI: boolean;
  isPoliceAI: boolean;
  aiLaneAxis?: 'x' | 'z';
  aiDirection?: number;
  colorHex: number;
}

export enum WeaponId {
  FISTS = 'FISTS',
  PISTOL = 'PISTOL',
  SMG = 'SMG',
  SHOTGUN = 'SHOTGUN',
  PLASMA_RIFLE = 'PLASMA_RIFLE',
}

export interface WeaponSpec {
  id: WeaponId;
  name: string;
  damage: number;
  fireRate: number; // shots per second
  range: number;
  clipSize: number;
  reloadTime: number;
  spread: number;
  pellets: number;
  price: number;
  ammoCost: number;
  color: number;
  isMelee?: boolean;
}

export interface WeaponState {
  spec: WeaponSpec;
  unlocked: boolean;
  clipAmmo: number;
  reserveAmmo: number;
}

export enum NPCRole {
  PEDESTRIAN = 'PEDESTRIAN',
  POLICE = 'POLICE',
  GANG_SYNDICATE = 'GANG_SYNDICATE',
  MISSION_TARGET = 'MISSION_TARGET',
  ALLY = 'ALLY',
}

export interface ActiveNPC {
  id: string;
  name: string;
  role: NPCRole;
  mesh: THREE.Group;
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  heading: number;
  health: number;
  maxHealth: number;
  state: 'walk' | 'flee' | 'pursue' | 'attack' | 'dead';
  attackCooldown: number;
  dialogueLine?: string;
  homeDistrict: string;
  walkPhase: number;
  hitFlashTimer: number;
}

export interface MissionStep {
  id: string;
  instruction: string;
  targetPosition: THREE.Vector3;
  targetRadius: number;
  type:
    | 'goto'
    | 'enter_vehicle'
    | 'eliminate_targets'
    | 'collect_item'
    | 'escape_wanted'
    | 'race_checkpoint'
    | 'analyze_compound';
  requiredVehicleClass?: VehicleClass;
  spawnEnemiesCount?: number;
  wantedStarsTrigger?: number;
  timeLimitSeconds?: number;
  compoundQuery?: string;
  dialogueSpeaker: string;
  dialogueText: string;
}

export interface MissionDefinition {
  id: string;
  title: string;
  giver: string;
  district: string;
  isSideMission: boolean;
  startMarker: THREE.Vector3;
  rewardCash: number;
  rewardReputation: number;
  description: string;
  steps: MissionStep[];
}

export interface BusinessProperty {
  id: string;
  name: string;
  district: string;
  position: THREE.Vector3;
  price: number;
  incomePerMinute: number;
  owned: boolean;
  description: string;
  accentColor: string;
}

export interface CollectiblePackage {
  id: string;
  position: THREE.Vector3;
  mesh: THREE.Group;
  collected: boolean;
  district: string;
}

export interface TrafficSignal {
  position: THREE.Vector3;
  redLights: THREE.Mesh[];
  yellowLights: THREE.Mesh[];
  greenLights: THREE.Mesh[];
  state: 'NS_GREEN' | 'NS_YELLOW' | 'EW_GREEN' | 'EW_YELLOW';
}

export interface OutfitOption {
  id: string;
  name: string;
  blazerColor: number;
  shirtColor: number;
  pantsColor: number;
  price: number;
  owned: boolean;
}

export interface SaveGameData {
  cash: number;
  reputation: number;
  health: number;
  armor: number;
  currentMissionIndex: number;
  completedMissionIds: string[];
  collectedPackageIds: string[];
  ownedBusinessIds: string[];
  ownedOutfitIds: string[];
  activeOutfitId: string;
  storedVehicles: VehicleClass[];
  weapons: {
    id: WeaponId;
    unlocked: boolean;
    clipAmmo: number;
    reserveAmmo: number;
  }[];
  timeOfDay: number;
  weather: WeatherType;
}
