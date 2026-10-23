import {
  AdditiveBlending,
  BoxGeometry,
  CapsuleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Euler,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { HORSE } from './config.js'
import { createEmitter, removeEmitter } from './particles.js'
import { neon } from './propkit.js'
import { bake } from './bake.js'

// The player's horse (and every remote player's, remotePlayers.js): a blocky procedural horse
// with a saddle, and rocket boosters on a rack behind it (the equipped engine's colours x the
// mount's engine count), each with a flickering flame. Built facing +Z (the character's forward),
// hooves on y = 0 (the player's feet). Every moving part (body, neck + head, tail, two segments per
// leg) is ONE vertex-coloured mesh, so a horse costs ~11 draw calls plus its engines. The gait
// (walk / trot / gallop, blended by speed) is posed procedurally in update(). The avatar rides on
// `horse.rider`, inside the body, so it bobs and leans with it.

const std = (color, extra) => new MeshStandardMaterial({ color, roughness: 0.55, metalness: 0, ...extra })

function shadowed(mesh) {
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

// One engine (shared with the lobby's parked raft and the catalog models). Nose +Z, flame out of -Z.
export function makeEngine({ body = HORSE.engine, band = HORSE.engineBand, flame = HORSE.flame } = {}) {
  const group = new Group()
  const bodyMat = std(body, { roughness: 0.4 })
  const bandMat = std(band, { emissive: band, emissiveIntensity: 0.25 })
  const metal = std('#2b2f36', { metalness: 0.6, roughness: 0.35 })

  const tube = new CylinderGeometry(0.2, 0.2, 0.85, 18)
  tube.rotateX(Math.PI / 2)
  group.add(shadowed(new Mesh(tube, bodyMat)))
  const ring = new CylinderGeometry(0.215, 0.215, 0.08, 18)
  ring.rotateX(Math.PI / 2)
  for (const z of [0.24, 0.02, -0.2]) {
    const m = shadowed(new Mesh(ring, bandMat))
    m.position.z = z
    group.add(m)
  }
  const nose = new SphereGeometry(0.2, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2)
  nose.rotateX(Math.PI / 2)
  const noseMesh = shadowed(new Mesh(nose, bandMat))
  noseMesh.position.z = 0.425
  group.add(noseMesh)
  const nozzle = new CylinderGeometry(0.16, 0.23, 0.22, 18, 1, true)
  nozzle.rotateX(Math.PI / 2)
  const nozzleMesh = shadowed(new Mesh(nozzle, metal))
  nozzleMesh.material.side = DoubleSide
  nozzleMesh.position.z = -0.53
  group.add(nozzleMesh)

  // Flame: an outer coloured cone and a white-hot core, additive, tip pointing back.
  const flameGroup = new Group()
  flameGroup.position.z = -0.6
  const outer = new ConeGeometry(0.19, 0.6, 16, 1, true)
  outer.translate(0, 0.3, 0)
  outer.rotateX(-Math.PI / 2)
  const core = new ConeGeometry(0.1, 0.32, 12, 1, true)
  core.translate(0, 0.16, 0)
  core.rotateX(-Math.PI / 2)
  // Bloom-aware (neon): HDR-bright with bloom on so the jets glow, plain colour without.
  const additive = { transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }
  const flameMat = neon(flame, HORSE.flameGlow, { ...additive, opacity: 0.75 })
  const coreMat = neon('#d8f8ff', HORSE.flameGlow, { ...additive, opacity: 0.6 })
  flameGroup.add(new Mesh(outer, flameMat), new Mesh(core, coreMat))
  group.add(flameGroup)
  return { group, flame: flameGroup }
}

// Frees a group's own geometries and materials (engines swapped out, a remote horse leaving).
export function disposeGroup(group) {
  group.traverse((o) => {
    if (o.isPoints) return removeEmitter(o)
    o.geometry?.dispose()
    if (o.material) for (const m of [o.material].flat()) m.dispose()
  })
}

// Until the horse catalog lands, the mount list is still the boat catalog (BOATS): each entry's
// model colours dress the horse, so equipping one still changes how it looks.
export function boatLook(entry) {
  const m = entry?.model ?? {}
  const coat = m.color ?? m.tube
  if (!coat) return {}
  return { coat, mane: '#' + new Color(coat).multiplyScalar(0.4).getHexString(), blanket: m.band ?? m.neon ?? m.stripes ?? m.seat ?? m.cabin ?? m.sail ?? m.rim }
}

// --- Model -----------------------------------------------------------------------
// Pieces are written in horse space (metres, hooves at y = 0, nose +Z), then each part's merged
// geometry is moved into its pivot's frame. All pieces carry a vertex colour.
const M = new Matrix4()
const Q = new Quaternion()
const E = new Euler()
const P = new Vector3()
const S = new Vector3()
function piece(list, geo, color, [x, y, z] = [0, 0, 0], [rx, ry, rz] = [0, 0, 0], [sx, sy, sz] = [1, 1, 1]) {
  const g = geo.index ? geo.toNonIndexed() : geo
  if (g !== geo) geo.dispose()
  g.deleteAttribute('uv')
  M.compose(P.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)), S.set(sx, sy, sz))
  g.applyMatrix4(M)
  const c = new Color(color)
  const n = g.attributes.position.count
  const colors = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3)
  g.setAttribute('color', new Float32BufferAttribute(colors, 3))
  list.push(g)
}
function merged(list, [ox, oy, oz]) {
  const g = mergeGeometries(list)
  for (const p of list) p.dispose()
  g.translate(-ox, -oy, -oz)
  return g
}
const ball = (r = 1, w = 14, h = 10) => new SphereGeometry(r, w, h)
const box = (x, y, z) => new BoxGeometry(x, y, z)

