// Procedural locomotion animator, ported from Clean Leaves for Loot (itself from
// +1 Cut Grass Adventure's PlayerAnimator + LocomotionCycle). States idle / run /
// airborne / landing are blended through pose buffers; the walk and run are ONE
// cycle at two depths, its phase advancing with distance travelled so the feet
// stay planted at any speed. Writes only to bones and the avatar root's
// rotation / position.y (the player group owns world placement). In the saddle (`ride`) the rider
// follows the horse: springs on the saddle's own acceleration plus the horse's gait, push-off,
// halt, jump and turns (horse.js `motion`, passed as input.mount). Boxity emotes (playEmote) play
// on top of whatever pose the state wrote.
import { Euler, Quaternion, Vector3 } from 'three'
import { ANIM, EMOTE } from '../config.js'
import { BONE_INDEX, PlayerRig, PoseBuffer } from './rig.js'

const TAU = Math.PI * 2
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)
const lerp = (a, b, t) => a + (b - a) * t
const ease = (t) => t * t * (3 - 2 * t)
const smoothstep = (e0, e1, v) => ease(clamp((v - e0) / (e1 - e0 || 1), 0, 1))
const kneeCurve = (phase) => {
  const raw = Math.sin(phase - Math.PI / 2.6)
  return raw > 0 ? raw * raw : 0
}

const L = ANIM.locomotion
const NO_MOUNT = { phase: 0, moving: 0, trot: 0, gallop: 0, drive: 0, brake: 0, air: 0, bend: 0 }
const tmpP = new Vector3()
const tmpV = new Vector3()
const tmpA = new Vector3()
const tmpQ = new Quaternion()
const tmpE = new Euler()
const DEG = Math.PI / 180
const LEG = /^Leg[LR]\d/

// An emote track at time t: [[s, xDeg, yDeg, zDeg], ...] eased (smoothstep) between keys, held
// outside them. Writes radians into tmpE.
function sampleTrack(keys, t) {
  let i = 0
  while (i < keys.length - 2 && t >= keys[i + 1][0]) i++
  const a = keys[i]
  const b = keys[Math.min(i + 1, keys.length - 1)]
  const s = b === a || b[0] <= a[0] ? (t >= b[0] ? 1 : 0) : ease(clamp((t - a[0]) / (b[0] - a[0]), 0, 1))
  tmpE.set(lerp(a[1], b[1], s) * DEG, lerp(a[2], b[2], s) * DEG, lerp(a[3], b[3], s) * DEG, 'XYZ')
}

export function makeAnimator(root) {
  if (!root) return null
  return new PlayerAnimator(root)
}

export function disposeAnimator(animator) {
  animator?.dispose()
}

class PlayerAnimator {
  constructor(root) {
    this.root = root
    this.rig = new PlayerRig(root)
    this.target = new PoseBuffer()
    this.from = new PoseBuffer()
    this.output = new PoseBuffer()
    this.scratch = new PoseBuffer()
    this.state = 'idle'
    this.stateTime = 0
    this.blendTime = 0
    this.blendDuration = 0
    this.phase = 0
    this.idleTime = 0
    this.airTime = 0
    this.bank = 0
    // Riding: the saddle's last world position / velocity, its smoothed acceleration (saddle frame),
    // the side / up / fore-aft springs, the last speed and the standing fidget.
    this.seatLast = new Vector3()
    this.seatVel = new Vector3()
    this.seatAcc = new Vector3()
    this.seatFresh = true
    this.springs = [0, 1, 2].map(() => ({ x: 0, v: 0 }))
    this.lastSpeed = 0
    this.look = 0
    this.lookTo = 0
    this.fidget = null // { kind: 'pat', t, dur }
    this.nextFidget = 3
    // Emotes: every named rig node's bind rotation (the animator is made in the bind pose; the clip
    // may drive nodes the pose buffer doesn't, e.g. ArmR_Offset) and the one playing.
    this.bind = {}
    for (const [name, node] of Object.entries(root.nodes ?? {})) if (node?.quaternion) this.bind[name] = { node, rest: node.quaternion.clone(), posed: name in BONE_INDEX }
    this.emote = null // { clip, t, w, stopping }
  }

  // A Boxity emote clip { len, loop, tracks } (bloxity.js emoteClip), played over the current pose.
  playEmote(clip) {
    if (clip?.tracks) this.emote = { clip, t: 0, w: this.emote?.w ?? 0, stopping: false }
  }

  stopEmote() {
    if (this.emote) this.emote.stopping = true
  }

  // An emote is playing and not on its way out.
  get emoting() {
    return !!this.emote && !this.emote.stopping
  }

  dispose() {
    for (const b of Object.values(this.bind)) b.node.quaternion.copy(b.rest)
    this.rig.resetToBindPose()
    this.root.rotation.set(0, 0, 0)
    this.root.position.y = 0
  }

