import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  Shape,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from 'three'
import { SHOPS } from './config.js'
import { createHorse } from './horse.js'
import { horseById, horseLook } from './horseModels.js'
import { short as shortPrice } from './interact.js'
import { createEmitter } from './particles.js'
import { paintFade, paintQuilt, paintSoftDot } from './textures.js'
import { bake } from './bake.js'
import { buildEastScenery } from './eastScenery.js'
import { label, neon, put, solidBox, std } from './propkit.js'

// The shops on the start island:
//  - Eggs (east, SHOPS.eggs): the open egg platform after the reference's east view: five eggs
//    on gift-box pedestals, a stone wall behind, the "Eggs" sign (the barn, corn field and grey
//    mountains behind it come from eastScenery.js)
//  - Horses (SHOPS.horses): an open stall (quilted pink platform with a glowing yellow rim, red
//    sides and a dark skirt, pale posts and a blue roof): an open back behind a white parapet, and two
//    premium horses on display (idling) with name + stat tags: the ROYAL
//    UNICORN wrapped in a glowing green aura, and the INFERNO NIGHTMARE on fire
//    (a neon ring and a glow pool on the floor, particles)
// Each stall is built in local space with its front toward +Z, then turned by
// its yaw so the front faces the spawn.
const PH = 0.5 // platform height

// 1000 -> "1K", 500000 -> "500K" (the price tags).
function short(n) {
  const units = ['', 'K', 'M', 'B', 'T']
  let i = 0
  while (n >= 1000 && i < units.length - 1) {
    n /= 1000
    i++
  }
  return `${Math.floor(n * 10) / 10}${units[i]}`
}

function shell(g, spec) {
  const W = spec.width
  const D = spec.depth
  const quilt = new CanvasTexture(paintQuilt())
  quilt.colorSpace = SRGBColorSpace
  quilt.wrapS = quilt.wrapT = RepeatWrapping
  quilt.repeat.set((W + 0.6) / 2, D / 2)
  const pink = std('#ffffff', { map: quilt, roughness: 0.75 })
  const red = std('#c8204a', { roughness: 0.6 })
  put(g, new BoxGeometry(W + 2.2, 0.24, D + 1.4), std('#3a3f4a', { roughness: 0.8 }), 0, 0.12, 0)
  put(g, new BoxGeometry(W + 0.6, PH, D), [red, red, pink, red, red, red], 0, PH / 2, 0)
  // Glowing yellow rim round the floor's front and sides.
  const rim = neon('#ffc21a', 2.2)
  put(g, new BoxGeometry(W + 0.9, 0.12, 0.22), rim, 0, PH + 0.02, D / 2 + 0.05, false)
  for (const s of [-1, 1]) put(g, new BoxGeometry(0.22, 0.12, D + 0.1), rim, s * (W / 2 + 0.35), PH + 0.02, 0, false)
  const postMat = std('#cfe0ff', { roughness: 0.45 })
  const postH = 6.6
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(g, new BoxGeometry(0.45, postH, 0.45), postMat, sx * (W / 2 - 0.2), PH + postH / 2, sz * (D / 2 - 0.3))
  const roofY = PH + postH + 0.25
  put(g, new BoxGeometry(W + 1.2, 0.2, D + 0.8), std('#8fc2ff'), 0, roofY - 0.3, 0)
  put(g, new BoxGeometry(W + 1.6, 0.55, D + 1.2), std('#2f7dff', { roughness: 0.4 }), 0, roofY, 0)
  put(g, new BoxGeometry(W + 1.6, 0.9, 0.3), std('#1f63e0', { roughness: 0.4 }), 0, roofY - 0.1, D / 2 + 0.6)
  // Platform and back wall are solid (the platform is too tall to drive onto).
  solidBox((W + 0.6) / 2, PH / 2, D / 2, spec.x, PH / 2, spec.z, spec.yaw)
  g.updateMatrixWorld(true)
  const back = new Vector3(0, 0, -D / 2 + 0.4).applyMatrix4(g.matrixWorld)
  solidBox(W / 2, 3, 0.3, back.x, PH + 3, back.z, spec.yaw)
  return -D / 2 + 0.4 // local z of the back wall
}

