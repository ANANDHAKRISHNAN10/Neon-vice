import * as THREE from 'three';
import { NPCRole, OutfitOption, VehicleClass } from '../types';

let sharedContactShadowTex: THREE.CanvasTexture | null = null;
let sharedRoadTex: THREE.CanvasTexture | null = null;
let sharedWindowTex: THREE.CanvasTexture | null = null;

export function getContactShadowTexture(): THREE.CanvasTexture {
  if (sharedContactShadowTex) return sharedContactShadowTex;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.68)');
  grad.addColorStop(0.6, 'rgba(0, 0, 0, 0.25)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  sharedContactShadowTex = new THREE.CanvasTexture(canvas);
  sharedContactShadowTex.colorSpace = THREE.SRGBColorSpace;
  return sharedContactShadowTex;
}

export function getProceduralRoadTexture(
  maxAnisotropy = 4,
): THREE.CanvasTexture {
  if (sharedRoadTex) return sharedRoadTex;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Dark wet-look asphalt base
  ctx.fillStyle = '#181b24';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle asphalt grain
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 22 + Math.floor(Math.random() * 18);
    ctx.fillStyle = `rgb(${v},${v + 2},${v + 8})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Sidewalk curb lines
  ctx.fillStyle = '#334155';
  ctx.fillRect(0, 0, 28, 512);
  ctx.fillRect(484, 0, 28, 512);

  // Neon double yellow center divider
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(248, 0, 5, 512);
  ctx.fillRect(259, 0, 5, 512);

  // Dashed lane lines
  ctx.fillStyle = '#cbd5e1';
  for (let y = 16; y < 512; y += 64) {
    ctx.fillRect(132, y, 6, 32);
    ctx.fillRect(374, y, 6, 32);
  }

  sharedRoadTex = new THREE.CanvasTexture(canvas);
  sharedRoadTex.wrapS = THREE.RepeatWrapping;
  sharedRoadTex.wrapT = THREE.RepeatWrapping;
  sharedRoadTex.colorSpace = THREE.SRGBColorSpace;
  sharedRoadTex.anisotropy = maxAnisotropy;
  return sharedRoadTex;
}

export function getBuildingWindowTexture(
  accentHex = '#00f0ff',
  maxAnisotropy = 4,
): THREE.CanvasTexture {
  if (sharedWindowTex && accentHex === '#00f0ff') return sharedWindowTex;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 256, 512);

  const cols = 4;
  const rows = 10;
  const padX = 12;
  const padY = 12;
  const w = (256 - padX * (cols + 1)) / cols;
  const h = (512 - padY * (rows + 1)) / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = (r * 7 + c * 3) % 5 !== 0;
      if (lit) {
        ctx.fillStyle =
          (r + c) % 4 === 0
            ? accentHex
            : (r + c) % 3 === 0
              ? '#fde047'
              : '#38bdf8';
      } else {
        ctx.fillStyle = '#1e293b';
      }
      ctx.fillRect(padX + c * (w + padX), padY + r * (h + padY), w, h);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  if (accentHex === '#00f0ff') sharedWindowTex = tex;
  return tex;
}

/**
 * Builds an articulated 10-part character model (Player or NPC) with bottom-center pivot at y=0.
 */
export function createCharacterModel(options: {
  role: NPCRole | 'PLAYER';
  outfit?: OutfitOption;
}): {
  group: THREE.Group;
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  blazerMat: THREE.MeshStandardMaterial;
  shirtMat: THREE.MeshStandardMaterial;
  pantsMat: THREE.MeshStandardMaterial;
} {
  const group = new THREE.Group();

  let blazerHex = 0xf8fafc;
  let shirtHex = 0x06b6d4;
  let pantsHex = 0xe2e8f0;
  const skinHex = 0xe0ac69;
  let hairHex = 0x1e1b18;

  if (options.outfit) {
    blazerHex = options.outfit.blazerColor;
    shirtHex = options.outfit.shirtColor;
    pantsHex = options.outfit.pantsColor;
  } else if (options.role === NPCRole.POLICE) {
    blazerHex = 0x1e3a8a;
    shirtHex = 0x93c5fd;
    pantsHex = 0x0f172a;
  } else if (options.role === NPCRole.GANG_SYNDICATE) {
    blazerHex = 0x9f1239;
    shirtHex = 0x111827;
    pantsHex = 0x18181b;
    hairHex = 0xf43f5e;
  } else if (options.role === NPCRole.PEDESTRIAN) {
    const palette = [0xff006e, 0x3a86ff, 0xfb5607, 0x8338ec, 0x06d6a0];
    blazerHex = palette[Math.floor(Math.random() * palette.length)];
    shirtHex = 0xffffff;
    pantsHex = 0x334155;
  }

  const blazerMat = new THREE.MeshStandardMaterial({
    color: blazerHex,
    roughness: 0.55,
    metalness: 0.1,
  });
  const shirtMat = new THREE.MeshStandardMaterial({
    color: shirtHex,
    roughness: 0.75,
    metalness: 0.05,
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: pantsHex,
    roughness: 0.65,
    metalness: 0.08,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: skinHex,
    roughness: 0.6,
    metalness: 0.05,
  });
  const shoeMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.3,
    metalness: 0.35,
  });
  const visorMat = new THREE.MeshStandardMaterial({
    color: 0x090d16,
    roughness: 0.12,
    metalness: 0.9,
    emissive: options.role === NPCRole.GANG_SYNDICATE ? 0xff0055 : 0x00e5ff,
    emissiveIntensity: 0.35,
  });

  // 1. Contact shadow at ground y=0.02
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 1.1),
    new THREE.MeshBasicMaterial({
      map: getContactShadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.55,
    }),
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.02;
  group.add(shadowPlane);

  // 2 & 3. Left & Right Legs (pivoted at hip y = 0.86)
  const legGeo = new THREE.BoxGeometry(0.18, 0.72, 0.18);
  legGeo.translate(0, -0.36, 0);
  const shoeGeo = new THREE.BoxGeometry(0.2, 0.12, 0.28);

  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.13, 0.84, 0);
  const leftLegMesh = new THREE.Mesh(legGeo, pantsMat);
  leftLegMesh.castShadow = true;
  const leftShoe = new THREE.Mesh(shoeGeo, shoeMat);
  leftShoe.position.set(0, -0.74, 0.04);
  leftLeg.add(leftLegMesh, leftShoe);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.13, 0.84, 0);
  const rightLegMesh = new THREE.Mesh(legGeo, pantsMat);
  rightLegMesh.castShadow = true;
  const rightShoe = new THREE.Mesh(shoeGeo, shoeMat);
  rightShoe.position.set(0, -0.74, 0.04);
  rightLeg.add(rightLegMesh, rightShoe);

  group.add(leftLeg, rightLeg);

  // 4. Torso / 80s Blazer Jacket
  const torsoMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.64, 0.26),
    blazerMat,
  );
  torsoMesh.position.set(0, 1.18, 0);
  torsoMesh.castShadow = true;
  group.add(torsoMesh);

  // 5. Inner V-Neck Shirt Chest Strip
  const shirtStrip = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.56, 0.28),
    shirtMat,
  );
  shirtStrip.position.set(0, 1.19, 0.01);
  group.add(shirtStrip);

  // 6. Collar Lapels
  const collar = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.12, 0.29),
    blazerMat,
  );
  collar.position.set(0, 1.46, 0);
  group.add(collar);

  // 7 & 8. Left & Right Arms (pivoted at shoulder y = 1.44)
  const armGeo = new THREE.BoxGeometry(0.15, 0.62, 0.15);
  armGeo.translate(0, -0.31, 0);

  const leftArm = new THREE.Group();
  leftArm.position.set(-0.33, 1.44, 0);
  const leftSleeve = new THREE.Mesh(armGeo, blazerMat);
  leftSleeve.castShadow = true;
  const leftHand = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 10, 10),
    skinMat,
  );
  leftHand.position.set(0, -0.62, 0);
  leftArm.add(leftSleeve, leftHand);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.33, 1.44, 0);
  const rightSleeve = new THREE.Mesh(armGeo, blazerMat);
  rightSleeve.castShadow = true;
  const rightHand = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 10, 10),
    skinMat,
  );
  rightHand.position.set(0, -0.62, 0);
  // Prop handgun on right hand for player/police/gang
  if (options.role !== NPCRole.PEDESTRIAN) {
    const gunBarrel = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.08, 0.26),
      shoeMat,
    );
    gunBarrel.position.set(0, -0.62, 0.14);
    rightArm.add(gunBarrel);
  }
  rightArm.add(rightSleeve, rightHand);
  group.add(leftArm, rightArm);

  // 9. Head
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.34, 0.32),
    skinMat,
  );
  head.position.set(0, 1.71, 0);
  head.castShadow = true;
  group.add(head);

  // 10. 80s Aviator Sunglasses + Hair / Police Cap
  const shades = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.09, 0.08),
    visorMat,
  );
  shades.position.set(0, 1.73, 0.15);
  group.add(shades);

  const hair = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.12, 0.35),
    new THREE.MeshStandardMaterial({
      color: options.role === NPCRole.POLICE ? 0x1e3a8a : hairHex,
      roughness: 0.7,
    }),
  );
  hair.position.set(0, 1.9, 0);
  group.add(hair);

  return {
    group,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    blazerMat,
    shirtMat,
    pantsMat,
  };
}

/**
 * Builds a composite 7-to-11 part 3D vehicle model with bottom-center ground pivot at y=0.
 */
export function createVehicleModel(
  vClass: VehicleClass,
  primaryHex: number,
  accentHex: number,
): {
  group: THREE.Group;
  wheels: THREE.Object3D[];
  sirenLightLeft?: THREE.Mesh;
  sirenLightRight?: THREE.Mesh;
  headlights: THREE.Light[];
} {
  const group = new THREE.Group();
  const wheels: THREE.Object3D[] = [];
  const headlights: THREE.Light[] = [];

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: primaryHex,
    roughness: 0.18,
    metalness: 0.72,
    clearcoat: 0.9,
    clearcoatRoughness: 0.12,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    roughness: 0.35,
    metalness: 0.8,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0f172a,
    roughness: 0.1,
    metalness: 0.85,
    transparent: true,
    opacity: 0.78,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.85,
    metalness: 0.1,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.2,
    metalness: 0.92,
  });
  const headlightMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  const taillightMat = new THREE.MeshBasicMaterial({ color: 0xff0055 });

  // Contact shadow
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.8, 5.2),
    new THREE.MeshBasicMaterial({
      map: getContactShadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.65,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  group.add(shadow);

  if (vClass === VehicleClass.BOAT) {
    // Multi-part Scarab Speedboat
    const hull = new THREE.Mesh(
      new THREE.ConeGeometry(1.35, 5.8, 4),
      bodyMat,
    );
    hull.rotation.x = Math.PI / 2;
    hull.rotation.z = Math.PI / 4;
    hull.scale.set(1.0, 1.0, 0.45);
    hull.position.set(0, 0.55, 0.3);
    hull.castShadow = true;
    group.add(hull);

    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 0.35, 4.4),
      trimMat,
    );
    deck.position.set(0, 0.78, -0.2);
    group.add(deck);

    const windshield = new THREE.Mesh(
      new THREE.BoxGeometry(1.75, 0.42, 0.9),
      glassMat,
    );
    windshield.position.set(0, 1.08, 0.35);
    windshield.rotation.x = -0.35;
    group.add(windshield);

    const engineCowling = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.55, 1.2),
      bodyMat,
    );
    engineCowling.position.set(0, 1.02, -1.8);
    group.add(engineCowling);

    const neonStripe = new THREE.Mesh(
      new THREE.BoxGeometry(2.22, 0.1, 4.5),
      taillightMat,
    );
    neonStripe.position.set(0, 0.72, -0.2);
    group.add(neonStripe);

    return { group, wheels, headlights };
  }

  if (vClass === VehicleClass.MOTORCYCLE) {
    // Multi-part Street Bike
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.55, 1.85),
      bodyMat,
    );
    frame.position.set(0, 0.68, 0);
    frame.castShadow = true;
    group.add(frame);

    const fairing = new THREE.Mesh(
      new THREE.ConeGeometry(0.32, 0.85, 6),
      trimMat,
    );
    fairing.rotation.x = Math.PI / 2;
    fairing.position.set(0, 0.88, 0.85);
    group.add(fairing);

    const windshield = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.28, 0.4),
      glassMat,
    );
    windshield.position.set(0, 1.12, 0.62);
    windshield.rotation.x = -0.45;
    group.add(windshield);

    const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.18, 18);
    wheelGeo.rotateZ(Math.PI / 2);
    const fWheel = new THREE.Mesh(wheelGeo, tireMat);
    fWheel.position.set(0, 0.36, 0.88);
    const rWheel = new THREE.Mesh(wheelGeo, tireMat);
    rWheel.position.set(0, 0.36, -0.82);
    wheels.push(fWheel, rWheel);
    group.add(fWheel, rWheel);

    const headLamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.12, 0.08),
      headlightMat,
    );
    headLamp.position.set(0, 0.9, 1.24);
    group.add(headLamp);

    return { group, wheels, headlights };
  }

  // Standard 4-wheel car / sports car / truck / police cruiser
  const isTruck = vClass === VehicleClass.TRUCK;
  const isSports = vClass === VehicleClass.SPORTS;
  const bodyWidth = isTruck ? 2.4 : 2.05;
  const bodyLength = isTruck ? 5.6 : 4.5;
  const chassisHeight = isTruck ? 0.75 : isSports ? 0.46 : 0.56;

  // 1. Primary Lower Chassis
  const chassis = new THREE.Mesh(
    new THREE.BoxGeometry(bodyWidth, chassisHeight, bodyLength),
    bodyMat,
  );
  chassis.position.set(0, 0.38 + chassisHeight / 2, 0);
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  group.add(chassis);

  // 2. Secondary Cabin / Greenhouse
  const cabinLength = isTruck ? 1.8 : isSports ? 1.95 : 2.25;
  const cabinHeight = isTruck ? 0.95 : isSports ? 0.44 : 0.56;
  const cabinZ = isTruck ? 1.4 : -0.15;
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(bodyWidth * 0.86, cabinHeight, cabinLength),
    glassMat,
  );
  cabin.position.set(0, 0.38 + chassisHeight + cabinHeight / 2, cabinZ);
  cabin.castShadow = true;
  group.add(cabin);

  // 3. Roof Cap
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(bodyWidth * 0.82, 0.08, cabinLength * 0.88),
    vClass === VehicleClass.POLICE ? trimMat : bodyMat,
  );
  roof.position.set(0, 0.38 + chassisHeight + cabinHeight + 0.02, cabinZ);
  group.add(roof);

  // 4. Truck Cargo Container or Sports Car Rear Spoiler + Side Strakes
  if (isTruck) {
    const cargo = new THREE.Mesh(
      new THREE.BoxGeometry(bodyWidth * 0.96, 1.55, 3.2),
      trimMat,
    );
    cargo.position.set(0, 0.38 + chassisHeight + 0.77, -1.05);
    cargo.castShadow = true;
    group.add(cargo);
  } else if (isSports) {
    const spoilerWing = new THREE.Mesh(
      new THREE.BoxGeometry(bodyWidth * 0.95, 0.08, 0.36),
      trimMat,
    );
    spoilerWing.position.set(
      0,
      0.38 + chassisHeight + 0.28,
      -bodyLength / 2 + 0.25,
    );
    const strutL = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.26, 0.22),
      bodyMat,
    );
    strutL.position.set(
      -bodyWidth * 0.38,
      0.38 + chassisHeight + 0.14,
      -bodyLength / 2 + 0.25,
    );
    const strutR = strutL.clone();
    strutR.position.x = bodyWidth * 0.38;
    group.add(spoilerWing, strutL, strutR);
  } else if (vClass === VehicleClass.TAXI) {
    const taxiSign = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 0.22, 0.28),
      headlightMat,
    );
    taxiSign.position.set(
      0,
      0.38 + chassisHeight + cabinHeight + 0.14,
      cabinZ,
    );
    group.add(taxiSign);
  }

  // 5. Police Lightbar
  let sirenLightLeft: THREE.Mesh | undefined;
  let sirenLightRight: THREE.Mesh | undefined;
  if (vClass === VehicleClass.POLICE) {
    sirenLightLeft = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.16, 0.24),
      new THREE.MeshBasicMaterial({ color: 0xff0033 }),
    );
    sirenLightLeft.position.set(
      -0.28,
      0.38 + chassisHeight + cabinHeight + 0.12,
      cabinZ,
    );
    sirenLightRight = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.16, 0.24),
      new THREE.MeshBasicMaterial({ color: 0x0066ff }),
    );
    sirenLightRight.position.set(
      0.28,
      0.38 + chassisHeight + cabinHeight + 0.12,
      cabinZ,
    );
    group.add(sirenLightLeft, sirenLightRight);
  }

  // 6. Headlights & Taillights
  const hlGeo = new THREE.BoxGeometry(0.36, 0.14, 0.08);
  const hlLeft = new THREE.Mesh(hlGeo, headlightMat);
  hlLeft.position.set(-bodyWidth * 0.34, 0.62, bodyLength / 2 + 0.02);
  const hlRight = hlLeft.clone();
  hlRight.position.x = bodyWidth * 0.34;

  const tlBar = new THREE.Mesh(
    new THREE.BoxGeometry(bodyWidth * 0.88, 0.14, 0.08),
    taillightMat,
  );
  tlBar.position.set(0, 0.64, -bodyLength / 2 - 0.02);
  group.add(hlLeft, hlRight, tlBar);

  // 7–10. Four Composite Wheels (Tire + Metallic Rim)
  const wheelRadius = isTruck ? 0.46 : 0.38;
  const wheelGeo = new THREE.CylinderGeometry(
    wheelRadius,
    wheelRadius,
    0.28,
    18,
  );
  wheelGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(
    wheelRadius * 0.58,
    wheelRadius * 0.58,
    0.3,
    12,
  );
  rimGeo.rotateZ(Math.PI / 2);

  const wheelOffsets = [
    [-bodyWidth / 2 - 0.04, wheelRadius, bodyLength * 0.31],
    [bodyWidth / 2 + 0.04, wheelRadius, bodyLength * 0.31],
    [-bodyWidth / 2 - 0.04, wheelRadius, -bodyLength * 0.31],
    [bodyWidth / 2 + 0.04, wheelRadius, -bodyLength * 0.31],
  ];

  for (const [wx, wy, wz] of wheelOffsets) {
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(wx, wy, wz);
    const tire = new THREE.Mesh(wheelGeo, tireMat);
    const rim = new THREE.Mesh(rimGeo, rimMat);
    wheelGroup.add(tire, rim);
    wheels.push(wheelGroup);
    group.add(wheelGroup);
  }

  return { group, wheels, sirenLightLeft, sirenLightRight, headlights };
}

/**
 * Creates a composite Tropical Palm Tree with curved trunk segments and 6 arching fronds.
 */
export function createPalmTree(scale = 1): THREE.Group {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x6b4423,
    roughness: 0.9,
  });
  const frondMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    roughness: 0.65,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });

  const segments = 5;
  let curY = 0;
  let curX = 0;
  for (let i = 0; i < segments; i++) {
    const h = 1.35;
    const rBottom = 0.28 * (1 - i * 0.11);
    const rTop = 0.24 * (1 - i * 0.11);
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(rTop, rBottom, h, 8),
      trunkMat,
    );
    seg.position.set(curX, curY + h / 2, 0);
    seg.rotation.z = -i * 0.04;
    seg.castShadow = true;
    group.add(seg);
    curY += h * 0.96;
    curX += i * 0.05;
  }

  // 6 Arching Fronds
  const frondGeo = new THREE.ConeGeometry(0.65, 2.8, 4);
  frondGeo.translate(0, 1.2, 0);
  for (let f = 0; f < 6; f++) {
    const frond = new THREE.Mesh(frondGeo, frondMat);
    frond.position.set(curX, curY, 0);
    const angle = (f / 6) * Math.PI * 2;
    frond.rotation.y = angle;
    frond.rotation.x = 1.15;
    frond.scale.set(0.85, 1, 0.22);
    frond.castShadow = true;
    group.add(frond);
  }

  group.scale.setScalar(scale);
  return group;
}

/**
 * Creates a glowing Rotating Neon Package Collectible.
 */
export function createCollectibleMesh(): THREE.Group {
  const group = new THREE.Group();
  const outer = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.55, 0),
    new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.8,
      roughness: 0.15,
      metalness: 0.8,
      wireframe: false,
    }),
  );
  outer.position.y = 1.1;

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.75, 0.06, 12, 24),
    new THREE.MeshBasicMaterial({ color: 0xff2a85 }),
  );
  ring.position.y = 1.1;

  group.add(outer, ring);
  return group;
}