// Body-part pivots (horse space). The legs hang from their shoulders / hips.
const D = HORSE.dims
const BODY_PIVOT = [0, D.barrelY, 0]
const NECK_PIVOT = [0, D.barrelY + 0.2, D.barrelLength / 2 - 0.12]
const TAIL_PIVOT = [0, D.barrelY + 0.24, -D.barrelLength / 2 - 0.08]
const NECK_TILT = 0.62 // rad the neck leans forward from upright
const HEAD_TILT = 0.85 // rad the face points down from level
const LEG_X = D.barrelWidth / 2 - 0.15
const LEGS = [
  // side (+X = the horse's left), front?, hoof phase in each gait's cycle: walk, trot, gallop
  { side: 1, front: true, offset: [0.25, 0, 0.45] },
  { side: -1, front: true, offset: [0.75, 0.5, 0.57] },
  { side: 1, front: false, offset: [0, 0.5, 0] },
  { side: -1, front: false, offset: [0.5, 0, 0.12] },
]

function buildParts(look) {
  const L = { ...HORSE.look, ...look }
  const bw = D.barrelWidth / 2
  const by = D.barrelY
  const bl = D.barrelLength / 2

  // Body: barrel, chest and rump, saddle, blanket, girth, stirrups, saddle bags, booster rack.
  const body = []
  piece(body, ball(1, 18, 12), L.coat, [0, by, 0], [0, 0, 0], [bw, D.barrelHeight / 2, bl])
  piece(body, ball(1, 16, 12), L.coat, [0, by + 0.04, bl - 0.3], [0, 0, 0], [bw * 1.04, D.barrelHeight / 2 + 0.04, 0.48])
  piece(body, ball(1, 16, 12), L.coat, [0, by + 0.06, -bl + 0.3], [0, 0, 0], [bw * 1.08, D.barrelHeight / 2 + 0.05, 0.5])
  const top = by + D.barrelHeight / 2
  piece(body, box(bw * 2 + 0.06, 0.05, 0.8), L.blanket, [0, top - 0.02, D.saddleZ], [0, 0, 0], [1, 1, 1])
  piece(body, box(bw * 2 + 0.1, 0.06, 0.06), L.trim, [0, top - 0.02, D.saddleZ + 0.38])
  piece(body, box(bw * 2 + 0.1, 0.06, 0.06), L.trim, [0, top - 0.02, D.saddleZ - 0.38])
  piece(body, ball(1, 14, 8), L.saddle, [0, top + 0.03, D.saddleZ], [0, 0, 0], [0.3, 0.08, 0.36])
  piece(body, box(0.18, 0.16, 0.1), L.saddle, [0, top + 0.1, D.saddleZ + 0.3]) // pommel
  piece(body, box(0.42, 0.14, 0.08), L.saddle, [0, top + 0.08, D.saddleZ - 0.32]) // cantle
  piece(body, new TorusGeometry(bw + 0.015, 0.035, 6, 24), L.leather, [0, by, D.saddleZ + 0.12], [0, 0, 0], [1, D.barrelHeight / D.barrelWidth, 1])
  for (const s of [1, -1]) {
    // Stirrup leathers and irons, where the rider's feet hang (ANIM.ride).
    piece(body, box(0.04, 0.34, 0.06), L.leather, [s * (bw + 0.02), top - 0.12, D.saddleZ + 0.08], [0, 0, s * 0.35])
    piece(body, new TorusGeometry(0.075, 0.02, 6, 12), L.metal, [s * (bw + 0.1), top - 0.34, D.saddleZ + 0.14], [0, Math.PI / 2, 0])
    piece(body, box(0.14, 0.26, 0.34), L.saddle, [s * (bw - 0.02), by + 0.12, -bl + 0.48]) // saddle bag
  }
  piece(body, box(bw * 2 + 0.5, 0.1, 0.18), L.rack, [0, D.rackY, D.rackZ]) // the booster rack

  // Neck + head (pivots at the withers): a thick neck leaning forward, the head angled nose-down.
  const neck = []
  const up = new Vector3(0, Math.cos(NECK_TILT), Math.sin(NECK_TILT)) // along the neck
  const crest = new Vector3(0, Math.sin(NECK_TILT), -Math.cos(NECK_TILT)) // toward the mane
  const base = new Vector3(...NECK_PIVOT)
  const along = (d, back = 0) => base.clone().addScaledVector(up, d).addScaledVector(crest, back)
  piece(neck, new CapsuleGeometry(D.neckRadius, D.neckLength, 4, 12), L.coat, along(D.neckLength / 2 + 0.06).toArray(), [NECK_TILT, 0, 0], [1, 1, 1.12])
  // Blocky mane along the crest.
  for (let i = 0; i < 5; i++) piece(neck, box(0.13, 0.17, 0.15), L.mane, along(0.04 + (i / 4) * D.neckLength, D.neckRadius - 0.02).toArray(), [NECK_TILT, 0, 0])
  // The head and everything on it: positions in the head's own frame (+Z along the face, nose-down
  // by HEAD_TILT), from the centre of the head box, which hangs off the top of the neck.
  const headTilt = new Euler(HEAD_TILT, 0, 0)
  const centre = along(D.neckLength + 0.1).add(new Vector3(0, -0.02, 0.24).applyEuler(headTilt))
  const onHead = (x, y, z) => new Vector3(x, y, z).applyEuler(headTilt).add(centre).toArray()
  const tilted = [HEAD_TILT, 0, 0]
  piece(neck, box(0.3, 0.34, 0.6), L.coat, onHead(0, 0, 0), tilted)
  piece(neck, box(0.26, 0.28, 0.2), L.muzzle, onHead(0, -0.03, 0.34), tilted)
  piece(neck, box(0.28, 0.3, 0.035), L.leather, onHead(0, -0.03, 0.22), tilted) // noseband
  piece(neck, box(0.16, 0.08, 0.14), L.mane, onHead(0, 0.19, -0.2), tilted) // forelock
  if (L.blaze) piece(neck, box(0.08, 0.01, 0.5), L.blaze, onHead(0, 0.172, 0.06), tilted)
  for (const s of [1, -1]) {
    piece(neck, ball(0.028, 6, 4), '#1a1110', onHead(s * 0.08, -0.02, 0.44)) // nostril
    piece(neck, ball(0.055, 10, 8), '#14100e', onHead(s * 0.15, 0.07, -0.02)) // eye
    piece(neck, ball(0.019, 6, 4), '#ffffff', onHead(s * 0.19, 0.09, 0.01)) // eye shine
    piece(neck, new ConeGeometry(0.06, 0.18, 6), L.coat, onHead(s * 0.09, 0.22, -0.24), [-0.35, 0, s * -0.2]) // ear
    piece(neck, box(0.02, 0.025, 0.42), L.leather, onHead(s * 0.155, -0.05, 0.06), tilted) // cheek strap
    // Reins: from the bit back to the pommel.
    const from = new Vector3(...onHead(s * 0.14, -0.1, 0.3))
    const to = new Vector3(s * 0.1, by + D.barrelHeight / 2 + 0.16, D.saddleZ + 0.34)
    const mid = from.clone().add(to).multiplyScalar(0.5)
    const len = from.distanceTo(to)
    const dir = to.clone().sub(from).normalize()
    const rein = new CylinderGeometry(0.012, 0.012, len, 4)
    rein.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir))
    piece(neck, rein, L.leather, [mid.x, mid.y, mid.z])
  }

  // Tail: blocky tufts hanging from the dock.
  const tail = []
  piece(tail, new CapsuleGeometry(0.06, 0.12, 3, 8), L.coat, [TAIL_PIVOT[0], TAIL_PIVOT[1] - 0.04, TAIL_PIVOT[2] - 0.04], [0.5, 0, 0])
  for (let i = 0; i < 4; i++) {
    const w = 0.16 + (i === 1 || i === 2 ? 0.04 : 0)
    piece(tail, box(w, 0.2, 0.12), L.mane, [0, TAIL_PIVOT[1] - 0.12 - i * 0.16, TAIL_PIVOT[2] - 0.1 - i * 0.03], [0.25, 0, 0])
  }

  // Legs: an upper (forearm / gaskin) and a lower (cannon, fetlock, hoof) per leg.
  const legs = LEGS.map(({ side, front }) => {
    const x = side * LEG_X
    const z = front ? D.frontZ : D.hindZ
    const hip = D.hipY
    const knee = D.kneeY
    const upper = []
    const r = front ? 0.13 : 0.16
    piece(upper, new CylinderGeometry(r, r * 0.75, hip - knee + 0.1, 10), L.coat, [x, (hip + knee) / 2, z])
    piece(upper, ball(r * 1.05, 10, 8), L.coat, [x, knee, z])
    if (!front) piece(upper, ball(1, 12, 10), L.coat, [x, hip + 0.04, z + 0.04], [0, 0, 0], [0.19, 0.3, 0.26]) // thigh
    const lower = []
    const sock = L.socks ? L.sock : L.coat
    piece(lower, new CylinderGeometry(0.09, 0.08, knee - 0.12, 8), sock, [x, (knee + 0.12) / 2 + 0.02, z])
    piece(lower, ball(0.105, 8, 6), sock, [x, 0.17, z + 0.02]) // fetlock
    piece(lower, new CylinderGeometry(0.1, 0.125, 0.13, 10), L.hoof, [x, 0.065, z + 0.02])
    return { upper: merged(upper, [x, hip, z]), lower: merged(lower, [x, knee, z]), pivot: [x, hip, z], knee: [x, knee, z] }
  })

  return {
    body: merged(body, BODY_PIVOT),
    neck: merged(neck, NECK_PIVOT),
    tail: merged(tail, TAIL_PIVOT),
    legs,
  }
}