function stall(scene, spec) {
  const g = new Group()
  g.position.set(spec.x, 0, spec.z)
  g.rotation.y = spec.yaw
  scene.add(g)
  return { g, backZ: shell(g, spec) }
}

// --- Eggs -------------------------------------------------------------------------------
// The open egg platform out east (SHOPS.eggs, after the reference's east view): a long low
// concrete platform with a stone wall along its back, the eggs on gift-box pedestals in a row
// along it, each under its price, the big gold "Eggs" sign over the middle. Egg and pedestal
// sizes are in egg units (x SHOPS.eggs.eggScale).
const EGG_R = 0.75

function rainbowEgg() {
  const geo = new SphereGeometry(EGG_R, 28, 18)
  const bands = ['#ff3b3b', '#ff9d1a', '#ffe14a', '#3ddc4a', '#2fb8ff', '#8a3cff']
  const pos = geo.attributes.position
  const colors = []
  const c = new Color()
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) / EGG_R + 1) / 2 // 0 bottom .. 1 top
    c.set(bands[Math.min(bands.length - 1, Math.floor((1 - t) * bands.length))])
    if (t > 0.86) c.set('#ffffff') // white cap
    colors.push(c.r, c.g, c.b)
  }
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3))
  return geo
}

// A feathered wing in the XY plane (root at the origin, reaching +X and up), for the angel egg.
function wingGeometry() {
  const s = new Shape()
  s.moveTo(0, 0)
  s.bezierCurveTo(0.5, 0.7, 1.3, 1.0, 1.9, 1.05)
  // Feather tips back along the lower edge.
  s.lineTo(1.55, 0.72)
  s.lineTo(1.75, 0.55)
  s.lineTo(1.3, 0.38)
  s.lineTo(1.45, 0.18)
  s.lineTo(0.95, 0.1)
  s.lineTo(1.0, -0.12)
  s.quadraticCurveTo(0.45, -0.1, 0, 0)
  const geo = new ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1 })
  geo.translate(0, 0, -0.03)
  return geo
}

