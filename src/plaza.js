import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  MeshBasicMaterial,
  PlaneGeometry,
  RepeatWrapping,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
} from 'three'
import { PLAZA } from './config.js'
import { short } from './interact.js'
import { createEmitter } from './particles.js'
import { paintAsphalt, paintPlanks, paintSoftDot, paintStripes, paintSwirl, paintText, paintTreadmill, toTexture } from './textures.js'
import { createHorse } from './horse.js'
import { horseById, horseLook } from './horseModels.js'
import { buildWindPump, fontReady, label, neon, put, solidBox, solidPole, std } from './propkit.js'
import { bake } from './bake.js'
import { buildCandyCane, buildGift, buildPine, buildSanta, buildSnowman, buildSnowyTree, buildStringLights } from './decor.js'

// The training plaza at the back of the ranch (+Z), laid out like the
// reference's south view from the spawn:
//  - grey pavement under two Train stations and a road between them to the portal
//  - each station: a green field with a white curb, six treadmills (a dark ribbed belt with
//    glowing chevrons streaming toward you between two glowing rails, a console at the far
//    end with a flickering screen, a glow pool under it), lock / requirement tags floating
//    over the consoles, a low stone wall with string lights at the back, the big "Train"
//    sign
//  - the ring portal on a snow mound in the middle (to the Frontier Town and back:
//    worlds.js): a red octagon ring with a green rim round a turning swirl, a present on top,
//    the destination and requirements floating over it, candy-striped poles with lights
//  - behind it the snowy Christmas tree on a patch of snow, candy canes, an autumn pine; left
//    (+X): the Golden Machine, the Collection kiosk, the snowman and a windmill; right (-X):
//    Forest Relics and a treasure chest (the cliffs, pines and far mountains ringing it all
//    are scenery, built per world: environment.js)
//  - particles (particles.js): snow falling over the plaza, sparkles round the portal and the
//    tree, motes rising off every treadmill and streaks running back along each belt
// Glowing parts are HDR-bright (neon rails, belts, the portal) so the bloom pass makes them
// shine; without bloom they still read as saturated colour. Platforms and treadmills are low
// enough to ride onto; everything else is solid. Static parts are baked (bake.js).
const P = PLAZA

function canvasTexture(c, repeatX = 1, repeatY = 1) {
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.wrapS = t.wrapT = RepeatWrapping
  t.repeat.set(repeatX, repeatY)
  t.anisotropy = 4
  return t
}

// A flat sign face with text on it (canvas sized to the text; '\n' for lines).
function textFace(text, color, bg, colors = null) {
  const t = paintText(text, { color, colors, bg, outline: null, font: '700 72px Fredoka, "Segoe UI Emoji", sans-serif', pad: 18 })
  return canvasTexture(t.canvas)
}

// Turn a prop so its front (+Z) faces a point on the ground.
const face = (obj, tx, tz) => (obj.rotation.y = Math.atan2(tx - obj.position.x, tz - obj.position.z))

// A rounded rectangle [x0, z0, x1, z1, r] as a Shape whose (x, y) are world (x, -z).
function roundedRect([x0, z0, x1, z1, r]) {
  const s = new Shape()
  const [a, b, c, d] = [x0, -z1, x1, -z0]
  s.moveTo(a + r, b)
  s.lineTo(c - r, b)
  s.quadraticCurveTo(c, b, c, b + r)
  s.lineTo(c, d - r)
  s.quadraticCurveTo(c, d, c - r, d)
  s.lineTo(a + r, d)
  s.quadraticCurveTo(a, d, a, d - r)
  s.lineTo(a, b + r)
  s.quadraticCurveTo(a, b, a + r, b)
  return s
}

// --- Ground ---------------------------------------------------------------------------------
// The grey pavement (one ShapeGeometry, UVs in metres) and the patch of snow round the tree.
function buildGround(root) {
  const geo = new ShapeGeometry(P.pavement.map(roundedRect), 6)
  geo.rotateX(-Math.PI / 2)
  const map = toTexture(paintAsphalt(256, 405, '#7a7d86', '#8d9099'), { repeat: 1 / 8, srgb: true })
  const pave = put(root, geo, std('#ffffff', { map, roughness: 0.95 }), 0, 0.025, 0, false)
  pave.receiveShadow = true
  const S = P.snow
  const snow = put(root, new CircleGeometry(1, 40), std('#f4f8ff', { roughness: 0.9 }), S.x, 0.04, S.z, false)
  snow.rotation.x = -Math.PI / 2
  snow.scale.set(S.rx, S.rz, 1)
  snow.receiveShadow = true
}

