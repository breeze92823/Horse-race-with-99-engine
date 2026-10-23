import {
  Bone,
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  ExtrudeGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Shape,
  Skeleton,
  SkinnedMesh,
  SphereGeometry,
  TorusGeometry,
  Uint16BufferAttribute,
  Vector3,
} from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { COMPANIONS, PARTNER, PETS } from './config.js'
import { LOOKS } from './pets.js'

// The 3D pets and partner that go with a horse, for the local player (main.js) and every remote
// player (remotePlayers.js) alike. Each pet / partner is ONE mesh: blocky parts with vertex
// colours, merged and cached per kind, so a full room stays cheap on phones. The looks follow
// the window portraits (pets.js LOOKS, partner.js looks in PARTNER): a pet is a rounded cube
// with googly eyes and its kind's ears / gills / wings / horns; a partner is a blocky figure in
// its shirt, pants, hair or hat (and cape), skinned rigidly to a small skeleton (each block
// follows one bone) so it can move and still be one draw call. Golden pets get a gold metal
// finish, Rainbow pets a colour-cycling glow (one shared material, its hue advanced once per frame).
// Pets hover in slots behind and beside the horse (COMPANIONS.slots) and swing after its turns;
// the partner rides pillion on the horse's `seat` behind the rider, arms round its waist,
// animated off the seat's own motion (createRide).

const INK = '#1d1a22'
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)
const toMatrix = new Matrix4()
const q = new Quaternion()
const euler = new Euler()
const tmpColor = new Color()

// A coloured part: a geometry moved into place (rotation x/y/z in radians), as non-indexed
// triangles carrying a `color` attribute so many parts merge into one mesh.
function part(geo, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const g = geo.index ? geo.toNonIndexed() : geo
  for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name)
  q.setFromEuler(euler.set(rx, ry, rz))
  toMatrix.compose(new Vector3(x, y, z), q, new Vector3(1, 1, 1))
  g.applyMatrix4(toMatrix)
  tmpColor.set(color)
  const n = g.attributes.position.count
  const col = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) tmpColor.toArray(col, i * 3)
  g.setAttribute('color', new (g.attributes.position.constructor)(col, 3))
  return g
}
const box = (w, h, d, color, x, y, z, rx, ry, rz) => part(new BoxGeometry(w, h, d), color, x, y, z, rx, ry, rz)
const mirror = (make) => [make(-1), make(1)]

const merge = (parts) => {
  const g = mergeGeometries(parts.flat())
  for (const p of parts.flat()) p.dispose()
  g.computeBoundingSphere()
  return g
}

// --- Pets ----------------------------------------------------------------------------------
// Body centre at y 0.45 (feet at 0), face toward +Z, about 0.9 m across.
function eyes(l) {
  if (l.glowEyes) return mirror((s) => box(0.22, 0.09, 0.04, '#9dff3a', s * 0.17, 0.52, 0.36, 0, 0, s * -0.3))
  return mirror((s) => [
    box(0.2, 0.22, 0.04, '#ffffff', s * 0.17, 0.52, 0.355),
    box(0.11, 0.13, 0.03, INK, s * 0.17 + 0.01, 0.5, 0.375),
    box(0.04, 0.04, 0.02, '#ffffff', s * 0.17 + 0.04, 0.54, 0.39),
  ])
}

function ears(l) {
  switch (l.ears) {
    case 'floppy':
      return mirror((s) => box(0.13, 0.42, 0.26, l.dark, s * 0.46, 0.5, 0, 0, 0, s * 0.22))
    case 'pointy':
      return mirror((s) => [part(new ConeGeometry(0.15, 0.34, 4), l.body, s * 0.24, 0.92, 0, 0, Math.PI / 4, s * -0.15), part(new ConeGeometry(0.08, 0.2, 4), l.inner ?? l.dark, s * 0.24, 0.9, 0.06, 0, Math.PI / 4, s * -0.15)])
    case 'long':
      return mirror((s) => [box(0.14, 0.52, 0.1, l.body, s * 0.17, 1.06, 0, 0, 0, s * -0.08), box(0.07, 0.38, 0.02, l.inner ?? l.dark, s * 0.17, 1.06, 0.06, 0, 0, s * -0.08)])
    case 'round':
      return mirror((s) => part(new CylinderGeometry(0.13, 0.13, 0.09, 12), l.dark, s * 0.3, 0.86, 0, Math.PI / 2))
    case 'horns':
      return [...mirror((s) => part(new ConeGeometry(0.08, 0.3, 6), '#ffd84a', s * 0.24, 0.94, 0, 0, 0, s * -0.3)), box(0.08, 0.14, 0.4, l.dark, 0, 0.86, -0.12, 0.3)]
  }
  return []
}