  // input: { grounded, speed, verticalVelocity, turn (-1..1), riding (seated on the horse),
  //   mount (the horse's `motion`, while riding) }
  update(dt, input) {
    if (!(dt > 0)) return
    this.stateTime += dt
    this.resolveState(dt, input)
    this.writePose(dt, input)
    this.blend(dt)
    this.rig.applyPose(this.output)
    this.applyEmote(dt, input.riding)
    this.applyVisual(dt, input)
  }

  // Each track is degree deltas over its bone's bind rotation (euler XYZ, right-multiplied), slerped
  // in over the pose by the emote's weight. Unknown bones are skipped; in the saddle the legs stay
  // round the barrel instead of dancing through the horse.
  applyEmote(dt, riding) {
    const e = this.emote
    if (!e) return
    const { len, loop, tracks } = e.clip
    e.t += dt
    if (!loop && e.t >= len) e.stopping = true
    e.w = clamp(e.w + (e.stopping ? -dt / EMOTE.blendOut : dt / EMOTE.blendIn), 0, 1)
    const time = loop ? e.t % len : Math.min(e.t, len)
    const w = ease(e.w)
    for (const name in tracks) {
      const b = this.bind[name]
      const keys = tracks[name]
      if (!b || !Array.isArray(keys) || !keys.length || (riding && LEG.test(name))) continue
      if (!b.posed) b.node.quaternion.copy(b.rest) // nothing else writes it each frame
      sampleTrack(keys, time)
      tmpQ.setFromEuler(tmpE).premultiply(b.rest)
      b.node.quaternion.slerp(tmpQ, w)
    }
    if (e.stopping && e.w <= 0) {
      this.emote = null
      for (const name in tracks) if (this.bind[name] && !this.bind[name].posed) this.bind[name].node.quaternion.copy(this.bind[name].rest)
    }
  }

  resolveState(dt, input) {
    // In the saddle the horse does the moving (and the jumping): the rider only sits.
    if (input.riding) return this.setState('ride', ANIM.transitions.toRide)
    if (!input.grounded) {
      // Ignore the few frames of a step down a ledge; only a real drop is airborne.
      this.airTime += dt
      if (this.airTime > ANIM.airborneDelay) this.setState('airborne', ANIM.transitions.toAirborne)
      return
    }
    this.airTime = 0
    if (this.state === 'airborne') {
      this.setState('landing', ANIM.transitions.toLanding)
      return
    }
    if (this.state === 'landing' && this.stateTime < ANIM.landing.duration) return
    this.setState(input.speed < L.idleSpeed ? 'idle' : 'run', ANIM.transitions.toLocomotion)
  }

  setState(next, duration) {
    if (next === this.state) return
    this.from.copyFrom(this.output)
    this.state = next
    this.stateTime = 0
    this.blendTime = 0
    this.blendDuration = duration
  }

  writePose(dt, input) {
    const t = this.target
    switch (this.state) {
      case 'idle': {
        // Ease the stride back to a neutral standing phase.
        const goal = this.phase > Math.PI ? TAU : 0
        this.phase += (goal - this.phase) * (1 - Math.exp(-8 * dt))
        if (this.phase >= TAU - 1e-4) this.phase = 0
        this.idleTime += dt
        const breath = Math.sin(this.idleTime * ANIM.idle.breathFrequency * TAU)
        t.applyDefinition(ANIM.idle.basePose)
        t.add('Spine1', breath * ANIM.idle.breathAmount)
        t.add('Neck1', -breath * ANIM.idle.breathAmount * 0.6)
        t.bobY = breath * ANIM.idle.breathBob
        break
      }
      case 'run': {
        const frequency = clamp(input.speed / L.strideDistance, L.minFrequency, L.maxFrequency)
        this.phase = (this.phase + frequency * TAU * dt) % TAU
        this.writeLocomotion(t, input.speed)
        break
      }
      case 'ride':
        this.writeRide(t, dt, input)
        break
      case 'airborne': {
        const rising = clamp(input.verticalVelocity / ANIM.airborne.velocityReference, -1, 1)
        t.applyDefinition(ANIM.airborne.fall)
        this.scratch.applyDefinition(ANIM.airborne.rise)
        t.lerpBetween(t, this.scratch, clamp(0.5 + rising * 0.5, 0, 1))
        t.bobY = 0
        break
      }
      case 'landing': {
        const depth = 1 - ease(clamp(this.stateTime / ANIM.landing.duration, 0, 1))
        t.applyDefinition(ANIM.landing.pose, depth)
        t.bobY = ANIM.landing.bobY * depth
        break
      }
    }
  }

