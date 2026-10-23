import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  CanvasTexture,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  MeshBasicMaterial,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  TubeGeometry,
  CatmullRomCurve3,
  Vector2,
  Vector3,
  IcosahedronGeometry,
} from 'three'
import { LOBBY, PARTNER, SPAWN } from './config.js'
import { buildTrack } from './track.js'
import { createHorse } from './horse.js'
import { createCompanions } from './companions.js'
import { buildDefaultCharacter, loadBaseCharacter } from './avatar/character.js'
import { applyProportions, attachEquippedAccessories } from './avatar/loader.js'
import { disposeAnimator, makeAnimator } from './avatar/animator.js'
import { paintFade, paintSoftDot } from './textures.js'
import { trailTexture } from './trailTextures.js'
import { buildLeaderboard } from './plaza.js'
import { fontReady, glow, label, neon, put, solidBox, solidPole, std } from './propkit.js'
import { createEmitter } from './particles.js'
import { partnerModel } from './companions.js'
import { short } from './interact.js'
import { buildWestScenery } from './westScenery.js'
import { bake } from './bake.js'
import {
  buildCandyCane,
  buildChristmasTree,
  buildGift,
  buildLampPost,
  buildPine,
  buildSnowman,
  buildStringLights,
  buildTent,
  buildWreath,
} from './decor.js'

// Everything standing on the plaza, laid out like the reference's north view from the
// spawn looking toward the RACE arch (-Z):
//  - the wooden RACE arch at the yard's front edge: two square posts, a beam overhanging
//    them, the RACE sign (checkered flags) hanging under it, a glowing gold start line, and
//    the road with striped barriers out into the meadow (track.js); lantern posts either
//    side, wooden post-and-rail fences along the front edges
//  - left: the Trails display (a horse galloping in place over a glowing ring, a lava trail
//    streaming off behind it, a low stone wall; the ring is the Trails hub pad, hub.js) and
//    the world portal, an arch of snow blocks with its destination and requirements written
//    on the glowing fill (worlds.js)
//  - right: the Power / Wins / Rebirth leaderboards (plaza.js buildLeaderboard, fed with the
//    plaza's), each with a figure standing on it
//  - Christmas dressing (decor.js, LOBBY.festive): lights and a wreath on the arch, the big tree,
//    candy canes, a snowman, presents; pines and market tents past the fences
//  - the west view: the Partner stage (the partners on a raised stone stage with red carpets) in
//    front of the red barn (westScenery.js)
// The oaks and the wind pump are scenery, built per world (environment.js).
// Solid props get fixed colliders so the horse cannot ride through them.
const G = LOBBY.gate
const C = LOBBY.colors
const faceSpawn = (x, z) => Math.atan2(SPAWN.x - x, SPAWN.z - z) // yaw that turns +Z toward the spawn

// --- The RACE arch ----------------------------------------------------------------------
// A checkered flag on a pole, waving, `w` px wide, its pole at (x, y) leaning `lean` rad.
function checkerFlag(ctx, x, y, w, lean) {
  const h = w * 0.72
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(lean)
  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#1a1a1a'
  ctx.lineWidth = w * 0.09
  ctx.beginPath()
  ctx.moveTo(0, h * 0.25)
  ctx.lineTo(0, -h * 1.15)
  ctx.stroke()
  const cols = 5
  const rows = 4
  const wave = (u) => Math.sin(u * Math.PI * 1.6) * h * 0.1
  // Outline first, then the squares.
  const corner = (u, v) => [u * w, -h * 1.1 + v * h + wave(u)]
  ctx.fillStyle = '#1a1a1a'
  ctx.beginPath()
  for (let i = 0; i <= 10; i++) ctx.lineTo(...corner(i / 10, 0))
  for (let i = 10; i >= 0; i--) ctx.lineTo(...corner(i / 10, 1))
  ctx.closePath()
  ctx.lineWidth = w * 0.07
  ctx.stroke()
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = (r + c) % 2 ? '#ffffff' : '#1a1a1a'
      const [ax, ay] = corner(c / cols, r / rows)
      const [bx, by] = corner((c + 1) / cols, r / rows)
      const [cx, cy] = corner((c + 1) / cols, (r + 1) / rows)
      const [dx, dy] = corner(c / cols, (r + 1) / rows)
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.lineTo(bx, by)
      ctx.lineTo(cx, cy)
      ctx.lineTo(dx, dy)
      ctx.closePath()
      ctx.fill()
    }
  ctx.restore()
}

