import { BufferGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three'
import { HORSE } from './config.js'
import { createEmitter, removeEmitter } from './particles.js'
import { neon } from './propkit.js'
import { BODY_PIVOT, buildHorseParts, EAR_PIVOTS, HEAD_PIVOT, LEGS, NECK_PIVOT, TAIL_END, TAIL_MID, TAIL_PIVOT } from './horseModels.js'

// The player's horse (and every remote player's, remotePlayers.js; the shop stall's and the Horses
// window's pictures): a procedural horse (geometry and catalog looks: horseModels.js) with a
// saddle. Built facing +Z (the character's forward), hooves on y = 0 (the player's feet). Every
// moving part (body; neck > head > ears; three tail joints; three segments per leg) is ONE
// vertex-coloured mesh (plus one unlit mesh for any glowing bits). update() poses it procedurally:
// the gait (walk / trot / gallop, blended by speed) says where each hoof goes and the legs are
// solved (two-bone IK) to put it there, so hooves plant on the ground while the body bobs, pitches
// and crouches; the body and neck ride springs, so the weight rocks back on a push-off, sits down
// into a halt and settles after it; turns (measured off the horse's own heading) lean the body and
// bend the neck into them; standing, it breathes, flicks its ears and fidgets. The avatar rides on
// `horse.rider`, inside the body, so it bobs and leans with it, and reads `horse.motion` (the
// gait phase, push-off, halt, jump and turn this frame) to ride each of them (avatar/animator.js).

// Frees a group's own geometries and materials (a remote horse leaving).
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
const angleTo = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from))
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
// A damped spring { x, v } pulled toward target ([w rad/s, damping ratio]); sub-stepped on long frames.
function spring(s, target, [w, zeta], dt) {
  for (let n = Math.ceil(dt * 60), h = dt / n; n > 0; n--) {
    s.v += (w * w * (target - s.x) - 2 * zeta * w * s.v) * h
    s.x += s.v * h
  }
  return s.x
}
// 0..1..0 over a fidget of `dur` s, fading in and out over `fade` s.
const envelope = (t, dur, fade = 0.35) => smooth(0, fade, t) * smooth(0, fade, dur - t)

// Two-bone IK in the leg's plane (y up, z forward, horse frame): angles from straight down
// (+ = hoof back) of the upper and lower bones that put the fetlock at (ty, tz). Front knees bend
// forward, hind hocks back.
const ik = { upper: 0, lower: 0 }
function solve(front, hy, hz, ty, tz, l1, l2) {
  const dy = ty - hy
  const dz = tz - hz
  const d = clamp(Math.hypot(dy, dz), Math.abs(l1 - l2) + 1e-3, (l1 + l2) * 0.9995)
  const line = Math.atan2(-dz, -dy)
  const a = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1))
  const b = Math.acos(clamp((l2 * l2 + d * d - l1 * l1) / (2 * l2 * d), -1, 1))
  ik.upper = front ? line - a : line + a
  ik.lower = front ? line + b : line - b
}

const IDLE = ['look', 'look', 'paw', 'sniff', 'shake', 'rest', 'rest', 'swat']
const IDLE_TIME = { look: 2.6, paw: 2.2, sniff: 3.4, shake: 1.2, rest: 7, swat: 1.1, toss: 1.7 }

