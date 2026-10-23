// The player's horse, as heard from the chase cam:
//  - hoofbeats, one per hoof as it lands (horse.js calls hoof() from the gait that poses the
//    legs, so the rhythm is the one on screen: four-beat walk, two-beat trot, the gallop's
//    da-da-DUM). A hoof is a thud (the weight), a woody clop (the hoof wall; crisp at a walk,
//    softened into a drum at a gallop) and a crunch of dirt. Hind hooves land a touch heavier;
//    left / right hooves pan a little.
//  - breathing: at the gallop a horse breathes once per stride, blowing out as the front legs
//    land; at the trot every other stride
//  - a snort now and then while standing (a lip-fluttered blow)
//  - the rocket boosters: a roar of filtered noise and a low rumble rising with thrust
// Mixing for a long listen: standing still the boosters settle to a quiet hiss; holding a steady
// speed in a race everything eases back (AUDIO.mount.settle) and taps, boosts and the start bring
// it forward again.
import { AUDIO } from '../config.js'
import { A, now, onStart, voice } from './core.js'
import { burst, modal, rnd, tone, vary } from './synth.js'

const M = AUDIO.mount
// The hoof wall: a short, dull wooden knock.
const HOOF = [[1, 1, 0.05], [2.4, 0.4, 0.025], [3.9, 0.15, 0.012]]

const s = {
  ok: false,
  roarGain: null,
  roarFilter: null,
  rumbleGain: null,
  hooves: null, // the hoofbeats' and breaths' level (presence x visibility)
  presence: 1, // mix level: eases to M.settle at a steady race speed, M.idleLevel standing still
  blip: 0, // tap boost flare that decays
  revAt: -1, // race start surge until this time
  stride: 0, // strides since the last breath (trot: every other)
  nextSnort: 0,
  stillSince: 0, // audio clock time the horse last moved (or raced)
}

function loop(kind, stereo = false) {
  const src = A.ctx.createBufferSource()
  src.buffer = stereo ? (kind === 'brown' ? A.noise.brownStereo : A.noise.pinkStereo) : A.noise[kind]
  src.loop = true
  src.start(0, Math.random() * (src.buffer.duration - 0.1))
  return src
}
const filt = (type, f, q = 0.7) => {
  const b = A.ctx.createBiquadFilter()
  b.type = type
  b.frequency.value = f
  b.Q.value = q
  return b
}
const gain = (v) => {
  const g = A.ctx.createGain()
  g.gain.value = v
  return g
}

onStart((ctx) => {
  const bus = A.engine
  // Booster roar: stereo pink noise, band-passed, rising with thrust; a low rumble under it.
  s.roarFilter = filt('bandpass', 300, 0.5)
  s.roarGain = gain(0)
  loop('pink', true).connect(s.roarFilter).connect(s.roarGain).connect(bus)
  s.rumbleGain = gain(0)
  loop('brown', true).connect(filt('lowpass', 140, 0.7)).connect(s.rumbleGain).connect(bus)
  // Hoofbeats and breaths go through one level, softened a little up top for the long listen.
  s.hooves = gain(0)
  const soft = filt('highshelf', 3000, 0.7)
  soft.gain.value = -6
  s.hooves.connect(soft).connect(bus)
  s.nextSnort = ctx.currentTime + rnd(4, 8)
  s.ok = true
})

// One hoof landing. leg: { front, side } (horse.js LEGS), speed m/s, gait 0 walk / 1 trot / 2 gallop.
export function hoof(leg, speed, gait) {
  if (!s.ok || !voice(0.12, 0.6)) return
  const t = now()
  const pan = leg.side * 0.18
  const k = (gait === 2 ? 1 : gait === 1 ? 0.8 : 0.6) * (leg.front ? 0.9 : 1) * vary(1, 0.12)
  const bus = s.hooves
  tone({ t, f: vary(gait === 2 ? 78 : 95, 0.08), f2: 48, d: gait === 2 ? 0.09 : 0.07, gain: M.thud * k, pan, bus })
  // The clop: crisp at a walk, dull at a gallop (the rush of hooves blurs into a drum).
  const crisp = gait === 0 ? 1 : gait === 1 ? 0.7 : 0.35
  modal({ t, f: vary(gait === 0 ? 720 : 560, 0.1), modes: HOOF, gain: M.clop * k * crisp, strike: 0.15 * crisp, decay: gait === 2 ? 0.7 : 1, pan, bus })
  burst({ t, noise: 'pink', type: 'bandpass', f: vary(1800, 0.2), q: 0.8, a: 0.002, d: 0.05, gain: M.crunch * k, pan, bus })
  // Breath with the stride, blown out as the leading front hoof lands.
  if (leg.front && leg.side > 0 && gait > 0 && (gait === 2 || ++s.stride % 2 === 0)) breath(t + 0.02, gait === 2 ? 1 : 0.6)
}