// --- The ring portal ------------------------------------------------------------------------
// A red octagon ring with a glowing green rim round a turning swirl, standing on a snow mound,
// a present on top and the sign floating over it (setSign: destination + requirements).
function buildPortal(root, animated) {
  const R = P.portal.radius
  const g = new Group()
  g.position.set(P.vip.x, 0, P.vip.z)
  root.add(g)
  const stat = new Group()
  const snow = std('#f4f8ff', { roughness: 0.85 })
  put(stat, new CylinderGeometry(5.2, 6, 1, 28), snow, 0, 0.5, 0)
  for (const [x, z, s] of [[-4.6, -2.6, 1.6], [4.4, -2.2, 1.4], [3.2, 3, 1.8], [-3.4, 3.2, 1.5]]) {
    const heap = put(stat, new SphereGeometry(1, 12, 8), snow, x, 0.7, z)
    heap.scale.set(s * 1.3, s * 0.6, s)
  }
  solidBox(4.5, 0.5, 3.5, P.vip.x, 0.5, P.vip.z)
  const y = P.portal.y
  const red = std('#d81f26', { roughness: 0.4 })
  const ring = put(stat, new TorusGeometry(R, 0.6, 8, 8), red, 0, y, 0)
  ring.rotation.z = Math.PI / 8 // a flat side at the bottom
  const rim = put(stat, new TorusGeometry(R - 0.45, 0.16, 6, 8), neon('#3dff6a', 2.4), 0, y, 0.25, false)
  rim.rotation.z = Math.PI / 8
  // Feet holding the ring on the mound.
  for (const s of [-1, 1]) put(stat, new BoxGeometry(0.9, 1.4, 1.0), red, s * R * 0.55, 1.4, 0)
  buildGift(stat, [0, 0, 1.6, '#e8262b', '#2bd14a', 0]).position.y = y + R + 0.35
  g.add(bake(stat, true))
  for (const s of [-1, 1]) solidBox(0.6, y, 0.6, P.vip.x + s * R, y, P.vip.z)

  const fillMat = new MeshBasicMaterial({ map: canvasTexture(paintSwirl(P.portal.open)), transparent: true, opacity: 0.92, side: DoubleSide })
  const fill = put(g, new CircleGeometry(R - 0.4, 32), fillMat, 0, y, 0, false)
  animated.push((t) => {
    fill.rotation.z = -t * 1.4
    fillMat.opacity = 0.85 + Math.sin(t * 2.2) * 0.07
  })

  // Candy-striped poles either side, string lights from their tops to the tree.
  const C = P.poles
  const stripes = toTexture(paintStripes('#e8262b', '#ffffff', 2, 128, 1), { srgb: true })
  stripes.wrapS = stripes.wrapT = RepeatWrapping
  stripes.repeat.set(1, C.height / 1.2)
  const poleMat = std('#ffffff', { map: stripes, roughness: 0.4 })
  const goldBall = std('#ffd21a', { metalness: 0.5, roughness: 0.3, emissive: '#ffb000', emissiveIntensity: 0.3 })
  for (const s of [-1, 1]) {
    const px = P.vip.x + s * C.dx
    const pz = P.vip.z + C.dz
    put(root, new CylinderGeometry(0.25, 0.25, C.height, 12), poleMat, px, C.height / 2, pz)
    put(root, new SphereGeometry(0.45, 14, 10), goldBall, px, C.height + 0.3, pz)
    solidPole(0.35, C.height, px, pz)
  }
  // Big bulbs sagging between the pole tops, across the front of the tree.
  buildStringLights(root, [[P.vip.x - C.dx, C.height - 0.3, P.vip.z + C.dz], [P.vip.x + C.dx, C.height - 0.3, P.vip.z + C.dz]], 2.6, undefined, 0.32)

  // The sign over the ring: the destination's name, then its requirements.
  const sign = new Sprite(new SpriteMaterial({ transparent: true, depthWrite: false, fog: false }))
  g.add(sign)
  let key = null
  let swirlOpen = true
  // lines: [[text, colour]], the destination first; open: the swirl's colour (open or locked).
  function setSign(lines, open, force = false) {
    const next = JSON.stringify([lines, open])
    if (next === key && !force) return
    key = next
    const colors = lines.map(([, c], i) => (i ? c : '#3dff6a'))
    const t = paintText(lines.map(([text]) => text).join('\n'), { colors, outline: '#0b2a12', font: '700 72px Fredoka, "Segoe UI Emoji", sans-serif', outlineWidth: 14 })
    sign.material.map?.dispose()
    const tex = new CanvasTexture(t.canvas)
    tex.colorSpace = SRGBColorSpace
    sign.material.map = tex
    sign.material.needsUpdate = true
    const h = 1.35 * lines.length
    sign.scale.set((h * t.canvas.width) / t.canvas.height, h, 1)
    sign.position.y = y + R + 2.4 + h / 2
    if (open !== swirlOpen) {
      swirlOpen = open
      fillMat.map.dispose()
      fillMat.map = canvasTexture(paintSwirl(open ? P.portal.open : P.portal.locked))
      fillMat.needsUpdate = true
    }
  }
  setSign([['Frontier Town', '#ffffff']], true)
  fontReady.then(() => setSign(...JSON.parse(key), true)) // repaint in Fredoka
  return setSign
}

