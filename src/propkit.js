import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
} from 'three'
import { NEON, OAK, PLAZA } from './config.js'
import { RAPIER, addFixed } from './physics.js'
import { mulberry32, paintText } from './textures.js'
import { bake } from './bake.js'

// Shared building blocks for the hand-built props (lobby.js, plaza.js):
// material shorthands, a mesh placer, fixed-collider helpers, outlined text
// sprites, the oak tree, grass-capped rock cliffs and the ranch's wind pump.

export const std = (color, extra) => new MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...extra })
export const glow = (color, opacity = 0.85) => new MeshBasicMaterial({ color, transparent: true, opacity, blending: AdditiveBlending, depthWrite: false, side: DoubleSide })

export function put(parent, geo, mat, x = 0, y = 0, z = 0, shadows = true) {
  const m = new Mesh(geo, mat)
  m.position.set(x, y, z)
  if (shadows) {
    m.castShadow = true
    m.receiveShadow = true
  }
  parent.add(m)
  return m
}

export const yawQuat = (yaw) => ({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) })
export function solidBox(hx, hy, hz, x, y, z, yaw = 0) {
  addFixed(RAPIER.ColliderDesc.cuboid(hx, hy, hz), { x, y, z }, yawQuat(yaw))
}
export function solidPole(radius, height, x, z) {
  addFixed(RAPIER.ColliderDesc.cylinder(height / 2, radius), { x, y: height / 2, z })
}

// --- Neon: unlit materials that glow ----------------------------------------------
// With bloom on, a neon material's colour is pushed to `k` times its base so
// it clears the bloom threshold (bloom measures luminance, so blues need a
// bigger k than greens to glow). With bloom off the same k would just tone-map
// to a washed-out white, so it is capped at NEON.plainMax. main.js flips this
// with the graphics preset via setNeonBloom.
const neonMats = new Set() // dropped again when a material is disposed
let neonBloom = false
function applyNeon(m) {
  const { base, k } = m.userData
  m.color.copy(base).multiplyScalar(neonBloom ? k : Math.min(k, NEON.plainMax))
}
// `extra` takes MeshBasicMaterial options (e.g. additive, transparent flames).
export function neon(color, k = NEON.k, extra = {}) {
  const m = new MeshBasicMaterial(extra)
  m.userData.base = new Color(color)
  m.userData.k = k
  applyNeon(m)
  neonMats.add(m)
  m.addEventListener('dispose', () => neonMats.delete(m))
  return m
}
export function setNeonBloom(on) {
  neonBloom = on
  for (const m of neonMats) applyNeon(m)
}

// --- Labels: outlined text sprites, repainted once Fredoka has loaded --------
export const fontReady = document.fonts?.load ? document.fonts.load('700 96px Fredoka').catch(() => null) : Promise.resolve()
export function label(text, height, opts) {
  const t = paintText(text, opts)
  const tex = new CanvasTexture(t.canvas)
  tex.colorSpace = SRGBColorSpace
  const sprite = new Sprite(new SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }))
  const fit = () => sprite.scale.set((height * t.canvas.width) / t.canvas.height, height, 1)
  fit()
  fontReady.then(() => {
    t.draw()
    tex.dispose() // the canvas may have changed size
    tex.needsUpdate = true
    fit()
  })
  return sprite
}

// --- Oak trees -------------------------------------------------------------------------
// A round cartoon oak: a tapering trunk and a cluster of flat-shaded leafy balls. `height` m to the
// top of the crown. solid: false for scenery whose collider is added elsewhere (environment.js) or
// that is out of reach (on a cliff, along the race track).
const leafMats = new Map()
const leafMat = (c) => leafMats.get(c) ?? leafMats.set(c, std(c, { roughness: 1, flatShading: true })).get(c)
export function buildOak(root, x, z, height, seed, y = 0, solid = true) {
  const rand = mulberry32(seed)
  const g = new Group()
  g.position.set(x, y, z)
  root.add(g)
  const h = height
  put(g, new CylinderGeometry((0.35 * h) / 6, (0.55 * h) / 6, h * 0.6, 7), std(OAK.trunk, { roughness: 1 }), 0, h * 0.3, 0)
  const r = h * 0.38
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + rand() * 1.2
    const d = i === 0 ? 0 : r * 0.55
    const ball = put(g, new IcosahedronGeometry(r * (i === 0 ? 1 : 0.75), 1), leafMat(OAK.leaves[Math.floor(rand() * OAK.leaves.length)]), Math.cos(a) * d, h * 0.72 + (i === 0 ? r * 0.3 : 0), Math.sin(a) * d)
    ball.rotation.set(rand() * 3, rand() * 3, 0)
  }
  if (solid && y === 0) treeCollider(x, z, height)
}
// A tree trunk's collider (also the Frontier Town's cactus or lamp post in its place).
export const treeCollider = (x, z, treeHeight) => solidPole((0.5 * treeHeight) / 10, (4 * treeHeight) / 10, x, z)

// --- Grass-capped rock cliffs ---------------------------------------------------------------------------
// A subdivided box pushed in and out by a smooth function of position (so the
// faces' shared corners move together and nothing cracks), flat shaded, darker
// toward its foot. The grass cap is the same trick with a ragged lower edge.
const wobble = (x, y, z, seed) => Math.sin(x * 0.37 + seed) * Math.cos(z * 0.41 - seed * 0.7) + Math.sin(y * 0.53 + x * 0.21 + seed * 1.3) * 0.6