// One egg (centre at its group's origin) with its extras; returns { group, update(t) }.
function makeEgg(spec) {
  const egg = new Group()
  const anim = []
  let mat
  if (spec.rainbow) mat = std('#ffffff', { vertexColors: true, roughness: 0.3 })
  else if (spec.slime) mat = std(spec.color, { roughness: 0.12, emissive: spec.color, emissiveIntensity: 0.35 })
  else mat = std(spec.color, { roughness: 0.3, emissive: spec.color, emissiveIntensity: 0.14 })
  const body = put(egg, spec.rainbow ? rainbowEgg() : new SphereGeometry(EGG_R, 28, 18), mat)
  body.scale.set(1, 1.3, 1)
  // A white shine on the upper side facing the spawn (-X).
  const shine = put(egg, new SphereGeometry(EGG_R * 0.2, 12, 8), std('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.6, transparent: true, opacity: 0.75 }), -EGG_R * 0.6, EGG_R * 0.55, -EGG_R * 0.35, false)
  shine.scale.set(0.4, 1.4, 0.7)
  if (spec.horns) {
    // Two little curled horns, one each side of the crown.
    const horn = std('#fff1c8', { roughness: 0.45 })
    for (const side of [-1, 1]) {
      const pts = []
      for (let i = 0; i <= 8; i++) {
        const t = i / 8
        pts.push(new Vector3(0, EGG_R * 0.95 + Math.sin(t * Math.PI * 0.55) * 0.55, side * (EGG_R * 0.55 + t * 0.5)))
      }
      put(egg, new TubeGeometry(new CatmullRomCurve3(pts), 12, 0.11, 8, false), horn)
      const tip = put(egg, new ConeGeometry(0.11, 0.28, 8), horn, 0, pts[8].y + 0.08, pts[8].z + side * 0.06)
      tip.rotation.x = side * 0.9
    }
  }
  if (spec.slime) {
    // Drips down the sides and a little knot of leaves on top.
    const drip = new SphereGeometry(0.16, 10, 8)
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2
      const d = put(egg, drip, mat, Math.cos(a) * EGG_R * 0.92, -EGG_R * (0.2 + (i % 3) * 0.18), Math.sin(a) * EGG_R * 0.92, false)
      d.scale.set(1, 1.8 + (i % 2) * 0.6, 1)
    }
    const leaf = std('#1f9a3a', { roughness: 0.6 })
    for (const side of [-1, 1]) {
      const l = put(egg, new SphereGeometry(0.22, 10, 8), leaf, 0, EGG_R * 1.33, side * 0.2)
      l.scale.set(0.7, 0.5, 1.4)
      l.rotation.x = -side * 0.5
    }
  }
  if (spec.cloud) {
    // A ring of puffy cloud round the foot.
    const puff = new IcosahedronGeometry(0.32, 2)
    const white = std('#ffffff', { roughness: 0.8, emissive: '#dceaff', emissiveIntensity: 0.25 })
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2
      const p = put(egg, puff, white, Math.cos(a) * EGG_R * 0.95, -EGG_R * 1.0 + (i % 2) * 0.1, Math.sin(a) * EGG_R * 0.95, false)
      p.scale.setScalar(0.8 + (i % 3) * 0.25)
    }
  }
  if (spec.wings) {
    const wingMat = std('#f4f8ff', { roughness: 0.4, emissive: '#bfe4ff', emissiveIntensity: 0.35, side: DoubleSide })
    const geo = wingGeometry()
    for (const side of [-1, 1]) {
      const pivot = new Group()
      pivot.position.set(0, EGG_R * 0.25, side * EGG_R * 0.55)
      pivot.rotation.y = -side * (Math.PI / 2) // reach out along +-Z (sideways as seen from the spawn)
      egg.add(pivot)
      const w = put(pivot, geo, wingMat, 0, 0, 0, false)
      w.scale.set(1.15, 1.15, 1)
      anim.push((t) => (pivot.rotation.z = Math.sin(t * 3.2) * 0.3))
    }
  }
  if (spec.ring) {
    // A tilted planet ring round the middle, turning.
    const ringPivot = new Group()
    ringPivot.rotation.set(0.45, 0, 0.25)
    egg.add(ringPivot)
    put(ringPivot, new TorusGeometry(EGG_R * 1.45, 0.07, 8, 48), neon('#8fd8ff', 2), 0, 0, 0, false).rotation.x = Math.PI / 2
    put(ringPivot, new TorusGeometry(EGG_R * 1.32, 0.04, 6, 48), neon('#e0a8ff', 2), 0, 0, 0, false).rotation.x = Math.PI / 2
    anim.push((t) => (ringPivot.rotation.y = t * 0.9))
  }
  return { group: egg, update: (t) => anim.forEach((fn) => fn(t)) }
}

// The gift-box pedestal an egg sits on (egg units, its dish at y = PED_H): a box tied with a
// ribbon of `ribbon`, a lid band, a short neck and a dish.
const PED_H = 1.35
function buildPedestal(parent, box, ribbon) {
  const g = new Group()
  parent.add(g)
  const boxMat = std(box, { roughness: 0.55 })
  const rib = std(ribbon, { roughness: 0.45, emissive: ribbon, emissiveIntensity: 0.15 })
  const W = 1.5
  const H = 0.8
  put(g, new BoxGeometry(W, H, W), boxMat, 0, H / 2, 0)
  put(g, new BoxGeometry(W + 0.04, H + 0.02, 0.26), rib, 0, H / 2, 0)
  put(g, new BoxGeometry(0.26, H + 0.02, W + 0.04), rib, 0, H / 2, 0)
  put(g, new BoxGeometry(W + 0.14, 0.16, W + 0.14), boxMat, 0, H, 0)
  put(g, new CylinderGeometry(0.32, 0.42, 0.3, 16), boxMat, 0, H + 0.23, 0)
  put(g, new CylinderGeometry(0.72, 0.45, 0.28, 24), rib, 0, H + 0.42, 0)
  return g
}