// --- Train stations ----------------------------------------------------------------------
// One treadmill on its lane, in its own frame (+Z = the far end), placed in its station's frame:
// a dark deck, the belt (chevrons streaming toward the near end), two glowing side rails, a
// roller, a console at the far end (posts in the lane colour, handlebar, tilted head with a
// flickering screen and two buttons), a glow pool under it, and the tags over the console.
// Static parts go into `stat` (baked by the station); the belt, screen, pool and tags stay live.
function buildLane(parent, stat, x, z, spec, i, animated, glowTex) {
  const L = P.lane
  const M = P.mill
  const PH = P.platform.height
  const g = new Group()
  g.position.set(x, PH, z)
  parent.add(g)
  const s = new Group() // the static parts, at the same place inside `stat`
  s.position.copy(g.position)
  stat.add(s)
  const color = spec.neon[i]
  const len = L.length - 0.2
  const w = M.width
  const dark = std('#1b1e27', { roughness: 0.55 })
  put(s, new BoxGeometry(w, 0.28, len), dark, 0, 0.14, 0)
  // Rails: thick, glowing in the lane colour, a bright top edge.
  const railMat = std(color, { emissive: color, emissiveIntensity: 0.65, roughness: 0.35 })
  for (const sx of [-1, 1]) {
    put(s, new BoxGeometry(M.rail, 0.46, len), railMat, sx * (w / 2 - M.rail / 2), 0.23, 0)
    put(s, new BoxGeometry(M.rail + 0.04, 0.06, len + 0.04), neon(color, 1.8), sx * (w / 2 - M.rail / 2), 0.48, 0, false)
  }
  const roller = put(s, new CylinderGeometry(0.2, 0.2, w - 2 * M.rail, 12), std('#3a3f4c', { metalness: 0.5, roughness: 0.35 }), 0, 0.2, -len / 2 + 0.15)
  roller.rotation.z = Math.PI / 2
  // Console: two posts, a handlebar, the head tilted toward the runner.
  const H = M.consoleHeight
  const cz = len / 2 - 0.35
  for (const sx of [-1, 1]) put(s, new BoxGeometry(0.22, H, 0.22), railMat, sx * (w / 2 - 0.3), H / 2 + 0.2, cz)
  put(s, new BoxGeometry(w - 0.4, 0.14, 0.14), dark, 0, H * 0.72, cz - 0.25)
  const head = new Group()
  head.position.set(0, H + 0.3, cz)
  head.rotation.x = 0.55 // its face (-Z) tips up toward the runner
  s.add(head)
  put(head, new BoxGeometry(w - 0.2, 1.0, 0.32), dark, 0, 0, 0)
  put(head, new BoxGeometry(w - 0.1, 0.08, 0.36), railMat, 0, 0.52, 0)
  put(head, new SphereGeometry(0.1, 8, 6), neon('#ff3b3b', 1.6), w / 2 - 0.45, -0.2, -0.17, false)
  put(head, new SphereGeometry(0.1, 8, 6), neon('#3dff6a', 1.6), w / 2 - 0.75, -0.2, -0.17, false)
  // Live: the screen (flickers), the belt (scrolls) and a glow pool on the grass.
  const screenMat = std('#0d1a2e', { emissive: color, emissiveIntensity: 0.35, roughness: 0.3 })
  const screen = new Group()
  screen.position.copy(head.position)
  screen.rotation.copy(head.rotation)
  g.add(screen)
  put(screen, new PlaneGeometry(1.5, 0.62), screenMat, -0.3, 0.02, -0.17, false).rotation.y = Math.PI
  const belt = canvasTexture(paintTreadmill(color), 1, len / 2.6)
  const surface = put(g, new PlaneGeometry(w - 2 * M.rail, len - 0.2), std('#ffffff', { map: belt, emissiveMap: belt, emissive: '#ffffff', emissiveIntensity: 0.75, roughness: 0.7 }), 0, 0.29, 0, false)
  surface.rotation.x = -Math.PI / 2
  surface.receiveShadow = true
  const poolMat = new MeshBasicMaterial({ map: glowTex, color, transparent: true, opacity: 0.45, blending: AdditiveBlending, depthWrite: false })
  const pool = put(g, new PlaneGeometry(w + 3, len + 3), poolMat, 0, 0.02, 0, false)
  pool.rotation.x = -Math.PI / 2

  // Tags over the console: lock + requirement + power while locked, the power once open.
  const tagStyle = { outline: '#0b1020', font: '700 52px Fredoka, "Segoe UI Emoji", sans-serif', outlineWidth: 9 }
  const tag = label(`🔒\n${spec.req[i]} Required\n${spec.power[i]} Power`, 2.1, { ...tagStyle, colors: ['#ffd21a', '#7dff6a', '#ffffff'] })
  tag.position.set(0, H + 2.6, cz)
  g.add(tag)
  const open = label(`⚡ ${spec.power[i]} Power`, 0.8, { ...tagStyle, color: '#7dff6a' })
  open.position.set(0, H + 1.8, cz)
  open.visible = false
  g.add(open)
  const phase = i * 1.3
  animated.push((t, dt) => {
    belt.offset.y -= dt * 1.6
    screenMat.emissiveIntensity = 0.3 + 0.12 * Math.sin(t * 9 + phase) + (Math.sin(t * 23 + phase) > 0.92 ? 0.25 : 0)
    poolMat.opacity = 0.38 + Math.sin(t * 2.4 + phase) * 0.1
  })
  return { g, tag, open }
}

// "1.5B" -> 1.5e9, "+30" -> 30.
const amount = (text) => parseFloat(text.replace('+', '')) * ({ K: 1e3, M: 1e6, B: 1e9, T: 1e12 }[text.slice(-1)] ?? 1)