function raceSignTexture() {
  const S = G.sign
  const c = document.createElement('canvas')
  c.width = 1400
  c.height = Math.round((1400 * S.height) / S.width)
  const draw = () => {
    const ctx = c.getContext('2d')
    const { width: W, height: H } = c
    ctx.fillStyle = C.woodDark
    ctx.fillRect(0, 0, W, H)
    // Planks: darker seams and a lighter frame.
    ctx.fillStyle = 'rgba(0,0,0,0.16)'
    for (let i = 1; i < 4; i++) ctx.fillRect(0, (H * i) / 4 - 2, W, 4)
    ctx.strokeStyle = C.wood
    ctx.lineWidth = 22
    ctx.strokeRect(11, 11, W - 22, H - 22)
    checkerFlag(ctx, W * 0.15, H * 0.72, 150, -0.32)
    checkerFlag(ctx, W * 0.74, H * 0.72, 150, 0.12)
    ctx.font = '700 190px Fredoka, "Arial Black", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 18
    ctx.strokeStyle = '#3a2000'
    ctx.strokeText('RACE', W / 2, H / 2 + 10)
    ctx.fillStyle = '#ffd21a'
    ctx.fillText('RACE', W / 2, H / 2 + 10)
  }
  draw()
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 8
  fontReady.then(() => {
    draw()
    tex.needsUpdate = true
  })
  return tex
}

function buildGate(root, animated) {
  const hw = G.halfWidth
  const gate = new Group()
  gate.position.z = G.z
  root.add(gate)

  const frame = new Group() // the static woodwork, baked below
  const wood = std(C.wood, { roughness: 0.75 })
  const woodLight = std(C.woodLight, { roughness: 0.75 })
  for (const side of [-1, 1]) {
    put(frame, new BoxGeometry(G.post, G.postHeight, G.post), wood, side * hw, G.postHeight / 2, 0)
    put(frame, new BoxGeometry(G.post + 0.3, 0.35, G.post + 0.3), woodLight, side * hw, G.postHeight + 0.17, 0)
    put(frame, new BoxGeometry(G.post + 0.4, 0.6, G.post + 0.4), woodLight, side * hw, 0.3, 0) // foot
    solidBox(G.post / 2, G.postHeight / 2, G.post / 2, side * hw, G.postHeight / 2, G.z)
  }
  // The beam across, overhanging the posts, with a lighter cap.
  const beamW = 2 * (hw + G.overhang)
  put(frame, new BoxGeometry(beamW, G.beamHeight, G.beamDepth), wood, 0, G.beamY, 0)
  put(frame, new BoxGeometry(beamW + 0.2, 0.3, G.beamDepth + 0.2), woodLight, 0, G.beamY + G.beamHeight / 2 + 0.15, 0)

  // The RACE sign on two hangers, the same on both faces.
  const S = G.sign
  const face = std('#ffffff', { map: raceSignTexture(), roughness: 0.7 })
  const edge = std(C.woodDark, { roughness: 0.75 })
  put(gate, new BoxGeometry(S.width, S.height, 0.5), [edge, edge, edge, edge, face, face], 0, S.y, 0)
  const hangTop = G.beamY - G.beamHeight / 2
  const hangBottom = S.y + S.height / 2
  for (const s of [-1, 1]) put(frame, new BoxGeometry(0.7, hangTop - hangBottom + 0.2, 0.5), wood, s * S.hangers, (hangTop + hangBottom) / 2, 0)

  // The glowing gold start line between the posts.
  const padMat = std(C.pad, { emissive: '#ffb000', emissiveIntensity: 0.55, roughness: 0.4 })
  put(gate, new BoxGeometry(hw * 2 + 1.6, 0.3, G.padDepth), padMat, 0, 0.15, 0, false).receiveShadow = true
  // A low glow rising off it, so the strip reads from the spawn's shallow angle.
  const fade = new CanvasTexture(paintFade('#ffc21a'))
  fade.colorSpace = SRGBColorSpace
  const glowMat = new MeshBasicMaterial({ map: fade, transparent: true, opacity: 0.6, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, fog: false })
  put(gate, new PlaneGeometry(hw * 2 + 1.6, 1.4), glowMat, 0, 0.9, G.padDepth / 2, false)
  animated.push((t) => (glowMat.opacity = 0.5 + Math.sin(t * 2.6) * 0.12))

  // Christmas: string lights sagging across the beam's front, a wreath in the middle.
  if (LOBBY.festive) {
    const fz = G.beamDepth / 2 + 0.2
    const ends = hw + G.overhang - 0.6
    const y = G.beamY + G.beamHeight / 2 - 0.2
    buildStringLights(gate, [[-ends, y, fz], [0, y - 0.3, fz], [ends, y, fz]], 1.7)
    buildWreath(frame, 0, G.beamY - 0.2, fz + 0.25, 1.5)
  }
  gate.add(bake(frame, true))

  // The road and its barriers out from the posts (hidden while racing: race.js draws a longer,
  // scrolling one).
  const lane = buildTrack(LOBBY.lane.length)
  gate.add(lane)
  return lane
}