// --- Gait --------------------------------------------------------------------------
const TAU = Math.PI * 2
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)
const ease = (t) => t * t * (3 - 2 * t)
const smooth = (e0, e1, v) => ease(clamp((v - e0) / (e1 - e0), 0, 1))
const GAITS = ['walk', 'trot', 'gallop']
let lift = 0 // stride()'s second result
// A hoof's place in its cycle p (0..1): -1 = reached forward, +1 = pushed back; the hoof is down for
// the first `duty` of the cycle (sliding back at a steady rate) and swings forward, lifted, after.
function stride(p, duty) {
  if (p < duty) {
    lift = 0
    return -1 + (2 * p) / duty
  }
  const t = (p - duty) / (1 - duty)
  lift = Math.sin(Math.PI * t)
  return 1 - 2 * ease(t)
}

// lite (remote players' horses, remotePlayers.js): no exhaust sparks, no shadows, and the engines'
// static parts baked to one mesh per material (only the flames stay apart: they flicker), so a
// horse with 8 engines costs a handful of draw calls instead of ~60.
export function createHorse({ lite = false } = {}) {
  const root = new Group() // follows the player; the body bobs and tilts inside it
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0 })
  const body = new Group()
  body.position.set(...BODY_PIVOT)
  root.add(body)
  const mesh = (parent, [x, y, z], [ox, oy, oz]) => {
    const g = new Group()
    g.position.set(x - ox, y - oy, z - oz)
    parent.add(g)
    const m = new Mesh(undefined, material)
    m.castShadow = !lite
    m.receiveShadow = !lite
    g.add(m)
    return { pivot: g, mesh: m }
  }
  const bodyMesh = new Mesh(undefined, material)
  bodyMesh.castShadow = bodyMesh.receiveShadow = !lite
  body.add(bodyMesh)
  const neck = mesh(body, NECK_PIVOT, BODY_PIVOT)
  const tail = mesh(body, TAIL_PIVOT, BODY_PIVOT)
  // Legs hang from the body (so they pitch with it); the lower segment from the upper's knee.
  const legs = LEGS.map((spec) => {
    const x = spec.side * LEG_X
    const z = spec.front ? D.frontZ : D.hindZ
    const upper = mesh(body, [x, D.hipY, z], BODY_PIVOT)
    const lower = mesh(upper.pivot, [x, D.kneeY, z], [x, D.hipY, z])
    return { ...spec, upper, lower }
  })

  function setLook(look = {}) {
    const parts = buildParts(look)
    bodyMesh.geometry?.dispose()
    bodyMesh.geometry = parts.body
    neck.mesh.geometry?.dispose()
    neck.mesh.geometry = parts.neck
    tail.mesh.geometry?.dispose()
    tail.mesh.geometry = parts.tail
    legs.forEach((leg, i) => {
      leg.upper.mesh.geometry?.dispose()
      leg.upper.mesh.geometry = parts.legs[i].upper
      leg.lower.mesh.geometry?.dispose()
      leg.lower.mesh.geometry = parts.legs[i].lower
    })
  }
  setLook()

  // The boosters sit on the rack behind the saddle: up to two high per side, further pairs behind,
  // an odd one under the belly. They take the equipped engine's colours and the mount's engine
  // count (setEngines).
  let flames = []
  let engines = []
  let baked = null // lite: the engines' merged static parts
  const halfWidth = D.barrelWidth / 2 + 0.3
  const rack = new Group()
  rack.position.set(0, D.rackY - BODY_PIVOT[1], D.rackZ)
  body.add(rack)
  function layoutEngines() {
    const paired = engines.length - (engines.length % 2)
    engines.forEach((e, i) => {
      if (i >= paired) return e.group.position.set(0, -0.76, 0.3) // the odd one: under the belly
      const side = i % 2 ? 1 : -1
      const j = Math.floor(i / 2) // per side: bottom, top, then the next pair behind
      e.group.position.set(side * halfWidth, j % 2 ? 0.2 : -0.22, -Math.floor(j / 2) * 0.85)
    })
    if (lite) bakeEngines()
  }
  // Lite: merge every engine's body, bands and nozzle into a few meshes, and draw all the flames as
  // two instanced meshes (outer + core), one instance per engine, posed from a marker each frame.
  let jets = null
  function bakeEngines() {
    if (baked) {
      rack.remove(baked)
      baked.traverse((o) => o.isMesh && o.geometry.dispose())
    }
    if (jets)
      for (const m of jets) {
        rack.remove(m)
        m.geometry.dispose()
        m.material.dispose()
        m.dispose()
      }
    jets = engines[0].flame.children.map((m) => {
      const im = new InstancedMesh(m.geometry, m.material, engines.length)
      im.frustumCulled = false // the instances move with the flicker; the base bounds would be wrong
      rack.add(im)
      return im
    })
    const holder = new Group()
    rack.add(holder)
    const markers = engines.map((e, i) => {
      const marker = new Object3D()
      marker.position.copy(e.group.position).add(e.flame.position)
      e.group.remove(e.flame)
      if (i > 0) disposeGroup(e.flame) // the instances use engine 0's flame geometry + materials
      rack.remove(e.group)
      holder.add(e.group)
      return marker
    })
    baked = bake(holder)
    rack.remove(holder)
    rack.add(baked)
    for (const e of engines) e.group.traverse((o) => o.isMesh && o.geometry.dispose()) // materials live on in `baked`
    engines = markers.map((m) => ({ flame: m, group: m })) // what's left of each engine: its flame marker
  }
  // look: an ENGINE catalog look ({ body, band, flame }) or null for the default; count: the mount's
  // engines, drawn as at least a pair (one per side) so every horse carries two.
  function setEngines(look, count = 4) {
    for (const e of engines) {
      rack.remove(e.group)
      disposeGroup(e.group)
    }
    const colors = { body: look?.body ?? HORSE.engine, band: look?.band ?? HORSE.engineBand, flame: look?.flame ?? HORSE.flame }
    engines = Array.from({ length: Math.max(2, Math.min(8, count)) }, (_, i) => {
      const engine = makeEngine(colors)
      engine.group.scale.setScalar(HORSE.engineScale)
      rack.add(engine.group)
      // Exhaust sparks out of the nozzle (in the engine's frame, so they follow it).
      if (!lite)
        createEmitter(engine.group, {
          boxes: [{ x: 0, y: 0, z: -0.75, sx: 0.06, sy: 0.06, sz: 0.06 }],
          count: 18, life: 0.4, velocity: [0, 0, -4.5], spread: [0.5, 0.5, 1.2],
          size: 0.2, color: colors.flame, intensity: 3, seed: 41 + i,
        })
      return engine
    })
    layoutEngines() // (lite: bakes, leaving a flame marker per engine)
    flames = engines.map((e) => e.flame)
  }
  setEngines(null, 2)

  // The avatar sits in the saddle; the equipped partner (companions.js) stands on the rump behind it.
  const rider = new Group()
  rider.position.set(0, HORSE.riderY - BODY_PIVOT[1], D.saddleZ + HORSE.riderZ)
  body.add(rider)
  const seat = new Group()
  seat.position.set(0, D.barrelY + D.barrelHeight / 2 + 0.02 - BODY_PIVOT[1], -D.barrelLength / 2 + 0.3)
  body.add(seat)

  const G = HORSE.gait
  const weights = [1, 0, 0]
  let phase = 0
  let pitch = 0
  let roll = 0
  let air = 0
  let lastSpeed = 0
  return {
    root,
    rider,
    seat,
    setLook,
    setEngines,
    // speed m/s, turn -1..1 (steering input), elapsed s, boost 0..~0.3 (race tap boost: longer,
    // fatter flames, a higher tail), grounded / vy (m/s) pose a jump.
    update(dt, speed, turn, elapsed, boost = 0, grounded = true, vy = 0) {
      if (!(dt > 0)) return
      const k = 1 - Math.exp(-HORSE.ease * dt)
      const accel = (speed - lastSpeed) / dt
      lastSpeed = speed

      // Gait weights (walk -> trot -> gallop) and one cycle phase whose rate follows the stride.
      const moving = smooth(G.idleSpeed, G.idleSpeed * 4, speed)
      const a = smooth(G.toTrot[0], G.toTrot[1], speed)
      const b = smooth(G.toGallop[0], G.toGallop[1], speed)
      weights[0] = 1 - a
      weights[1] = a * (1 - b)
      weights[2] = a * b
      let strideLength = 0
      for (let g = 0; g < 3; g++) strideLength += weights[g] * G[GAITS[g]].stride
      phase = (phase + clamp(speed / strideLength, G.minRate, G.maxRate) * moving * dt) % 1
      air += ((grounded ? 0 : 1) - air) * (1 - Math.exp(-12 * dt))

      for (const leg of legs) {
        let swing = 0
        let flex = 0
        for (let g = 0; g < 3; g++) {
          const w = weights[g]
          if (w < 1e-3) continue
          const gait = G[GAITS[g]]
          const p = (phase + leg.offset[g]) % 1
          const pos = stride(p, gait.duty)
          swing += w * gait.swing * pos
          flex += w * gait.flex * lift
        }
        const rest = leg.front ? G.frontRest : G.hindRest
        const jump = leg.front ? G.jumpFront : G.jumpHind
        const upper = (rest[0] + swing * moving) * (1 - air) + jump[0] * air
        const lower = (rest[1] + flex * moving * (leg.front ? 1 : G.hindFlex)) * (1 - air) + jump[1] * air
        leg.upper.pivot.rotation.x = upper
        leg.lower.pivot.rotation.x = lower
      }

      // Body: a bob per footfall (walk, trot) or a rocking canter (gallop), leaning into turns;
      // nose up while rising off a jump, down on the way down.
      const [ww, wt, wg] = weights
      const c = phase * TAU
      const bob = moving * (ww * G.walk.bob * Math.sin(c * 2) + wt * G.trot.bob * Math.abs(Math.cos(c * 2)) + wg * G.gallop.bob * Math.sin(c))
      const rock = moving * wg * G.gallop.rock * Math.sin(c + 1.2)
      const jumpPitch = air * clamp(-vy / 8, -1, 1) * 0.28
      pitch += (clamp(-accel * HORSE.pitchPerAccel, -0.1, 0.1) + jumpPitch - pitch) * k
      roll += (turn * HORSE.rollPerTurn * Math.min(1, speed / 6) - roll) * k
      body.position.y = BODY_PIVOT[1] + bob
      body.rotation.set(pitch + rock, 0, roll)

      // Neck: lowered and stretched at speed, nodding with the stride; idle, it looks about.
      const still = 1 - moving
      neck.pivot.rotation.x = moving * (wt * 0.12 + wg * 0.38 + ww * 0.07 * Math.sin(c * 2 + 0.5) + wt * 0.04 * Math.sin(c * 2) + wg * 0.14 * Math.sin(c + 2.4)) +
        still * 0.06 * Math.sin(elapsed * 0.5) - air * 0.2
      neck.pivot.rotation.y = still * 0.16 * Math.sin(elapsed * 0.23) - turn * 0.15
      // Tail: streams out behind at speed, swishes at rest.
      tail.pivot.rotation.x = Math.min(1.3, moving * (wt * 0.35 + wg * 0.85) + boost * 1.5 + air * 0.3)
      tail.pivot.rotation.z = (0.22 * still + 0.06) * Math.sin(elapsed * 1.7 + Math.sin(elapsed * 0.37) * 2) - turn * 0.2

      const thrust = (0.75 + Math.min(1, speed / 14) * 0.9) * (1 + boost * 4)
      for (let i = 0; i < flames.length; i++) {
        const f = flames[i]
        f.scale.z = thrust * (0.85 + 0.3 * Math.abs(Math.sin(elapsed * 31 + i * 1.7)))
        const w = (0.9 + 0.12 * Math.sin(elapsed * 23 + i)) * (1 + boost * 1.5)
        f.scale.x = f.scale.y = w
        if (jets) {
          f.updateMatrix()
          for (const m of jets) m.setMatrixAt(i, f.matrix)
        }
      }
      if (jets) for (const m of jets) m.instanceMatrix.needsUpdate = true
    },
  }
}