function extras(l) {
  const out = []
  if (l.gills) for (const [y, a] of [[0.66, 0.5], [0.52, 0], [0.38, -0.5]]) out.push(...mirror((s) => box(0.3, 0.09, 0.09, l.gills, s * 0.52, y, -0.02, 0, 0, s * a)))
  if (l.wings === 'leaf') out.push(...mirror((s) => box(0.5, 0.36, 0.05, '#3fbf3a', s * 0.55, 0.62, -0.22, 0, s * 0.6, s * 0.3)))
  if (l.wings === 'bat') out.push(...mirror((s) => [box(0.6, 0.4, 0.05, l.dark, s * 0.62, 0.7, -0.24, 0, s * 0.55, s * 0.35), box(0.3, 0.22, 0.06, l.body, s * 0.42, 0.66, -0.2, 0, s * 0.55, s * 0.35)]))
  if (l.tuft) for (const [x, h] of [[-0.2, 0.26], [0, 0.36], [0.2, 0.26]]) out.push(part(new ConeGeometry(0.1, h, 5), '#3fbf3a', x, 0.82 + h / 2, -0.05))
  if (l.flames) for (const [x, y, h, c] of [[0, 1.0, 0.5, '#5cff2a'], [-0.32, 0.9, 0.36, '#5cff2a'], [0.32, 0.9, 0.36, '#5cff2a'], [0, 0.95, 0.3, '#c8ff5a']]) out.push(part(new ConeGeometry(0.16, h, 6), c, x, y, -0.08))
  if (l.belly) out.push(box(0.4, 0.26, 0.04, l.belly, 0, 0.24, 0.355))
  if (l.muzzle) out.push(box(0.36, 0.2, 0.06, l.muzzle, 0, 0.32, 0.36))
  if (l.patches) out.push(...mirror((s) => box(0.26, 0.3, 0.03, l.dark, s * 0.17, 0.51, 0.352)))
  if (l.cheeks) out.push(...mirror((s) => box(0.1, 0.06, 0.02, '#ff8fb0', s * 0.3, 0.38, 0.356)))
  if (l.nose) out.push(box(0.1, 0.06, 0.04, INK, 0, 0.37, 0.4))
  if (l.nostrils) out.push(...mirror((s) => box(0.04, 0.04, 0.02, INK, s * 0.05, 0.36, 0.37)))
  if (l.mouth || l.whiskers) out.push(box(0.12, 0.03, 0.02, INK, 0, 0.33, 0.37))
  return out
}

// The Eternal Star: a faceted pink star on white wings with a little crown.
function starGeometry() {
  const shape = new Shape()
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5
    const r = i % 2 ? 0.2 : 0.46
    const p = [Math.cos(a) * r, Math.sin(a) * r]
    i ? shape.lineTo(...p) : shape.moveTo(...p)
  }
  const star = part(new ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 1 }), '#e46cff', 0, 0.5, -0.11)
  return merge([
    star,
    ...mirror((s) => box(0.5, 0.3, 0.05, '#f6f2ff', s * 0.5, 0.62, -0.12, 0, s * 0.4, s * 0.4)),
    box(0.28, 0.14, 0.2, '#9b4dff', 0, 1.02, 0),
    ...mirror((s) => box(0.07, 0.07, 0.03, INK, s * 0.09, 0.52, 0.17)),
  ])
}

const petGeos = new Map()
function petGeometry(kind) {
  if (petGeos.has(kind)) return petGeos.get(kind)
  let g
  if (kind === 'star') g = starGeometry()
  else {
    const l = LOOKS[kind] ?? LOOKS.dog
    g = merge([
      ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => box(0.18, 0.16, 0.18, l.dark, sx * 0.22, 0.08, sz * 0.18))),
      part(new RoundedBoxGeometry(0.8, 0.72, 0.7, 2, 0.12), l.body, 0, 0.5, 0),
      box(0.6, 0.06, 0.02, '#ffffff', 0, 0.78, 0.352), // shine strip, like the portraits
      ...eyes(l),
      ...ears(l),
      ...extras(l),
    ])
  }
  petGeos.set(kind, g)
  return g
}

// --- Partner -------------------------------------------------------------------------------
// About 1.75 m before COMPANIONS.partnerScale, feet at 0, facing +Z.
function shirt(l) {
  const c2 = l.color2
  const out = []
  const band = (y, h = 0.06, c = c2) => out.push(box(0.58, h, 0.32, c, 0, y, 0))
  switch (l.shirt) {
    case 'stripes':
      for (const y of [1.08, 0.94, 0.8]) band(y, 0.05)
      break
    case 'bands':
      band(1.0)
      band(0.82)
      break
    case 'vest':
      out.push(...mirror((s) => box(0.16, 0.6, 0.02, c2, s * 0.2, 0.93, 0.155)))
      break
    case 'jacket':
      out.push(box(0.14, 0.6, 0.02, '#f4f4f4', 0, 0.93, 0.155), box(0.06, 0.34, 0.02, c2, 0, 1.0, 0.165))
      break
    case 'hero':
      out.push(box(0.3, 0.2, 0.02, '#ffd23a', 0, 1.05, 0.155))
      band(0.68, 0.06, '#ffd23a')
      break
    case 'emblem':
      out.push(box(0.26, 0.12, 0.02, c2, 0, 1.03, 0.155))
      band(0.68)
      break
    case 'labcoat':
      out.push(box(0.6, 0.3, 0.3, l.color, 0, 0.5, -0.0), box(0.1, 0.4, 0.02, c2, 0, 1.02, 0.155))
      break
    case 'plain':
      break
    case 'jumpsuit':
    case 'police':
      out.push(box(0.14, 0.12, 0.02, c2, 0, 1.15, 0.155))
      band(0.68, 0.06, '#1d1d23')
      break
    default:
      band(0.68)
  }
  return out
}