// --- Fences -----------------------------------------------------------------------------
// Post-and-rail fences along LOBBY.fence.lines: every post in one InstancedMesh, two rails and a
// collider per segment.
function buildFences(root) {
  const F = LOBBY.fence
  const wood = std(C.wood, { roughness: 0.8 })
  const cap = std(C.woodLight, { roughness: 0.8 })
  const spots = []
  const rails = new Group()
  for (const line of F.lines) {
    for (let i = 0; i < line.length - 1; i++) {
      const [ax, az] = line[i]
      const [bx, bz] = line[i + 1]
      const len = Math.hypot(bx - ax, bz - az)
      const yaw = Math.atan2(-(bz - az), bx - ax)
      const n = Math.max(1, Math.round(len / F.spacing))
      for (let k = i ? 1 : 0; k <= n; k++) spots.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n])
      const mx = (ax + bx) / 2
      const mz = (az + bz) / 2
      for (const y of F.rails) put(rails, new BoxGeometry(len, F.rail[0], F.rail[1]), wood, mx, y, mz).rotation.y = yaw
      solidBox(len / 2, F.height / 2, 0.35, mx, F.height / 2, mz, yaw)
    }
  }
  const m = new Matrix4()
  const posts = new InstancedMesh(new BoxGeometry(F.post, F.height, F.post), wood, spots.length)
  const caps = new InstancedMesh(new BoxGeometry(F.post + 0.16, 0.16, F.post + 0.16), cap, spots.length)
  spots.forEach(([x, z], i) => {
    posts.setMatrixAt(i, m.makeTranslation(x, F.height / 2, z))
    caps.setMatrixAt(i, m.makeTranslation(x, F.height + 0.08, z))
  })
  posts.castShadow = posts.receiveShadow = true
  root.add(posts, caps, bake(rails, true))
}

// --- Figures ----------------------------------------------------------------------------
// A rider seated on a display horse, built in the horse's `rider` frame (+Z forward): hips on the
// saddle, thighs round the barrel, hands forward on the reins.
function makeRider(look) {
  const g = new Group()
  const hipY = 0.54
  const shirt = std(look.torso)
  const pants = std(look.legs)
  put(g, new BoxGeometry(0.5, 0.56, 0.28), shirt, 0, hipY + 0.3, -0.02).rotation.x = 0.18
  put(g, new BoxGeometry(0.36, 0.36, 0.36), std(look.skin ?? '#f2c79a'), 0, hipY + 0.78, 0.06)
  put(g, new BoxGeometry(0.4, 0.14, 0.4), std(look.hair ?? '#ffd21a'), 0, hipY + 0.99, 0.04)
  for (const s of [-1, 1]) {
    const arm = put(g, new BoxGeometry(0.16, 0.5, 0.16), shirt, s * 0.32, hipY + 0.42, 0.18)
    arm.rotation.x = -0.9
    const thigh = put(g, new BoxGeometry(0.18, 0.18, 0.46), pants, s * 0.34, hipY - 0.02, 0.14)
    thigh.rotation.y = s * 0.2
    put(g, new BoxGeometry(0.16, 0.5, 0.18), pants, s * 0.44, hipY - 0.3, 0.3)
  }
  return g
}

