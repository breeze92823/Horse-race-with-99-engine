import { BoxGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, PlaneGeometry, RepeatWrapping } from 'three'
import { GROUND, LOBBY, TRACK } from './config.js'
import { paintAsphalt, paintStripes, toTexture } from './textures.js'
import { std } from './propkit.js'

// The road out from the RACE arch (lobby.js: the short one in the lobby; race.js: the long one
// that slides past while racing): an asphalt strip a little wider than the arch with a dashed white
// centre line, and a low red-and-white striped barrier on white legs along the lines of the arch
// posts. Built in the gate's frame: it starts at the start line's far edge and runs `length` m toward
// -Z. One mesh for the asphalt, one InstancedMesh each for the dashes and the legs and one for both
// barriers, so even the 700 m race road is a handful of draw calls.
const G = LOBBY.gate
let asphaltMap = null
let stripeMap = null

export function buildTrack(length, { shadows = true } = {}) {
  const hw = G.halfWidth
  const start = -G.padDepth / 2
  const group = new Group()

  // Asphalt: the texture's v runs down the road, one tile every TRACK.tile m.
  asphaltMap ||= toTexture(paintAsphalt(), { srgb: true })
  const width = 2 * (hw + TRACK.margin)
  const map = asphaltMap.clone()
  map.needsUpdate = true
  map.repeat.set(width / TRACK.tile, length / TRACK.tile)
  const road = new Mesh(new PlaneGeometry(width, length), new MeshStandardMaterial({ map, roughness: 0.95, metalness: 0 }))
  road.rotation.x = -Math.PI / 2
  road.position.set(0, GROUND.level + 0.03, start - length / 2)
  road.receiveShadow = true
  group.add(road)

  // Centre line: one dash per tile, so the scrolling race road never shows a seam.
  const m = new Matrix4()
  const [dw, dl] = TRACK.dash
  const dashGeo = new PlaneGeometry(dw, dl)
  dashGeo.rotateX(-Math.PI / 2)
  const dashCount = Math.floor(length / TRACK.tile)
  const dashes = new InstancedMesh(dashGeo, std(TRACK.line, { roughness: 0.8 }), dashCount)
  for (let i = 0; i < dashCount; i++) dashes.setMatrixAt(i, m.makeTranslation(0, GROUND.level + 0.05, start - TRACK.tile / 2 - i * TRACK.tile))
  dashes.receiveShadow = true
  dashes.frustumCulled = false // one long instanced mesh; its bounds would be the first dash's
  group.add(dashes)

  // Barriers: white legs every postSpacing m, a striped board along them on each side.
  const [px, py, pz] = TRACK.postSize
  const count = Math.floor(length / TRACK.postSpacing) + 1
  const legs = new InstancedMesh(new BoxGeometry(px, py, pz), std(TRACK.leg, { roughness: 0.6 }), count * 2)
  let n = 0
  for (const side of [-1, 1])
    for (let i = 0; i < count; i++) legs.setMatrixAt(n++, m.makeTranslation(side * hw, GROUND.level + py / 2, start - i * TRACK.postSpacing))
  legs.castShadow = shadows
  legs.frustumCulled = false
  group.add(legs)
  const B = TRACK.barrier
  if (!stripeMap) {
    stripeMap = toTexture(paintStripes(TRACK.red, '#ffffff', 1, 128, 0), { srgb: true })
    stripeMap.wrapS = stripeMap.wrapT = RepeatWrapping
  }
  const stripes = stripeMap.clone()
  stripes.needsUpdate = true
  stripes.repeat.set(length / B.stripe, 1)
  const face = std('#ffffff', { map: stripes, roughness: 0.55 })
  const white = std('#ffffff', { roughness: 0.55 })
  // Box faces +X/-X carry the length along u (BoxGeometry: px/nx faces span depth x height).
  const board = new BoxGeometry(B.thick, B.height, length)
  const boards = new InstancedMesh(board, [face, face, white, white, white, white], 2)
  n = 0
  for (const side of [-1, 1]) boards.setMatrixAt(n++, m.makeTranslation(side * hw, GROUND.level + B.y, start - length / 2))
  boards.castShadow = shadows
  boards.frustumCulled = false
  group.add(boards)
  return group
}
