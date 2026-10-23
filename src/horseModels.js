import {
  BoxGeometry,
  CapsuleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  Float32BufferAttribute,
  Matrix4,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { HORSE, HORSES } from './config.js'

// The horse's geometry (horse.js poses it) and every catalog horse's look (HORSES.list in
// config.js: the Horses window, the shop stall, remote players). A look is a set of colours plus
// optional extras: size, long ears, a horn, wings, armour, zebra stripes / skeleton ribs / robot
// seams, spots, feathered hooves, a glowing mane / eyes / horn, a metallic coat (`shine`).
// Pieces are written in horse space (metres, hooves at y = 0, nose +Z), carry a vertex colour, and
// are merged into one geometry per moving part (moved into its pivot's frame); glowing pieces go
// into a second geometry per part, drawn with an unlit neon material.
// Moving parts: body; neck > head > two ears; a three-joint tail; per leg upper (forearm / gaskin)
// > lower (cannon) > pastern (pastern, hoof and shoe).

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
// A piece laid along the given axes (its own x, y, z), centred at pos.
function laid(list, geo, color, pos, x, y, z) {
  geo.applyMatrix4(new Matrix4().makeBasis(x, y, z))
  piece(list, geo, color, pos.toArray ? pos.toArray() : pos)
}
function merged(list, [ox, oy, oz]) {
  if (!list.length) return null
  const g = mergeGeometries(list)
  for (const p of list) p.dispose()
  g.translate(-ox, -oy, -oz)
  return g
}
const ball = (r = 1, w = 14, h = 10) => new SphereGeometry(r, w, h)
const box = (x, y, z) => new BoxGeometry(x, y, z)
const rbox = (x, y, z, r) => new RoundedBoxGeometry(x, y, z, 2, r)
const pick = (colors, i) => (Array.isArray(colors) ? colors[i % colors.length] : colors)
// Deterministic 0..1 noise for spot placement and strand lengths.
const hash = (i) => {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}
const X = new Vector3(1, 0, 0)

// Body-part pivots (horse space). The legs hang from their shoulders / hips.
const D = HORSE.dims
export const BODY_PIVOT = [0, D.barrelY, 0]
export const NECK_PIVOT = [0, D.barrelY + 0.2, D.barrelLength / 2 - 0.12]
const NECK_TILT = 0.62 // rad the neck leans forward from upright
const HEAD_TILT = 0.85 // rad the face points down from level
const UP = new Vector3(0, Math.cos(NECK_TILT), Math.sin(NECK_TILT)) // along the neck
const CREST = new Vector3(0, Math.sin(NECK_TILT), -Math.cos(NECK_TILT)) // toward the mane
const along = (d, back = 0) => new Vector3(...NECK_PIVOT).addScaledVector(UP, d).addScaledVector(CREST, back)
const neckR = (d) => D.neckRadius * (1.12 - 0.34 * Math.min(1, Math.max(0, d / D.neckLength))) // thick at the base, slim at the throat
// The head hangs off the top of the neck (pivots at the poll); everything on it is placed in its
// own frame (+Z along the face, nose-down by HEAD_TILT) from the centre of the skull.
export const HEAD_PIVOT = along(D.neckLength + 0.06).toArray()
const HEAD_ROT = new Euler(HEAD_TILT, 0, 0)
const HEAD_CENTRE = along(D.neckLength + 0.1).add(new Vector3(0, -0.02, 0.24).applyEuler(HEAD_ROT))
const onHead = (x, y, z) => new Vector3(x, y, z).applyEuler(HEAD_ROT).add(HEAD_CENTRE).toArray()
// Ear bases, [left (+X), right]: each ear turns on its own.
export const EAR_PIVOTS = [1, -1].map((s) => onHead(s * 0.085, 0.16, -0.25))
// Tail: dock, middle, end; each segment swings from the one before.
export const TAIL_PIVOT = [0, D.barrelY + 0.24, -D.barrelLength / 2 - 0.08]
export const TAIL_MID = [0, D.barrelY - 0.09, -D.barrelLength / 2 - 0.22]
export const TAIL_END = [0, D.barrelY - 0.41, -D.barrelLength / 2 - 0.25]
const LEG_X = D.barrelWidth / 2 - 0.15
export const LEGS = [
  // side (+X = the horse's left), front?, hoof phase in each gait's cycle: walk, trot, gallop
  { side: 1, front: true, offset: [0.25, 0, 0.45] },
  { side: -1, front: true, offset: [0.75, 0.5, 0.57] },
  { side: 1, front: false, offset: [0, 0.5, 0] },
  { side: -1, front: false, offset: [0.5, 0, 0.12] },
].map((l) => {
  const x = l.side * LEG_X
  const z = l.front ? D.frontZ : D.hindZ
  return { ...l, hip: [x, D.hipY, z], knee: [x, D.kneeY, z], fetlock: [x, D.fetlockY, z] }
})

// Returns { body, neck, head, ears: [left, right], tail: [dock, mid, end], legs: [{ upper, lower,
// pastern }], glow: { body, neck, head, tail: [...] } } (glow parts null when the look has none).
export function buildHorseParts(look = {}) {
  const L = { ...HORSE.look, ...look }
  const bw = D.barrelWidth / 2
  const by = D.barrelY
  const bl = D.barrelLength / 2
  const bh = D.barrelHeight / 2
  const top = by + bh
  const body = []
  const neck = []
  const head = []
  const ears = [[], []]
  const tails = [[], [], []]
  const glow = { body: [], neck: [], head: [], tail: [[], [], []] }
  const mane = L.maneGlow ? glow.neck : neck
  const forelock = L.maneGlow ? glow.head : head
  const tailHair = L.maneGlow ? glow.tail : tails
  const tailColor = L.tail ?? L.mane

  // Body: barrel with a sagging belly, deep chest, sloping shoulders, withers, a round croup with
  // its quarters, then the tack: saddle, blanket, girth, fenders, stirrups, saddle bags.
  piece(body, ball(1, 20, 14), L.coat, [0, by, 0], [0, 0, 0], [bw, bh, bl])
  piece(body, ball(1, 16, 12), L.coat, [0, by - 0.1, 0.02], [0, 0, 0], [bw * 0.96, bh * 0.82, bl * 0.72]) // belly
  piece(body, ball(1, 16, 12), L.coat, [0, by + 0.02, bl - 0.3], [0, 0, 0], [bw * 1.02, bh + 0.03, 0.48]) // chest
  piece(body, ball(1, 12, 10), L.coat, [0, by - 0.08, bl - 0.06], [0.3, 0, 0], [bw * 0.62, bh * 0.7, 0.24]) // breast
  piece(body, ball(1, 14, 10), L.coat, [0, top - 0.04, bl - 0.48], [0.25, 0, 0], [0.15, 0.12, 0.32]) // withers
  for (const s of [1, -1]) {
    piece(body, ball(1, 12, 10), L.coat, [s * bw * 0.6, by + 0.02, bl - 0.36], [-0.4, 0, s * 0.08], [0.14, 0.34, 0.2]) // shoulder
    piece(body, ball(1, 12, 10), L.coat, [s * bw * 0.45, by + 0.03, -bl + 0.34], [0.2, 0, 0], [0.2, 0.36, 0.36]) // quarter
  }
  piece(body, ball(1, 16, 12), L.coat, [0, by + 0.07, -bl + 0.3], [0, 0, 0], [bw * 1.06, bh + 0.04, 0.5]) // croup
  piece(body, box(bw * 2 + 0.06, 0.05, 0.8), L.blanket, [0, top - 0.02, D.saddleZ])
  piece(body, box(bw * 2 + 0.1, 0.06, 0.06), L.trim, [0, top - 0.02, D.saddleZ + 0.38])
  piece(body, box(bw * 2 + 0.1, 0.06, 0.06), L.trim, [0, top - 0.02, D.saddleZ - 0.38])
  piece(body, ball(1, 14, 8), L.saddle, [0, top + 0.03, D.saddleZ], [0, 0, 0], [0.3, 0.08, 0.36])
  piece(body, rbox(0.2, 0.16, 0.12, 0.04), L.saddle, [0, top + 0.1, D.saddleZ + 0.3]) // pommel
  piece(body, new CylinderGeometry(0.03, 0.035, 0.1, 8), L.saddle, [0, top + 0.21, D.saddleZ + 0.32]) // horn
  piece(body, new CylinderGeometry(0.055, 0.055, 0.03, 10), L.saddle, [0, top + 0.27, D.saddleZ + 0.33])
  piece(body, rbox(0.44, 0.14, 0.09, 0.035), L.saddle, [0, top + 0.08, D.saddleZ - 0.32]) // cantle
  piece(body, new TorusGeometry(bw + 0.015, 0.035, 6, 24), L.leather, [0, by, D.saddleZ + 0.12], [0, 0, 0], [1, bh / bw, 1])
  for (const s of [1, -1]) {
    piece(body, rbox(0.03, 0.3, 0.42, 0.012), L.saddle, [s * (bw + 0.0), top - 0.16, D.saddleZ - 0.02], [0, 0, s * 0.12]) // fender
    // Stirrup leathers and irons, where the rider's feet hang (ANIM.ride).
    piece(body, box(0.04, 0.34, 0.06), L.leather, [s * (bw + 0.02), top - 0.12, D.saddleZ + 0.08], [0, 0, s * 0.35])
    piece(body, new TorusGeometry(0.075, 0.02, 6, 12), L.metal, [s * (bw + 0.1), top - 0.34, D.saddleZ + 0.14], [0, Math.PI / 2, 0])
    piece(body, rbox(0.14, 0.26, 0.34, 0.04), L.saddle, [s * (bw - 0.02), by + 0.12, -bl + 0.48]) // saddle bag
    piece(body, box(0.02, 0.04, 0.36), L.leather, [s * (bw + 0.055), by + 0.2, -bl + 0.48]) // its flap strap
  }

  // Neck: tapered and deeper than wide, blending into the chest, with a crest under the mane.
  const len = D.neckLength
  piece(neck, new CylinderGeometry(neckR(len), neckR(0), len + 0.12, 16), L.coat, along(len / 2).toArray(), [NECK_TILT, 0, 0], [1, 1, 1.15])
  piece(neck, ball(1, 14, 10), L.coat, along(0.02, -0.02).toArray(), [NECK_TILT, 0, 0], [neckR(0) * 1.05, 0.3, neckR(0) * 1.25])
  piece(neck, ball(1, 12, 10), L.coat, along(len + 0.04).toArray(), [NECK_TILT, 0, 0], [neckR(len), neckR(len) * 1.1, neckR(len) * 1.3]) // throat latch
  piece(neck, ball(1, 12, 8), L.coat, along(len * 0.5, neckR(len * 0.5) * 0.72).toArray(), [NECK_TILT, 0, 0], [0.1, len * 0.62, 0.12]) // crest
  // Mane: strands from the crest falling down the horse's right side, a ridge along the top.
  piece(mane, rbox(0.1, len + 0.14, 0.08, 0.03), pick(L.mane, 0), along(len / 2 + 0.02, neckR(len / 2) + 0.02).toArray(), [NECK_TILT, 0, 0])
  const fall = X.clone().multiplyScalar(-0.88).addScaledVector(CREST, -0.48).normalize()
  const strandX = new Vector3().crossVectors(fall, UP)
  for (let i = 0; i < 9; i++) {
    const d = -0.02 + (i / 8) * (len + 0.1)
    const long = 0.2 + 0.1 * hash(i + 3) + (i > 1 && i < 7 ? 0.04 : 0)
    const root = along(d, neckR(d) * 0.95)
    laid(mane, box(0.045, long, 0.1), pick(L.mane, i), root.addScaledVector(fall, long / 2 - 0.02), strandX, fall, UP)
  }

  // Head: skull with round jowls, a tapering face and a soft muzzle with flared nostrils; eyes on
  // the sides; a forelock, and a bridle (browband, cheek straps, noseband, bit rings).
  const tilted = [HEAD_TILT, 0, 0]
  piece(head, rbox(0.3, 0.3, 0.34, 0.08), L.coat, onHead(0, 0.02, -0.12), tilted)
  for (const s of [1, -1]) piece(head, ball(1, 12, 10), L.coat, onHead(s * 0.09, -0.08, -0.13), tilted, [0.075, 0.13, 0.14]) // jowl
  piece(head, rbox(0.25, 0.24, 0.34, 0.07), L.coat, onHead(0, 0, 0.13), tilted)
  piece(head, rbox(0.23, 0.23, 0.18, 0.08), L.muzzle, onHead(0, -0.02, 0.33), tilted)
  piece(head, ball(1, 10, 8), L.muzzle, onHead(0, -0.13, 0.32), tilted, [0.085, 0.045, 0.075]) // lower lip
  piece(forelock, rbox(0.14, 0.04, 0.22, 0.015), pick(L.mane, 5), onHead(0, 0.18, -0.16), [HEAD_TILT + 0.08, 0, 0])
  piece(forelock, rbox(0.08, 0.03, 0.14, 0.012), pick(L.mane, 6), onHead(0.025, 0.17, -0.02), [HEAD_TILT, 0.12, 0])
  if (L.blaze) {
    piece(head, box(0.11, 0.008, 0.12), L.blaze, onHead(0, 0.173, -0.1), tilted) // star
    piece(head, box(0.07, 0.008, 0.32), L.blaze, onHead(0, 0.123, 0.15), tilted) // stripe
    piece(head, box(0.08, 0.008, 0.1), L.blaze, onHead(0, 0.098, 0.33), tilted) // snip
  }
  piece(head, new TorusGeometry(1, 0.016, 4, 22), L.leather, onHead(0, -0.01, 0.23), tilted, [0.136, 0.131, 1]) // noseband
  piece(head, new TorusGeometry(1, 0.016, 4, 22), L.leather, onHead(0, 0.02, -0.24), tilted, [0.162, 0.162, 1]) // browband + throatlatch
  for (const s of [1, -1]) {
    piece(head, ball(1, 8, 6), '#1a1110', onHead(s * 0.065, 0.005, 0.418), tilted, [0.024, 0.036, 0.014]) // nostril
    if (L.eyesGlow) piece(glow.head, ball(0.055, 10, 8), L.eyesGlow, onHead(s * 0.148, 0.07, -0.06))
    else {
      piece(head, ball(1, 12, 10), '#14100e', onHead(s * 0.148, 0.07, -0.06), tilted, [0.028, 0.048, 0.055]) // eye
      piece(head, ball(0.014, 6, 4), '#ffffff', onHead(s * 0.172, 0.09, -0.04)) // eye shine
      piece(head, box(0.02, 0.016, 0.1), L.coat, onHead(s * 0.15, 0.125, -0.06), tilted) // brow
    }
    piece(head, box(0.016, 0.022, 0.48), L.leather, onHead(s * 0.152, -0.03, -0.01), tilted) // cheek strap
    piece(head, new TorusGeometry(0.035, 0.01, 4, 10), L.metal, onHead(s * 0.122, -0.09, 0.34), [HEAD_TILT, Math.PI / 2, 0]) // bit ring
    // Reins: from the bit back to the pommel.
    const from = new Vector3(...onHead(s * 0.13, -0.09, 0.34))
    const to = new Vector3(s * 0.1, top + 0.16, D.saddleZ + 0.34)
    const mid = from.clone().add(to).multiplyScalar(0.5)
    const rein = new CylinderGeometry(0.012, 0.012, from.distanceTo(to), 4)
    rein.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), to.clone().sub(from).normalize()))
    piece(neck, rein, L.leather, [mid.x, mid.y, mid.z])
  }
  if (L.horn) piece(L.hornGlow ? glow.head : head, new ConeGeometry(0.07, 0.42, 8), L.horn, onHead(0, 0.36, -0.08), [HEAD_TILT - 0.75, 0, 0])

  // Ears: cupped, opening forward, a darker inside; long (donkey) ears too.
  const longEars = L.ears === 'long'
  EAR_PIVOTS.forEach((at, i) => {
    const s = i ? -1 : 1
    const h = longEars ? 0.38 : 0.2
    const outer = new ConeGeometry(longEars ? 0.075 : 0.058, h, 7)
    outer.translate(0, h / 2, 0)
    const inner = new ConeGeometry(longEars ? 0.045 : 0.034, h * 0.72, 6)
    inner.translate(0, h * 0.4, 0.028)
    const tilt = [longEars ? -0.45 : -0.18, 0, s * (longEars ? -0.4 : -0.2)]
    piece(ears[i], outer, L.coat, at, tilt, [1, 1, 0.72])
    piece(ears[i], inner, L.earInner ?? '#2a1a12', at, tilt, [1, 1, 0.72])
  })

  // Tail: a dock, then three hanging hanks of hair, each with a few loose strands, flaring at the tip.
  piece(tails[0], new CapsuleGeometry(0.065, 0.14, 3, 8), L.coat, [0, TAIL_PIVOT[1] - 0.05, TAIL_PIVOT[2] - 0.05], [0.6, 0, 0])
  const hanks = [
    [TAIL_PIVOT, TAIL_MID, 0.1],
    [TAIL_MID, TAIL_END, 0.12],
    [TAIL_END, [0, TAIL_END[1] - 0.3, TAIL_END[2] - 0.02], 0.11],
  ]
  hanks.forEach(([a, b, w], i) => {
    const c = [0, (a[1] + b[1]) / 2 - (i ? 0 : 0.03), (a[2] + b[2]) / 2 - (i ? 0 : 0.03)]
    const h = (a[1] - b[1]) / 2 + 0.05
    const lean = Math.atan2(a[2] - b[2], a[1] - b[1])
    piece(tailHair[i], ball(1, 12, 10), pick(tailColor, i), c, [lean, 0, 0], [w, h, w * 0.78])
    for (let j = 0; j < 3; j++) {
      const x = (j - 1) * w * 0.55
      piece(tailHair[i], rbox(0.05, h * 2.1, 0.05, 0.02), pick(tailColor, i + j + 1), [x, c[1] - 0.02, c[2] - 0.02], [lean + (j - 1) * 0.05, 0, -x * 0.9])
    }
  })
  piece(tailHair[2], new ConeGeometry(0.11, 0.16, 9), pick(tailColor, 3), [0, TAIL_END[1] - 0.36, TAIL_END[2] - 0.02], [Math.PI, 0, 0])

  // Legs: upper (muscled forearm and flat knee / gaskin, thigh and pointed hock), lower (slim
  // cannon with its tendon, round fetlock), pastern (pastern, coronet, hoof, sole and a shoe).
  const legLists = LEGS.map(({ front, hip: [x, hip, z], knee: [, knee], fetlock: [, fet] }) => {
    const upper = []
    const sock = L.socks ? L.sock : L.coat
    if (front) {
      piece(upper, new CylinderGeometry(0.12, 0.075, hip - knee + 0.04, 10), L.coat, [x, (hip + knee) / 2, z], [0, 0, 0], [1, 1, 1.1])
      piece(upper, ball(1, 12, 10), L.coat, [x, hip - 0.1, z + 0.01], [0, 0, 0], [0.135, 0.22, 0.16]) // forearm muscle
      piece(upper, rbox(0.15, 0.13, 0.15, 0.045), L.coat, [x, knee, z + 0.005]) // knee
    } else {
      piece(upper, new CylinderGeometry(0.14, 0.08, hip - knee + 0.04, 10), L.coat, [x, (hip + knee) / 2, z], [0, 0, 0], [1, 1, 1.25])
      piece(upper, ball(1, 12, 10), L.coat, [x - Math.sign(x) * 0.03, hip + 0.04, z + 0.02], [0, 0, 0], [0.16, 0.32, 0.28]) // thigh
      piece(upper, rbox(0.13, 0.14, 0.17, 0.045), L.coat, [x, knee, z - 0.01]) // hock
      piece(upper, ball(0.05, 8, 6), L.coat, [x, knee + 0.05, z - 0.09]) // point of hock
    }
    const lower = []
    piece(lower, new CylinderGeometry(0.066, 0.06, knee - fet, 8), sock, [x, (knee + fet) / 2, z], [0, 0, 0], [1, 1, 1.2])
    piece(lower, rbox(0.05, (knee - fet) * 0.8, 0.045, 0.018), sock, [x, (knee + fet) / 2, z - 0.055]) // tendon
    piece(lower, ball(1, 10, 8), sock, [x, fet, z - 0.01], [0, 0, 0], [0.082, 0.074, 0.098]) // fetlock
    const pastern = []
    piece(pastern, new CylinderGeometry(0.06, 0.074, fet - 0.11, 8), sock, [x, (fet + 0.11) / 2, z + 0.01])
    piece(pastern, new CylinderGeometry(0.09, 0.097, 0.026, 12), sock, [x, 0.124, z + 0.015]) // coronet
    piece(pastern, new CylinderGeometry(0.092, 0.115, 0.112, 12), L.hoof, [x, 0.058, z + 0.015], [0.08, 0, 0])
    piece(pastern, new CylinderGeometry(0.104, 0.104, 0.006, 12), '#151110', [x, 0.003, z + 0.02]) // sole
    piece(pastern, new TorusGeometry(0.084, 0.013, 4, 14, Math.PI * 1.4), L.metal, [x, 0.004, z + 0.02], [Math.PI / 2, 0, -Math.PI * 0.2]) // shoe
    if (L.feathers) piece(pastern, new CylinderGeometry(0.11, 0.17, 0.2, 10), L.sock, [x, 0.15, z + 0.02]) // feathered fetlock
    return { upper, lower, pastern, x, z, front }
  })

  // Stripes: rings round the barrel, neck and upper legs. zebra = the whole horse; ribs = thin
  // bands over the ribcage only; seams = glowing panel lines (robot).
  if (L.stripes) {
    const { color, kind = 'zebra' } = L.stripes
    const list = (part) => (kind === 'seams' ? glow[part] : part === 'body' ? body : neck)
    const thick = kind === 'zebra' ? 0.05 : 0.025
    const zs = kind === 'ribs' ? [-0.25, -0.1, 0.05, 0.2, 0.35] : kind === 'seams' ? [-0.55, 0, 0.55] : [-0.7, -0.45, -0.2, 0.05, 0.3, 0.55]
    for (const z of zs) {
      const k = Math.sqrt(1 - (z / bl) ** 2)
      const ring = new TorusGeometry(1, thick, 5, 28, kind === 'ribs' ? Math.PI * 0.8 : Math.PI * 2)
      // Ribs: the lower 80% of the ring (sides and belly), as an arc.
      const rot = kind === 'ribs' ? [0, 0, -Math.PI * 0.9] : [0, 0, 0]
      piece(list('body'), ring, color, [0, by, z], rot, [bw * k + 0.03, bh * k + 0.03, 1])
    }
    if (kind !== 'ribs')
      for (const d of [0.12, 0.3]) piece(list('neck'), new TorusGeometry(neckR(d) + 0.012, thick, 5, 20), color, along(d).toArray(), [NECK_TILT - Math.PI / 2, 0, 0], [1, 1.15, 1])
    if (kind === 'zebra')
      for (const leg of legLists)
        for (const y of [0.62, 0.8]) piece(leg.upper, new TorusGeometry(leg.front ? 0.115 : 0.14, 0.03, 5, 16), color, [leg.x, y, leg.z], [Math.PI / 2, 0, 0], [1, 1.15, 1])
  }

  // Spots: little domes on the rump (appaloosa) or all over (galaxy stars, dapples).
  if (L.spots) {
    const { color, count = 14, where = 'rump', size = 0.07, glow: glowing } = L.spots
    for (let i = 0; i < count; i++) {
      const a = (hash(i) - 0.5) * Math.PI * 1.6 // round the barrel, top half and sides
      const t = where === 'rump' ? -0.95 + hash(i + 50) * 0.6 : -0.9 + hash(i + 50) * 1.8
      const k = Math.sqrt(1 - Math.min(0.9, t * t))
      const p = [Math.sin(a) * bw * k * 1.08, by + Math.cos(a) * bh * k * 1.04, t * bl]
      piece(glowing ? glow.body : body, ball(size * (0.7 + hash(i + 9) * 0.6), 8, 6), color, p)
    }
  }

  // Wings: a fan of feathers either side of the withers, swept up and back.
  if (L.wings) {
    for (const s of [1, -1])
      for (let i = 0; i < 4; i++) {
        const len = 1.3 - i * 0.2
        const a = 0.45 + i * 0.28 // rad from upright toward the tail
        const x = s * (bw - 0.02)
        const y = top - 0.02
        const z = D.saddleZ - 0.32
        const dir = new Vector3(s * 0.55, Math.cos(a), -Math.sin(a)).normalize()
        const geo = rbox(0.05, len, 0.3, 0.02)
        geo.translate(0, len / 2, 0)
        geo.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir))
        piece(body, geo, i === 0 ? L.wings : (L.wingTips ?? L.wings), [x, y, z - i * 0.06])
      }
  }

  // Armour (knight): a face plate, neck plates, a chest plate and a long cloth caparison.
  if (L.armor) {
    const { plate, cloth, trim = L.trim } = L.armor
    piece(head, box(0.31, 0.03, 0.5), plate, onHead(0, 0.19, 0.02), tilted)
    for (let i = 0; i < 3; i++) piece(neck, box(0.36, 0.06, 0.18), plate, along(0.12 + i * 0.15, 0.12).toArray(), [NECK_TILT + Math.PI / 2, 0, 0])
    piece(body, box(0.62, 0.42, 0.06), plate, [0, by + 0.04, bl + 0.16], [-0.25, 0, 0])
    for (const s of [1, -1]) {
      piece(body, box(0.03, 0.56, bl * 2 - 0.2), cloth, [s * (bw + 0.07), by - 0.14, 0])
      piece(body, box(0.035, 0.07, bl * 2 - 0.2), trim, [s * (bw + 0.08), by - 0.41, 0])
    }
  }

  const tailPivots = [TAIL_PIVOT, TAIL_MID, TAIL_END]
  return {
    body: merged(body, BODY_PIVOT),
    neck: merged(neck, NECK_PIVOT),
    head: merged(head, HEAD_PIVOT),
    ears: ears.map((e, i) => merged(e, EAR_PIVOTS[i])),
    tail: tails.map((t, i) => merged(t, tailPivots[i])),
    legs: legLists.map((l, i) => ({ upper: merged(l.upper, LEGS[i].hip), lower: merged(l.lower, LEGS[i].knee), pastern: merged(l.pastern, LEGS[i].fetlock) })),
    glow: {
      body: merged(glow.body, BODY_PIVOT),
      neck: merged(glow.neck, NECK_PIVOT),
      head: merged(glow.head, HEAD_PIVOT),
      tail: glow.tail.map((t, i) => merged(t, tailPivots[i])),
    },
  }
}

// --- Catalog ------------------------------------------------------------------------
export const horseById = (id) => HORSES.list.find((h) => h.id === id)
// The look a catalog horse is drawn with (an unknown id: the default horse).
export const horseLook = (id) => horseById(id)?.look ?? {}