function head(l) {
  const out = [box(0.42, 0.42, 0.42, l.skin, 0, 1.47, 0)]
  const covered = l.hat === 'mask' || l.hat === 'balaclava' || l.hat === 'hood' || l.hat === 'cowl'
  if (covered) {
    // A mask's front is its own colour (hatColor) inside the hood; a balaclava / hood shows an eye slit.
    out.push(box(0.44, 0.44, 0.44, l.hood ?? l.hatColor, 0, 1.48, 0))
    if (l.hat === 'mask') out.push(box(0.34, 0.36, 0.02, l.hatColor, 0, 1.48, 0.222))
    else out.push(box(0.3, 0.07, 0.02, l.skin, 0, 1.5, 0.222))
    if (l.hat === 'cowl') out.push(...mirror((s) => part(new ConeGeometry(0.06, 0.18, 4), l.hatColor, s * 0.14, 1.77, 0)))
  }
  if (covered) out.push(...maskSymbol(l))
  if (!covered || l.hat === 'cowl') {
    const big = l.face === 'princess' || l.face === 'doll'
    if (l.face === 'shades') out.push(box(0.34, 0.08, 0.02, INK, 0, 1.5, 0.215))
    else if (big)
      out.push(...mirror((s) => [
        box(0.1, 0.12, 0.02, '#ffffff', s * 0.09, 1.5, 0.212),
        box(0.07, 0.09, 0.02, l.eyes ?? INK, s * 0.09, 1.495, 0.218),
        box(0.03, 0.04, 0.02, INK, s * 0.09, 1.49, 0.222),
        box(0.025, 0.025, 0.02, '#ffffff', s * 0.09 + 0.02, 1.52, 0.226),
      ]))
    else out.push(...mirror((s) => [box(0.06, 0.09, 0.02, INK, s * 0.09, 1.5, 0.215), box(0.02, 0.02, 0.02, '#ffffff', s * 0.09 + 0.015, 1.52, 0.222)]))
    const brow = l.hairColor ?? INK
    out.push(...mirror((s) => box(0.09, 0.018, 0.02, brow, s * 0.09, 1.585, 0.215, 0, 0, l.face === 'stern' ? s * -0.25 : 0)))
    if (big) out.push(...mirror((s) => box(0.07, 0.035, 0.02, '#ff8fb0', s * 0.15, 1.43, 0.214)))
    if (l.face === 'clown') out.push(part(new SphereGeometry(0.05, 8, 6), '#e3263a', 0, 1.43, 0.22))
    else if (big) out.push(box(0.08, 0.035, 0.02, l.lips ?? '#e0486a', 0, 1.38, 0.215))
    else out.push(box(0.12, 0.025, 0.02, '#8a3a2a', 0, 1.38, 0.215))
  }
  switch (l.hat) {
    case 'cap':
    case 'police':
      out.push(box(0.46, l.hat === 'police' ? 0.16 : 0.12, 0.46, l.hatColor, 0, 1.72, 0), box(0.34, 0.03, 0.18, l.hatColor, 0, 1.67, 0.28))
      break
    case 'hardhat':
      out.push(part(new SphereGeometry(0.27, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), l.hatColor, 0, 1.66, 0), box(0.6, 0.03, 0.6, l.hatColor, 0, 1.66, 0))
      break
    case 'fedora':
      out.push(box(0.62, 0.03, 0.62, l.hatColor, 0, 1.69, 0), box(0.4, 0.16, 0.4, l.hatColor, 0, 1.78, 0))
      break
  }
  if (!l.hat) {
    if (l.hair) out.push(box(0.46, 0.12, 0.46, l.hairColor, 0, 1.72, 0), box(0.46, 0.3, 0.1, l.hairColor, 0, 1.58, -0.19))
    const hc = l.hairColor
    if (l.hair === 'curly') {
      out.push(box(0.46, 0.8, 0.1, hc, 0, 1.18, -0.2), ...mirror((s) => box(0.08, 0.5, 0.3, hc, s * 0.25, 1.4, -0.04)))
      for (const y of [1.62, 1.45, 1.28, 1.11]) out.push(...mirror((s) => part(new SphereGeometry(0.08, 8, 6), hc, s * 0.27, y, -0.1)))
    }
    if (l.hair === 'twinbraids')
      out.push(
        box(0.46, 0.3, 0.1, hc, 0, 1.46, -0.2),
        ...mirror((s) => [box(0.08, 0.3, 0.3, hc, s * 0.25, 1.52, -0.04), ...[1.3, 1.18, 1.06, 0.94].map((y) => part(new SphereGeometry(0.07, 8, 6), hc, s * 0.22, y, 0.13)), part(new SphereGeometry(0.04, 6, 4), l.ties ?? hc, s * 0.22, 0.86, 0.13)]),
      )
    if (l.hair === 'bun') out.push(part(new SphereGeometry(0.13, 10, 8), hc, 0, 1.76, -0.14))
    if (l.tufts) out.push(...mirror((s) => [part(new SphereGeometry(0.08, 8, 6), hc, s * 0.28, 1.68, -0.06), part(new SphereGeometry(0.04, 6, 4), l.tufts, s * 0.24, 1.66, -0.04)]))
    if (l.hair === 'long') out.push(box(0.46, 0.8, 0.1, l.hairColor, 0, 1.18, -0.2), ...mirror((s) => box(0.08, 0.5, 0.3, l.hairColor, s * 0.25, 1.4, -0.04)))
    if (l.hair === 'braid') out.push(box(0.46, 0.5, 0.1, l.hairColor, 0, 1.3, -0.2), ...mirror((s) => box(0.08, 0.34, 0.3, l.hairColor, s * 0.25, 1.5, -0.04)), box(0.1, 0.5, 0.1, l.hairColor, 0.2, 1.05, 0.12))
    if (l.hair === 'bob') out.push(box(0.5, 0.34, 0.1, l.hairColor, 0, 1.52, -0.2), ...mirror((s) => box(0.08, 0.3, 0.4, l.hairColor, s * 0.25, 1.58, 0)))
    if (l.hair === 'pigtails') out.push(box(0.12, 0.3, 0.12, l.tipA ?? l.hairColor, -0.29, 1.52, -0.05), box(0.12, 0.3, 0.12, l.tipB ?? l.hairColor, 0.29, 1.52, -0.05))
    // Headwear over the hair.
    if (l.band) out.push(box(0.47, 0.05, 0.47, l.band, 0, 1.66, 0), box(0.06, 0.06, 0.02, l.gem ?? '#ffd23a', 0, 1.66, 0.24))
    if (l.crown)
      out.push(
        box(0.3, 0.05, 0.04, l.crown, 0, 1.73, 0.14),
        ...[[-0.1, 0.08], [0, 0.13], [0.1, 0.08]].map(([x, h]) => part(new ConeGeometry(0.03, h, 4), l.crown, x, 1.75 + h / 2, 0.14)),
        box(0.04, 0.04, 0.02, l.gem ?? '#ff4f8a', 0, 1.74, 0.165),
      )
    if (l.bow) out.push(...mirror((s) => box(0.13, 0.1, 0.05, l.bow, s * 0.08, 1.8, 0.02, 0, 0, s * 0.3)), box(0.05, 0.05, 0.06, l.bow, 0, 1.8, 0.02))
    if (l.flower) out.push(part(new SphereGeometry(0.06, 8, 6), l.flower, 0.23, 1.62, 0.08), part(new SphereGeometry(0.025, 6, 4), '#ffd23a', 0.26, 1.62, 0.12))
  }
  // VIP: a spiky mane round the mask.
  if (l.mane)
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2
      out.push(part(new ConeGeometry(0.07, 0.2, 5), l.mane, Math.sin(a) * 0.3, 1.48 + Math.cos(a) * 0.3, -0.1, 0, 0, -a))
    }
  return out
}