// --- The Trails display ----------------------------------------------------------------
// A horse galloping in place nose +X, a lava trail streaming off behind it, a rider, a low wall
// of grey stone blocks at its back and the "Trails" sign; the glowing ring under it is the
// Trails hub pad (hub.js).
function buildTrailsDisplay(root, animated) {
  const T = LOBBY.trails
  const g = new Group()
  g.position.set(T.x, 0, T.z)
  root.add(g)
  const horse = createHorse({ lite: true, engines: false })
  horse.setLook({})
  horse.root.scale.setScalar(T.horseScale)
  horse.root.rotation.y = Math.PI / 2
  g.add(horse.root)
  horse.rider.add(bake(makeRider({ torso: '#2f6bff', legs: '#26262e', hair: '#ffd21a' }), true))
  animated.push((t, dt) => horse.update(dt || 1 / 60, 13, 0, t))

  // Lava trail: an upright band toward -X from the hind legs, its texture streaming back.
  const map = trailTexture('magma').clone()
  map.needsUpdate = true
  map.wrapS = RepeatWrapping
  map.repeat.set(T.trailLength / 3.4, 1)
  const trailMat = new MeshBasicMaterial({ map, transparent: true, side: DoubleSide, depthWrite: false })
  const trail = put(g, new PlaneGeometry(T.trailLength, 1.5), trailMat, -T.trailLength / 2 - 1.2, 1.9, 0, false)
  trail.rotation.y = 0 // faces +Z: the spawn side
  animated.push((t, dt) => (map.offset.x += (dt || 1 / 60) * 2.2))
  createEmitter(root, {
    boxes: [{ x: T.x - 3, y: 1.9, z: T.z, sx: 2, sy: 0.6, sz: 0.4 }],
    count: 30, life: 1.1, velocity: [-4, 0.6, 0], spread: [1.5, 0.6, 0.4], gravity: 1,
    size: 0.22, color: '#ffb347', intensity: 4, twinkle: 9, seed: 71,
  })

  // The stone wall behind: grey blocks of uneven height.
  const W = T.wall
  const stone = [std('#9aa0a8', { roughness: 0.95 }), std('#868c95', { roughness: 0.95 }), std('#aab0b8', { roughness: 0.95 })]
  const wall = new Group()
  let x = W.from
  let k = 0
  while (x < W.to - 0.5) {
    const w = Math.min(W.to - x, 1.8 + ((k * 7) % 5) * 0.35)
    const h = 2.2 + ((k * 5) % 4) * 0.4
    put(wall, new BoxGeometry(w - 0.08, h, W.depth), stone[k % 3], x + w / 2, h / 2, W.z)
    put(wall, new BoxGeometry(w - 0.3, 0.5, W.depth * 0.6), stone[(k + 1) % 3], x + w / 2, h + 0.25, W.z - 0.3)
    x += w
    k++
  }
  root.add(bake(wall, true))
  solidBox((W.to - W.from) / 2, 1.6, W.depth / 2, (W.from + W.to) / 2, 1.6, W.z)

  const tag = label('Trails', 1.5, { color: '#ffc21a', outline: '#3a2000', outlineWidth: 14 })
  tag.position.set(0, 6.4, 0)
  g.add(tag)
}

