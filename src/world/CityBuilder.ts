import * as THREE from 'three';
import { INITIAL_BUSINESSES, WATER_EAST_X } from '../constants';
import {
  BusinessProperty,
  CollectiblePackage,
  TrafficSignal,
} from '../types';
import {
  createCollectibleMesh,
  createPalmTree,
  getBuildingWindowTexture,
  getProceduralRoadTexture,
} from './ProceduralModels';

export interface InteractiveZone {
  id: string;
  label: string;
  prompt: string;
  type: 'safehouse' | 'weapon_shop' | 'garage' | 'biochem_lab' | 'business';
  position: THREE.Vector3;
  radius: number;
  businessRef?: BusinessProperty;
  beaconMesh: THREE.Mesh;
}

export interface BuiltCity {
  cityGroup: THREE.Group;
  buildingColliders: THREE.Box3[];
  trafficSignals: TrafficSignal[];
  interactiveZones: InteractiveZone[];
  collectibles: CollectiblePackage[];
  oceanMesh: THREE.Mesh;
  roadMaterial: THREE.MeshStandardMaterial;
  roadGridLines: { axis: 'x' | 'z'; coord: number }[];
}

export function buildNeonViceCity(maxAnisotropy = 4): BuiltCity {
  const cityGroup = new THREE.Group();
  const buildingColliders: THREE.Box3[] = [];
  const trafficSignals: TrafficSignal[] = [];
  const interactiveZones: InteractiveZone[] = [];
  const collectibles: CollectiblePackage[] = [];

  // 1. Base Turf / Island Ground (West & Central Landmass)
  const landGeo = new THREE.PlaneGeometry(360, 480);
  const landMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.88,
    metalness: 0.05,
  });
  const landMesh = new THREE.Mesh(landGeo, landMat);
  landMesh.rotation.x = -Math.PI / 2;
  landMesh.position.set(-75, 0, 0);
  landMesh.receiveShadow = true;
  cityGroup.add(landMesh);

  // 2. Ocean Drive Sandy Beach Strip (X from 78 to 108)
  const beachGeo = new THREE.PlaneGeometry(34, 480);
  const beachMat = new THREE.MeshStandardMaterial({
    color: 0xeab308,
    roughness: 0.92,
    metalness: 0.02,
  });
  const beachMesh = new THREE.Mesh(beachGeo, beachMat);
  beachMesh.rotation.x = -Math.PI / 2;
  beachMesh.position.set(92, 0.01, 0);
  beachMesh.receiveShadow = true;
  cityGroup.add(beachMesh);

  // 3. Tropical Ocean Water (East X > 105)
  const oceanGeo = new THREE.PlaneGeometry(260, 560, 28, 28);
  const oceanMat = new THREE.MeshPhysicalMaterial({
    color: 0x0284c7,
    roughness: 0.15,
    metalness: 0.25,
    clearcoat: 0.95,
    clearcoatRoughness: 0.1,
  });
  const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
  oceanMesh.rotation.x = -Math.PI / 2;
  oceanMesh.position.set(WATER_EAST_X + 125, -0.15, 0);
  cityGroup.add(oceanMesh);

  // Marina Wooden Pier extending into the water at (114, 0, 55)
  const pierMesh = new THREE.Mesh(
    new THREE.BoxGeometry(26, 0.5, 8),
    new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 }),
  );
  pierMesh.position.set(112, 0.25, 55);
  pierMesh.receiveShadow = true;
  cityGroup.add(pierMesh);

  // 4. Road Grid Network
  const roadTex = getProceduralRoadTexture(maxAnisotropy);
  const roadMaterial = new THREE.MeshStandardMaterial({
    map: roadTex,
    roughness: 0.35,
    metalness: 0.25,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const roadZCoords = [-80, -40, 0, 40, 80];
  const roadXCoords = [-80, -40, 0, 40, 75];
  const roadWidth = 14;
  const roadGridLines: { axis: 'x' | 'z'; coord: number }[] = [];

  for (const z of roadZCoords) {
    roadGridLines.push({ axis: 'x', coord: z });
    const rTex = roadTex.clone();
    rTex.needsUpdate = true;
    rTex.repeat.set(1, 20);
    const mat = roadMaterial.clone();
    mat.map = rTex;
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(roadWidth, 220),
      mat,
    );
    road.rotation.x = -Math.PI / 2;
    road.rotation.z = Math.PI / 2;
    road.position.set(-10, 0.03, z);
    road.receiveShadow = true;
    cityGroup.add(road);
  }

  for (const x of roadXCoords) {
    roadGridLines.push({ axis: 'z', coord: x });
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(roadWidth, 240),
      roadMaterial,
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(x, 0.04, 0);
    road.receiveShadow = true;
    cityGroup.add(road);
  }

  // 5. Airport Runway Strip in Far West (X = -118)
  const runway = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 210),
    new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.5,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  runway.rotation.x = -Math.PI / 2;
  runway.position.set(-118, 0.03, 0);
  cityGroup.add(runway);

  // Runway Center Stripes
  for (let rz = -90; rz <= 90; rz += 18) {
    const stripe = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 9),
      new THREE.MeshBasicMaterial({ color: 0xf8fafc }),
    );
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(-118, 0.05, rz);
    cityGroup.add(stripe);
  }

  // 6. Traffic Signals at Central Intersections
  const signalCoords = [
    [-40, -40],
    [0, -40],
    [40, -40],
    [-40, 0],
    [0, 0],
    [40, 0],
    [-40, 40],
    [0, 40],
    [40, 40],
  ];

  const poleMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.7,
    roughness: 0.3,
  });

  for (const [ix, iz] of signalCoords) {
    const sigGroup = new THREE.Group();
    sigGroup.position.set(ix + 7.5, 0, iz + 7.5);

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.18, 5.2, 8),
      poleMat,
    );
    pole.position.y = 2.6;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.14, 0.14), poleMat);
    arm.position.set(-1.2, 4.9, 0);
    const housing = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 1.1, 0.45),
      poleMat,
    );
    housing.position.set(-2.1, 4.6, 0);

    const rBulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff0033 }),
    );
    rBulb.position.set(-2.1, 4.92, 0.22);

    const yBulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x332200 }),
    );
    yBulb.position.set(-2.1, 4.6, 0.22);

    const gBulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x003311 }),
    );
    gBulb.position.set(-2.1, 4.28, 0.22);

    sigGroup.add(pole, arm, housing, rBulb, yBulb, gBulb);
    cityGroup.add(sigGroup);

    trafficSignals.push({
      position: new THREE.Vector3(ix, 0, iz),
      redLights: [rBulb],
      yellowLights: [yBulb],
      greenLights: [gBulb],
      state: 'NS_GREEN',
    });
  }

  // 7. Procedural Buildings across Districts
  const winTexCyan = getBuildingWindowTexture('#00f0ff', maxAnisotropy);
  const winTexPink = getBuildingWindowTexture('#ff2a85', maxAnisotropy);

  function addCompositeBuilding(
    bx: number,
    bz: number,
    w: number,
    h: number,
    d: number,
    baseHex: number,
    neonHex: number,
    useWindowTex = true,
  ) {
    const bGroup = new THREE.Group();
    bGroup.position.set(bx, 0, bz);

    const bMat = new THREE.MeshStandardMaterial({
      color: baseHex,
      map: useWindowTex
        ? neonHex === 0xff2a85
          ? winTexPink
          : winTexCyan
        : null,
      roughness: 0.42,
      metalness: 0.35,
    });

    // Main Tower Body
    const mainTower = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bMat);
    mainTower.position.y = h / 2;
    mainTower.castShadow = true;
    mainTower.receiveShadow = true;
    bGroup.add(mainTower);

    // Secondary Stepped Podium / Crown
    const crown = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.76, h * 0.16, d * 0.76),
      new THREE.MeshStandardMaterial({
        color: baseHex,
        roughness: 0.3,
        metalness: 0.6,
      }),
    );
    crown.position.y = h + (h * 0.16) / 2;
    bGroup.add(crown);

    // Glowing Neon Roof Trim Band
    const neonBand = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.3, 0.45, d + 0.3),
      new THREE.MeshBasicMaterial({ color: neonHex }),
    );
    neonBand.position.y = h - 0.5;
    bGroup.add(neonBand);

    // Vertical Neon Fins on Art Deco / Downtown Towers
    const finGeo = new THREE.BoxGeometry(0.35, h * 0.85, d + 0.35);
    const fin = new THREE.Mesh(
      finGeo,
      new THREE.MeshBasicMaterial({ color: neonHex }),
    );
    fin.position.y = h * 0.45;
    bGroup.add(fin);

    cityGroup.add(bGroup);

    const box = new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(bx, h / 2, bz),
      new THREE.Vector3(w + 0.8, h, d + 0.8),
    );
    buildingColliders.push(box);
  }

  // Ocean Drive Art Deco Hotels (X ~ 56)
  const artDecoRows = [-62, -22, 18, 58];
  const decoColors = [0xfdf2f8, 0xe0f2fe, 0xfef9c3, 0xf3e8ff];
  const decoNeons = [0xff2a85, 0x00f0ff, 0xf97316, 0xa855f7];
  artDecoRows.forEach((bz, i) => {
    addCompositeBuilding(
      57,
      bz,
      14,
      14 + (i % 2) * 5,
      18,
      decoColors[i % decoColors.length],
      decoNeons[i % decoNeons.length],
      true,
    );
  });

  // Vice Downtown Skyscrapers (Center X: -20 to +22, Z: -60 to +22)
  const downtownBlocks = [
    [-20, -60, 16, 38, 16, 0x1e293b, 0x00f0ff],
    [20, -60, 16, 44, 16, 0x0f172a, 0xff2a85],
    [-20, -20, 15, 34, 15, 0x1e1b4b, 0xa855f7],
    [20, -20, 16, 48, 16, 0x0f172a, 0x00f0ff], // Vance Crown Tower
    [-20, 20, 15, 28, 15, 0x1e293b, 0xf43f5e],
    [20, 20, 14, 24, 14, 0x334155, 0x38bdf8],
  ];
  for (const [bx, bz, w, h, d, col, neon] of downtownBlocks) {
    addCompositeBuilding(bx, bz, w, h, d, col, neon, true);
  }

  // Starlight West Villas & Customs (X: -60)
  const westBlocks = [
    [-60, -60, 16, 16, 16, 0x312e81, 0x38bdf8],
    [-60, -20, 16, 18, 16, 0x1e293b, 0xff2a85],
    [-60, 20, 16, 12, 16, 0x0f172a, 0x00f0ff], // Vice Exotic Customs
  ];
  for (const [bx, bz, w, h, d, col, neon] of westBlocks) {
    addCompositeBuilding(bx, bz, w, h, d, col, neon, true);
  }

  // Port Vice Harbor & Bio-Chem Industrial Zone (South Z ~ 62 to 98)
  addCompositeBuilding(-22, 98, 20, 14, 14, 0x064e3b, 0x10b981, true); // Bio-Chem Lab
  addCompositeBuilding(-60, 62, 18, 11, 14, 0x7c2d12, 0xf97316, false); // Cargo Depot
  addCompositeBuilding(20, 62, 18, 12, 14, 0x1e3a8a, 0x38bdf8, false); // Harbor Warehouse

  // Airport Control Tower & Hangar
  addCompositeBuilding(-98, -25, 10, 26, 10, 0x334155, 0x00f0ff, true);
  addCompositeBuilding(-98, 25, 14, 10, 22, 0x475569, 0xfbbf24, false);

  // 8. Palm Trees along Ocean Drive & Boulevards
  const palmCoords = [
    [82, -75],
    [82, -50],
    [82, -25],
    [82, 0],
    [82, 25],
    [82, 50],
    [82, 75],
    [48, -50],
    [48, -10],
    [48, 30],
    [-8, -50],
    [-8, -10],
    [-8, 30],
    [8, -50],
    [8, 30],
    [-48, -30],
    [-48, 10],
  ];
  for (const [px, pz] of palmCoords) {
    const tree = createPalmTree(0.9 + Math.random() * 0.25);
    tree.position.set(px, 0, pz);
    tree.rotation.y = Math.random() * Math.PI * 2;
    cityGroup.add(tree);
  }

  // 9. Interactive Zone Beacons (Safehouse, Weapon Shop, Garage, Bio-Chem Lab, Businesses)
  function addZone(
    id: string,
    label: string,
    prompt: string,
    type: InteractiveZone['type'],
    pos: THREE.Vector3,
    hexColor: number,
    businessRef?: BusinessProperty,
  ) {
    const beaconGeo = new THREE.CylinderGeometry(2.2, 2.2, 2.6, 24, 1, true);
    const beaconMat = new THREE.MeshBasicMaterial({
      color: hexColor,
      transparent: true,
      opacity: 0.38,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
    beaconMesh.position.copy(pos);
    beaconMesh.position.y = 1.3;
    cityGroup.add(beaconMesh);

    interactiveZones.push({
      id,
      label,
      prompt,
      type,
      position: pos.clone(),
      radius: 4.2,
      businessRef,
      beaconMesh,
    });
  }

  // Safehouse at Ocean Drive
  addZone(
    'zone_safehouse',
    'Ocean Drive Safehouse & Wardrobe',
    'Press E to Save Game, Heal & Change Outfit',
    'safehouse',
    new THREE.Vector3(65, 0, 25),
    0x38bdf8,
  );

  // Weapon Shop Downtown
  addZone(
    'zone_weapon_shop',
    'Vice Tactical Arms & Armor',
    'Press E to Browse Weapons, Ammo & Body Armor',
    'weapon_shop',
    new THREE.Vector3(-28, 0, -12),
    0xf43f5e,
  );

  // Customs Respray & Garage
  addZone(
    'zone_customs',
    'Vice Exotic Customs & Respray',
    'Press E to Repair Vehicle & Clear Wanted Heat ($300)',
    'garage',
    new THREE.Vector3(-68, 0, 22),
    0xfbbf24,
  );

  // Bio-Chem Molecular Lab Terminal
  addZone(
    'zone_biochem_lab',
    'Port Vice Bio-Chem Synthesis Lab',
    'Press E to Open Live PubChem Molecular Inspector',
    'biochem_lab',
    new THREE.Vector3(-22, 0, 88),
    0x10b981,
  );

  // Purchasable Businesses
  for (const biz of INITIAL_BUSINESSES) {
    addZone(
      `zone_${biz.id}`,
      biz.name,
      `Press E to Inspect / Purchase Property ($${biz.price.toLocaleString()})`,
      'business',
      biz.position,
      0xa855f7,
      biz,
    );
  }

  // 10. 12 Hidden Neon Packages across the city
  const packageLocations: [number, number, string][] = [
    [88, -68, 'Ocean Drive North Beach'],
    [88, 35, 'Ocean Drive South Pier'],
    [118, 55, 'Marina Boat Dock'],
    [2, -68, 'Downtown North Plaza'],
    [-28, -32, 'Downtown Alley'],
    [28, 28, 'Downtown South'],
    [-68, -50, 'Starlight West Villa'],
    [-68, 52, 'Starlight Industrial Edge'],
    [-118, -65, 'Airport North Threshold'],
    [-118, 65, 'Airport South Hangar'],
    [-45, 88, 'Port Vice Container Yard'],
    [45, 85, 'Harbor South Point'],
  ];

  packageLocations.forEach(([kx, kz, dist], idx) => {
    const mesh = createCollectibleMesh();
    mesh.position.set(kx, 0, kz);
    cityGroup.add(mesh);
    collectibles.push({
      id: `pkg_${idx + 1}`,
      position: new THREE.Vector3(kx, 0, kz),
      mesh,
      collected: false,
      district: dist,
    });
  });

  return {
    cityGroup,
    buildingColliders,
    trafficSignals,
    interactiveZones,
    collectibles,
    oceanMesh,
    roadMaterial,
    roadGridLines,
  };
}