// The white shape on a guard's mask (circle / triangle / square), the VIP's lion nose.
function maskSymbol(l) {
  const z = 0.238 // just in front of the mask's face plate
  const W = '#f4f4f4'
  switch (l.symbol) {
    case 'circle':
      return [part(new TorusGeometry(0.075, 0.014, 6, 18), W, 0, 1.5, z)]
    case 'triangle':
      return [box(0.15, 0.025, 0.02, W, 0, 1.44, z), box(0.15, 0.025, 0.02, W, -0.038, 1.505, z, 0, 0, Math.PI / 3), box(0.15, 0.025, 0.02, W, 0.038, 1.505, z, 0, 0, -Math.PI / 3)]
    case 'square':
      return [box(0.14, 0.025, 0.02, W, 0, 1.57, z), box(0.14, 0.025, 0.02, W, 0, 1.43, z), box(0.025, 0.14, 0.02, W, -0.07, 1.5, z), box(0.025, 0.14, 0.02, W, 0.07, 1.5, z)]
    case 'lion':
      return [...mirror((s) => box(0.08, 0.03, 0.02, INK, s * 0.09, 1.53, z, 0, 0, s * -0.3)), box(0.08, 0.06, 0.04, '#7a4a10', 0, 1.44, z)]
    case 'facets':
      return [...mirror((s) => box(0.1, 0.035, 0.02, '#000000', s * 0.09, 1.53, z, 0, 0, s * 0.15)), box(0.02, 0.4, 0.02, '#3a3a44', 0, 1.47, z)]
  }
  return []
}