// --- The world portal -------------------------------------------------------------------
// An arch of snow blocks round a glowing fill, snow heaped at its feet, facing the spawn. The fill
// carries the sign (setSign: destination + requirements, like the reference's Snow portal).
function buildPortal(root, animated) {
  const P = LOBBY.portal
  const g = new Group()
  g.position.set(P.x, 0, P.z)
  g.rotation.y = faceSpawn(P.x, P.z)
  root.add(g)
  const r = P.width / 2
  const straight = P.height - r // the opening's straight sides
  // The blocks: along the centre line of the frame, up one side, over, down the other.
  const centre = r + P.frame / 2
  const path = []
  for (let i = 0; i < 3; i++) path.push([-centre, (straight * (i + 0.5)) / 3, 0])
  const arcN = 7
  for (let i = 0; i < arcN; i++) {
    const a = Math.PI - (Math.PI * (i + 0.5)) / arcN
    path.push([Math.cos(a) * centre, straight + Math.sin(a) * centre, a])
  }
  for (let i = 2; i >= 0; i--) path.push([centre, (straight * (i + 0.5)) / 3, 0])
  const snow = [std('#f4f9ff', { roughness: 0.85 }), std('#dfeeff', { roughness: 0.85 })]
  const blocks = new Group()
  path.forEach(([x, y, a], i) => {
    const arc = i >= 3 && i < 3 + arcN
    const len = arc ? (Math.PI * centre) / arcN + 0.1 : straight / 3 + 0.1
    const b = put(blocks, new BoxGeometry(P.frame * 1.08, len, P.depth), snow[i % 2], x, y, 0)
    if (arc) b.rotation.z = a - Math.PI / 2
    b.scale.x = 1 + (i % 3) * 0.04
  })
  put(blocks, new BoxGeometry(P.width + P.frame * 2.4, 0.5, P.depth + 0.6), snow[1], 0, 0.25, 0) // threshold
  // Snow heaped round its feet.
  const heap = new IcosahedronGeometry(1, 2)
  for (const [x, z, s] of [[-centre - 1.4, 0.6, 1.6], [centre + 1.2, 0.8, 1.4], [-centre + 0.4, 1.4, 1.1], [centre + 2.6, -0.2, 1]]) {
    const m = put(blocks, heap, snow[0], x, 0, z)
    m.scale.set(s * 1.4, s * 0.55, s)
  }
  g.add(bake(blocks, true))
  const yaw = g.rotation.y
  for (const s of [-1, 1]) solidBox(P.frame / 2, P.height / 2, P.depth / 2, P.x + Math.cos(yaw) * s * centre, P.height / 2, P.z - Math.sin(yaw) * s * centre, yaw)

  // The fill: the opening's shape, UVs 0..1 over its bounds, a canvas face.
  const shape = new Shape()
  shape.moveTo(-r, 0)
  shape.lineTo(r, 0)
  shape.lineTo(r, straight)
  shape.absarc(0, straight, r, 0, Math.PI, false)
  shape.closePath()
  const fillGeo = new ShapeGeometry(shape, 20)
  const pos = fillGeo.attributes.position
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) + r) / P.width
    uv[i * 2 + 1] = pos.getY(i) / P.height
  }
  fillGeo.setAttribute('uv', new BufferAttribute(uv, 2))
  const canvas = document.createElement('canvas')
  canvas.width = 384
  canvas.height = Math.round((384 * P.height) / P.width)
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  const fillMat = new MeshBasicMaterial({ map: tex, side: DoubleSide })
  put(g, fillGeo, fillMat, 0, 0.02, 0, false)
  // The gold glow round the opening.
  const rimPts = [new Vector3(-r, 0, 0), new Vector3(-r, straight, 0)]
  for (let i = 1; i < 12; i++) {
    const a = Math.PI - (Math.PI * i) / 12
    rimPts.push(new Vector3(Math.cos(a) * r, straight + Math.sin(a) * r, 0))
  }
  rimPts.push(new Vector3(r, straight, 0), new Vector3(r, 0, 0))
  const rimMat = neon('#ffc21a', 2.4)
  put(g, new TubeGeometry(new CatmullRomCurve3(rimPts, false, 'catmullrom', 0.1), 48, 0.13, 6, false), rimMat, 0, 0, 0.12, false)
  const rimBase = rimMat.color.clone()
  animated.push((t) => rimMat.color.copy(rimBase).multiplyScalar(0.85 + Math.sin(t * 2.4) * 0.15))

  let sign = null
  // lines: [[text, colour]], the destination first; open: the fill glows brighter when it is.
  function setSign(lines, open, force = false) {
    const next = JSON.stringify([lines, open])
    if (next === sign && !force) return
    sign = next
    const ctx = canvas.getContext('2d')
    const { width: W, height: H } = canvas
    const bg = ctx.createRadialGradient(W / 2, H * 0.55, 10, W / 2, H * 0.55, W * 0.9)
    bg.addColorStop(0, open ? '#9a2a1a' : '#6a1414')
    bg.addColorStop(1, open ? '#3a0808' : '#240405')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    lines.forEach(([text, color], i) => {
      const size = i ? 30 : 44
      ctx.font = `700 ${size}px Fredoka, "Segoe UI Emoji", sans-serif`
      let px = size
      while (px > 14 && ctx.measureText(text).width > W * 0.86) ctx.font = `700 ${--px}px Fredoka, "Segoe UI Emoji", sans-serif`
      const y = H * 0.46 + (i - (lines.length - 1) / 2) * 50 - (i ? 0 : 6)
      ctx.lineWidth = 8
      ctx.strokeStyle = '#1a0406'
      ctx.strokeText(text, W / 2, y)
      ctx.fillStyle = color
      ctx.fillText(text, W / 2, y)
    })
    tex.needsUpdate = true
  }
  setSign([['Frontier Town', '#ffffff']], true)
  fontReady.then(() => setSign(...JSON.parse(sign), true)) // repaint in Fredoka
  // Where driving in uses it: just in front of the opening, toward the spawn.
  const out = 2.6
  return { x: P.x + Math.sin(yaw) * out, z: P.z + Math.cos(yaw) * out, setSign }
}