  // The saddle's acceleration in its own frame (side, up, fore-aft) pushes the weight about on three
  // springs. Fore-aft comes from the speed (a racing horse stays put while the world scrolls).
  rideSprings(dt, speed) {
    const R = ANIM.ride
    const seat = this.root.parent
    if (!seat) return
    seat.getWorldPosition(tmpP)
    seat.getWorldQuaternion(tmpQ)
    // A respawn / teleport / first frame is not a motion.
    if (this.seatFresh || tmpP.distanceToSquared(this.seatLast) > 9) {
      this.seatFresh = false
      this.seatLast.copy(tmpP)
      this.seatVel.set(0, 0, 0)
      this.seatAcc.set(0, 0, 0)
      this.lastSpeed = speed
      for (const s of this.springs) s.x = s.v = 0
    }
    tmpV.copy(tmpP).sub(this.seatLast).divideScalar(dt)
    this.seatLast.copy(tmpP)
    tmpA.copy(tmpV).sub(this.seatVel).divideScalar(dt).applyQuaternion(tmpQ.invert())
    this.seatVel.copy(tmpV)
    tmpA.z = (speed - this.lastSpeed) / dt
    this.lastSpeed = speed
    tmpA.clampLength(0, R.maxAccel)
    this.seatAcc.lerp(tmpA, 1 - Math.exp(-R.accelSmooth * dt))
    // x'' = -a - w^2 x - 2 zeta w x', sub-stepped.
    const steps = Math.ceil(dt * 240)
    const h = dt / steps
    for (let i = 0; i < 3; i++) {
      const [w, zeta] = R.spring[i]
      const s = this.springs[i]
      const drive = -this.seatAcc.getComponent(i)
      for (let k = 0; k < steps; k++) {
        s.v += (drive - w * w * s.x - 2 * zeta * w * s.v) * h
        s.x += s.v * h
      }
      s.x = clamp(s.x, -R.maxSway, R.maxSway)
    }
  }

  writeRide(out, dt, input) {
    const R = ANIM.ride
    const m = input.mount ?? NO_MOUNT
    this.idleTime += dt
    this.rideSprings(dt, input.speed)
    const side = this.springs[0].x
    const up = this.springs[1].x
    const fore = this.springs[2].x
    const still = 1 - m.moving
    const c = m.phase * TAU
    const G = R.gallop
    const J = R.jump
    const P = R.pull
    const gallop = m.gallop * (1 - m.air)
    const brake = m.brake * (1 - m.air)

    // Standing: look round, now and then lean down and pat the horse's neck.
    if (this.fidget) {
      this.fidget.t += dt
      if (this.fidget.t >= this.fidget.dur || m.moving > 0.4) this.fidget = null
    }
    if ((this.nextFidget -= dt) <= 0) {
      this.nextFidget = R.fidgetEvery[0] + Math.random() * (R.fidgetEvery[1] - R.fidgetEvery[0])
      if (still > 0.9 && !this.fidget && Math.random() < 0.35) {
        this.fidget = { kind: 'pat', t: 0, dur: 1.8 }
        this.lookTo = R.look * 0.2
      } else this.lookTo = still > 0.9 && Math.random() < 0.7 ? (Math.random() * 2 - 1) * R.look : 0
    }
    if (m.moving > 0.4) this.lookTo = 0
    this.look += (this.lookTo - this.look) * (1 - Math.exp(-3 * dt))
    const pat = this.fidget ? smoothstep(0, 0.35, this.fidget.t) * smoothstep(0, 0.35, this.fidget.dur - this.fidget.t) : 0

    const breath = Math.sin(this.idleTime * ANIM.idle.breathFrequency * TAU)
    const lean = clamp(input.speed / R.leanSpeed, 0, 1) * R.lean
    const sway = clamp(fore * R.pitch - Math.min(up, 0) * R.slump, -R.maxPitch, R.maxPitch) // the springs' share of the pitch
    // Hands pump forward with the gallop's reach, the head nods against it.
    const pump = Math.sin(c + 0.6) * gallop
    const kick = m.drive * (1 - m.air) * (0.5 + 0.5 * Math.sin(this.idleTime * R.kick.rate * TAU))
    const pitch = lean + sway + gallop * G.lean + m.air * J.lean - brake * P.lean + pat * 0.35 + breath * R.breath

    out.applyDefinition(R.pose)
    out.add('Spine1', pitch * 0.65, this.look * 0.25 - m.bend * R.turn.look * 0.3, side * R.roll + m.bend * R.turn.lean)
    out.add('Spine2', pitch * 0.35, this.look * 0.15, side * R.roll * 0.4)
    // The head stays up, looking where the horse goes.
    out.add('Neck1', -pitch * 0.7 - pump * G.nod + pat * 0.2, this.look * 0.6 - m.bend * R.turn.look, -side * R.roll * 0.5)
    for (const s of [1, -1]) {
      const L1 = s > 0 ? 'LegL1' : 'LegR1'
      const L2 = s > 0 ? 'LegL2' : 'LegR2'
      const A1 = s > 0 ? 'ArmL1' : 'ArmR1'
      const A2 = s > 0 ? 'ArmL2' : 'ArmR2'
      // Rising out of the saddle bends the knees under the rider; the heels kick on a push-off and
      // brace forward pulling up; the shins swing with the weight.
      const crouch = gallop * G.knee + m.air * J.knee
      out.add(L1, -crouch * 0.5 - brake * P.brace * 0.4)
      const knee = crouch + kick * R.kick.amount - brake * P.brace - fore * R.swing + up * R.dangle + s * side * R.swing * 0.5
      const rest = R.pose[L2].x
      out.add(L2, clamp(rest + knee, R.knee[0], R.knee[1]) - rest) // never past straight
      // Reins: back against the pitch (the hands stay by the neck), pumping at the gallop, given
      // forward over a jump, pulled to the chest on a halt; the right hand pats the neck standing.
      const patting = s < 0 ? pat : 0
      out.add(A1, -sway * 0.5 - pump * G.pump - m.air * J.reach + brake * P.arm + patting * 0.45, 0, s * patting * -0.25)
      out.add(A2, pump * G.pump * 0.6 - m.air * J.reach * 0.6 + brake * P.elbow - patting * (0.6 - 0.25 * Math.sin(this.idleTime * 11)))
    }
    // The seat: on the up spring, posting at the trot, a two-point seat at the gallop, standing in
    // the stirrups over a jump.
    out.bobY = clamp(up, -R.sink, R.lift) + m.trot * (1 - m.air) * R.post * Math.max(0, Math.sin(c * 2)) + gallop * G.lift * (0.6 + 0.4 * Math.sin(c + 0.6)) + m.air * J.lift
  }