// lite (remote players' horses, the display horses, the window's pictures): no hoof dust, no shadows.
// onFootfall(leg, speed, gait): called as each hoof lands (leg: a LEGS entry, gait: 0 walk, 1 trot,
// 2 gallop, the dominant one), from the same phase that poses the legs, so hoofbeats match what is seen.
export function createHorse({ lite = false, onFootfall = null } = {}) {
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
  const head = pivot(neck.pivot, HEAD_PIVOT, NECK_PIVOT)
  const ears = EAR_PIVOTS.map((at, i) => ({ ...pivot(head.pivot, at, HEAD_PIVOT), side: i ? -1 : 1, x: 0, y: 0, tx: 0, ty: 0, next: 0 }))
  const tail = [pivot(body, TAIL_PIVOT, BODY_PIVOT)]
  tail.push(pivot(tail[0].pivot, TAIL_MID, TAIL_PIVOT))
  tail.push(pivot(tail[1].pivot, TAIL_END, TAIL_MID))
  // Legs hang from the body (so they pitch with it); each segment from the joint above.
  const legs = LEGS.map((spec) => {
    const upper = pivot(body, spec.hip, BODY_PIVOT)
    const lower = pivot(upper.pivot, spec.knee, spec.hip)
    const pastern = pivot(lower.pivot, spec.fetlock, spec.knee)
    return { ...spec, upper, lower, pastern, l1: spec.hip[1] - spec.knee[1], l2: spec.knee[1] - spec.fetlock[1], lastP: 0 }
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
    swap(head.mesh, parts.head)
    swap(torso.glow, parts.glow.body)
    swap(neck.glow, parts.glow.neck)
    swap(head.glow, parts.glow.head)
    ears.forEach((ear, i) => swap(ear.mesh, parts.ears[i]))
    tail.forEach((t, i) => {
      swap(t.mesh, parts.tail[i])
      swap(t.glow, parts.glow.tail[i])
    })
    legs.forEach((leg, i) => {
      swap(leg.upper.mesh, parts.legs[i].upper)
      swap(leg.lower.mesh, parts.legs[i].lower)
      swap(leg.pastern.mesh, parts.legs[i].pastern)
    })
    material.metalness = look.shine ?? 0
    material.roughness = look.shine ? 0.35 : 0.7
    // A bigger or smaller horse; the rider and partner keep their own size.
    size = look.size ?? 1
    frame.scale.setScalar(size)
    rider.scale.setScalar(1 / size)
    seat.scale.setScalar(1 / size)
  }

  // Dust kicked up behind the hooves (not on lite horses): faded in with speed, only on the ground;
  // a push-off and a sliding halt throw a burst of it.
  const dust = lite ? null : createEmitter(frame, {
    boxes: LEGS.map(({ hip: [x, , z] }) => ({ x, y: 0.12, z: z - 0.1, sx: 0.22, sy: 0.06, sz: 0.3 })),
    count: 64, life: 0.9, velocity: [0, 1.2, -5], spread: [1.2, 0.8, 1.5], gravity: 1.5,
    size: 0.8, grow: 2.6, color: HORSE.dust.color, opacity: HORSE.dust.opacity, solid: true, seed: 77,
  })

  // The avatar sits in the saddle; the equipped partner (companions.js) rides pillion on the
  // horse's back just behind the cantle.
  const rider = new Group()
  rider.position.set(0, HORSE.riderY - BODY_PIVOT[1], D.saddleZ + HORSE.riderZ)
  body.add(rider)
  const seat = new Group()
  seat.position.set(0, D.barrelY + D.barrelHeight / 2 - BODY_PIVOT[1], D.saddleZ + HORSE.seatZ)
  body.add(seat)
  setLook()

  const G = HORSE.gait
  const MO = HORSE.motion
  const weights = [1, 0, 0]
  const hip = new Vector3()
  const ahead = new Vector3()
  const pitchS = { x: 0, v: 0 }
  const dropS = { x: 0, v: 0 }
  const neckS = { x: 0, v: 0 }
  const headS = { x: 0, v: 0 }
  let phase = 0
  let roll = 0
  let air = 0
  let lastSpeed = 0
  let accel = 0 // m/s^2, smoothed
  let drive = 0 // 0..1 pushing off
  let brake = 0 // 0..1 pulling up
  let peak = 0 // recent top speed (a stop from a gallop ends in a toss)
  let lastYaw = null
  let yawRate = 0 // rad/s, smoothed
  let bendS = 0
  let tailBend = 0
  let breath = 0
  let exertion = 0 // 0..1, builds at the gallop and fades standing: heavier breathing
  let idle = null // the fidget playing: { kind, t, dur, side }
  let nextIdle = 1.5 + Math.random() * 2
  const rnd = (lo, hi) => lo + Math.random() * (hi - lo)
  // What the rider reacts to, rewritten each update(): phase 0..1 of the stride, gait shares
  // (0..1, x moving), drive / brake 0..1, air 0..1, bend -1..1 (the
  // sign of the body's lean into a turn, scaled by speed).
  const motion = { phase: 0, moving: 0, trot: 0, gallop: 0, drive: 0, brake: 0, air: 0, bend: 0 }
  return {
    root,
    rider,
    seat,
    motion,
    setLook,
    // Frees this horse's geometry and materials (a display horse or picture done with).
    dispose() {
      if (dust) removeEmitter(dust)
      root.traverse((o) => o.isMesh && o.geometry.dispose())
      material.dispose()
      glowMaterial.dispose()
    },
    // speed m/s, turn -1..1 (steering that doesn't turn the horse itself: the race's lane changes;
    // its own turning is measured off its heading), elapsed s, boost 0..~0.3 (race tap boost: a
    // higher tail), grounded / vy (m/s) pose a jump.
    update(dt, speed, turn, elapsed, boost = 0, grounded = true, vy = 0) {
      if (!(dt > 0)) return
      const k = 1 - Math.exp(-HORSE.ease * dt)
      accel += ((speed - lastSpeed) / dt - accel) * (1 - Math.exp(-8 * dt))
      lastSpeed = speed

      // How fast the horse itself is turning (+ = to its right); a jump of the heading (a respawn,
      // a teleport) is not a turn.
      root.getWorldDirection(ahead)
      const yaw = Math.atan2(ahead.x, ahead.z)
      const dYaw = lastYaw === null ? 0 : angleTo(lastYaw, yaw)
      lastYaw = yaw
      yawRate += ((Math.abs(dYaw) > 0.5 ? 0 : dYaw / dt) - yawRate) * (1 - Math.exp(-10 * dt))
      const bend = clamp(turn - yawRate / MO.turnRef, -1, 1)
      bendS += (bend - bendS) * (1 - Math.exp(-7 * dt))

      // Push-off and halt, from the acceleration (only on the ground).
      const L = MO.launch
      const H = MO.halt
      const onGround = grounded ? 1 : 0
      drive += (clamp(accel / L.accel, 0, 1) * (1 - smooth(L.below[0], L.below[1], speed)) * onGround - drive) * (1 - Math.exp(-10 * dt))
      brake += (clamp(-accel / H.accel, 0, 1) * onGround - brake) * (1 - Math.exp(-10 * dt))
      peak = Math.max(peak * Math.exp(-0.4 * dt), speed)
      exertion = clamp(exertion + (speed > 9 ? dt / 12 : -dt / 14), 0, 1)

      // Turning on the spot still steps the hooves round.
      const gaitSpeed = Math.max(speed, Math.min(1.6, Math.abs(yawRate) * 0.6))
      const stepScale = 0.35 + 0.65 * clamp(speed / Math.max(gaitSpeed, 1e-3), 0, 1)
      // Gait weights (walk -> trot -> gallop) and one cycle phase whose rate follows the stride.
      const moving = smooth(G.idleSpeed, G.idleSpeed * 4, gaitSpeed)
      const still = 1 - moving
      const a = smooth(G.toTrot[0], G.toTrot[1], gaitSpeed)
      const b = smooth(G.toGallop[0], G.toGallop[1], gaitSpeed)
      weights[0] = 1 - a
      weights[1] = a * (1 - b)
      weights[2] = a * b
      let strideLength = 0
      for (let g = 0; g < 3; g++) strideLength += weights[g] * G[GAITS[g]].stride
      phase = (phase + clamp(gaitSpeed / (strideLength * size), G.minRate, G.maxRate) * moving * dt) % 1
      air += ((grounded ? 0 : 1) - air) * (1 - Math.exp(-12 * dt))
      const lead = weights[2] >= weights[1] && weights[2] >= weights[0] ? 2 : weights[1] >= weights[0] ? 1 : 0
      const [ww, wt, wg] = weights
      const c = phase * TAU

      // Fidgets: one at a time while standing; pulling up from a gallop tosses the head and shakes.
      if (peak > MO.settleFrom && speed < 0.8 && grounded) {
        idle = { kind: 'toss', t: 0, dur: IDLE_TIME.toss, side: Math.random() < 0.5 ? 1 : -1 }
        peak = 0
      }
      if (idle) {
        idle.t += dt
        if (idle.t >= idle.dur || (moving > 0.6 && idle.kind !== 'toss')) {
          idle = null
          nextIdle = rnd(...MO.idleEvery)
        }
      } else if (still > 0.95 && grounded && (nextIdle -= dt) <= 0) {
        const kind = IDLE[Math.floor(Math.random() * IDLE.length)]
        idle = { kind, t: 0, dur: IDLE_TIME[kind] * rnd(0.8, 1.25), side: Math.random() < 0.5 ? 1 : -1 }
      }
      const fid = (kind) => (idle?.kind === kind ? envelope(idle.t, idle.dur) : 0)
      const look = fid('look')
      const sniff = fid('sniff') * still
      const rest = fid('rest') * still
      const shakeEnv = fid('shake') + (idle?.kind === 'toss' ? smooth(0.35, 0.5, idle.t) * envelope(idle.t, idle.dur, 0.3) : 0)
      const toss = idle?.kind === 'toss' ? Math.sin(Math.PI * clamp(idle.t / 0.55, 0, 1)) : 0
      const shake = shakeEnv * Math.sin((idle?.t ?? 0) * 21) * (idle ? Math.exp(-idle.t * 0.9) * 1.6 : 0)
      const side = idle?.side ?? 1

      // Body: a bob per footfall (walk, trot) or a rocking canter (gallop), weight on springs: back
      // on its haunches pushing off and pulling up, rocking forward as it settles; nose up while
      // rising off a jump, down on the way down; leaning into turns.
      const bob = moving * stepScale * (ww * G.walk.bob * Math.sin(c * 2) + wt * G.trot.bob * Math.abs(Math.cos(c * 2)) + wg * G.gallop.bob * Math.sin(c))
      const rock = moving * wg * G.gallop.rock * Math.sin(c + 1.2)
      const jumpPitch = air * clamp(-vy / 8, -1, 1) * 0.28
      const pitch = spring(pitchS, clamp(-accel * HORSE.pitchPerAccel, -0.06, 0.06) + L.pitch * drive + H.pitch * brake + jumpPitch, MO.spring.body, dt)
      const drop = spring(dropS, L.drop * drive + H.drop * brake + rest * 0.025, MO.spring.body, dt)
      roll += (bendS * MO.rollPerTurn * Math.min(1, speed / 6) - side * rest * 0.035 - roll) * k
      breath += dt * TAU * (0.28 + 0.75 * exertion)
      const chest = Math.sin(breath) * (0.006 + 0.022 * exertion) * (0.4 + 0.6 * still)
      torso.mesh.scale.set(1 + chest * 0.7, 1 + chest, 1)
      torso.glow.scale.copy(torso.mesh.scale)
      body.position.y = BODY_PIVOT[1] - G.stand + bob - drop
      body.rotation.set(pitch + rock, -bendS * 0.06 * moving, roll)

      // Legs: where each hoof should be (the gait's stride, braced or gathered by a halt / push-off,
      // a paw or a rested hind leg), then the joints that reach it.
      const reachScale = moving * stepScale * (1 - 0.55 * brake)
      for (const leg of legs) {
        // A hoof lands when its place in the leading gait's cycle wraps back to 0 (stance starts).
        if (onFootfall) {
          const p = (phase + leg.offset[lead]) % 1
          if (leg.lastP > 0.5 && p < 0.5 && moving > 0.3 && air < 0.5) onFootfall(leg, gaitSpeed, lead)
          leg.lastP = p
        }
        let dz = 0
        let up = 0
        let flip = 0
        for (let g = 0; g < 3; g++) {
          const w = weights[g]
          if (w < 1e-3) continue
          const gait = G[GAITS[g]]
          const pos = stride((phase + leg.offset[g]) % 1, gait.duty)
          dz -= w * pos * G.reach * gait.duty * gait.stride * 0.5
          up += w * gait.lift * lift
          flip += w * gait.flip * lift
        }
        dz *= reachScale
        up *= moving * (1 - 0.6 * brake) * (leg.front ? 1 : G.hindLift)
        flip *= moving * (leg.front ? 1 : G.hindLift)
        if (leg.front) dz += H.brace * brake + 0.05 * drive
        else dz += H.hindTuck * brake + L.hindTuck * drive
        if (leg.front && idle?.kind === 'paw' && leg.side === side) {
          // Paw the ground: lift and reach, then scrape back, twice or three times.
          const u = (idle.t % 0.62) / 0.62
          const e = envelope(idle.t, idle.dur, 0.2) * still
          dz += e * (u < 0.5 ? 0.24 * ease(u / 0.5) : 0.24 * (1 - (u - 0.5) / 0.5))
          up += e * (u < 0.5 ? 0.2 * Math.sin(Math.PI * (u / 0.5)) : 0.01)
          flip += e * (u < 0.5 ? 0.9 * Math.sin(Math.PI * (u / 0.5)) : -0.15)
        }
        if (!leg.front && leg.side === side) {
          // Rest a hind leg: the hip drops, the hoof tips onto its toe.
          dz += rest * 0.1
          up += rest * 0.05
          flip += rest * 0.55
        }
        hip.set(leg.hip[0] - BODY_PIVOT[0], leg.hip[1] - BODY_PIVOT[1], leg.hip[2] - BODY_PIVOT[2]).applyEuler(body.rotation).add(body.position)
        solve(leg.front, hip.y, hip.z, leg.fetlock[1] + up, leg.hip[2] + (leg.front ? G.restZ[0] : G.restZ[1]) + dz, leg.l1, leg.l2)
        const tilt = body.rotation.x
        const jump = leg.front ? G.jumpFront : G.jumpHind
        const upper = (ik.upper - tilt) * (1 - air) + jump[0] * air
        const lower = (ik.lower - ik.upper) * (1 - air) + jump[1] * air
        const pastern = (flip - ik.lower) * (1 - air) + jump[2] * air
        leg.upper.pivot.rotation.x = upper
        leg.lower.pivot.rotation.x = lower
        leg.pastern.pivot.rotation.x = pastern
      }

      // Neck and head: lowered and stretched at speed, nodding with the stride; stretched out
      // pushing off, thrown up pulling up (then tossed and shaken), bent into a turn; standing, it
      // looks about, sniffs the ground and shakes off flies.
      const nod = moving * (ww * 0.07 * Math.sin(c * 2 + 0.5) + wt * 0.04 * Math.sin(c * 2) + wg * 0.14 * Math.sin(c + 2.4))
      const neckPitch = spring(neckS, moving * (wt * 0.12 + wg * 0.34) + L.neck * drive + H.neck * brake - toss * 0.5 + sniff * 0.75 - air * 0.2, MO.spring.neck, dt)
      neck.pivot.rotation.x = neckPitch + nod + still * 0.05 * Math.sin(elapsed * 0.5)
      neck.pivot.rotation.y = -bendS * (0.28 + 0.12 * still) + still * 0.12 * Math.sin(elapsed * 0.23) + look * side * 0.45 + shake * 0.12
      neck.pivot.rotation.z = shake * 0.05
      const headPitch = spring(headS, -wg * moving * 0.16 + L.head * drive + H.head * brake - toss * 0.35 + sniff * 0.45, MO.spring.neck, dt)
      head.pivot.rotation.x = headPitch - nod * 0.4 + sniff * 0.06 * Math.sin(elapsed * 9)
      head.pivot.rotation.y = -bendS * 0.18 + look * side * 0.3 + shake * 0.22
      head.pivot.rotation.z = bendS * 0.08 + shake * 0.45 + look * side * -0.08

      // Ears: pricked forward on the move (pinned back on a hard push-off, cocked at a halt);
      // standing, each flicks about on its own.
      const motionEar = 0.18 - drive * 0.7 + brake * 0.15
      for (const ear of ears) {
        if ((ear.next -= dt) <= 0) {
          const r = Math.random()
          ear.tx = r < 0.45 ? rnd(0.1, 0.3) : r < 0.8 ? rnd(-0.1, 0.1) : rnd(-0.5, -0.25)
          ear.ty = r < 0.45 ? rnd(-0.1, 0.1) : ear.side * rnd(0.3, 0.8)
          ear.next = rnd(0.6, 3.5)
        }
        const tx = ear.tx * still + motionEar * moving + look * 0.25
        const ty = ear.ty * still + look * side * 0.4
        const kk = 1 - Math.exp(-14 * dt)
        ear.x += (tx - ear.x) * kk
        ear.y += (ty - ear.y) * kk
        ear.pivot.rotation.set(ear.x - shakeEnv * 0.2, ear.y, ear.side * shake * 0.3)
      }

      // Tail: streams out behind at speed (fluttering, the tip after the dock), lifts on a push-off,
      // swishes at rest (a hard swat now and then), trails a turn.
      const raise = Math.min(1.3, moving * (wt * 0.35 + wg * 0.85) + boost * 1.5 + air * 0.3 + drive * 0.35)
      const swat = fid('swat')
      const swish = (0.2 * still + 0.05 + swat * 0.5) * still + 0.05 * moving
      tailBend += (bendS - tailBend) * (1 - Math.exp(-4 * dt))
      const rate = 1.7 + swat * 5
      tail.forEach((t, i) => {
        const share = [0.55, 0.28, 0.2][i]
        t.pivot.rotation.x = raise * share + moving * wg * 0.07 * Math.sin(elapsed * 13 - i * 1.1) - brake * 0.08 * (i === 0)
        t.pivot.rotation.z = swish * (i ? 0.6 : 1) * Math.sin(elapsed * rate + Math.sin(elapsed * 0.37) * 2 - i * 0.8) - tailBend * (0.2 - i * 0.04)
      })

      motion.phase = phase
      motion.moving = moving
      motion.trot = wt * moving
      motion.gallop = wg * moving
      motion.drive = drive
      motion.brake = brake
      motion.air = air
      motion.bend = bendS * Math.min(1, speed / 6)

      if (dust) {
        const kick = Math.max(smooth(HORSE.dust.from, HORSE.dust.full, speed), drive * 0.8, brake * Math.min(1, speed / 3)) * (1 - air)
        dust.visible = kick > 0.01
        dust.material.uniforms.uOpacity.value = HORSE.dust.opacity * kick
        // Streams back faster at speed; a sliding halt sprays it forward.
        dust.material.uniforms.uVelocity.value[2] = brake > 0.3 ? 2.5 + speed * 0.2 : -(3 + Math.min(speed, 40) * 0.45)
      }
    },
  }
}