// --- Leaderboards -----------------------------------------------------------------------
// Power / Wins / Rebirth facing the spawn, the board's top player standing on each: their Bloxity
// avatar and equipped pets (the server's row 0, set through board.setTop by the plaza's feed).
function buildTopFigure(holder, animated) {
  const spot = new Group() // the board's top edge
  spot.position.set(0, 7.42, 0.1)
  holder.add(spot)
  const pets = new Group()
  pets.position.copy(spot.position)
  pets.scale.setScalar(0.6)
  holder.add(pets)
  const companions = createCompanions(pets, new Group())
  let avatar = null
  let animator = null
  let shown = null // the look json currently built, null = none
  let generation = 0
  let petKey = null

  const place = (next) => {
    if (avatar) spot.remove(avatar)
    disposeAnimator(animator)
    avatar = next
    animator = null
    if (!next) return
    next.scale.multiplyScalar(1.3)
    next.traverse((o) => o.isMesh && (o.castShadow = false))
    spot.add(next)
    animator = makeAnimator(next)
  }

  animated.push((t, dt) => {
    animator?.update(dt || 1 / 60, { grounded: true, speed: 0, verticalVelocity: 0, turn: 0, riding: false })
    companions.update(dt || 1 / 60, t, 0, 0, 0, Math.PI) // heading round: the pets float in front
  })

  return async (row) => {
    const look = row ? row.avatar || '' : null
    const petList = row?.pets ?? ''
    if (petList !== petKey) {
      petKey = petList
      companions.setPets(petList ? petList.split(',').map((x) => ({ kind: x.split(':')[0], tier: Number(x.split(':')[1]) || 0 })) : [])
    }
    if (look === shown) return
    shown = look
    const mine = ++generation
    if (look === null) return place(null)
    let parsed = null
    try {
      parsed = look ? JSON.parse(look) : null
    } catch {}
    if (!parsed) return place(buildDefaultCharacter())
    try {
      const group = await loadBaseCharacter()
      await attachEquippedAccessories(group, parsed.equipped, { skinTextureUrl: parsed.skin || undefined })
      if (mine !== generation) return
      applyProportions(group, parsed.proportions)
      place(group)
    } catch (err) {
      console.warn('[lobby] top player avatar failed to load', err)
      if (mine === generation) place(buildDefaultCharacter())
    }
  }
}

function buildBoards(root, animated) {
  const s = LOBBY.boardScale
  return LOBBY.boards.map((b) => {
    // Turned toward LOBBY.boardFacing (the open sand in front of the eggs: face-on from the east
    // view, angled from the north one, like the reference) and leaning back a little.
    const [fx, fz] = LOBBY.boardFacing
    const g = new Group()
    g.position.set(b.x, 0, b.z)
    g.rotation.y = Math.atan2(fx - b.x, fz - b.z)
    g.scale.setScalar(s)
    root.add(g)
    const lean = new Group()
    lean.rotation.x = -LOBBY.boardLean
    g.add(lean)
    const board = buildLeaderboard(lean, b.stat, b.style)
    board.setTop = buildTopFigure(lean, animated)
    solidBox(2.5 * s, 3.9 * s, 0.4 * s, b.x, 3.9 * s, b.z, g.rotation.y)
    return board
  })
}