function createEggPlatform(scene, spec, animated, spots) {
  const S = spec.eggScale
  const P = spec.platform
  const W = spec.wall
  const n = spec.eggs.length
  const zA = spec.z0 - P.overhang
  const zB = spec.z1 + P.overhang
  const len = zB - zA
  const midZ = (zA + zB) / 2
  const depth = P.back - P.front
  const midX = (P.front + P.back) / 2
  const root = new Group()
  root.name = 'eggs'
  scene.add(root)

  // Platform: pale concrete with a lighter lip along the front, and the stone wall behind.
  const statics = new Group()
  const top = std('#c9cdd4', { roughness: 0.85 })
  const side = std('#a3a8b1', { roughness: 0.9 })
  put(statics, new BoxGeometry(depth, P.height, len), [side, side, top, side, side, side], midX, P.height / 2, midZ)
  put(statics, new BoxGeometry(0.5, 0.12, len + 0.2), std('#e6e9ee', { roughness: 0.7 }), P.front + 0.25, P.height + 0.06, midZ)
  put(statics, new BoxGeometry(depth + 1.4, 0.2, len + 1.4), std('#8d939c', { roughness: 0.9 }), midX, 0.1, midZ) // footing
  solidBox(depth / 2, P.height / 2, len / 2, midX, P.height / 2, midZ)
  const stone = [std('#7d838c', { roughness: 0.95 }), std('#8b9199', { roughness: 0.95 }), std('#727880', { roughness: 0.95 })]
  const wx = P.back - W.depth / 2
  let z = zA
  let k = 0
  while (z < zB - 0.4) {
    const w = Math.min(zB - z, 1.6 + ((k * 7) % 5) * 0.4)
    const h = W.height - 0.5 + ((k * 5) % 4) * 0.3
    put(statics, new BoxGeometry(W.depth, h, w - 0.1), stone[k % 3], wx, P.height + h / 2, z + w / 2)
    if (k % 3 === 1) put(statics, new BoxGeometry(W.depth * 0.7, 0.6, w * 0.6), stone[(k + 1) % 3], wx - 0.1, P.height + h + 0.3, z + w / 2)
    z += w
    k++
  }
  solidBox(W.depth / 2, (P.height + W.height) / 2, len / 2, wx, (P.height + W.height) / 2, midZ)

  const haloTex = new CanvasTexture(paintSoftDot(128))
  haloTex.colorSpace = SRGBColorSpace
  const fadeTex = new CanvasTexture(paintFade('#ffffff'))
  fadeTex.colorSpace = SRGBColorSpace
  const sparkles = []
  const motes = []
  const floorY = P.height
  spec.eggs.forEach((eggSpec, i) => {
    const ez = spec.z0 + ((spec.z1 - spec.z0) * i) / Math.max(1, n - 1)
    const tint = eggSpec.rainbow ? '#ffc8f0' : eggSpec.color
    // Pedestal (baked with the platform), a glow pool on the floor and a neon ring on the dish.
    const ped = buildPedestal(statics, eggSpec.wings ? '#c21fb0' : '#24345f', eggSpec.stand)
    ped.position.set(spec.x, floorY, ez)
    ped.scale.setScalar(S)
    const pool = new Mesh(new CircleGeometry(1.6 * S, 32), new MeshBasicMaterial({ map: haloTex, color: eggSpec.stand, transparent: true, opacity: 0.7, blending: AdditiveBlending, depthWrite: false }))
    pool.rotation.x = -Math.PI / 2
    pool.position.set(spec.x, floorY + 0.03, ez)
    root.add(pool)
    const rim = put(root, new TorusGeometry(0.72 * S, 0.05 * S, 8, 40), neon(eggSpec.stand, 2.2), spec.x, floorY + (PED_H - 0.08) * S, ez, false)
    rim.rotation.x = Math.PI / 2
    solidBox(0.8 * S, (floorY + PED_H * S) / 2, 0.8 * S, spec.x, (floorY + PED_H * S) / 2, ez)

    // The egg, floating a little over the dish, its halo behind it, a soft beam for the strong ones.
    const egg = makeEgg(eggSpec)
    const baseY = floorY + (PED_H + 0.1 + EGG_R * 1.3) * S
    egg.group.scale.setScalar(S)
    egg.group.position.set(spec.x, baseY, ez)
    root.add(egg.group)
    const halo = new Sprite(new SpriteMaterial({ map: haloTex, color: tint, transparent: true, opacity: eggSpec.glow ?? 0.4, blending: AdditiveBlending, depthWrite: false }))
    halo.scale.set(3.4 * S, 3.9 * S, 1)
    halo.position.set(spec.x + 0.4, baseY, ez)
    root.add(halo)
    if (eggSpec.aura || eggSpec.slime) {
      const beamMat = new MeshBasicMaterial({ map: fadeTex, color: tint, transparent: true, opacity: 0.4, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, fog: false })
      put(root, new CylinderGeometry(0.9 * S, 1.1 * S, 5 * S, 24, 1, true), beamMat, spec.x, floorY + 2.5 * S, ez, false)
      animated.push((t) => (beamMat.opacity = 0.3 + Math.sin(t * 2.2 + i) * 0.1))
      motes.push({ x: spec.x, y: floorY + PED_H * S, z: ez, sx: 0.9 * S, sy: 0.2, sz: 0.9 * S, color: tint })
    }
    const colors = eggSpec.rainbow ? ['#ff3b3b', '#ffe14a', '#3ddc4a', '#2fb8ff', '#b05cff'] : [eggSpec.color, '#ffffff']
    for (const color of colors) sparkles.push({ x: spec.x, y: baseY, z: ez, sx: 1.1 * S, sy: 1.3 * S, sz: 1.1 * S, color })
    spots.push({ egg: eggSpec, x: spec.x, y: baseY + 1.3 * S, z: ez })
    const tag = label(`🏆 ${short(eggSpec.price)}`, 1.35, { color: '#ffffff', outline: '#1a0a14', font: '700 64px Fredoka, "Segoe UI Emoji", sans-serif', outlineWidth: 10 })
    tag.position.set(spec.x, baseY + 2.0 * S + 0.6, ez)
    root.add(tag)
    animated.push((t) => {
      egg.group.rotation.y = Math.sin(t * 0.7 + i) * 0.5
      egg.group.position.y = baseY + Math.sin(t * 2 + i) * 0.12
      halo.material.opacity = (eggSpec.glow ?? 0.4) * (0.85 + Math.sin(t * 2.6 + i) * 0.15)
      egg.update(t)
    })
  })
  root.add(bake(statics, true))
  const sign = label('Eggs', 4.2, { color: '#ffd21a', outline: '#3a2400', outlineWidth: 18 })
  sign.position.set(spec.x + 1, floorY + 10.4, (spec.z0 + spec.z1) / 2)
  root.add(sign)
  animated.push((t) => (sign.position.y = floorY + 10.4 + Math.sin(t * 1.6) * 0.15))

  createEmitter(scene, {
    boxes: sparkles, count: 160, life: 2, velocity: [0, 0.7, 0], spread: [0.3, 0.35, 0.3],
    size: 0.45, intensity: 3, twinkle: 7, sprite: 'sparkle', seed: 71,
  })
  if (motes.length)
    createEmitter(scene, {
      boxes: motes, count: 70, life: 2.4, velocity: [0, 1.6, 0], spread: [0.3, 0.5, 0.3],
      size: 0.6, grow: 0.4, intensity: 2.6, opacity: 0.7, seed: 72,
    })
  buildEastScenery(scene)
}