function buildTrain(root, animated, spec, glowTex) {
  const { width: PW, depth: PD, height: PH, curb } = P.platform
  const L = P.lane
  // The whole station is turned by its yaw, so the lanes stay a straight grid
  // on the platform and still lean toward the portal.
  const g = new Group()
  g.position.set(spec.x, 0, spec.z)
  g.rotation.y = spec.yaw
  root.add(g)
  const stat = new Group() // static parts in the station frame, baked at the end
  const cos = Math.cos(spec.yaw)
  const sin = Math.sin(spec.yaw)
  const world = (lx, lz) => [spec.x + lx * cos + lz * sin, spec.z - lx * sin + lz * cos]
  // The green field inside a white curb.
  put(stat, new BoxGeometry(PW, PH, PD), std('#2fbf3e', { roughness: 0.9 }), 0, PH / 2, 0)
  const white = std('#f4f6f8', { roughness: 0.6 })
  for (const s of [-1, 1]) {
    put(stat, new BoxGeometry(PW + curb * 2, PH + 0.12, curb), white, 0, (PH + 0.12) / 2, s * (PD / 2 + curb / 2))
    put(stat, new BoxGeometry(curb, PH + 0.12, PD), white, s * (PW / 2 + curb / 2), (PH + 0.12) / 2, 0)
  }
  solidBox(PW / 2 + curb, PH / 2, PD / 2 + curb, spec.x, PH / 2, spec.z, spec.yaw)

  // Six treadmills, two rows of three; driveable (a collider on top of each).
  const lanes = []
  L.rowZ.forEach((lz, row) => {
    L.colX.forEach((lx, col) => {
      const i = row * L.colX.length + col
      const { g: lane, tag, open } = buildLane(g, stat, lx, lz, spec, i, animated, glowTex)
      const [x, z] = world(lx, lz)
      solidBox(P.mill.width / 2, 0.15, (L.length - 0.2) / 2, x, PH + 0.15, z, spec.yaw)
      // Training zone (training.js): world centre, yaw, half extents, unlock price and power.
      lanes.push({
        lane, color: spec.neon[i], tag, open,
        x, z, yaw: spec.yaw, halfW: L.width / 2, halfL: L.length / 2,
        req: amount(spec.req[i]), reqText: spec.req[i], power: amount(spec.power[i]),
      })
    })
  })

  // Behind the field: wooden steps up to a raised deck, a stone wall at its back with lights
  // along it, and two horses on glowing pads on the deck (where the leaderboards used to stand).
  const D = P.deck
  const inner = spec.x > 0 ? -1 : 1 // the side toward the road (local x)
  const DW = PW + curb * 2 - D.inset
  const dx = -inner * (D.inset / 2) // the deck stops short of the inner edge
  const z0 = PD / 2 + curb
  const top = D.steps * D.step
  const deckEnd = z0 + D.steps * D.tread + D.depth
  const planks = canvasTexture(paintPlanks(512, 6, 33).color, DW / 4, 1)
  const plankTop = std('#c98e55', { map: planks, roughness: 0.85 })
  const woodSide = std('#7a4a26', { roughness: 0.85 })
  for (let k = 1; k <= D.steps; k++) {
    const front = z0 + (k - 1) * D.tread
    const h = k * D.step
    put(stat, new BoxGeometry(DW, h, deckEnd - front), [woodSide, woodSide, plankTop, woodSide, woodSide, woodSide], dx, h / 2, (front + deckEnd) / 2)
    const [cx, cz] = world(dx, (front + deckEnd) / 2)
    solidBox(DW / 2, h / 2, (deckEnd - front) / 2, cx, h / 2, cz, spec.yaw)
  }
  const backZ = deckEnd + 0.6
  const wallH = top + D.wall
  const stone = [std('#9aa0a8', { roughness: 0.95 }), std('#868c95', { roughness: 0.95 })]
  for (let k = 0, x = -DW / 2; x < DW / 2 - 0.1; k++) {
    const w = Math.min(DW / 2 - x, 2.2 + (k % 3) * 0.4)
    const h = wallH + (k % 2) * 0.3
    put(stat, new BoxGeometry(w - 0.06, h, 1.2), stone[k % 2], dx + x + w / 2, h / 2, backZ)
    x += w
  }
  const [wx, wz] = world(dx, backZ)
  solidBox(DW / 2, wallH / 2, 0.6, wx, wallH / 2, wz, spec.yaw)
  buildStringLights(g, [[dx - DW / 2, wallH + 0.35, backZ - 0.6], [dx, wallH + 0.35, backZ - 0.6], [dx + DW / 2, wallH + 0.35, backZ - 0.6]], 0.6)
  const displays = spec.horses.map(([id, color], k) => buildDisplay(g, stat, id, color, dx + (k ? -1 : 1) * (DW / 4), z0 + D.steps * D.tread + D.depth / 2, top, spec, animated, glowTex))
  for (const d of displays) [d.x, d.z] = world(d.lx, d.lz)
  // Over the back row, in front of the low cliffs behind.
  const sign = label('Train', 5.5, { color: '#ffe14a', outline: '#3a2400', outlineWidth: 18 })
  sign.position.set(0, 9.4, PD / 2 - 2.5)
  g.add(sign)
  g.add(bake(stat, true))
  return { lanes, displays }
}

// One horse on show on a deck (station frame): a glowing pad in `color` with a bright rim and a glow
// pool, the catalog horse `id` standing broadside, nose toward the road and a little toward you,
// idling, its name and Wins boost floating over it. Its spot (world, filled in by the caller)
// makes it buyable with E (interact.js, like the stall's horses).
function buildDisplay(g, stat, id, color, lx, lz, top, spec, animated, glowTex) {
  const def = horseById(id)
  const padMat = std(color, { emissive: color, emissiveIntensity: 0.55, roughness: 0.4 })
  put(stat, new BoxGeometry(4.8, 0.14, 2.8), padMat, lx, top + 0.07, lz)
  const rim = neon(color, 2.2)
  for (const s of [-1, 1]) {
    put(stat, new BoxGeometry(4.9, 0.1, 0.12), rim, lx, top + 0.15, lz + s * 1.4, false)
    put(stat, new BoxGeometry(0.12, 0.1, 2.9), rim, lx + s * 2.45, top + 0.15, lz, false)
  }
  const poolMat = new MeshBasicMaterial({ map: glowTex, color, transparent: true, opacity: 0.6, blending: AdditiveBlending, depthWrite: false })
  const pool = put(g, new PlaneGeometry(7, 4.6), poolMat, lx, top + 0.16, lz, false)
  pool.rotation.x = -Math.PI / 2
  const horse = createHorse({ lite: true })
  horse.setLook(horseLook(id))
  const inner = spec.x > 0 ? -1 : 1
  horse.root.scale.setScalar(P.deck.horseScale)
  horse.root.rotation.y = inner * (Math.PI / 2 + 0.35)
  horse.root.position.set(lx, top + 0.14, lz)
  g.add(horse.root)
  const phase = lx + spec.x
  animated.push((t) => {
    horse.update(1 / 60, 0, 0, t + phase)
    poolMat.opacity = 0.5 + Math.sin(t * 2.2 + phase) * 0.12
  })
  const tag = label(`${def.name}
🏆 ${def.price == null ? 'Free' : short(def.price)}`, 1.05, { colors: [color, '#ffe14a'], outline: '#1a0a14', font: '700 64px Fredoka, "Segoe UI Emoji", sans-serif', outlineWidth: 10 })
  tag.position.set(lx, top + 4.6, lz)
  g.add(tag)
  return { horse: id, lx, lz, y: top + 3, color, x: 0, z: 0 }
}

