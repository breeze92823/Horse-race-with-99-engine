import { BoxGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three'
import { GROUND, LOBBY, TRACK } from './config.js'
import { paintDirt, toTexture } from './textures.js'
import { std } from './propkit.js'

// The dirt track out from the START gate (lobby.js: the short one in the lobby; race.js: the long
// one that slides past while racing): a raked dirt strip a little wider than the gate, between two
// white rail fences on the lines of the gate posts. Built in the gate's frame: it starts just past
// the gate pad and runs `length` m toward -Z. One mesh for the dirt, one InstancedMesh for every
// post and one for the rails, so even the 700 m race track is three draw calls.
const G = LOBBY.gate
let dirtMap = null

export function buildTrack(length, { shadows = true } = {}) {
  const hw = G.halfWidth
  const start = -G.padDepth / 2 - 2
  const group = new Group()

  // Dirt: the texture's v runs down the track, one tile every TRACK.tile m.
  dirtMap ||= toTexture(paintDirt(), { srgb: true })
  const width = 2 * (hw + TRACK.margin)
  const map = dirtMap.clone()
  map.needsUpdate = true
  map.repeat.set(width / TRACK.tile, length / TRACK.tile)
  const dirt = new Mesh(new PlaneGeometry(width, length), new MeshStandardMaterial({ map, roughness: 1, metalness: 0 }))
  dirt.rotation.x = -Math.PI / 2
  dirt.position.set(0, GROUND.level + 0.03, start - length / 2)
  dirt.receiveShadow = true
  group.add(dirt)

  // Fences: a post every postSpacing m on each side, and the rails along them.
  const wood = std(TRACK.wood, { roughness: 0.6 })
  const [px, py, pz] = TRACK.postSize
  const count = Math.floor(length / TRACK.postSpacing) + 1
  const posts = new InstancedMesh(new BoxGeometry(px, py, pz), wood, count * 2)
  const m = new Matrix4()
  let n = 0
  for (const side of [-1, 1])
    for (let i = 0; i < count; i++) posts.setMatrixAt(n++, m.makeTranslation(side * hw, GROUND.level + py / 2, start - i * TRACK.postSpacing))
  posts.castShadow = shadows
  posts.frustumCulled = false // one long instanced mesh; its bounds would be the first post's
  group.add(posts)
  const [rw, rh] = TRACK.railSize
  const rail = new BoxGeometry(rw, rh, length)
  const rails = new InstancedMesh(rail, wood, 2 * TRACK.rails.length)
  n = 0
  for (const side of [-1, 1]) for (const y of TRACK.rails) rails.setMatrixAt(n++, m.makeTranslation(side * (hw + px / 2 + rw / 2), GROUND.level + y, start - length / 2))
  rails.castShadow = shadows
  rails.frustumCulled = false
  group.add(rails)
  return group
}