// Outfit details over the body: dress bodice / skirt layers, collar, sleeves, sash, necklace,
// tracksuit number + trim, tie, belt, shoes, sparkles, the Recruiter's ddakji.
function outfit(l) {
  const out = []
  const F = 0.156 // the torso's front face
  if (l.top) out.push(box(0.6, 0.24, 0.32, l.top, 0, 1.12, 0))
  if (l.bodice) out.push(box(0.44, 0.5, 0.02, l.bodice, 0, 0.95, F))
  if (l.lace) for (const y of [1.0, 0.9, 0.8]) out.push(box(0.12, 0.018, 0.02, l.lace, 0, y, F + 0.012, 0, 0, 0.5), box(0.12, 0.018, 0.02, l.lace, 0, y, F + 0.012, 0, 0, -0.5))
  if (l.neckline) out.push(box(0.4, 0.1, 0.02, l.skin, 0, 1.19, F + 0.004))
  if (l.shell) out.push(...mirror((s) => part(new SphereGeometry(0.09, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), l.shell, s * 0.12, 1.06, F - 0.01, Math.PI / 2)))
  if (l.collar) out.push(box(0.42, 0.08, 0.34, l.collar, 0, 1.25, 0))
  if (l.straps) out.push(...mirror((s) => box(0.07, 0.6, 0.02, l.straps, s * 0.14, 0.93, F)), box(0.36, 0.26, 0.02, l.straps, 0, 0.78, F + 0.002))
  if (l.sleeves) out.push(...mirror((s) => part(new SphereGeometry(0.15, 10, 8), l.sleeves, s * 0.38, 1.17, 0)))
  if (l.sash) out.push(box(0.6, 0.07, 0.32, l.sash, 0, 0.68, 0), ...mirror((s) => box(0.1, 0.08, 0.02, l.sash, s * 0.06, 0.68, F + 0.01, 0, 0, s * 0.3)))
  if (l.necklace) out.push(box(0.22, 0.025, 0.02, l.necklace, 0, 1.2, F + 0.006), box(0.05, 0.05, 0.02, l.pendant ?? l.necklace, 0, 1.16, F + 0.008))
  if (l.number) out.push(box(0.15, 0.09, 0.02, '#ffffff', 0.13, 1.06, F + 0.002), box(0.11, 0.03, 0.02, INK, 0.13, 1.06, F + 0.007))
  // Arm and leg stripes in halves, one per bone.
  if (l.trim) out.push(...mirror((s) => [1.065, 0.775].map((y) => box(0.02, 0.29, 0.07, l.trim, s * 0.495, y, 0))), ...mirror((s) => [0.47, 0.17].map((y) => box(0.02, 0.3, 0.07, l.trim, s * 0.275, y, 0))))
  if (l.tie) out.push(box(0.16, 0.3, 0.02, '#f4f4f4', 0, 1.08, F), box(0.05, 0.28, 0.02, l.tie, 0, 1.05, F + 0.006))
  if (l.belt) out.push(box(0.6, 0.07, 0.32, l.belt, 0, 0.7, 0), box(0.07, 0.06, 0.02, '#c9ced8', 0, 0.7, F + 0.01))
  if (l.shoes) out.push(...mirror((s) => box(0.28, 0.1, 0.34, l.shoes, s * 0.14, 0.05, 0.03)))
  if (l.overskirt) out.push(part(new CylinderGeometry(0.31, 0.45, 0.4, 12), l.overskirt, 0, 0.46, 0))
  if (l.hem) out.push(part(new CylinderGeometry(0.51, 0.51, 0.05, 12), l.hem, 0, 0.06, 0))
  if (l.sparkle)
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4 - 1.2 // round the front of the skirt
      const y = 0.12 + (i % 3) * 0.17
      const r = 0.5 - (y - 0.04) * 0.32 + 0.012
      out.push(to(J.hips, box(0.04, 0.04, 0.02, l.sparkle, Math.sin(a) * r, y, Math.cos(a) * r, 0, a, Math.PI / 4)))
    }
  if (l.ddakji) out.push(...[box(0.17, 0.17, 0.03, '#2f63c8', -0.4, 0.5, 0.18, 0.4, 0, 0.2), box(0.15, 0.15, 0.03, '#d9263a', -0.36, 0.46, 0.2, 0.4, 0, -0.2)].map((g) => to(J.fore[0], g)))
  return out
}