// --- Leaderboards --------------------------------------------------------------------------
// Each board's face is a canvas: RANK / NAME / stat header, PLAZA_ROWS rows (gold, silver, bronze
// ranks first) and the player's own line at the bottom. "Loading..." until the server answers.
const PLAZA_ROWS = 10
// Seconds -> "45m", "12h 5m", "3d 4h".
function duration(s) {
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d) return `${d}d ${h % 24}h`
  if (h) return `${h}h ${m % 60}m`
  return `${m}m`
}
const formatStat = (stat, v) => (stat === 'playtime' ? duration(v) : short(v))
const RANK_COLORS = ['#ffd84a', '#e4ecf5', '#ff9a4a']

// Fits text into maxW by shrinking the font (names can be long).
function fitText(ctx, text, x, y, maxW, size, align) {
  let px = size
  ctx.font = `700 ${px}px Fredoka, "Segoe UI Emoji", sans-serif`
  while (px > 12 && ctx.measureText(text).width > maxW) ctx.font = `700 ${--px}px Fredoka, "Segoe UI Emoji", sans-serif`
  ctx.textAlign = align
  ctx.strokeText(text, x, y)
  ctx.fillText(text, x, y)
}

// rows: [{ name, value }] or null (not loaded); rank: this player's place or null; mine: their value.
function drawBoard(board, rows, rank, mine) {
  const key = JSON.stringify([rows, rank, mine])
  if (key === board.key) return
  board.key = key
  const { canvas, st, def, stat } = board
  const ctx = canvas.getContext('2d')
  const W = canvas.width
  const H = canvas.height
  ctx.fillStyle = st.bg
  ctx.fillRect(0, 0, W, H)
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.lineWidth = 6
  ctx.strokeStyle = '#0a1030'
  const colX = [64, 230, 448]
  // Header.
  ctx.fillStyle = st.head
  fitText(ctx, 'RANK', colX[0], 40, 110, 30, 'center')
  fitText(ctx, 'NAME', colX[1], 40, 200, 30, 'center')
  fitText(ctx, def.column, colX[2], 40, 120, 30, 'center')
  // Rows.
  const top = 74
  const rowH = 60
  for (let i = 0; i < PLAZA_ROWS; i++) {
    const y = top + i * rowH
    ctx.fillStyle = st.row
    ctx.beginPath()
    ctx.roundRect(14, y + 4, W - 28, rowH - 10, 12)
    ctx.fill()
    ctx.lineWidth = 3
    ctx.strokeStyle = st.rowEdge
    ctx.stroke()
    ctx.lineWidth = 6
    ctx.strokeStyle = '#0a1030'
    const r = rows?.[i]
    const cy = y + rowH / 2 - 1
    ctx.fillStyle = RANK_COLORS[i] ?? '#ffffff'
    fitText(ctx, `#${i + 1}`, colX[0], cy, 90, 28, 'center')
    ctx.fillStyle = '#ffffff'
    fitText(ctx, r ? r.name : rows ? '-' : '', colX[1], cy, 210, 26, 'center')
    fitText(ctx, r ? formatStat(stat, r.value) : '', colX[2], cy, 116, 26, 'center')
  }
  // The player's own line.
  const fy = top + PLAZA_ROWS * rowH + 34
  ctx.fillStyle = st.foot
  ctx.strokeStyle = st.footStroke
  ctx.lineWidth = 4
  if (!rows) {
    fitText(ctx, 'Loading...', W / 2, fy, W - 40, 32, 'center')
  } else {
    fitText(ctx, rank ? `Your Rank: #${rank}` : 'Your Rank: -', 30, fy, 250, 28, 'left')
    if (mine != null) fitText(ctx, formatStat(stat, mine), W - 30, fy, 200, 30, 'right')
  }
  board.tex.needsUpdate = true
}

// Board frame styles: `outer` the frame, `bg` the face, then the header, rows and footer colours;
// `rim` = a glowing edge round the frame (the north boards, lobby.js).
const BOARD_STYLES = {
  dark: { outer: '#252a36', bg: '#0d1733', head: '#5fd0ff', row: '#1d4fd6', rowEdge: '#4f8bff', foot: '#9fc0ff', footStroke: '#000814' },
  gold: { outer: '#ffd21a', bg: '#ffd21a', head: '#d0306a', row: '#2a62ef', rowEdge: '#7fb0ff', foot: '#5a3a00', footStroke: '#fff2a8', rim: '#ffe14a' },
  cyan: { outer: '#1a2238', bg: '#0d1733', head: '#5fd0ff', row: '#1d4fd6', rowEdge: '#4f8bff', foot: '#9fc0ff', footStroke: '#000814', rim: '#2fe0ff' },
  blue: { outer: '#1d3f9a', bg: '#0d1733', head: '#ff7ab8', row: '#2a62ef', rowEdge: '#7fb0ff', foot: '#9fc0ff', footStroke: '#000814', rim: '#4f8bff' },
  green: { outer: '#1a5a2a', bg: '#0d1733', head: '#7dff6a', row: '#1d4fd6', rowEdge: '#4f8bff', foot: '#9fc0ff', footStroke: '#000814', rim: '#5dff6a' },
}

// A leaderboard standing in `parent`'s frame, its face toward +Z: frame, canvas face (drawBoard)
// and the stat's title floating over it. Returns the board for createPlaza's redraw (lobby.js builds
// the north ones with it and hands them to createPlaza).
export function buildLeaderboard(parent, stat, style) {
  const st = BOARD_STYLES[style]
  const def = P.leaderboards[stat]
  put(parent, new BoxGeometry(4.8, 7, 0.5), std(st.outer, { roughness: 0.6 }), 0, 3.9, 0)
  if (st.rim) {
    const rim = neon(st.rim, 2)
    for (const s of [-1, 1]) {
      put(parent, new BoxGeometry(0.16, 7.1, 0.56), rim, s * 2.42, 3.9, 0, false)
      put(parent, new BoxGeometry(4.96, 0.16, 0.56), rim, 0, 3.9 + s * 3.52, 0, false)
    }
  }
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 776
  const tex = canvasTexture(canvas)
  const edge = std(st.bg)
  const faceMat = std('#ffffff', { map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.55, roughness: 0.7 })
  put(parent, new BoxGeometry(4.1, 6.2, 0.1), [edge, edge, edge, edge, faceMat, edge], 0, 3.9, 0.3)
  const t = label(def.title, 1.4, { color: def.color, outline: '#1a0a14', font: '700 64px Fredoka, "Segoe UI Emoji", sans-serif', outlineWidth: 10 })
  t.position.set(0, 11, 0) // over the top player standing on the board (lobby.js buildTopFigure)
  parent.add(t)
  const board = { stat, def, st, canvas, tex, key: '' }
  drawBoard(board, null, null, null)
  return board
}