// A blow through the nostrils: a short, breathy whoosh with a little nasal body.
function breath(t, k) {
  burst({ t, noise: 'pink', f: vary(900, 0.15), f2: 520, q: 1.4, a: 0.025, d: 0.16, gain: M.breath * k, bus: s.hooves })
  burst({ t, noise: 'brown', type: 'lowpass', f: 320, q: 0.6, a: 0.02, d: 0.12, gain: M.breath * 0.8 * k, bus: s.hooves })
}

// A snort: a sharp blow fluttered by the lips (noise chopped ~30 times a second), then a sigh.
function snort(t) {
  if (!voice(0.8, 1)) return
  const ctx = A.ctx
  const src = ctx.createBufferSource()
  src.buffer = A.noise.pink
  src.start(t, Math.random() * (src.buffer.duration - 1))
  src.stop(t + 0.7)
  const bp = filt('bandpass', vary(1100, 0.15), 1.1)
  const flutter = gain(0.5)
  const lfo = ctx.createOscillator()
  lfo.frequency.value = rnd(26, 36)
  const depth = gain(0.5)
  lfo.connect(depth).connect(flutter.gain)
  lfo.start(t)
  lfo.stop(t + 0.7)
  const env = gain(0)
  env.gain.setValueAtTime(0.0001, t)
  env.gain.linearRampToValueAtTime(M.snort, t + 0.03)
  env.gain.exponentialRampToValueAtTime(M.snort * 0.3, t + 0.22)
  env.gain.exponentialRampToValueAtTime(0.0001, t + 0.6)
  src.connect(bp).connect(flutter).connect(env).connect(s.hooves)
  burst({ t: t + 0.35, noise: 'pink', f: 600, f2: 380, q: 1, a: 0.08, d: 0.3, gain: M.snort * 0.35, bus: s.hooves })
}

// Tap boost: the boosters flare.
export function blip() {
  s.blip = Math.min(1, s.blip + 0.35)
}
// Race start: the boosters surge for a moment.
export function rev() {
  if (A.ctx) s.revAt = A.ctx.currentTime + 1.2
}

const K = 0.06 // smoothing time constant for every continuous param (s)
// st: { speed (m/s), top (m/s, what counts as full speed), boost (0..0.3), moving (lobby
// joystick, 0..1), racing, visible (the horse is on screen / near) }
export function update(dt, st) {
  if (!s.ok || !A.ctx) return
  const t = A.ctx.currentTime
  const f = Math.min(1, st.speed / Math.max(1, st.top))
  s.blip *= Math.exp(-4 * dt)
  const surge = t < s.revAt ? (s.revAt - t) / 1.2 : 0
  // Presence: racing at a steady speed it all eases back so it never wears on the ear; a tap, a
  // boost or the start bring it forward. In the lobby, standing still = a quiet hiss.
  const excite = Math.min(1, surge + s.blip * 1.5 + st.boost * 3)
  const goal = st.racing ? Math.max(M.settle, excite, 1 - f) : M.idleLevel + (1 - M.idleLevel) * Math.max(st.moving, f)
  s.presence += (goal - s.presence) * (1 - Math.exp(-dt / (goal > s.presence ? 0.15 : M.settleTime)))
  const level = (st.visible ? 1 : 0) * s.presence
  const thrust = st.racing ? 0.4 + f * 0.6 + st.boost * 1.6 + s.blip * 0.5 + surge * 0.4 : Math.max(st.moving, f) * 0.45 + 0.15
  s.roarFilter.frequency.setTargetAtTime(200 + thrust * 700, t, K)
  s.roarGain.gain.setTargetAtTime(level * M.roar * thrust * thrust, t, K)
  s.rumbleGain.gain.setTargetAtTime(level * M.rumble * (0.3 + thrust), t, K)
  s.hooves.gain.setTargetAtTime((st.visible ? 1 : 0) * (st.racing ? Math.max(M.settle, excite) : 1) * M.hooves, t, K)

  // Standing about in the lobby: a snort every so often (timed on the audio clock, not frames).
  if (st.racing || st.speed >= 0.5) s.stillSince = t
  const still = t - s.stillSince
  if (still > 2 && st.visible && t > s.nextSnort) {
    snort(now())
    s.nextSnort = t + rnd(...M.snortEvery)
  } else if (still <= 2) s.nextSnort = Math.max(s.nextSnort, t + 2)
}
