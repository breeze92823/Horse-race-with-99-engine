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
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { HORSE, HORSES } from './config.js'

// The horse's geometry (horse.js poses it) and every catalog horse's look (HORSES.list in
// config.js: the Horses window, the shop stall, remote players). A look is a set of colours plus
// optional extras: size, long ears, a horn, wings, armour, zebra stripes / skeleton ribs / robot
// seams, spots, feathered hooves, a glowing mane / eyes / horn, a metallic coat (`shine`).
// Pieces are written in horse space (metres, hooves at y = 0, nose +Z), carry a vertex colour, and
// are merged into one geometry per moving part (moved into its pivot's frame); glowing pieces go
// into a second geometry per part, drawn with an unlit neon material.

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
  if (!list.length) return null
  const g = mergeGeometries(list)
  for (const p of list) p.dispose()
  g.translate(-ox, -oy, -oz)
  return g
}
const ball = (r = 1, w = 14, h = 10) => new SphereGeometry(r, w, h)
const box = (x, y, z) => new BoxGeometry(x, y, z)
const pick = (colors, i) => (Array.isArray(colors) ? colors[i % colors.length] : colors)
// Deterministic 0..1 noise for spot placement.
const hash = (i) => {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

// Body-part pivots (horse space). The legs hang from their shoulders / hips.
const D = HORSE.dims
export const BODY_PIVOT = [0, D.barrelY, 0]
export const NECK_PIVOT = [0, D.barrelY + 0.2, D.barrelLength / 2 - 0.12]
export const TAIL_PIVOT = [0, D.barrelY + 0.24, -D.barrelLength / 2 - 0.08]
const NECK_TILT = 0.62 // rad the neck leans forward from upright
const HEAD_TILT = 0.85 // rad the face points down from level
const LEG_X = D.barrelWidth / 2 - 0.15
export const LEGS = [
  // side (+X = the horse's left), front?, hoof phase in each gait's cycle: walk, trot, gallop
  { side: 1, front: true, offset: [0.25, 0, 0.45] },
  { side: -1, front: true, offset: [0.75, 0.5, 0.57] },
  { side: 1, front: false, offset: [0, 0.5, 0] },
  { side: -1, front: false, offset: [0.5, 0, 0.12] },
].map((l) => ({ ...l, hip: [l.side * LEG_X, D.hipY, l.front ? D.frontZ : D.hindZ], knee: [l.side * LEG_X, D.kneeY, l.front ? D.frontZ : D.hindZ] }))

// Returns { body, neck, tail, legs: [{ upper, lower }], glow: { body, neck, tail } } (glow parts
// null when the look has none).
export function buildHorseParts(look = {}) {
  const L = { ...HORSE.look, ...look }
  const bw = D.barrelWidth / 2
  const by = D.barrelY
  const bl = D.barrelLength / 2
  const bh = D.barrelHeight / 2
  const top = by + bh
  const body = []
  const neck = []
  const tail = []
  const glow = { body: [], neck: [], tail: [] }
  const mane = L.maneGlow ? glow.neck : neck
  const tailList = L.maneGlow ? glow.tail : tail
  const tailColor = L.tail ?? L.mane

  // Body: barrel, chest and rump, saddle, blanket, girth, stirrups, saddle bags, booster rack.
  piece(body, ball(1, 18, 12), L.coat, [0, by, 0], [0, 0, 0], [bw, bh, bl])
  piece(body, ball(1, 16, 12), L.coat, [0, by + 0.04, bl - 0.3], [0, 0, 0], [bw * 1.04, bh + 0.04, 0.48])
  piece(body, ball(1, 16, 12), L.coat, [0, by + 0.06, -bl + 0.3], [0, 0, 0], [bw * 1.08, bh + 0.05, 0.5])
  piece(body, box(bw * 2 + 0.06, 0.05, 0.8), L.blanket, [0, top - 0.02, D.saddleZ])
  piece(body, box(bw * 2 + 0.1, 0.06, 0.06), L.trim, [0, top - 0.02, D.saddleZ + 0.38])
  piece(body, box(bw * 2 + 0.1, 0.06, 0.06), L.trim, [0, top - 0.02, D.saddleZ - 0.38])
  piece(body, ball(1, 14, 8), L.saddle, [0, top + 0.03, D.saddleZ], [0, 0, 0], [0.3, 0.08, 0.36])
  piece(body, box(0.18, 0.16, 0.1), L.saddle, [0, top + 0.1, D.saddleZ + 0.3]) // pommel
  piece(body, box(0.42, 0.14, 0.08), L.saddle, [0, top + 0.08, D.saddleZ - 0.32]) // cantle
  piece(body, new TorusGeometry(bw + 0.015, 0.035, 6, 24), L.leather, [0, by, D.saddleZ + 0.12], [0, 0, 0], [1, bh / bw, 1])
  for (const s of [1, -1]) {
    // Stirrup leathers and irons, where the rider's feet hang (ANIM.ride).
    piece(body, box(0.04, 0.34, 0.06), L.leather, [s * (bw + 0.02), top - 0.12, D.saddleZ + 0.08], [0, 0, s * 0.35])
    piece(body, new TorusGeometry(0.075, 0.02, 6, 12), L.metal, [s * (bw + 0.1), top - 0.34, D.saddleZ + 0.14], [0, Math.PI / 2, 0])
    piece(body, box(0.14, 0.26, 0.34), L.saddle, [s * (bw - 0.02), by + 0.12, -bl + 0.48]) // saddle bag
  }
  piece(body, box(bw * 2 + 0.5, 0.1, 0.18), L.rack, [0, D.rackY, D.rackZ]) // the booster rack

  // Neck + head (pivots at the withers): a thick neck leaning forward, the head angled nose-down.
  const up = new Vector3(0, Math.cos(NECK_TILT), Math.sin(NECK_TILT)) // along the neck
  const crest = new Vector3(0, Math.sin(NECK_TILT), -Math.cos(NECK_TILT)) // toward the mane
  const base = new Vector3(...NECK_PIVOT)
  const along = (d, back = 0) => base.clone().addScaledVector(up, d).addScaledVector(crest, back)
  piece(neck, new CapsuleGeometry(D.neckRadius, D.neckLength, 4, 12), L.coat, along(D.neckLength / 2 + 0.06).toArray(), [NECK_TILT, 0, 0], [1, 1, 1.12])
  // Blocky mane along the crest.
  for (let i = 0; i < 5; i++) piece(mane, box(0.15, 0.24, 0.17), pick(L.mane, i), along(0.04 + (i / 4) * D.neckLength, D.neckRadius + 0.01).toArray(), [NECK_TILT, 0, 0])
  // The head and everything on it: positions in the head's own frame (+Z along the face, nose-down
  // by HEAD_TILT), from the centre of the head box, which hangs off the top of the neck.
  const headTilt = new Euler(HEAD_TILT, 0, 0)
  const centre = along(D.neckLength + 0.1).add(new Vector3(0, -0.02, 0.24).applyEuler(headTilt))
  const onHead = (x, y, z) => new Vector3(x, y, z).applyEuler(headTilt).add(centre).toArray()
  const tilted = [HEAD_TILT, 0, 0]
  piece(neck, box(0.3, 0.34, 0.6), L.coat, onHead(0, 0, 0), tilted)
  piece(neck, box(0.26, 0.28, 0.2), L.muzzle, onHead(0, -0.03, 0.34), tilted)
  piece(neck, box(0.28, 0.3, 0.035), L.leather, onHead(0, -0.03, 0.22), tilted) // noseband
  piece(mane, box(0.16, 0.08, 0.14), pick(L.mane, 5), onHead(0, 0.19, -0.2), tilted) // forelock
  if (L.blaze) piece(neck, box(0.08, 0.01, 0.5), L.blaze, onHead(0, 0.172, 0.06), tilted)
  const longEars = L.ears === 'long'
  for (const s of [1, -1]) {
    piece(neck, ball(0.028, 6, 4), '#1a1110', onHead(s * 0.08, -0.02, 0.44)) // nostril
    if (L.eyesGlow) piece(glow.neck, ball(0.058, 10, 8), L.eyesGlow, onHead(s * 0.15, 0.07, -0.02))
    else {
      piece(neck, ball(0.055, 10, 8), '#14100e', onHead(s * 0.15, 0.07, -0.02)) // eye
      piece(neck, ball(0.019, 6, 4), '#ffffff', onHead(s * 0.19, 0.09, 0.01)) // eye shine
    }
    if (longEars) piece(neck, new ConeGeometry(0.075, 0.38, 6), L.coat, onHead(s * 0.1, 0.32, -0.26), [-0.55, 0, s * -0.35])
    else piece(neck, new ConeGeometry(0.06, 0.18, 6), L.coat, onHead(s * 0.09, 0.22, -0.24), [-0.35, 0, s * -0.2]) // ear
    piece(neck, box(0.02, 0.025, 0.42), L.leather, onHead(s * 0.155, -0.05, 0.06), tilted) // cheek strap
    // Reins: from the bit back to the pommel.
    const from = new Vector3(...onHead(s * 0.14, -0.1, 0.3))
    const to = new Vector3(s * 0.1, top + 0.16, D.saddleZ + 0.34)
    const mid = from.clone().add(to).multiplyScalar(0.5)
    const rein = new CylinderGeometry(0.012, 0.012, from.distanceTo(to), 4)
    rein.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), to.clone().sub(from).normalize()))
    piece(neck, rein, L.leather, [mid.x, mid.y, mid.z])
  }
  if (L.horn) piece(L.hornGlow ? glow.neck : neck, new ConeGeometry(0.07, 0.42, 8), L.horn, onHead(0, 0.36, -0.08), [HEAD_TILT - 0.75, 0, 0])

  // Tail: blocky tufts hanging from the dock.
  piece(tail, new CapsuleGeometry(0.06, 0.12, 3, 8), L.coat, [TAIL_PIVOT[0], TAIL_PIVOT[1] - 0.04, TAIL_PIVOT[2] - 0.04], [0.5, 0, 0])
  for (let i = 0; i < 4; i++) {
    const w = 0.16 + (i === 1 || i === 2 ? 0.04 : 0)
    piece(tailList, box(w, 0.2, 0.12), pick(tailColor, i), [0, TAIL_PIVOT[1] - 0.12 - i * 0.16, TAIL_PIVOT[2] - 0.1 - i * 0.03], [0.25, 0, 0])
  }

  // Legs: an upper (forearm / gaskin) and a lower (cannon, fetlock, hoof) per leg.
  const legLists = LEGS.map(({ front, hip: [x, hip, z], knee: [, knee] }) => {
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
    if (L.feathers) piece(lower, new CylinderGeometry(0.11, 0.17, 0.2, 10), L.sock, [x, 0.16, z + 0.02]) // feathered fetlock
    return { upper, lower, x, z, front }
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
      piece(list('body'), ring, color, [0, by, z], rot, [bw * k + 0.012, bh * k + 0.012, 1])
    }
    if (kind !== 'ribs')
      for (const d of [0.12, 0.3]) piece(list('neck'), new TorusGeometry(D.neckRadius + 0.012, thick, 5, 20), color, along(d).toArray(), [NECK_TILT - Math.PI / 2, 0, 0], [1, 1.12, 1])
    if (kind === 'zebra')
      for (const leg of legLists)
        for (const y of [0.62, 0.8]) piece(leg.upper, new TorusGeometry(leg.front ? 0.115 : 0.14, 0.03, 5, 16), color, [leg.x, y, leg.z], [Math.PI / 2, 0, 0])
  }

  // Spots: little domes on the rump (appaloosa) or all over (galaxy stars, dapples).
  if (L.spots) {
    const { color, count = 14, where = 'rump', size = 0.07, glow: glowing } = L.spots
    for (let i = 0; i < count; i++) {
      const a = (hash(i) - 0.5) * Math.PI * 1.6 // round the barrel, top half and sides
      const t = where === 'rump' ? -0.95 + hash(i + 50) * 0.6 : -0.9 + hash(i + 50) * 1.8
      const k = Math.sqrt(1 - Math.min(0.9, t * t))
      const p = [Math.sin(a) * bw * k * 1.06, by + Math.cos(a) * bh * k * 1.02, t * bl]
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
        const geo = box(0.05, len, 0.3)
        geo.translate(0, len / 2, 0)
        geo.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir))
        piece(body, geo, i === 0 ? L.wings : (L.wingTips ?? L.wings), [x, y, z - i * 0.06])
      }
  }

  // Armour (knight): a face plate, neck plates, a chest plate and a long cloth caparison.
  if (L.armor) {
    const { plate, cloth, trim = L.trim } = L.armor
    piece(neck, box(0.33, 0.03, 0.5), plate, onHead(0, 0.18, 0.04), tilted)
    for (let i = 0; i < 3; i++) piece(neck, box(0.36, 0.06, 0.18), plate, along(0.12 + i * 0.15, 0.12).toArray(), [NECK_TILT + Math.PI / 2, 0, 0])
    piece(body, box(0.62, 0.42, 0.06), plate, [0, by + 0.04, bl + 0.12], [-0.25, 0, 0])
    for (const s of [1, -1]) {
      piece(body, box(0.03, 0.56, bl * 2 - 0.2), cloth, [s * (bw + 0.05), by - 0.14, 0])
      piece(body, box(0.035, 0.07, bl * 2 - 0.2), trim, [s * (bw + 0.06), by - 0.41, 0])
    }
  }

  return {
    body: merged(body, BODY_PIVOT),
    neck: merged(neck, NECK_PIVOT),
    tail: merged(tail, TAIL_PIVOT),
    legs: legLists.map((l, i) => ({ upper: merged(l.upper, LEGS[i].hip), lower: merged(l.lower, LEGS[i].knee) })),
    glow: { body: merged(glow.body, BODY_PIVOT), neck: merged(glow.neck, NECK_PIVOT), tail: merged(glow.tail, TAIL_PIVOT) },
  }
}

// --- Catalog ------------------------------------------------------------------------
export const horseById = (id) => HORSES.list.find((h) => h.id === id)
// The look a catalog horse is drawn with (an unknown id: the default horse).
export const horseLook = (id) => horseById(id)?.look ?? {}