// --- Horses ------------------------------------------------------------------------------
// Particles around one display horse: a rising aura with sparkles, or fire with embers off its
// body and mane.
function horseFx(scene, horse, b, scale) {
  const at = horse.getWorldPosition(new Vector3())
  const box = (color, sy = 0.3) => ({ x: at.x, y: at.y + 0.4, z: at.z, sx: 2.2, sy, sz: 2.2, color })
  if (b.fx === 'aura') {
    createEmitter(scene, {
      boxes: [box(b.glow)], count: 110, life: 1.5, velocity: [0, 1.5, 0], spread: [0.7, 0.5, 0.7],
      size: 0.75, grow: 0.25, intensity: 3, opacity: 0.75, seed: 51,
    })
    createEmitter(scene, {
      boxes: [box('#d8ffe0', 1.2)], count: 35, life: 2.2, velocity: [0, 0.8, 0], spread: [0.4, 0.4, 0.4],
      size: 0.45, intensity: 3, twinkle: 7, sprite: 'sparkle', seed: 52,
    })
  } else if (b.fx === 'fire') {
    const mane = horse.localToWorld(new Vector3(0, 1.9, 0.9)) // the neck's crest, in model units
    const back = { x: at.x, y: at.y + 1.6 * scale, z: at.z, sx: 1.2, sy: 0.3, sz: 1.2, color: '#ff5a1a' }
    createEmitter(scene, {
      boxes: [box('#ff5a1a'), box('#ffb21a'), back, { x: mane.x, y: mane.y, z: mane.z, sx: 0.4, sy: 0.3, sz: 0.4, color: '#ffd24a' }],
      count: 140, life: 0.95, velocity: [0, 2.6, 0], spread: [0.6, 0.9, 0.6],
      size: 0.95, grow: 0.15, intensity: 3.5, opacity: 0.8, seed: 53,
    })
    createEmitter(scene, {
      boxes: [box('#ffcf4a', 1)], count: 45, life: 2.2, velocity: [0, 2, 0], spread: [1, 1, 1], gravity: 0.4,
      size: 0.18, intensity: 4, twinkle: 8, seed: 54,
    })
  }
}

