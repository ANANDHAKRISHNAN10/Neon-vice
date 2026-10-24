import * as THREE from 'three';
import {
  BusinessProperty,
  MissionDefinition,
  OutfitOption,
  VehicleClass,
  VehicleSpec,
  WeaponId,
  WeaponSpec,
} from './types';

export const CITY_BOUNDS = 240; // -240 to +240 meters
export const WATER_EAST_X = 105; // Ocean starts at X > 105

export const VEHICLE_SPECS: Record<VehicleClass, VehicleSpec> = {
  [VehicleClass.SPORTS]: {
    id: VehicleClass.SPORTS,
    name: 'Cheetah Testarossa 86',
    maxSpeed: 36,
    acceleration: 24,
    braking: 28,
    turnSpeed: 2.5,
    driftFactor: 0.92,
    maxHealth: 140,
    price: 4500,
    defaultColor: 0xff2a85,
    accentColor: 0x00f0ff,
  },
  [VehicleClass.SEDAN]: {
    id: VehicleClass.SEDAN,
    name: 'Oceanic Cruiser Brougham',
    maxSpeed: 24,
    acceleration: 15,
    braking: 20,
    turnSpeed: 2.1,
    driftFactor: 0.85,
    maxHealth: 160,
    price: 1800,
    defaultColor: 0x00d8c0,
    accentColor: 0xfff3d1,
  },
  [VehicleClass.MOTORCYCLE]: {
    id: VehicleClass.MOTORCYCLE,
    name: 'Vortex Katana 900',
    maxSpeed: 39,
    acceleration: 30,
    braking: 32,
    turnSpeed: 3.1,
    driftFactor: 0.9,
    maxHealth: 95,
    price: 2600,
    defaultColor: 0x9d4edd,
    accentColor: 0x00f5d4,
  },
  [VehicleClass.TAXI]: {
    id: VehicleClass.TAXI,
    name: 'Vice Checker Cab',
    maxSpeed: 26,
    acceleration: 17,
    braking: 22,
    turnSpeed: 2.3,
    driftFactor: 0.88,
    maxHealth: 165,
    price: 1500,
    defaultColor: 0xffbe0b,
    accentColor: 0x111827,
  },
  [VehicleClass.TRUCK]: {
    id: VehicleClass.TRUCK,
    name: 'Harbor Hauler 6x6',
    maxSpeed: 21,
    acceleration: 12,
    braking: 18,
    turnSpeed: 1.65,
    driftFactor: 0.78,
    maxHealth: 280,
    price: 3400,
    defaultColor: 0x3a86ff,
    accentColor: 0xe5e7eb,
  },
  [VehicleClass.BOAT]: {
    id: VehicleClass.BOAT,
    name: 'Stinger Scarab Speedboat',
    maxSpeed: 34,
    acceleration: 22,
    braking: 16,
    turnSpeed: 2.2,
    driftFactor: 0.94,
    maxHealth: 180,
    isWaterOnly: true,
    price: 5200,
    defaultColor: 0xffffff,
    accentColor: 0xff006e,
  },
  [VehicleClass.POLICE]: {
    id: VehicleClass.POLICE,
    name: 'VCPD Interceptor',
    maxSpeed: 33,
    acceleration: 22,
    braking: 26,
    turnSpeed: 2.4,
    driftFactor: 0.89,
    maxHealth: 200,
    price: 6000,
    defaultColor: 0x111827,
    accentColor: 0xffffff,
  },
};