// The partner's skeleton: [parent, x, y] of each joint (figure units, standing, front +Z). Index
// 0 / 1 of a pair = the -x / +x side (mirror()'s order).
const J = { hips: 0, spine: 1, head: 2, thigh: [3, 5], shin: [4, 6], arm: [7, 9], fore: [8, 10] }
const JOINTS = [
  [-1, 0, 0.64], // hips
  [0, 0, 0.64], // spine, bending at the waist
  [1, 0, 1.25], // head, at the neck
  [0, -0.14, 0.64], [3, -0.14, 0.32], // thigh, shin
  [0, 0.14, 0.64], [5, 0.14, 0.32],
  [1, -0.39, 1.2], [7, -0.39, 0.92], // upper arm, forearm (+ hand)
  [1, 0.39, 1.2], [9, 0.39, 0.92],
]
const to = (bone, g) => ((g.userData.bone = bone), g)
const centre = new Vector3()
// The bone a block follows: its own tag, else where it sits on the standing figure.
function boneOf(g) {
  if (g.userData.bone !== undefined) return g.userData.bone
  g.computeBoundingBox()
  const c = g.boundingBox.getCenter(centre)
  const s = c.x < 0 ? 0 : 1
  if (Math.abs(c.x) > 0.3 && c.y > 0.45) return c.y > 0.92 ? J.arm[s] : J.fore[s]
  if (c.y < 0.64) return Math.abs(c.x) < 0.04 ? J.hips : c.y < 0.32 ? J.shin[s] : J.thigh[s]
  return J.spine
}
// Merges the blocks as a rigidly skinned geometry (each vertex wholly on its block's bone).
function mergeSkinned(parts) {
  for (const g of parts.flat()) {
    const n = g.attributes.position.count
    const index = new Uint16Array(n * 4)
    const weight = new Float32Array(n * 4)
    index.fill(boneOf(g))
    for (let i = 0; i < n; i++) weight[i * 4] = 1
    g.setAttribute('skinIndex', new Uint16BufferAttribute(index, 4))
    g.setAttribute('skinWeight', new (g.attributes.position.constructor)(weight, 4))
  }
  return merge(parts)
}

const partnerGeos = new Map()
function partnerGeometry(id) {
  if (partnerGeos.has(id)) return partnerGeos.get(id)
  const p = PARTNER.partners.find((x) => x.id === id)
  const l = { skin: '#f1c9a5', color: '#7a8190', color2: '#4a4f5c', pants: '#2b3550', ...p?.look }
  const armColor = l.arms ?? l.color
  const hand = l.gloves ?? l.skin
  // Arms hang down in the bind pose (raised by their bones for `armsUp`); limbs come in halves.
  const g = mergeSkinned([
    ...(l.skirt ? [part(new CylinderGeometry(0.3, 0.5, 0.62, 12), l.skirt, 0, 0.35, 0)] : []),
    ...mirror((s) => [0.48, 0.16].map((y) => box(0.26, 0.32, 0.28, s < 0 ? l.pants : l.pants2 ?? l.pants, s * 0.14, y, 0))),
    box(0.58, 0.62, 0.3, l.color, 0, 0.93, 0),
    ...shirt(l),
    ...outfit(l),
    ...mirror((s) => [box(0.2, 0.31, 0.24, armColor, s * 0.39, 1.075, 0), box(0.2, 0.31, 0.24, armColor, s * 0.39, 0.765, 0), box(0.18, 0.12, 0.22, hand, s * 0.39, 0.58, 0)]),
    ...head(l).flat(Infinity).map((h) => to(J.head, h)),
    ...(l.cape ? [box(0.62, 1.05, 0.04, l.cape, 0, 0.78, -0.2, -0.12)] : []),
    ...(l.bat ? [to(J.fore[1], part(new CylinderGeometry(0.035, 0.06, 0.8, 8), '#8a5a2c', 0.42, 0.68, 0.18, 0.5))] : []),
    ...(l.clipboard ? [to(J.fore[0], box(0.26, 0.34, 0.03, '#d8c9a2', -0.4, 0.82, 0.2, -0.3))] : []),
  ])
  partnerGeos.set(id, g)
  return g
}

// A partner figure: the cached geometry on its own skeleton, standing (bones at rest).
function partnerFigure(id) {
  const bones = JOINTS.map(([parent, x, y]) => {
    const b = new Bone()
    b.position.set(x - (parent < 0 ? 0 : JOINTS[parent][1]), y - (parent < 0 ? 0 : JOINTS[parent][2]), 0)
    return b
  })
  JOINTS.forEach(([parent], i) => parent >= 0 && bones[parent].add(bones[i]))
  const mesh = new SkinnedMesh(partnerGeometry(id), MATS.plain)
  mesh.add(bones[0])
  mesh.updateMatrixWorld(true)
  mesh.bind(new Skeleton(bones))
  mesh.frustumCulled = false // posed far from its bind-pose bounds
  mesh.userData.bones = bones
  mesh.userData.look = PARTNER.partners.find((x) => x.id === id)?.look ?? {}
  return mesh
}
// Raises both arms beside the head (`armsUp`: the Superhero pose).
function raiseArms(bones) {
  mirror((s) => bones[J.arm[s < 0 ? 0 : 1]].rotation.set(0, 0, s * (Math.PI - 0.2)))
}