// --- Christmas dressing and scenery past the fences ----------------------------------------
function buildDecor(root) {
  const props = new Group()
  for (const [x, z, h] of LOBBY.pines) buildPine(props, x, z, h)
  for (const t of LOBBY.tents) buildTent(props, t)
  if (LOBBY.festive) {
    buildChristmasTree(props, LOBBY.tree)
    for (const c of LOBBY.canes) buildCandyCane(props, c)
    buildSnowman(props, LOBBY.snowman, SPAWN.x, SPAWN.z)
    for (const gift of LOBBY.gifts) {
      buildGift(props, gift)
      solidBox(gift[2] / 2, gift[2] * 0.42, gift[2] / 2, gift[0], gift[2] * 0.42, gift[1], gift[5] ?? 0)
    }
  }
  const wood = std(C.wood, { roughness: 0.8 })
  for (const lamp of LOBBY.lamps) buildLampPost(props, lamp, LOBBY.lampHeight, wood, 0)
  root.add(bake(props, true))
}

// --- The Partner stage (west) ----------------------------------------------------------------
// A raised stone stage, front (+Z in its frame) toward the spawn: two steps up the front (each
// under the controller's autostep, so the horse can ride up), four red carpets with gold edges
// running down them, a low stone wall along the back and a pink glow along its foot. The partners
// (LOBBY.partner.show) stand on it in a row, each with its name and price over it; each one's spot
// goes into `spots` for its interact prompt (buy / equip, interact.js).
function buildPartnerStage(root, animated, spots) {
  const S = LOBBY.partner
  const g = new Group()
  g.position.set(S.x, 0, S.z)
  g.rotation.y = faceSpawn(S.x, S.z)
  root.add(g)
  const yaw = g.rotation.y
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  const world = (lx, lz) => [S.x + lx * cos + lz * sin, S.z - lx * sin + lz * cos]
  const L = S.length
  const D = S.depth
  const H = S.height
  const stone = [std('#a3a8b0', { roughness: 0.95 }), std('#9098a2', { roughness: 0.95 }), std('#b4b9c0', { roughness: 0.95 })]
  const body = new Group() // baked below
  // The stage: a row of stone blocks, then two steps along the front.
  const blocks = 8
  for (let i = 0; i < blocks; i++) put(body, new BoxGeometry(L / blocks - 0.06, H, D), stone[i % 3], -L / 2 + (i + 0.5) * (L / blocks), H / 2, 0)
  put(body, new BoxGeometry(L + 0.3, 0.14, D + 0.3), stone[2], 0, H + 0.02, 0) // a pale lip on top
  const stepD = S.step / 2
  for (const k of [1, 2]) {
    const h = H * (1 - k / 3)
    put(body, new BoxGeometry(L - 0.6, h, stepD), stone[k % 3], 0, h / 2, D / 2 + stepD * (k - 0.5))
  }
  // Red carpets with gold edges: over the stage's front half, down the steps, out onto the ground.
  const red = std('#c8202a', { roughness: 0.8 })
  const gold = std('#ffc21a', { emissive: '#ffb000', emissiveIntensity: 0.35, roughness: 0.5 })
  const W = S.carpet
  for (const cx of S.carpets) {
    const runs = [
      [H + 0.1, D * 0.55, D / 2 - D * 0.275],
      [(H * 2) / 3 + 0.03, stepD, D / 2 + stepD * 0.5],
      [H / 3 + 0.03, stepD, D / 2 + stepD * 1.5],
      [0.04, 1.6, D / 2 + stepD * 2 + 0.8],
    ]
    for (const [y, d, z] of runs) {
      put(body, new BoxGeometry(W, 0.06, d), red, cx, y, z)
      for (const s of [-1, 1]) put(body, new BoxGeometry(0.26, 0.07, d), gold, cx + s * (W / 2 - 0.2), y + 0.01, z)
    }
  }
  // The low stone wall at the back, blocks of uneven height.
  let x = -L / 2
  let k = 0
  while (x < L / 2 - 0.3) {
    const w = Math.min(L / 2 - x, 1.6 + ((k * 7) % 5) * 0.3)
    const h = S.wall + ((k * 5) % 4) * 0.25
    put(body, new BoxGeometry(w - 0.06, h, 1.1), stone[(k + 1) % 3], x + w / 2, H + h / 2, -D / 2 + 0.55)
    x += w
    k++
  }
  g.add(bake(body, true))
  // Colliders: the stage and its two steps (each lower than the autostep), the wall.
  const [cx, cz] = world(0, 0)
  solidBox(L / 2, H / 2, D / 2, cx, H / 2, cz, yaw)
  for (const k of [1, 2]) {
    const h = H * (1 - k / 3)
    const [sx, sz] = world(0, D / 2 + stepD * (k - 0.5))
    solidBox((L - 0.6) / 2, h / 2, stepD / 2, sx, h / 2, sz, yaw)
  }
  const [wx, wz] = world(0, -D / 2 + 0.55)
  solidBox(L / 2, (H + S.wall) / 2, 0.55, wx, (H + S.wall) / 2, wz, yaw)

  // A pink glow along the stage's foot, like the reference's.
  const fade = new CanvasTexture(paintFade('#ff6ad8'))
  fade.colorSpace = SRGBColorSpace
  const glowMat = new MeshBasicMaterial({ map: fade, transparent: true, opacity: 0.5, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, fog: false })
  put(g, new PlaneGeometry(L + 1, 1.2), glowMat, 0, 0.6, D / 2 + S.step + 0.05, false)
  animated.push((t) => (glowMat.opacity = 0.4 + Math.sin(t * 2) * 0.1))

  // The partners: each its own figure (companions.js), name + price over it, a soft pool of its
  // colour at its feet and sparkles round it.
  const auraTex = new CanvasTexture(paintSoftDot(128))
  auraTex.colorSpace = SRGBColorSpace
  const sparkleBoxes = []
  const n = S.show.length
  S.show.forEach((id, i) => {
    const def = PARTNER.partners.find((p) => p.id === id)
    if (!def) return
    const lx = -L / 2 + ((i + 0.5) * L) / n
    const lz = -0.4
    const fig = partnerModel(id)
    fig.scale.setScalar(S.scale)
    fig.position.set(lx, H + 0.08, lz)
    fig.rotation.y = (i - (n - 1) / 2) * -0.05
    fig.castShadow = true
    g.add(fig)
    const tag = label(`${def.name}\n🏆 ${short(def.price)}`, 0.8, { colors: [def.tint, '#ffe14a'], outline: '#1a0a14', font: '700 64px Fredoka, "Segoe UI Emoji", sans-serif', outlineWidth: 10 })
    tag.position.set(lx, H + 2.6 * S.scale + 0.5, lz)
    g.add(tag)
    const pool = new Sprite(new SpriteMaterial({ map: auraTex, color: def.tint, transparent: true, opacity: 0.45, blending: AdditiveBlending, depthWrite: false }))
    pool.scale.set(2.2, 2.2, 1)
    pool.position.set(lx, H + 0.9, lz)
    g.add(pool)
    const [px, pz] = world(lx, lz)
    spots.push({ partner: id, x: px, y: H + 2.4 * S.scale, z: pz })
    solidBox(0.45 * S.scale, 0.95 * S.scale, 0.3 * S.scale, px, H + 0.95 * S.scale, pz, yaw)
    sparkleBoxes.push({ x: px, y: H + 1.2 * S.scale, z: pz, sx: 0.7, sy: 1.1, sz: 0.7, color: def.tint })
  })
  createEmitter(root, {
    boxes: sparkleBoxes, count: 70, life: 2.2, velocity: [0, 0.5, 0], spread: [0.25, 0.25, 0.25],
    size: 0.38, intensity: 3, twinkle: 7, sprite: 'sparkle', seed: 62,
  })
}

export function createLobby(scene) {
  const root = new Group()
  root.name = 'lobby'
  scene.add(root)
  const animated = [] // fn(elapsed, dt) per animated prop

  const lane = buildGate(root, animated)
  buildFences(root)
  buildDecor(root)
  buildTrailsDisplay(root, animated)
  const portal = buildPortal(root, animated)
  const boards = buildBoards(root, animated)
  // Where each shop object's interact prompt sits (interact.js).
  const spots = { statues: [] }
  buildPartnerStage(root, animated, spots.statues)
  buildWestScenery(root)

  return {
    spots,
    // The world portal: where driving in uses it, and its sign (worlds.js).
    portal,
    // The north leaderboards, for createPlaza to keep fed.
    boards,
    setLaneVisible: (on) => (lane.visible = on),
    update(dt, elapsed) {
      for (const fn of animated) fn(elapsed, dt)
    },
  }
}