export const WEAPON_SPECS: Record<WeaponId, WeaponSpec> = {
  [WeaponId.FISTS]: {
    id: WeaponId.FISTS,
    name: 'Street Brawler Fists',
    damage: 28,
    fireRate: 2.8,
    range: 2.6,
    clipSize: 999,
    reloadTime: 0,
    spread: 0.1,
    pellets: 1,
    price: 0,
    ammoCost: 0,
    color: 0xfbbf24,
    isMelee: true,
  },
  [WeaponId.PISTOL]: {
    id: WeaponId.PISTOL,
    name: 'Vice 9mm Auto',
    damage: 34,
    fireRate: 4.5,
    range: 65,
    clipSize: 15,
    reloadTime: 1.2,
    spread: 0.015,
    pellets: 1,
    price: 400,
    ammoCost: 80,
    color: 0x38bdf8,
  },
  [WeaponId.SMG]: {
    id: WeaponId.SMG,
    name: 'Mac-10 Neon Pulse',
    damage: 22,
    fireRate: 11,
    range: 55,
    clipSize: 32,
    reloadTime: 1.5,
    spread: 0.045,
    pellets: 1,
    price: 1200,
    ammoCost: 150,
    color: 0xf43f5e,
  },
  [WeaponId.SHOTGUN]: {
    id: WeaponId.SHOTGUN,
    name: 'Palm Street Sweeper',
    damage: 24,
    fireRate: 1.4,
    range: 34,
    clipSize: 8,
    reloadTime: 2.0,
    spread: 0.09,
    pellets: 6,
    price: 2200,
    ammoCost: 200,
    color: 0xf97316,
  },
  [WeaponId.PLASMA_RIFLE]: {
    id: WeaponId.PLASMA_RIFLE,
    name: 'Outrun Heavy Carbine',
    damage: 58,
    fireRate: 6.5,
    range: 95,
    clipSize: 25,
    reloadTime: 1.6,
    spread: 0.01,
    pellets: 1,
    price: 4500,
    ammoCost: 300,
    color: 0xa855f7,
  },
};

export const OUTFIT_CATALOG: OutfitOption[] = [
  {
    id: 'miami_pastel',
    name: 'Ocean Drive Pastel',
    blazerColor: 0xf8fafc,
    shirtColor: 0x06b6d4,
    pantsColor: 0xe2e8f0,
    price: 0,
    owned: true,
  },
  {
    id: 'crimson_kingpin',
    name: 'Sunset Kingpin',
    blazerColor: 0xe11d48,
    shirtColor: 0x111827,
    pantsColor: 0x1f2937,
    price: 850,
    owned: false,
  },
  {
    id: 'midnight_synth',
    name: 'Midnight Outrun',
    blazerColor: 0x311042,
    shirtColor: 0xf43f5e,
    pantsColor: 0x0f172a,
    price: 1400,
    owned: false,
  },
  {
    id: 'emerald_cartel',
    name: 'Starlight VIP Gold',
    blazerColor: 0x047857,
    shirtColor: 0xfbbf24,
    pantsColor: 0xf8fafc,
    price: 2500,
    owned: false,
  },
];

export const INITIAL_BUSINESSES: BusinessProperty[] = [
  {
    id: 'biz_malibu_club',
    name: 'Club Flamingo Lounge',
    district: 'Ocean Drive Beach',
    position: new THREE.Vector3(68, 0, -45),
    price: 3000,
    incomePerMinute: 450,
    owned: false,
    description: 'Iconic beachfront synth-pop nightclub with VIP tables.',
    accentColor: '#ff2a85',
  },
  {
    id: 'biz_sunshine_autos',
    name: 'Vice Exotic Customs & Garage',
    district: 'Starlight West',
    position: new THREE.Vector3(-68, 0, 22),
    price: 4500,
    incomePerMinute: 700,
    owned: false,
    description: 'High-end vehicle respray, repair bay, and import showroom.',
    accentColor: '#00f0ff',
  },
  {
    id: 'biz_biochem_lab',
    name: 'Port Vice Bio-Chem Synthesis Lab',
    district: 'Port Vice Harbor',
    position: new THREE.Vector3(-22, 0, 92),
    price: 6500,
    incomePerMinute: 1100,
    owned: false,
    description:
      'Coastal pharmaceutical & PubChem molecular analysis terminal.',
    accentColor: '#10b981',
  },
  {
    id: 'biz_skyline_tower',
    name: 'Vance Crown Tower',
    district: 'Vice Downtown',
    position: new THREE.Vector3(18, 0, -18),
    price: 12000,
    incomePerMinute: 2200,
    owned: false,
    description: 'Downtown corporate skyscraper controlling the city skyline.',
    accentColor: '#a855f7',
  },
];