// --- The partner riding pillion ------------------------------------------------------------
// Seated astride on the horse's `seat` behind the rider, arms round its waist (COMPANIONS.ride).
// Its weight hangs on three damped springs (fore-aft, up-down, sideways, in the seat's frame)
// driven by the seat's own acceleration, measured off its world position each frame (so a
// remote player's partner rides the same): it sways back on a push-off and pitches forward on a
// halt, sinks into the saddle and bounces off it with every stride of the trot and gallop, lifts
// off over a jump, and leans into turns; the lower legs swing with the same weight. Its head
// stays level against the horse's pitch, it breathes, looks round while the horse stands, and
// now and then leans out to peek past the rider on the move.
const rideTmp = { p: new Vector3(), v: new Vector3(), a: new Vector3(), q: new Quaternion(), fwd: new Vector3() }
const SIDES = [-1, 1]
function createRide(fig, seat) {
  const R = COMPANIONS.ride
  const bones = fig.userData.bones
  const armsUp = fig.userData.look.armsUp
  const last = new Vector3()
  const vel = new Vector3()
  const acc = new Vector3() // m/s^2, smoothed, seat frame
  const springs = [0, 1, 2].map(() => ({ x: 0, v: 0 })) // x (side), y (up), z (fore-aft), m
  let fresh = true
  let speed = 0
  let look = 0
  let lookTo = 0
  let peek = 0
  let peekTo = 0
  let next = 2
  const rnd = (lo, hi) => lo + Math.random() * (hi - lo)
  const sideOf = (s) => (s < 0 ? 0 : 1)
  return {
    reset() {
      fresh = true
    },
    update(dt, t) {
      if (!(dt > 0)) return
      const { p, v, a, q: qs, fwd } = rideTmp
      seat.getWorldPosition(p)
      seat.getWorldQuaternion(qs)
      // A respawn / teleport / first frame is not a motion.
      if (fresh || p.distanceToSquared(last) > 9) {
        fresh = false
        last.copy(p)
        vel.set(0, 0, 0)
        acc.set(0, 0, 0)
        for (const s of springs) s.x = s.v = 0
      }
      v.copy(p).sub(last).divideScalar(dt)
      last.copy(p)
      a.copy(v).sub(vel).divideScalar(dt).clampLength(0, R.maxAccel).applyQuaternion(qs.invert())
      qs.invert()
      vel.copy(v)
      acc.lerp(a, 1 - Math.exp(-R.accelSmooth * dt))
      speed += (Math.hypot(v.x, v.z) - speed) * (1 - Math.exp(-4 * dt))

      // The weight against the seat: x'' = -a - w^2 x - 2 zeta w x'.
      const steps = Math.ceil(dt * 240)
      const h = dt / steps
      for (let i = 0; i < 3; i++) {
        const [w, zeta] = R.spring[i]
        const s = springs[i]
        const drive = -acc.getComponent(i)
        for (let k = 0; k < steps; k++) {
          s.v += (drive - w * w * s.x - 2 * zeta * w * s.v) * h
          s.x += s.v * h
        }
        s.x = clamp(s.x, -R.maxSway, R.maxSway)
      }
      const side = springs[0].x
      const up = springs[1].x
      const fore = springs[2].x

      // Fidgets: looking round standing, peeking past the rider moving.
      next -= dt
      if (next <= 0) {
        const moving = speed > 1.5
        lookTo = moving ? 0 : Math.random() < 0.3 ? 0 : rnd(-R.look, R.look)
        peekTo = moving && peek === 0 && Math.random() < 0.6 ? (Math.random() < 0.5 ? -1 : 1) : 0
        next = rnd(R.fidgetEvery[0], R.fidgetEvery[1]) * (peekTo ? 0.5 : 1)
      }
      const ke = 1 - Math.exp(-3 * dt)
      look += (lookTo - look) * ke
      peek += (peekTo - peek) * ke
      if (Math.abs(peek - peekTo) < 0.01) peek = peekTo

      const P = R.pose
      const scale = fig.scale.x
      const lean = clamp(speed / R.leanSpeed, 0, 1) * R.lean
      const sway = fore * R.pitch - Math.min(up, 0) * R.slump // the springs' share of the pitch
      const pitch = P.spine + lean + sway + Math.sin(t * Math.PI * 2 * R.breathRate) * R.breath
      fwd.set(0, 0, 1).applyQuaternion(qs)
      const horsePitch = Math.asin(clamp(fwd.y, -1, 1)) // nose up > 0

      const hips = bones[J.hips]
      hips.position.set(0, R.seat + clamp(up, -R.sink, R.lift) / scale, clamp(fore, -0.05, 0.05) / scale)
      hips.rotation.set(sway * 0.3, 0, 0)
      bones[J.spine].rotation.set(pitch, peek * 0.12 + look * 0.25, side * R.roll - peek * R.peekRoll)
      bones[J.head].rotation.set(P.head - (pitch - P.spine) * 0.75 + horsePitch * 0.6, look * 0.6 + peek * 0.35, -side * R.roll * 0.5 + peek * R.peekRoll * 0.5)
      for (const s of SIDES) {
        const i = sideOf(s)
        // Thighs round the barrel, gripping tighter at speed; lower legs swing with the weight.
        bones[J.thigh[i]].rotation.set(P.thigh[0] + lean * 0.3, 0, s * (P.thigh[2] - lean * 0.15))
        bones[J.shin[i]].rotation.set(P.shin[0] - fore * R.swing + up * R.dangle + s * side * R.swing * 0.5, 0, s * P.shin[2])
        if (armsUp) {
          // Arms up in a cheer, bouncing with the stride.
          bones[J.arm[i]].rotation.set(-sway * 0.5, 0, s * (Math.PI - 0.25 + up * R.dangle * 0.5 + Math.sin(t * 3 + s) * 0.06))
          bones[J.fore[i]].rotation.set(0, 0, 0)
        } else {
          // Hands stay on the rider: the arms take back what the springs pitch the torso.
          bones[J.arm[i]].rotation.set(P.arm[0] - sway * 0.9, 0, s * P.arm[2])
          bones[J.fore[i]].rotation.set(P.fore[0] + sway * 0.3, 0, s * P.fore[2])
        }
      }
    },
  }
}