  // One cycle at two depths (walk -> run), derived from actual speed.
  writeLocomotion(out, speed) {
    const run = smoothstep(L.walkSpeed, L.runSpeed, speed)
    const sprint = smoothstep(L.runSpeed, L.sprintSpeed, speed) * 0.4
    const depth = (d) => lerp(lerp(d.walk, d.run, run), d.sprint, sprint)
    const phase = this.phase
    const swing = Math.sin(phase)
    const opposite = -swing
    const hip = depth(L.hipSwing)
    const knee = depth(L.kneeBend)
    const arm = depth(L.armSwing)
    const elbow = depth(L.elbowBend)
    const twist = depth(L.torsoTwist)
    const lean = depth(L.torsoLean)
    const headTwist = depth(L.headCounterTwist)
    const roll = depth(L.torsoRoll)
    const bob = depth(L.bob)

    out.reset()
    // Thighs half a cycle apart; the stride is pushed back more than forward at speed.
    const back = 1 + sprint * 0.35
    out.set('LegL1', hip * (swing > 0 ? swing : swing * back))
    out.set('LegR1', hip * (opposite > 0 ? opposite : opposite * back))
    out.set('LegL2', knee * kneeCurve(phase))
    out.set('LegR2', knee * kneeCurve(phase + Math.PI))
    // Arms counter-swing against the leg on the same side.
    out.set('ArmL1', arm * opposite - sprint * 0.25, 0, sprint * 0.12)
    out.set('ArmR1', arm * swing - sprint * 0.25, 0, -sprint * 0.12)
    out.set('ArmL2', elbow + elbow * 0.35 * Math.max(0, opposite))
    out.set('ArmR2', elbow + elbow * 0.35 * Math.max(0, swing))
    // Torso leans in, twists with the stride and rolls on the footfall.
    out.set('Spine1', lean, twist * opposite, roll * Math.sin(phase * 2))
    out.set('Spine2', lean * 0.4, twist * 0.5 * opposite, 0)
    out.set('Neck1', -lean * 0.7, headTwist * swing, 0)
    out.bobY = -bob * Math.cos(phase * 2)
  }

  blend(dt) {
    if (this.blendDuration > 0) {
      this.blendTime += dt
      const t = clamp(this.blendTime / this.blendDuration, 0, 1)
      this.output.lerpBetween(this.from, this.target, ease(t))
      if (t >= 1) this.blendDuration = 0
    } else {
      this.output.copyFrom(this.target)
    }
  }

  applyVisual(dt, input) {
    const wantBank = this.state === 'run' ? -input.turn * L.bankAngle * 0.6 : 0
    this.bank += (wantBank - this.bank) * (1 - Math.exp(-L.bankRate * dt))
    this.root.rotation.set(0, 0, this.bank)
    this.root.position.y = this.output.bobY
  }
}