// --- Kiosks and displays ------------------------------------------------------------------
function buildGolden(root, animated) {
  const g = new Group()
  g.position.set(P.golden.x, 0, P.golden.z)
  face(g, 0, 10)
  root.add(g)
  const gold = std('#ffc933', { metalness: 0.65, roughness: 0.3, emissive: '#7a5200', emissiveIntensity: 0.2 })
  const ring = put(g, new TorusGeometry(3, 0.14, 8, 48), neon('#ffb21a'), 0, 0.08, 0, false)
  ring.rotation.x = Math.PI / 2
  put(g, new BoxGeometry(3.2, 0.4, 2.4), std('#a8771a', { metalness: 0.5, roughness: 0.4 }), 0, 0.2, 0)
  put(g, new BoxGeometry(2.6, 3, 1.8), gold, 0, 1.9, 0)
  put(g, new BoxGeometry(1.8, 1.2, 0.06), std('#122a6a', { emissive: '#2a5cff', emissiveIntensity: 0.6 }), 0, 2.5, 0.92)
  put(g, new SphereGeometry(0.18, 12, 8), std('#e8262b', { emissive: '#e8262b', emissiveIntensity: 0.4 }), 0.6, 1.5, 0.95)
  put(g, new SphereGeometry(0.95, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), std('#bfe8ff', { transparent: true, opacity: 0.45, roughness: 0.05 }), 0, 3.4, 0)
  const nugget = put(g, new SphereGeometry(0.45, 12, 10), gold, 0, 3.75, 0)
  put(g, new CylinderGeometry(1, 1, 0.12, 24), gold, 0, 3.4, 0)
  const t = label('Golden Machine', 0.8, { color: '#ffe14a', outline: '#3a2400' })
  t.position.y = 5.8
  g.add(t)
  solidBox(1.6, 2, 1.2, P.golden.x, 2, P.golden.z, g.rotation.y)
  // Gold sparkles drifting round the machine.
  createEmitter(root, {
    boxes: [{ x: P.golden.x, y: 2.4, z: P.golden.z, sx: 2, sy: 2, sz: 2, color: '#ffd24a' }],
    count: 45, life: 2.4, velocity: [0, 0.6, 0], spread: [0.3, 0.3, 0.3],
    size: 0.45, intensity: 3, twinkle: 6, sprite: 'sparkle', seed: 81,
  })
  animated.push((time) => (nugget.rotation.y = time * 1.5))
}

function buildIndex(root) {
  const g = new Group()
  g.position.set(P.index.x, 0, P.index.z)
  face(g, 0, 10)
  root.add(g)
  put(g, new BoxGeometry(2.2, 3, 1.6), std('#2a5cff', { roughness: 0.45 }), 0, 1.5, 0)
  put(g, new BoxGeometry(1.6, 1.4, 0.06), std('#dff3ff', { emissive: '#9fdcff', emissiveIntensity: 0.5 }), 0, 1.9, 0.82)
  put(g, new CylinderGeometry(0.08, 0.08, 1.2), std('#c8cfdb'), 0, 3.6, 0)
  const disc = put(g, new CylinderGeometry(0.75, 0.75, 0.14, 28), std('#ffffff'), 0, 4.6, 0)
  disc.rotation.x = Math.PI / 2
  const star = label('★', 1.1, { color: '#ffc21a', outline: '#3a2400', outlineWidth: 8 })
  star.position.set(0, 4.6, 0.2)
  g.add(star)
  const t = label('Collection', 0.8, { color: '#bff4ff', outline: '#123a8a' })
  t.position.y = 5.9
  g.add(t)
  solidBox(1.1, 1.5, 0.8, P.index.x, 1.5, P.index.z, g.rotation.y)
}

function buildRelics(root, animated) {
  const g = new Group()
  g.position.set(P.relics.x, 0, P.relics.z)
  face(g, 0, 10)
  root.add(g)
  const purple = std('#8a3cff', { roughness: 0.45 })
  put(g, new BoxGeometry(4.6, 1.3, 2), purple, 0, 0.65, 0)
  put(g, new BoxGeometry(4.8, 0.16, 2.2), std('#f2e9ff'), 0, 1.36, 0)
  const q = std('#ffffff', { map: textFace('?', '#8a3cff', '#ffffff') })
  const box = put(g, new BoxGeometry(1.3, 1.3, 1.3), q, -0.8, 2.1, 0)
  const coin = put(g, new CylinderGeometry(0.55, 0.55, 0.14, 28), std('#ffc933', { metalness: 0.6, roughness: 0.3, emissive: '#7a5200', emissiveIntensity: 0.3 }), 1.2, 2.6, 0)
  coin.rotation.x = Math.PI / 2
  for (const s of [-1, 1]) put(g, new BoxGeometry(0.2, 3.6, 0.2), purple, s * 2.2, 1.8, -0.9)
  put(g, new BoxGeometry(4.6, 0.6, 0.2), purple, 0, 3.6, -0.9)
  const t = label('Forest Relics', 0.8, { color: '#ffe14a', outline: '#3a2400' })
  t.position.y = 4.8
  g.add(t)
  solidBox(2.3, 1, 1, P.relics.x, 1, P.relics.z, g.rotation.y)
  animated.push((time) => {
    coin.rotation.z = time * 2
    box.position.y = 2.1 + Math.sin(time * 2) * 0.12
  })
}

