import { AdditiveBlending, BufferGeometry, ConeGeometry, CylinderGeometry, DoubleSide, Group, InstancedMesh, Mesh, MeshStandardMaterial, Object3D, SphereGeometry } from 'three'
import { HORSE } from './config.js'
import { createEmitter, removeEmitter } from './particles.js'
import { neon } from './propkit.js'
import { bake } from './bake.js'
import { BODY_PIVOT, buildHorseParts, LEGS, NECK_PIVOT, TAIL_PIVOT } from './horseModels.js'

// The player's horse (and every remote player's, remotePlayers.js; the shop stall's and the Horses
// window's pictures): a blocky procedural horse (geometry and catalog looks: horseModels.js) with a
// saddle, and rocket boosters on a rack behind it (the equipped engine's colours x the mount's
// engine count), each with a flickering flame. Built facing +Z (the character's forward), hooves on
// y = 0 (the player's feet). Every moving part (body, neck + head, tail, two segments per leg) is
// ONE vertex-coloured mesh (plus one unlit mesh for any glowing bits), so a horse costs ~11 draw
// calls plus its engines. The gait (walk / trot / gallop, blended by speed) is posed procedurally in
// update(). The avatar rides on `horse.rider`, inside the body, so it bobs and leans with it.

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

// lite (remote players' horses, the stall's display horses, the window's pictures): no exhaust
// sparks, no shadows, and the engines' static parts baked to one mesh per material (only the flames
// stay apart: they flicker), so a horse with 8 engines costs a handful of draw calls instead of
// ~60. engines = false: no boosters at all (display horses).
export function createHorse({ lite = false, engines: withEngines = true } = {}) {
  const D = HORSE.dims
  const root = new Group() // follows the player; `frame` inside it carries the look's size
  const frame = new Group()
  root.add(frame)
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0 })
  const glowMaterial = neon('#ffffff', HORSE.glow, { vertexColors: true })
  const body = new Group() // bobs and tilts
  body.position.set(...BODY_PIVOT)
  frame.add(body)
  const part = (holder) => {
    const m = new Mesh(new BufferGeometry(), material)
    m.castShadow = m.receiveShadow = !lite
    const glowing = new Mesh(new BufferGeometry(), glowMaterial)
    glowing.visible = false
    holder.add(m, glowing)
    return { mesh: m, glow: glowing }
  }
  const pivot = (parent, [x, y, z], [ox, oy, oz]) => {
    const g = new Group()
    g.position.set(x - ox, y - oy, z - oz)
    parent.add(g)
    return { pivot: g, ...part(g) }
  }
  const torso = part(body)
  const neck = pivot(body, NECK_PIVOT, BODY_PIVOT)
  const tail = pivot(body, TAIL_PIVOT, BODY_PIVOT)
  // Legs hang from the body (so they pitch with it); the lower segment from the upper's knee.
  const legs = LEGS.map((spec) => {
    const upper = pivot(body, spec.hip, BODY_PIVOT)
    const lower = pivot(upper.pivot, spec.knee, spec.hip)
    return { ...spec, upper, lower }
  })

  const swap = (m, geo) => {
    m.geometry?.dispose()
    m.geometry = geo ?? new BufferGeometry()
    m.visible = !!geo
  }
  // look: a catalog horse's look (horseModels.js horseLook) or {} for the default.
  let size = 1
  function setLook(look = {}) {
    const parts = buildHorseParts(look)
    swap(torso.mesh, parts.body)
    swap(neck.mesh, parts.neck)
    swap(tail.mesh, parts.tail)
    swap(torso.glow, parts.glow.body)
    swap(neck.glow, parts.glow.neck)
    swap(tail.glow, parts.glow.tail)
    legs.forEach((leg, i) => {
      swap(leg.upper.mesh, parts.legs[i].upper)
      swap(leg.lower.mesh, parts.legs[i].lower)
    })
    material.metalness = look.shine ?? 0
    material.roughness = look.shine ? 0.35 : 0.7
    // A bigger or smaller horse; the rider and partner keep their own size.
    size = look.size ?? 1
    frame.scale.setScalar(size)
    rider.scale.setScalar(1 / size)
    seat.scale.setScalar(1 / size)
  }

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
  if (withEngines) setEngines(null, 2)

  // The avatar sits in the saddle; the equipped partner (companions.js) stands on the rump behind it.
  const rider = new Group()
  rider.position.set(0, HORSE.riderY - BODY_PIVOT[1], D.saddleZ + HORSE.riderZ)
  body.add(rider)
  const seat = new Group()
  seat.position.set(0, D.barrelY + D.barrelHeight / 2 + 0.02 - BODY_PIVOT[1], -D.barrelLength / 2 + 0.3)
  body.add(seat)
  setLook()

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
    // Frees this horse's geometry, materials and engines (a display horse or picture done with).
    dispose() {
      for (const e of engines) disposeGroup(e.group)
      if (baked) disposeGroup(baked)
      for (const m of jets ?? []) {
        m.material.dispose()
        m.dispose()
      }
      root.traverse((o) => o.isMesh && o.geometry.dispose())
      material.dispose()
      glowMaterial.dispose()
    },
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
      phase = (phase + clamp(speed / (strideLength * size), G.minRate, G.maxRate) * moving * dt) % 1
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