export const RADIO_STATIONS = [
  {
    id: 'flash_86',
    name: 'FLASH 86.5 FM',
    genre: '80s Synthpop & Outrun',
    bpm: 118,
    rootNote: 220, // A3
    scale: [0, 3, 5, 7, 10, 12],
  },
  {
    id: 'wave_103',
    name: 'WAVE 103.9',
    genre: 'New Wave & Sunset Arpeggios',
    bpm: 126,
    rootNote: 196, // G3
    scale: [0, 2, 4, 7, 9, 12],
  },
  {
    id: 'vice_electro',
    name: 'VICE BEAT 94.1',
    genre: 'Electro Funk & Bassline',
    bpm: 110,
    rootNote: 164.81, // E3
    scale: [0, 3, 5, 6, 7, 10],
  },
  {
    id: 'night_drive',
    name: 'NIGHTDRIVE 107.7',
    genre: 'Dark Cyber Synthwave',
    bpm: 132,
    rootNote: 146.83, // D3
    scale: [0, 1, 5, 7, 8, 12],
  },
  {
    id: 'radio_off',
    name: 'RADIO OFF',
    genre: 'Engine Audio Only',
    bpm: 0,
    rootNote: 0,
    scale: [],
  },
];

export const MISSIONS: MissionDefinition[] = [
  {
    id: 'm1_neon_arrival',
    title: '01. Neon Arrival',
    giver: 'Sonny Cortez',
    district: 'Ocean Drive Beach',
    isSideMission: false,
    startMarker: new THREE.Vector3(42, 0, 15),
    rewardCash: 1500,
    rewardReputation: 150,
    description:
      'Retrieve Sonny’s custom Cheetah Testarossa from the Downtown Parking Plaza and deliver it to the Ocean Drive Hotel.',
    steps: [
      {
        id: 'm1_s1',
        instruction:
          'Head to the Downtown Plaza marker and pick up the stashed Sports Car.',
        targetPosition: new THREE.Vector3(-12, 0, -28),
        targetRadius: 9,
        type: 'goto',
        dialogueSpeaker: 'Sonny Cortez',
        dialogueText:
          'Welcome to Neon Vice, Vance. My prized Cheetah 86 is parked downtown. Go grab it before the cops impound it.',
      },
      {
        id: 'm1_s2',
        instruction: 'Press E or F to get behind the wheel of a vehicle.',
        targetPosition: new THREE.Vector3(-12, 0, -28),
        targetRadius: 14,
        type: 'enter_vehicle',
        dialogueSpeaker: 'Vance',
        dialogueText:
          'Clean lines, twin turbos. Let’s hear this engine purr down Ocean Drive.',
      },
      {
        id: 'm1_s3',
        instruction:
          'Deliver the car to the Ocean Drive Beachfront Hotel drop-off.',
        targetPosition: new THREE.Vector3(72, 0, -35),
        targetRadius: 12,
        type: 'goto',
        timeLimitSeconds: 95,
        dialogueSpeaker: 'Sonny Cortez',
        dialogueText:
          'Bring her straight to the Ocean Drive Hotel VIP lane. Keep the paint clean!',
      },
    ],
  },
  {
    id: 'm2_chem_intercept',
    title: '02. Molecular Contraband',
    giver: 'Dr. Elena Rostova',
    district: 'Port Vice Harbor',
    isSideMission: false,
    startMarker: new THREE.Vector3(-25, 0, 75),
    rewardCash: 2800,
    rewardReputation: 300,
    description:
      'Ambush the Chrome Syndicate biochemical shipment in the Industrial Zone, eliminate the guards, and verify the compound at the Port Bio-Chem Lab.',
    steps: [
      {
        id: 'm2_s1',
        instruction:
          'Travel to the Industrial Exchange and confront the Chrome Syndicate guards.',
        targetPosition: new THREE.Vector3(-75, 0, 68),
        targetRadius: 14,
        type: 'goto',
        spawnEnemiesCount: 3,
        dialogueSpeaker: 'Dr. Elena Rostova',
        dialogueText:
          'The Chrome Syndicate hijacked our pure Lidocaine & Adrenaline precursors. Hit their depot in West Harbor.',
      },
      {
        id: 'm2_s2',
        instruction:
          'Eliminate the Chrome Syndicate guards protecting the shipment.',
        targetPosition: new THREE.Vector3(-75, 0, 68),
        targetRadius: 28,
        type: 'eliminate_targets',
        dialogueSpeaker: 'Vance',
        dialogueText:
          'Syndicate enforcers spotted. Time to clear the loading dock.',
      },
      {
        id: 'm2_s3',
        instruction:
          'Deliver the recovered chemical case to the Port Bio-Chem Lab.',
        targetPosition: new THREE.Vector3(-22, 0, 92),
        targetRadius: 10,
        type: 'goto',
        compoundQuery: 'Lidocaine',
        dialogueSpeaker: 'Dr. Elena Rostova',
        dialogueText:
          'Incredible work! Bring the sample back to the Bio-Chem Lab so we can run a live PubChem structure verification.',
      },
    ],
  },
  {
    id: 'm3_street_heat',
    title: '03. Outrun Sunset Circuit',
    giver: 'Rico "Turbo" Diaz',
    district: 'Vice Downtown',
    isSideMission: false,
    startMarker: new THREE.Vector3(12, 0, -55),
    rewardCash: 4000,
    rewardReputation: 450,
    description:
      'Blast through 4 high-speed checkpoints across Downtown, Starlight Avenue, Airport Runway, and Ocean Drive before the clock hits zero.',
    steps: [
      {
        id: 'm3_s1',
        instruction: 'Checkpoint 1/4: Sprint or drive to Starlight North Arch.',
        targetPosition: new THREE.Vector3(-65, 0, -65),
        targetRadius: 14,
        type: 'race_checkpoint',
        timeLimitSeconds: 120,
        dialogueSpeaker: 'Rico Diaz',
        dialogueText:
          'Hit the gas, Vance! Four checkpoints across the city—show them who owns these neon streets!',
      },
      {
        id: 'm3_s2',
        instruction:
          'Checkpoint 2/4: Tear down to the Vice Airport Runway South.',
        targetPosition: new THREE.Vector3(-115, 0, 35),
        targetRadius: 15,
        type: 'race_checkpoint',
        dialogueSpeaker: 'Rico Diaz',
        dialogueText:
          'Checkpoint 1 cleared! Now open up the throttle toward the Airport Runway!',
      },
      {
        id: 'm3_s3',
        instruction: 'Checkpoint 3/4: Cut East through Port Vice Harbor.',
        targetPosition: new THREE.Vector3(25, 0, 82),
        targetRadius: 15,
        type: 'race_checkpoint',
        dialogueSpeaker: 'Vance',
        dialogueText: 'Tires are glowing hot—one more stretch to the beach!',
      },
      {
        id: 'm3_s4',
        instruction: 'Final Checkpoint 4/4: Finish at Ocean Drive Pier!',
        targetPosition: new THREE.Vector3(82, 0, 12),
        targetRadius: 15,
        type: 'race_checkpoint',
        dialogueSpeaker: 'Rico Diaz',
        dialogueText:
          'New city record! Nobody touches your lap time in Neon Vice!',
      },
    ],
  },
  {
    id: 'm4_harbor_heist',
    title: '04. Scarab Bay Escape',
    giver: 'Sonny Cortez',
    district: 'Port Vice Harbor',
    isSideMission: false,
    startMarker: new THREE.Vector3(78, 0, 62),
    rewardCash: 6500,
    rewardReputation: 650,
    description:
      'Steal the high-speed Stinger Speedboat from the East Marina, survive a 3-Star VCPD pursuit across the ocean bay, and lose the heat.',
    steps: [
      {
        id: 'm4_s1',
        instruction:
          'Head to the East Marina Pier where the Stinger Speedboat is moored.',
        targetPosition: new THREE.Vector3(114, 0, 55),
        targetRadius: 14,
        type: 'goto',
        wantedStarsTrigger: 3,
        dialogueSpeaker: 'Sonny Cortez',
        dialogueText:
          'The harbor patrol tipped off VCPD! Grab the Scarab Speedboat at the Marina Pier and hit the open water!',
      },
      {
        id: 'm4_s2',
        instruction:
          'Pilot the boat or drive to the Northern Cove Smuggler Buoy.',
        targetPosition: new THREE.Vector3(122, 0, -75),
        targetRadius: 18,
        type: 'goto',
        dialogueSpeaker: 'Vance',
        dialogueText:
          'Sirens all over the boardwalk! Taking her full throttle north across the bay!',
      },
      {
        id: 'm4_s3',
        instruction:
          'Evade the police or reach the Vice Customs Respray Garage to clear your Wanted level.',
        targetPosition: new THREE.Vector3(-68, 0, 22),
        targetRadius: 14,
        type: 'escape_wanted',
        dialogueSpeaker: 'Sonny Cortez',
        dialogueText:
          'Lose the VCPD tail or duck into Vice Customs on Starlight West to clear the heat!',
      },
    ],
  },
  {
    id: 'm5_crown_of_vice',
    title: '05. Crown of Neon Vice',
    giver: 'Vance Syndicate',
    district: 'Vice Downtown',
    isSideMission: false,
    startMarker: new THREE.Vector3(0, 0, 0),
    rewardCash: 15000,
    rewardReputation: 1200,
    description:
      'Storm the Chrome Syndicate’s Downtown Citadel, defeat Lazarus Vega’s elite strike team, and claim the Neon Vice empire.',
    steps: [
      {
        id: 'm5_s1',
        instruction:
          'Advance on the Downtown Syndicate Citadel Plaza for the final showdown.',
        targetPosition: new THREE.Vector3(18, 0, -18),
        targetRadius: 16,
        type: 'goto',
        spawnEnemiesCount: 6,
        wantedStarsTrigger: 2,
        dialogueSpeaker: 'Vance',
        dialogueText:
          'Lazarus Vega thinks he can run Neon Vice from his glass tower. Let’s take the whole empire.',
      },
      {
        id: 'm5_s2',
        instruction:
          'Defeat Lazarus Vega and his elite Chrome Syndicate bodyguards!',
        targetPosition: new THREE.Vector3(18, 0, -18),
        targetRadius: 35,
        type: 'eliminate_targets',
        dialogueSpeaker: 'Lazarus Vega',
        dialogueText:
          'You never should have crossed the bridge into Downtown, Vance! Security—open fire!',
      },
      {
        id: 'm5_s3',
        instruction:
          'Return to the Ocean Drive Safehouse Terrace to celebrate your takeover.',
        targetPosition: new THREE.Vector3(65, 0, 25),
        targetRadius: 12,
        type: 'goto',
        dialogueSpeaker: 'Sonny Cortez',
        dialogueText:
          'Lazarus is finished! From the docks to the skyline, Neon Vice City belongs to you, Boss!',
      },
    ],
  },
];

export const PEDESTRIAN_QUIPS = [
  'Watch the pastel suit, pal—it’s imported!',
  'Have you heard the new synth track on Flash 86.5?',
  'Ocean Drive at sunset... nothing beats Neon Vice.',
  'VCPD sirens have been going off all night.',
  'I’m saving up for a Cheetah Testarossa!',
  'Stay clear of Port Vice after midnight.',
  'Club Flamingo is packed tonight!',
];