// --- Materials -------------------------------------------------------------------------------
const MATS = {
  plain: new MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }),
  golden: new MeshStandardMaterial({ vertexColors: true, color: '#ffd65a', metalness: 0.65, roughness: 0.28, emissive: '#5a3800', emissiveIntensity: 0.6 }),
  rainbow: new MeshStandardMaterial({ vertexColors: true, roughness: 0.4, emissive: '#ff0000', emissiveIntensity: 0.55 }),
}
const tierMat = (tier) => (tier >= 2 ? MATS.rainbow : tier === 1 ? MATS.golden : MATS.plain)
// Once per frame (main.js): the Rainbow pets' glow walks round the colour wheel.
export function updateCompanionMaterials(t) {
  MATS.rainbow.emissive.setHSL((t * 0.25) % 1, 1, 0.5)
}

// A PARTNER as one standing figure (~1.9 m, front +Z): the Partner stage's display (lobby.js).
export function partnerModel(id) {
  const fig = partnerFigure(id)
  if (fig.userData.look.armsUp) raiseArms(fig.userData.bones)
  return fig
}

// --- A horse's companions -------------------------------------------------------------------
// scene: where the pets fly (they swing after the horse in world space); seat: the horse's
// partner seat (horse.js). shadows: cast shadows (the local player's only).
export function createCompanions(scene, seat, { shadows = false } = {}) {
  const pets = new Group() // follows the owner, yaw eased so the pets swing round after turns
  scene.add(pets)
  let petMeshes = []
  let petKey = ''
  let partner = null
  let partnerId = ''
  let ride = null
  let yaw = null

  return {
    get petCount() {
      return pets.visible ? petMeshes.length : 0
    },
    // [{ kind, tier }] equipped, at most COMPANIONS.slots.length drawn.
    setPets(list) {
      const shown = list.filter((p) => PETS.kinds[p.kind]).slice(0, COMPANIONS.slots.length)
      const key = shown.map((p) => `${p.kind}:${p.tier}`).join(',')
      if (key === petKey) return
      petKey = key
      for (const m of petMeshes) pets.remove(m)
      petMeshes = shown.map((p, i) => {
        const m = new Mesh(petGeometry(p.kind), tierMat(p.tier))
        const huge = p.kind.startsWith('huge')
        m.scale.setScalar(COMPANIONS.petScale * (huge ? COMPANIONS.hugeScale : 1))
        m.castShadow = shadows
        m.userData.slot = i
        pets.add(m)
        return m
      })
    },
    // A PARTNER id, or '' / null for none.
    setPartner(id) {
      id = PARTNER.partners.some((p) => p.id === id) ? id : ''
      if (id === partnerId) return
      partnerId = id
      if (partner) {
        seat.remove(partner)
        partner.skeleton.dispose()
      }
      partner = ride = null
      if (!id) return
      partner = partnerFigure(id)
      partner.scale.setScalar(COMPANIONS.partnerScale)
      partner.castShadow = shadows
      seat.add(partner)
      ride = createRide(partner, seat)
    },
    setVisible(on) {
      pets.visible = on
      if (partner) {
        if (on && !partner.visible) ride.reset()
        partner.visible = on
      }
    },
    // x, y, z: the owner's feet; heading: its yaw (rad); t: elapsed s. Snaps on big jumps.
    update(dt, t, x, y, z, heading) {
      if (yaw === null || Math.hypot(x - pets.position.x, z - pets.position.z) > 40) yaw = heading
      const d = Math.atan2(Math.sin(heading - yaw), Math.cos(heading - yaw))
      yaw += d * (1 - Math.exp(-COMPANIONS.turnLag * dt))
      pets.position.set(x, y, z)
      pets.rotation.y = yaw
      for (const m of petMeshes) {
        const i = m.userData.slot
        const [sx, sy, sz] = COMPANIONS.slots[i]
        m.position.set(sx + Math.sin(t * 1.3 + i * 2.1) * 0.15, sy + Math.sin(t * 2.4 + i) * COMPANIONS.bob, sz + Math.cos(t * 1.1 + i * 1.7) * 0.15)
        m.rotation.set(0, Math.sin(t * 0.9 + i) * 0.25 - d * 0.6, Math.sin(t * 1.7 + i) * 0.06)
      }
      if (partner?.visible) ride.update(dt, t)
    },
    dispose() {
      scene.remove(pets)
      if (partner) {
        seat.remove(partner)
        partner.skeleton.dispose()
      }
    },
  }
}