function buildChest(root) {
  const g = new Group()
  g.position.set(P.chest.x, 0, P.chest.z)
  face(g, 0, 10)
  root.add(g)
  const red = std('#d8262b', { roughness: 0.5 })
  const gold = std('#ffc933', { metalness: 0.6, roughness: 0.3 })
  put(g, new BoxGeometry(1.9, 1.1, 1.2), red, 0, 0.55, 0)
  const lid = put(g, new CylinderGeometry(0.6, 0.6, 1.9, 16, 1, false, 0, Math.PI), red, 0, 1.1, 0)
  lid.rotation.z = Math.PI / 2
  for (const s of [-1, 1]) put(g, new BoxGeometry(0.18, 1.2, 1.25), gold, s * 0.6, 0.6, 0)
  put(g, new BoxGeometry(0.3, 0.36, 0.1), gold, 0, 1.0, 0.62)
  solidBox(1, 0.8, 0.7, P.chest.x, 0.8, P.chest.z, g.rotation.y)
}

// --- The back of the plaza -----------------------------------------------------------------
// The snowy Christmas tree, candy canes, the autumn pine, the snowman and the windmill (its wheel
// turns).
function buildBackdrop(root, animated) {
  const props = new Group()
  for (const c of P.canes) buildCandyCane(props, c)
  const [ox, oz, oh] = P.orangePine
  buildPine(props, ox, oz, oh, '#ff8a2a')
  buildSnowman(props, P.snowman, 0, 10)
  for (const gift of P.gifts) {
    buildGift(props, gift)
    solidBox(gift[2] / 2, gift[2] * 0.42, gift[2] / 2, gift[0], gift[2] * 0.42, gift[1], gift[5])
  }
  root.add(bake(props, true))
  const wave = buildSanta(root, P.santa, 0, 10)
  animated.push((t) => (wave.rotation.z = -0.5 - Math.abs(Math.sin(t * 3)) * 0.6))
  buildStatue(root)
  buildSnowyTree(root, P.tree)
  const W = P.windmill
  const wheel = buildWindPump(root, W)
  solidPole(0.7 * W.scale, 3, W.x, W.z)
  animated.push((t) => (wheel.rotation.z = t * 1.6))
}

// A slate-grey stone statue on a round pedestal: a horse rearing up on its hind legs, front legs
// pawing the air, tail down, a rider in the saddle with one arm raised. Built from blocks in the
// statue's own frame (nose +Z, ~9 m tall at scale 1), then turned broadside to the plaza.
function buildStatue(root) {
  const S = P.statue
  const stone = std('#6f7888', { roughness: 0.85, flatShading: true })
  const dark = std('#5c6472', { roughness: 0.85, flatShading: true })
  put(root, new CylinderGeometry(2.4, 2.7, 2.2, 10), std('#7c818c', { roughness: 0.95 }), S.x, 1.1, S.z)
  put(root, new CylinderGeometry(2.6, 2.6, 0.3, 10), std('#a4a8b2', { roughness: 0.9 }), S.x, 2.35, S.z)
  solidPole(2.7, 2.2, S.x, S.z)
  const g = new Group()
  // A block of size [w, h, d] centred at p, tipped by rx (nose-up negative) about its centre.
  const block = (size, p, rx = 0, mat = stone, rz = 0) => {
    const m = put(g, new BoxGeometry(...size), mat, ...p)
    m.rotation.set(rx, 0, rz)
    return m
  }
  for (const sx of [-1, 1]) {
    block([0.42, 2.0, 0.5], [sx * 0.42, 1.0, -0.35], 0.15) // hind cannons + hocks
    block([0.55, 1.6, 0.75], [sx * 0.42, 2.5, -0.55], -0.35) // gaskins / thighs
    block([0.36, 1.3, 0.36], [sx * 0.36, 5.75, 2.3], -1.25) // front forearms, reaching forward
    block([0.32, 1.1, 0.32], [sx * 0.36, 5.35, 3.05], 0.35) // front cannons, hanging
  }
  block([0.5, 0.3, 0.6], [0.42, 0.15, -0.3], 0, dark) // hooves on the ground
  block([0.5, 0.3, 0.6], [-0.42, 0.15, -0.3], 0, dark)
  block([1.3, 1.45, 3.7], [0, 4.75, 0.75], -0.95) // barrel, steeply up
  block([1.2, 1.2, 1.2], [0, 3.45, -0.25], -0.95) // rump
  block([0.75, 2.3, 0.85], [0, 7.2, 2.15], -0.35) // neck
  block([0.42, 2.2, 0.25], [0, 7.3, 1.75], -0.35, dark) // mane along its crest
  block([0.66, 0.8, 1.45], [0, 8.35, 2.75], 0.75) // head, nose down
  for (const sx of [-1, 1]) block([0.14, 0.42, 0.14], [sx * 0.2, 8.95, 2.35], -0.3)
  block([0.32, 2.4, 0.32], [0, 2.4, -1.15], 0.35, dark) // tail
  // The rider: legs along the flanks, torso leaning into the climb, one arm raised.
  for (const sx of [-1, 1]) block([0.32, 1.2, 0.36], [sx * 0.72, 4.9, 0.7], -0.6)
  block([0.85, 1.25, 0.5], [0, 6.2, 0.05], 0.25)
  block([0.55, 0.55, 0.55], [0, 7.15, 0.25], 0)
  block([0.62, 0.12, 0.62], [0, 7.47, 0.25], 0, dark) // hat brim
  block([0.28, 1.2, 0.28], [-0.55, 6.15, 0.35], 0.5)
  block([0.28, 1.4, 0.28], [0.6, 7.35, 0.05], 0, stone, -0.35) // raised arm
  const holder = new Group()
  holder.add(g)
  g.scale.setScalar(S.scale)
  const baked = bake(holder, true)
  baked.position.set(S.x, 2.5, S.z)
  baked.rotation.y = Math.PI / 2 + 0.25 // broadside, nose toward screen-left (+X), a little toward the plaza
  root.add(baked)
}