function lumpyBox(w, h, d, seed, amount, colorAt) {
  const geo = new BoxGeometry(w, h, d, Math.max(2, Math.round(w / 4)), Math.max(2, Math.round(h / 4)), Math.max(2, Math.round(d / 4)))
  const pos = geo.attributes.position
  const colors = []
  const c = new Color()
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    pos.setXYZ(i, x + wobble(x, y, z, seed) * amount, y, z + wobble(z, y, x, seed + 3) * amount)
    colorAt(y / h + 0.5, c)
    colors.push(c.r, c.g, c.b)
  }
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geo.computeVertexNormals()
  return geo
}

// A cliff's collider (also the footprint of the City building standing in its place).
export function cliffCollider([x, z, w, d, h, yaw], baseY = 0) {
  solidBox(w / 2 + 0.6, h / 2, d / 2 + 0.6, x, baseY + h / 2, z, yaw)
}

// solid: false for decoration that never meets the player (race scenery, the
// start island's scenery: environment.js adds its colliders once), which gets no collider.
// colors: { rock, rockDark, grass, grassLight } (default the plaza's; the cap is "grass").
export function buildCliff(root, [x, z, w, d, h, yaw], seed, baseY = 0, solid = true, colors = PLAZA) {
  const g = new Group()
  g.position.set(x, baseY, z)
  g.rotation.y = yaw
  root.add(g)
  const dark = new Color(colors.rockDark)
  const rock = new Color(colors.rock)
  const rockGeo = lumpyBox(w, h, d, seed, 1.3, (t, out) => out.copy(dark).lerp(rock, Math.min(1, t * 1.6)))
  put(g, rockGeo, std('#ffffff', { vertexColors: true, flatShading: true, roughness: 0.95 }), 0, h / 2, 0)

  // Grass cap: a slab over the top whose lower edge hangs down unevenly.
  const grass = new Color(colors.grass)
  const light = new Color(colors.grassLight)
  const capH = 2.4
  const capGeo = lumpyBox(w + 2.2, capH, d + 2.2, seed + 9, 0.6, (t, out) => out.copy(grass).lerp(light, t))
  const pos = capGeo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    if (y < 0) pos.setY(i, y - 0.4 - Math.abs(wobble(pos.getX(i) * 2, y, pos.getZ(i) * 2, seed)) * 1.6)
  }
  capGeo.computeVertexNormals()
  put(g, capGeo, std('#ffffff', { vertexColors: true, flatShading: true, roughness: 0.9 }), 0, h - capH / 2 + 0.6, 0)
  if (solid) cliffCollider([x, z, w, d, h, yaw], baseY)
}

// --- Wind pump ---------------------------------------------------------------------------
// The ranch's water pump: a tapering four-legged lattice tower, a bladed wheel on top facing
// -Z with a tail vane behind it, a trough at its foot. Visual only: environment.js adds the
// collider round its foot. Returns the wheel (spun by the caller).
export function buildWindPump(root, { x, z, scale }) {
  const g = new Group()
  g.position.set(x, 0, z)
  g.scale.setScalar(scale)
  g.rotation.y = 0.5
  root.add(g)
  const frame = new Group() // everything but the wheel, baked to a few meshes
  const steel = std('#9aa3ad', { metalness: 0.5, roughness: 0.45 })
  const H = 6
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const leg = put(frame, new CylinderGeometry(0.05, 0.07, H + 0.2, 6), steel, sx * 0.55, H / 2, sz * 0.55)
    leg.rotation.set(-sz * 0.08, 0, sx * 0.08)
  }
  for (const y of [1.5, 3, 4.5]) {
    const k = 1 - y / (H * 1.6)
    put(frame, new BoxGeometry(1.1 * k + 0.1, 0.06, 0.06), steel, 0, y, 0.55 * k)
    put(frame, new BoxGeometry(1.1 * k + 0.1, 0.06, 0.06), steel, 0, y, -0.55 * k)
    put(frame, new BoxGeometry(0.06, 0.06, 1.1 * k + 0.1), steel, 0.55 * k, y, 0)
    put(frame, new BoxGeometry(0.06, 0.06, 1.1 * k + 0.1), steel, -0.55 * k, y, 0)
  }
  put(frame, new BoxGeometry(0.4, 0.4, 0.9), steel, 0, H + 0.2, 0.1)
  put(frame, new BoxGeometry(0.04, 0.9, 1.4), std('#e8262b', { roughness: 0.6 }), 0, H + 0.35, 1.2) // tail vane
  put(frame, new BoxGeometry(1.8, 0.6, 0.8), std('#8a5a32', { roughness: 0.9 }), 1.4, 0.3, 0.4) // trough
  put(frame, new BoxGeometry(1.6, 0.05, 0.6), std('#3f8fd8', { roughness: 0.2 }), 1.4, 0.58, 0.4)
  g.add(bake(frame, true))
  const blades = new Group()
  const blade = std('#eef0f2', { metalness: 0.3, roughness: 0.5, side: DoubleSide })
  for (let i = 0; i < 12; i++) {
    const arm = new Group()
    arm.rotation.z = (i / 12) * Math.PI * 2
    put(arm, new BoxGeometry(0.34, 1.3, 0.03), blade, 0, 0.85, 0).rotation.y = 0.5
    blades.add(arm)
  }
  put(blades, new CylinderGeometry(0.18, 0.18, 0.2, 10), steel, 0, 0, 0).rotation.x = Math.PI / 2
  const wheel = new Group()
  wheel.position.set(0, H + 0.2, -0.45)
  wheel.add(bake(blades, true))
  g.add(wheel)
  return wheel
}
