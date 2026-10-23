import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector3,
} from 'three'
import { SHOPS } from './config.js'
import { createHorse } from './horse.js'
import { horseLook } from './horseModels.js'
import { createEmitter } from './particles.js'
import { paintQuilt, paintSoftDot } from './textures.js'
import { label, neon, put, solidBox, std } from './propkit.js'

// The two open shop stalls either side of the spawn, from the reference's
// east and west views. Both share one shell: a quilted pink platform with a
// glowing yellow rim, red sides and a dark skirt, pale posts and a blue roof.
//  - Eggs (east, SHOPS.eggs): light counter wall, dark upper panels with the
//    yellow "Eggs" sign, four eggs (yellow, spiky gold, green, rainbow)
//    turning on pedestals under trophy prices
//  - Horses (west, SHOPS.horses): an open back behind a white parapet, and two
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
const EGG_R = 0.75

function rainbowEgg() {
  const geo = new SphereGeometry(EGG_R, 24, 16)
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

function makeEgg(spec) {
  const egg = new Group()
  const mat = spec.rainbow ? std('#ffffff', { vertexColors: true, roughness: 0.35 }) : std(spec.color, { roughness: 0.35, emissive: spec.color, emissiveIntensity: 0.12 })
  const body = put(egg, spec.rainbow ? rainbowEgg() : new SphereGeometry(EGG_R, 24, 16), mat)
  body.scale.set(1, 1.3, 1)
  if (spec.spiky) {
    const spike = new ConeGeometry(0.16, 0.5, 8)
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      const dir = new Vector3(Math.cos(a), i % 2 ? 0.25 : -0.25, Math.sin(a)).normalize()
      const s = put(egg, spike, mat, dir.x * EGG_R * 0.95, dir.y * EGG_R * 1.3, dir.z * EGG_R * 0.95)
      s.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), dir)
    }
  }
  return egg
}

function createEggStall(scene, spec, animated, spots) {
  const { g, backZ } = stall(scene, spec)
  const W = spec.width
  put(g, new BoxGeometry(W, 2.4, 0.5), std('#a9bddf', { roughness: 0.5 }), 0, PH + 1.2, backZ)
  put(g, new BoxGeometry(W, 2.8, 0.4), std('#1f2a48', { roughness: 0.6 }), 0, PH + 3.8, backZ)
  for (const s of [-1, 1]) put(g, new BoxGeometry(W / 2 - 0.8, 2.2, 0.1), std('#2c3b66'), s * (W / 4), PH + 3.8, backZ + 0.22)
  const sign = label('Eggs', 1.5, { color: '#ffe14a', outline: '#3a2400', outlineWidth: 16 })
  sign.position.set(0, PH + 4.4, backZ + 0.6)
  g.add(sign)

  const pedestal = new CylinderGeometry(0.75, 0.85, 0.7, 24)
  const ring = new TorusGeometry(0.78, 0.08, 8, 32)
  const ringMat = neon('#4fb8ff')
  const base = PH + 0.7 + EGG_R * 1.3 + 0.05
  const haloTex = new CanvasTexture(paintSoftDot(128))
  haloTex.colorSpace = SRGBColorSpace
  const sparkles = []
  const spacing = W / (spec.eggs.length + 0.5)
  spec.eggs.forEach((eggSpec, i) => {
    const x = (i - (spec.eggs.length - 1) / 2) * spacing
    put(g, pedestal, std('#2a2f3c', { roughness: 0.5 }), x, PH + 0.35, 0.6)
    const r = put(g, ring, ringMat, x, PH + 0.72, 0.6, false)
    r.rotation.x = Math.PI / 2
    const egg = makeEgg(eggSpec)
    egg.position.set(x, base, 0.6)
    g.add(egg)
    // A soft halo of the egg's colour behind it, and sparkles to match.
    const tint = eggSpec.rainbow ? '#ffffff' : eggSpec.color
    const halo = new Sprite(new SpriteMaterial({ map: haloTex, color: tint, transparent: true, opacity: eggSpec.glow ?? 0.45, blending: AdditiveBlending, depthWrite: false }))
    halo.scale.set(2.6, 3.0, 1)
    halo.position.set(x, base, 0.3)
    g.add(halo)
    g.updateMatrixWorld(true)
    const at = egg.getWorldPosition(new Vector3())
    const colors = eggSpec.rainbow ? ['#ff3b3b', '#ffe14a', '#3ddc4a', '#2fb8ff', '#b05cff'] : [eggSpec.color]
    for (const color of colors) sparkles.push({ x: at.x, y: at.y, z: at.z, sx: 1.0, sy: 1.1, sz: 1.0, color })
    spots.push({ egg: eggSpec, x: at.x, y: at.y + 1.3, z: at.z })
    const tag = label(`🏆 ${short(eggSpec.price)}`, 0.5, { color: '#ffffff', outline: '#1a0a14', font: '700 64px Fredoka, "Segoe UI Emoji", sans-serif', outlineWidth: 10 })
    tag.position.set(x, PH + 3.7, 0.6)
    g.add(tag)
    animated.push((t) => {
      egg.rotation.y = t * 0.8 + i
      egg.position.y = base + Math.sin(t * 2 + i) * 0.08
    })
  })
  createEmitter(scene, {
    boxes: sparkles, count: 90, life: 2, velocity: [0, 0.6, 0], spread: [0.25, 0.3, 0.25],
    size: 0.32, intensity: 3, twinkle: 7, sprite: 'sparkle', seed: 71,
  })
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
    const tag = label(`${b.name}\n⊕ ${b.stat}`, 0.85, { colors: [b.labelColor, '#7dff6a'], outline: '#1a0a14', font: '700 64px Fredoka, sans-serif', outlineWidth: 10 })
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
  createEggStall(scene, SHOPS.eggs, animated, spots.eggs)
  createHorseStall(scene, SHOPS.horses, spots.horses, animated)
  return {
    spots,
    update(dt, elapsed) {
      for (const fn of animated) fn(elapsed)
    },
  }
}