// --- Particles ----------------------------------------------------------------------------
function buildParticles(scene, trains) {
  const F = P.snowfall
  // Snow drifting down over the whole plaza.
  createEmitter(scene, {
    boxes: [{ x: F.x, y: F.y / 2, z: F.z, sx: F.sx, sy: F.y / 2, sz: F.sz }],
    count: F.count, life: 9, velocity: [0.3, -1.4, 0], spread: [0.5, 0.3, 0.5], gravity: 0,
    size: 0.32, color: '#ffffff', intensity: 1.3, opacity: 0.85, seed: 11, solid: true,
  })
  // Sparkles round the portal and the tree.
  const T = P.tree
  createEmitter(scene, {
    boxes: [
      { x: P.vip.x, y: P.portal.y, z: P.vip.z - 0.5, sx: P.portal.radius, sy: P.portal.radius, sz: 0.6, color: '#7dff9a' },
      { x: T.x, y: T.height * 0.45, z: T.z, sx: T.height * 0.22, sy: T.height * 0.4, sz: T.height * 0.22, color: '#fff2a0' },
    ],
    count: 110, life: 3.5, velocity: [0, 0.5, 0], spread: [0.3, 0.3, 0.3],
    size: 0.6, intensity: 2.6, twinkle: 5, sprite: 'sparkle', seed: 13,
  })
  // Sparkles rising off the display horses' pads, in each pad's colour.
  createEmitter(scene, {
    boxes: trains.flatMap(({ displays }) => displays.map((d) => ({ x: d.x, y: P.deck.steps * P.deck.step + 1.2, z: d.z, sx: 2.2, sy: 1.2, sz: 1.2, color: d.color }))),
    count: 80, life: 2.2, velocity: [0, 0.9, 0], spread: [0.25, 0.3, 0.25],
    size: 0.45, intensity: 3, twinkle: 6, sprite: 'sparkle', seed: 16,
  })
  // Per treadmill: energy motes rising off the belt in its colour, and streaks running back
  // along it toward its near end (the belt's direction, so one emitter per station's yaw).
  const L = P.lane
  const M = P.mill
  const at = new Vector3()
  for (const [k, { lanes }] of trains.entries()) {
    const yaw = lanes[0].yaw
    const boxes = lanes.map(({ lane, color }) => {
      lane.getWorldPosition(at)
      return { x: at.x, y: at.y + 0.45, z: at.z, sx: M.width / 2 - M.rail - 0.2, sy: 0.08, sz: L.length / 2 - 0.6, color }
    })
    createEmitter(scene, {
      boxes, count: 150, life: 1.8, velocity: [0, 1.3, 0], spread: [0.15, 0.4, 0.15],
      size: 0.3, intensity: 4, opacity: 0.9, twinkle: 4, seed: 15 + k,
    })
    createEmitter(scene, {
      boxes, count: 90, life: 0.9, velocity: [-Math.sin(yaw) * 6, 0.2, -Math.cos(yaw) * 6], spread: [0.1, 0.1, 0.1],
      size: 0.22, grow: 0.3, intensity: 3.5, opacity: 0.8, seed: 25 + k,
    })
  }
}

// extra.boards: the leaderboards to keep fed (lobby.js's, buildLeaderboard).
export function createPlaza(scene, { boards = [] } = {}) {
  const root = new Group()
  root.name = 'plaza'
  scene.add(root)
  const animated = [] // fn(elapsed, dt) per animated prop

  buildGround(root)
  const setSign = buildPortal(root, animated)
  const glowTex = new CanvasTexture(paintSoftDot(128))
  glowTex.colorSpace = SRGBColorSpace
  const trains = P.trains.map((spec) => buildTrain(root, animated, spec, glowTex))
  const lanes = trains.flatMap((t) => t.lanes)
  let leaders = null // the server's last `leaderboard` { boards, ranks }
  let mine = {} // this player's live values per stat
  const redraw = () =>
    boards.forEach((b) => {
      const rows = leaders?.boards?.[b.stat] ?? null
      drawBoard(b, rows, leaders?.ranks?.[b.stat] ?? null, mine[b.stat] ?? null)
      b.setTop?.(rows?.[0] ?? null)
    })
  fontReady.then(() => {
    for (const b of boards) b.key = '' // repaint in Fredoka
    redraw()
  })
  buildGolden(root, animated)
  buildIndex(root)
  buildRelics(root, animated)
  buildChest(root)
  buildBackdrop(root, animated)
  root.updateMatrixWorld(true)
  buildParticles(scene, trains)

  return {
    lanes,
    // The deck horses' interact spots ({ horse, x, y, z }), like the stall's (main.js adds them).
    spots: { horses: trains.flatMap((t) => t.displays) },
    // Swaps each lane's lock tag for its power tag once `isOpen(lane)`.
    setUnlocked(isOpen) {
      for (const l of lanes) {
        const on = isOpen(l)
        l.tag.visible = !on
        l.open.visible = on
      }
    },
    // The portal's sign (worlds.js): lines [[text, colour]] with the destination first, and
    // whether the portal is open (its swirl turns PLAZA.portal.open, else .locked).
    setPortal: (lines, open) => setSign(lines, open),
    // The server's `leaderboard` message: { boards: { stat: [{ name, value }] }, ranks: { stat: n | null } }.
    setLeaderboard(data) {
      leaders = data
      redraw()
    },
    // This player's own values ({ rebirths, trophies, energy, playtime }) for the boards' bottom line.
    setMine(values) {
      mine = values
      redraw()
    },
    update(dt, elapsed) {
      for (const fn of animated) fn(elapsed, dt)
    },
  }
}