// The two premium horses (horse.js, no rider or boosters) standing on the stall floor, idling.
function createHorseStall(scene, spec, spots, animated) {
  const { g, backZ } = stall(scene, spec)
  const W = spec.width
  // Open back: a white parapet under the top beam.
  const white = std('#e8eef8', { roughness: 0.5 })
  put(g, new BoxGeometry(W, 1.2, 0.3), white, 0, PH + 0.6, backZ)
  put(g, new BoxGeometry(W, 0.3, 0.4), white, 0, PH + 4.3, backZ)
  const glowTex = new CanvasTexture(paintSoftDot(128))
  glowTex.colorSpace = SRGBColorSpace
  const spacing = W / spec.horses.length
  const shown = []
  spec.horses.forEach((b, i) => {
    const x = (i - (spec.horses.length - 1) / 2) * spacing
    const horse = createHorse({ engines: false })
    const look = horseLook(b.id)
    horse.setLook(look)
    const root = horse.root
    root.scale.setScalar(spec.horseScale)
    // Nose toward +X (1) or -X (-1), turned partly toward the front so it shows three-quarters.
    root.rotation.y = (b.facing ?? 1) * (Math.PI / 2 - spec.horseAngle)
    root.position.set(x, PH + 0.02, 0.3)
    g.add(root)
    // A neon ring and a glow pool on the floor under it.
    const ring = put(g, new TorusGeometry(2.6, 0.07, 6, 48), neon(b.glow), x, PH + 0.05, 0.3, false)
    ring.rotation.x = -Math.PI / 2
    const pool = put(g, new PlaneGeometry(6, 9), new MeshBasicMaterial({ map: glowTex, color: b.glow, transparent: true, opacity: 0.55, blending: AdditiveBlending, depthWrite: false }), x, PH + 0.03, 0.3, false)
    pool.rotation.set(-Math.PI / 2, 0, root.rotation.y)
    const price = horseById(b.id).price
    const tag = label(`${b.name}\n🏆 ${price == null ? 'Free' : shortPrice(price)}`, 0.85, { colors: [b.labelColor, '#ffe14a'], outline: '#1a0a14', font: '700 64px Fredoka, "Segoe UI Emoji", sans-serif', outlineWidth: 10 })
    tag.position.set(x, PH + 5.6, 0.3)
    g.add(tag)
    shown.push([root, b])
    animated.push((t) => horse.update(1 / 60, 0, 0, t + i * 3.7))
  })
  g.updateMatrixWorld(true)
  for (const [root, b] of shown) {
    horseFx(scene, root, b, spec.horseScale)
    const at = root.getWorldPosition(new Vector3())
    spots.push({ horse: b.id, x: at.x, y: at.y + 3, z: at.z })
  }
}

export function createShops(scene) {
  const animated = []
  // Where each egg / display horse's interact prompt sits (interact.js).
  const spots = { eggs: [], horses: [] }
  createEggPlatform(scene, SHOPS.eggs, animated, spots.eggs)
  createHorseStall(scene, SHOPS.horses, spots.horses, animated)
  return {
    spots,
    update(dt, elapsed) {
      for (const fn of animated) fn(elapsed)
    },
  }
}
