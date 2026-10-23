// The countryside around the player, all synthesised:
//  - wind over the meadow: a soft stereo bed that gusts (every few seconds a swell that opens
//    up brighter), with the grass rustling in the gusts; racing, the rush of air grows with speed
//  - songbirds by day: quick phrases of chirps, sweeps and trills, near and far, either side
//  - a distant crowd from the grandstands: a murmur that swells into a cheer now and then while
//    racing, faint in the lobby (louder toward the START gate)
//  - the waterfall in the plaza: a positional roar (rumble + hiss) that grows as you ride toward it
//  - crickets at night
// One scheduler tick (every AUDIO.ambience.tick s) plans the next events ahead of the clock;
// update() moves the continuous levels every frame.
import { AUDIO, LOBBY, PLAZA } from '../config.js'
import { A, onStart, ready } from './core.js'
import { env, rnd, route } from './synth.js'

const M = AUDIO.ambience
const s = {
  ok: false,
  wind: null, // gust envelope gain + its filter
  windFilter: null,
  windLevel: null, // speed / racing level
  rustle: null,
  crowd: null, // swell envelope
  crowdLevel: null, // racing / distance level
  fall: null, // waterfall level + pan
  fallPan: null,
  nextGust: 0,
  nextBird: 0,
  nextCheer: 0,
  crickets: [],
  night: false,
  racing: false,
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
function loop(buf) {
  const src = A.ctx.createBufferSource()
  src.buffer = buf
  src.loop = true
  src.start(0, Math.random() * (buf.duration - 0.1))
  return src
}

onStart((ctx) => {
  const bus = A.amb
  // Wind: stereo pink -> band (opens in a gust) -> gust envelope -> level.
  s.windLevel = gain(0)
  s.windLevel.connect(bus)
  s.windFilter = filt('bandpass', 420, 0.45)
  s.wind = gain(0.4)
  loop(A.noise.pinkStereo).connect(s.windFilter).connect(s.wind).connect(s.windLevel)
  // Grass rustle: a high, grainy hiss that only comes up in the gusts.
  s.rustle = gain(0)
  loop(A.noise.pinkStereo).connect(filt('highpass', 3200, 0.5)).connect(s.rustle).connect(s.windLevel)
  // Crowd: a murmur of many voices (two formant-ish bands of pink noise), swelling into cheers.
  s.crowdLevel = gain(0)
  s.crowdLevel.connect(bus)
  s.crowd = gain(0.5)
  s.crowd.connect(s.crowdLevel)
  loop(A.noise.pinkStereo).connect(filt('bandpass', 650, 0.9)).connect(gain(1)).connect(s.crowd)
  loop(A.noise.pinkStereo).connect(filt('bandpass', 1700, 1.4)).connect(gain(0.5)).connect(s.crowd)
  // Waterfall: a heavy rumble + broadband hiss, positional.
  s.fallPan = ctx.createStereoPanner()
  s.fall = gain(0)
  s.fall.connect(s.fallPan).connect(bus)
  loop(A.noise.pinkStereo).connect(filt('bandpass', 1100, 0.35)).connect(gain(0.9)).connect(s.fall)
  loop(A.noise.brownStereo).connect(filt('lowpass', 220, 0.6)).connect(gain(1.2)).connect(s.fall)
  // Night crickets: each is a sine whose gain is pulsed into chirps by the scheduler.
  for (const [f, pan] of M.crickets) {
    const o = ctx.createOscillator()
    o.frequency.value = f
    const g = gain(0)
    o.connect(g)
    route(g, { bus, pan, verb: 0.25 })
    o.start()
    s.crickets.push({ g, next: 0, rate: rnd(0.55, 0.9) })
  }
  s.nextGust = ctx.currentTime + 1
  s.nextBird = ctx.currentTime + rnd(2, 5)
  s.nextCheer = ctx.currentTime + rnd(...M.cheerEvery)
  s.ok = true
  setInterval(schedule, M.tick * 1000)
})

// One gust: the wind swells and brightens, the grass rustles, then it all dies back.
function gust(t) {
  const rise = rnd(1.2, 2.5)
  const fall = rnd(2, 4)
  const peak = rnd(0.7, 1)
  const g = s.wind.gain
  const f = s.windFilter.frequency
  g.cancelScheduledValues(t)
  f.cancelScheduledValues(t)
  g.setValueAtTime(g.value, t)
  f.setValueAtTime(f.value, t)
  g.linearRampToValueAtTime(peak, t + rise)
  f.exponentialRampToValueAtTime(rnd(750, 1100), t + rise)
  g.linearRampToValueAtTime(rnd(0.3, 0.45), t + rise + fall)
  f.exponentialRampToValueAtTime(rnd(360, 460), t + rise + fall)
  s.rustle.gain.cancelScheduledValues(t)
  env(s.rustle.gain, t + rise * 0.5, rise * 0.5, M.rustle * peak, fall)
  return t + rise + fall * rnd(0.4, 1.2)
}

// A songbird's phrase: a few chirps, sweeps and a trill, quick and high.
function bird(t) {
  const ctx = A.ctx
  const near = Math.random() < 0.4
  const out = gain((near ? 1 : 0.45) * M.bird * rnd(0.7, 1))
  route(out, { bus: A.amb, pan: rnd(-0.9, 0.9), verb: near ? 0.25 : 0.5 })
  const notes = 3 + Math.floor(Math.random() * 6)
  const base = rnd(2600, 4200)
  let at = t
  const trillAt = Math.floor(Math.random() * notes)
  for (let i = 0; i < notes; i++) {
    const trill = i === trillAt
    const reps = trill ? 4 + Math.floor(Math.random() * 5) : 1
    for (let r = 0; r < reps; r++) {
      const len = trill ? 0.035 : rnd(0.05, 0.13)
      const f0 = base * rnd(0.85, 1.25)
      const o = ctx.createOscillator()
      o.frequency.setValueAtTime(f0, at)
      // Sweeps up or down; a trill is the same tiny chirp repeated fast.
      o.frequency.exponentialRampToValueAtTime(f0 * (trill ? 1.3 : Math.random() < 0.5 ? rnd(1.2, 1.6) : rnd(0.6, 0.8)), at + len)
      const g = gain(0)
      env(g.gain, at, 0.008, 1, len - 0.008)
      o.connect(g).connect(out)
      o.start(at)
      o.stop(at + len + 0.02)
      at += len + (trill ? 0.02 : rnd(0.04, 0.12))
    }
  }
}

// The crowd swells into a cheer and settles back.
function cheer(t) {
  const g = s.crowd.gain
  g.cancelScheduledValues(t)
  g.setValueAtTime(g.value, t)
  g.linearRampToValueAtTime(rnd(1.3, 1.8), t + rnd(0.4, 0.8))
  g.linearRampToValueAtTime(0.5, t + rnd(2.5, 4))
}

// One cricket chirp: 3-5 pulses ~35 ms apart.
function chirp(c, t) {
  const pulses = 3 + Math.floor(Math.random() * 3)
  const g = c.g.gain
  for (let i = 0; i < pulses; i++) {
    const at = t + i * 0.036
    g.setValueAtTime(0, at)
    g.linearRampToValueAtTime(M.cricket, at + 0.004)
    g.linearRampToValueAtTime(0, at + 0.016)
  }
}

function schedule() {
  if (!s.ok || !ready()) return
  const t = A.ctx.currentTime
  const ahead = t + M.tick * 1.5
  if (s.nextGust < ahead) s.nextGust = gust(Math.max(t, s.nextGust))
  if (!s.night && s.nextBird < ahead) {
    bird(Math.max(t, s.nextBird))
    s.nextBird = t + rnd(...(s.racing ? M.birdEveryRacing : M.birdEvery))
  }
  if (s.racing && s.nextCheer < ahead) {
    cheer(Math.max(t, s.nextCheer))
    s.nextCheer = t + rnd(...M.cheerEvery)
  }
  if (s.night) {
    for (const c of s.crickets) {
      if (c.next < t) c.next = t + rnd(0, 0.3)
      while (c.next < ahead) {
        chirp(c, c.next)
        c.next += c.rate * rnd(0.9, 1.1)
      }
    }
  }
}

// listener: { x, z, rightX, rightZ } (camera position + its right vector on the ground);
// racing; speed (m/s); night.
export function update(dt, st) {
  if (!s.ok) return
  const t = A.ctx.currentTime
  s.night = st.night
  s.racing = st.racing
  // Wind: a steady breeze, rushing harder the faster the race goes.
  const rush = st.racing ? Math.min(1, st.speed / 60) : 0
  s.windLevel.gain.setTargetAtTime(M.wind * (1 + rush * M.rush), t, 0.4)
  // Crowd: all around while racing; in the lobby faint, louder toward the START gate.
  const toGate = Math.max(0, Math.min(1, 1 - (st.z - LOBBY.gate.z) / 90))
  s.crowdLevel.gain.setTargetAtTime(M.crowd * (st.racing ? 1 : M.crowdLobby * (0.3 + 0.7 * toGate)), t, 0.6)
  // Waterfall: inverse-distance with a floor so it never pops in; panned from the camera.
  const W = PLAZA.waterfall
  const dx = W.x - st.x
  const dz = W.z - st.z
  const d = Math.hypot(dx, dz)
  const fall = st.racing ? 0 : M.waterfall / (1 + Math.pow(d / M.waterfallNear, 2))
  s.fall.gain.setTargetAtTime(fall, t, 0.25)
  const pan = d > 0.1 ? (dx * st.rightX + dz * st.rightZ) / d : 0
  s.fallPan.pan.setTargetAtTime(pan * 0.8, t, 0.15)
}
