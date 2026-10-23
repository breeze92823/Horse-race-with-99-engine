// Every tunable constant lives here; the rest of src/ holds no theme values.

// --- Identity -------------------------------------------------------------
export const GAME_SLUG = 'horse-race-with-99-engine' // slug registered on bloxity.io
export const GAME_TITLE = 'Horse Race'

// Forces the Bloxity SDK and avatar CDN to be treated as unavailable (see .env.example).
export const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true'
// Dev server only (never in a build): the VIP portal ignores its world requirement (worlds.js).
export const DEV_WORLDS = import.meta.env.DEV && import.meta.env.VITE_DEV_WORLDS === 'true'

// --- Server (net.js) -----------------------------------------------------------
// The Colyseus server (../Horse-race-backend) holds the only save: nothing is kept
// in the browser. Deployed builds (prod and the dev channel) always go through the Bloxity
// matchmaker (Legion.SDK.net.resolveEndpoint): a fixed socket URL would pin everyone to one pod.
// Only the local dev server (`npm run dev`) connects straight to a URL.
export const SERVER_URL = import.meta.env.DEV ? import.meta.env.VITE_SERVER_URL_DEV || 'ws://localhost:2567' : ''
export const NET = {
  saveEvery: 5, // s: progress is sent at most this often (and when the tab hides or closes)
  retry: 2, // s before the first reconnect; doubles after each failed resolve/join...
  retryMax: 30, // ...up to this (the matchmaker can hold a cold start for ~45 s)
  rejoin: 1, // s before resolving again after the room closed (e.g. its pod is being replaced)
  raceEvery: 0.25, // s: this player's race distance is relayed to the others at most this often
  // Presence (remotePlayers.js): this player's pose goes out at most `poseHz` times a second
  // (skipped while it stands still); remote players ease toward their last pose (plus
  // speed x heading for the time since it came: dead reckoning) at `remoteLerp` 1/s. The nearest
  // `maxRemotes` (fewer on touch) are drawn within `remoteFade` m (racers further down the lane
  // within `raceFade`); pets, partner and trail only within `detailRange` m.
  poseHz: 10,
  remoteLerp: 10,
  predictMax: 0.4, // s of dead reckoning at most (a stalled sender stops instead of drifting off)
  remoteFade: 220,
  raceFade: 600,
  maxRemotes: 20,
  maxRemotesTouch: 10,
  detailRange: 90,
}

// --- World (metres: +X east, +Z south, +Y up) -------------------------------
export const GROUND_Y = 0
// The start island (world.js): one convex slab, a sunny plaza of cracked sand. Its front edge
// sweeps from the start gate (front, -Z) back toward +Z on both wings, so the side fences
// funnel toward the gate like the reference shot.
export const YARD = {
  front: -46, // z of the yard's front edge at the start gate
  back: 90, // z of the back edge
  halfWidth: 75, // x extent of the wings
  wingZ: 24, // z of the front edge at the far left/right ends
  gateEdge: 52, // half-width of the straight front edge (the arch, the Trails display and portal, the boards)
  depth: 4, // slab thickness
  fenceHeight: 3, // invisible wall around the yard so nobody rides off into the meadow
  side: '#c49a5c', // the slab's sandy edge
  sandTile: 8, // m per tile of the cracked plaza sand (paintSand: 4x4 slabs, ~2 m each; 3x the slabs per metre, same texture so no extra cost)
  sandGlow: 0.32, // share of the sand's colour it shows unlit (keeps it sunny yellow under the blue sky fill)
  dirtTile: 8, // m per dirt texture tile (the Frontier Town's desert)
}
// The meadow every world stands in (world.js): grass out to the horizon, under the start island
// and the race track, scrolled by a race. `tint` multiplies the grass (per world: WORLDS.list.*.ground,
// which can also swap the grass for dirt).
// sunk: where the far hills, the hill, mesas and the race's rock arches sink into it.
export const GROUND = { level: -0.05, size: 1400, tile: 9, tint: '#ffffff', sunk: -1.6 }
export const SPAWN = { x: 0, y: 0.05, z: 8 }
export const SPAWN_FACING = Math.PI // yaw the character faces on spawn (PI = toward -Z, the start gate)

// --- Player modes (modes.js) -------------------------------------------------
// 'character' = third-person chase cam with the avatar on screen.
// 'player' = first-person, the camera is the player's eyes and the avatar is hidden.
export const MODES = ['character', 'player']
export const START_MODE = 'character'

// --- Physics (physics.js, player.js) ------------------------------------------
export const PHYSICS = {
  gravity: -22, // m/s^2 for dynamic bodies and the player
  fixedStep: 1 / 60, // s per physics tick; rendering interpolates between ticks
  maxSubSteps: 5, // a long frame never runs more ticks than this
  walkSpeed: 8, // m/s
  sprintSpeed: 14, // m/s with Shift held
  accel: 30, // m/s^2 a horse gathers speed at from a standstill (player.js tapers it toward the top)
  accelTaper: 0.5, // share of `accel` left off at sprintSpeed
  airAccel: 22, // m/s^2 steering while airborne
  decel: 26, // m/s^2 when no key is held (a gallop pulls up in ~4 m)
  grip: 80, // m/s^2 the hooves kill side-slip at
  turnSpeed: 8, // rad/s the body turns toward its heading at a standstill
  turnSpeedFast: 4.5, // rad/s at sprintSpeed (a wider arc at the gallop)
  turnSlow: 0.2, // share of speed kept while the heading is behind the horse (it arcs round)
  jumpSpeed: 8.5, // m/s
  coyoteTime: 0.1, // s after leaving a ledge a jump still counts
  jumpBuffer: 0.12, // s a jump pressed before landing is remembered
  stepHeight: 0.45, // m autostep
  maxSlope: 50, // degrees the player can walk up
  snapToGround: 0.4, // m the controller stays glued to downward steps and slopes
  pushMass: 80, // kg the character weighs when shoving crates
  killY: -6, // sank this far: respawn
}
export const PLAYER_DIMS = { radius: 0.75, height: 1.8 } // wide capsule: it carries the horse

// --- Lobby props (lobby.js) ---------------------------------------------------
// Roblox-scale, laid out off the reference's north view (the spawn looking at the RACE
// arch, -Z) by back-projecting its pixels: the arch ~50 m ahead, the Trails display and
// the world portal on the left, three leaderboards and the Christmas tree on the right.
// Positions are (x, z) in metres; anything facing "the spawn" turns toward SPAWN.
export const LOBBY = {
  // The wooden RACE arch: two square posts, a beam overhanging them, the RACE sign hanging
  // under it on two hangers, a glowing gold start line between the posts. halfWidth = the
  // posts' centres (the race lane and its barriers follow it: track.js, race.js).
  gate: {
    z: -43.5, halfWidth: 17, post: 2.4, postHeight: 22.6,
    beamY: 18.9, beamHeight: 3, beamDepth: 2.2, overhang: 3.2,
    sign: { y: 13.4, width: 23, height: 5.2, hangers: 7.5 },
    padDepth: 5, // the start line's depth (a glowing strip seen almost edge-on from the spawn)
  },
  lane: { length: 600 }, // the road and its barriers from the gate posts out into the meadow, into the fog (track.js)
  // Wooden post-and-rail ranch fences: polylines from the arch posts out along the yard's front
  // edges (one collider per segment).
  fence: {
    height: 3.2, post: 0.6, spacing: 3.6, rails: [1.35, 2.55], rail: [0.42, 0.3],
    lines: [
      [[-18.3, -43.5], [-50.7, -43.5], [-71.6, 20]],
      [[18.3, -43.5], [50.7, -43.5], [71.6, 20]],
    ],
  },
  // L-shaped posts with a lantern hanging off the arm (side = which way the arm reaches).
  lamps: [
    { x: -21.2, z: -40.2, side: -1 },
    { x: 21.2, z: -40.2, side: 1 },
  ],
  lampHeight: 11,
  // Left of the arch: the Trails display (a horse galloping in place over a glowing ring
  // with a lava trail streaming behind it, a low stone wall at its back; its ring is the
  // Trails hub pad, HUB) and the world portal (worlds.js: the Frontier Town gate, its
  // requirements written on the glowing fill like the reference's Snow portal).
  trails: { x: -37.5, z: -22.5, horseScale: 1.7, wall: { z: -27.5, from: -49, to: -34, depth: 2.6 }, trailLength: 17 },
  portal: { x: -28.8, z: -33.5, width: 5.4, height: 7.4, frame: 1.6, depth: 2 },
  // Right of the arch: the three leaderboards (PLAZA.leaderboards stats, fed with the plaza's),
  // each with its top player's Bloxity avatar + pets standing on it (lobby.js); `style` = the frame.
  boards: [
    { stat: 'energy', x: 25.4, z: -34, style: 'cyan' },
    { stat: 'trophies', x: 29, z: -29.5, style: 'gold' },
    { stat: 'rebirths', x: 33.4, z: -25, style: 'blue' },
    { stat: 'playtime', x: 38.6, z: -18.5, style: 'green' },
  ],
  boardScale: 0.92,
  boardFacing: [2, -14], // the point every board turns its face to
  boardLean: 0.06, // rad the boards lean back
  // Christmas dressing (decor.js), all of it off with `festive: false`: string lights and a
  // wreath on the arch, the tree behind the boards, candy canes, a snowman, presents.
  festive: true,
  tree: { x: 52, z: -51, height: 30 },
  canes: [
    { x: -58, z: -49, height: 16.5 },
    { x: -50, z: -50, height: 12.5, turn: 2.6 },
    { x: 35, z: -48, height: 15 },
  ],
  pines: [
    [-48, -55, 17.5],
    [-56, -40, 13],
    [-66, -18, 15],
    [60, -42, 12],
  ],
  snowman: { x: -24.5, z: -38.5 },
  gifts: [
    // x, z, size, box, ribbon, yaw
    [-33.6, -29.5, 2.2, '#2fc2b8', '#ffffff', 0.3],
    [-31.4, -31.6, 2.8, '#e8262b', '#ffffff', -0.2],
    [-35.5, -27.8, 1.4, '#e8262b', '#ffd21a', 0.6],
    [24.2, -22.5, 2.3, '#e8262b', '#ffd21a', 0.4],
  ],
  // Market tents beside the road just past the arch: x, z, size, roof stripes.
  tents: [
    [-24, -60, 5.5, '#ffd21a', '#2f6bff'],
    [25, -58, 5.5, '#e8262b', '#ffffff'],
  ],
  // The Partner stage, the west view (after the reference): a raised stone stage, its front (+X)
  // toward the spawn, with a step and four red carpets running up it; the partners stand on it
  // (`show`, south to north = left to right from the spawn; each one buys / equips that PARTNER,
  // interact.js), a low stone wall behind them, and the red barn behind that with the "Partner"
  // sign over it (westScenery.js). x / z = the stage's centre; length runs along z.
  partner: {
    x: -35, z: 6, length: 30, depth: 7, height: 1.3, step: 1.8, wall: 1.4, scale: 2,
    carpets: [-10.5, -3.5, 3.5, 10.5], carpet: 3.8,
    show: ['anna', 'p456', 'grace', 'younghee', 'diana', 'guard', 'elsa'],
  },
  pump: { x: 82, z: -28, scale: 1.6 }, // the ranch's wind pump out by the east barn (the Frontier Town's welcome sign)
  trees: [], // x, z, height: ranch oaks on the yard (the plaza has its own, in PLAZA)
  colors: {
    wood: '#8a5631', // arch, fences, lamp posts
    woodDark: '#6b3f22', // the RACE sign
    woodLight: '#a8703f',
    pad: '#ffd21a',
  },
}

// Oak trees (propkit.js), shared by the ranch, the plaza, the hill and the race scenery.
export const OAK = { trunk: '#7a4f2a', leaves: ['#3f9e32', '#4fb33c', '#5cbf45', '#378a2c'] }

// --- Training plaza at the back of the ranch (plaza.js) ---------------------------
// The reference's south view: two Train stations (green fields with a white curb on grey
// pavement) either side of a road to a ring portal in front of a snowy Christmas tree, ringed
// by grey rock cliffs with pines and far mountains. Facing it (+Z), +X is screen-left.
export const PLAZA = {
  platform: { width: 20, depth: 24, height: 0.35, curb: 0.55 },
  // Each station: six treadmill lanes in a straight grid of two rows of three
  // (station frame: rowZ/colX are lane centres), the whole station turned by its
  // yaw (0: square-on, side by side with a narrow road between them, like the
  // reference; the portal and decks are behind their back rows). A lane
  // (the training zone, training.js) is ~2x the horse's length; the treadmill on
  // it is `mill` (belt between two glowing rails, a console at the far end).
  // `neon` is each lane's colour, listed front row first, left to right as seen
  // from the spawn; `req`/`power` are the tags over the consoles. The front edge
  // stays behind the Eggs stall; the back clears the tree and cliffs.
  lane: { width: 4.2, length: 7.6, rowZ: [-6.5, 4.3], colX: [6.3, 0, -6.3] },
  mill: { width: 3.3, rail: 0.42, consoleHeight: 2.5 },
  // Behind each station (where its leaderboards stood): a raised wooden deck reached by steps
  // from the treadmills, a stone wall at its back, and two catalog horses on glowing pads
  // (`horses` per train: id, pad colour; buyable with E like the stall's horses).
  deck: { steps: 4, step: 0.375, tread: 0.55, depth: 4.6, wall: 1.5, horseScale: 2, inset: 3.5 }, // inset: m short of the field's inner edge (the portal stands between the decks)
  trains: [
    {
      x: 15, z: 34, yaw: 0,
      horses: [['rainbowAlicorn', '#ff5fd8'], ['galaxy', '#9a4dff']],
      neon: ['#eef4ff', '#2bff4a', '#2fb8ff', '#b63bff', '#ff2a2a', '#ff8a1a'],
      req: ['0', '1K', '5K', '35K', '400K', '1M'],
      power: ['+1', '+3', '+5', '+10', '+20', '+30'],
    },
    {
      x: -15, z: 34, yaw: 0,
      horses: [['pegasus', '#2fe0ff'], ['skeleton', '#3f7bff']],
      neon: ['#eef4ff', '#2bff4a', '#2fd8ff', '#ff3bd8', '#ff3b2a', '#ffa21a'],
      req: ['4M', '15M', '50M', '300M', '1.5B', '5B'],
      power: ['+40', '+50', '+60', '+70', '+80', '+90'],
    },
  ],
  // The leaderboards (lobby.js puts them by the RACE arch: LOBBY.boards), keyed by the saved stat
  // the backend ranks (leaderboard.ts LEADERBOARD_STATS): title over the board, the stat column's
  // heading and its colour. Rows come from the server's `leaderboard`.
  leaderboards: {
    rebirths: { title: '🔄 Rebirth', column: 'Rebirth', color: '#ff3d8b' },
    trophies: { title: '🏆 Wins', column: 'Wins', color: '#ffe14a' },
    energy: { title: '⚡ Power', column: 'Power', color: '#5fd0ff' },
    playtime: { title: '⏱️ Playtime', column: 'Time', color: '#7dff6a' },
  },
  // The ring portal on its snow mound (worlds.js; the circle in front of it is WORLDS.portal).
  vip: { x: 0, z: 52 }, // between the decks, behind the stations' back rows
  portal: { radius: 3.4, y: 4.6, open: '#3dff6a', locked: '#ff4f6a' }, // the swirl's colour (worlds.js)
  // Grey pavement under both stations and round the portal, its front edge just in front of
  // the stations: rounded rectangles [x0, z0, x1, z1, corner radius].
  pavement: [[-27, 19, 27, 48, 5]],
  // Behind the portal: the snowy Christmas tree on a patch of snow, candy-striped poles with
  // lights either side of the portal, candy canes, an autumn pine, the snowman, and snowfall.
  tree: { x: 4, z: 62.5, height: 28 }, // behind-left of the portal (screen-left = +X)
  snow: { x: 0, z: 56, rx: 17, rz: 10 },
  poles: { dx: 6.9, dz: -0.5, height: 11 }, // lights hang between their tops
  santa: { x: 5.6, z: 47.8 },
  gifts: [[-5.8, 47.6, 1.5, '#e8262b', '#2bd14a', 0.3], [-7.1, 48.6, 1.1, '#2f6bff', '#ffffff', -0.4], [-4.7, 46.9, 0.9, '#2bd14a', '#e8262b', 0.8]],
  // A slate stone statue of a rearing horse and rider on a pedestal behind the portal (x, z,
  // scale: 1 = ~9 m tall).
  statue: { x: -8.5, z: 60, scale: 1.9 },
  canes: [
    { x: -12.2, z: 56.4, height: 11 },
    { x: -15.2, z: 58.4, height: 14, turn: 2.8 },
  ],
  orangePine: [-34, 55, 15],
  snowman: { x: 32.5, z: 48 },
  windmill: { x: 41, z: 53, scale: 2.2 },
  snowfall: { x: 0, z: 39, sx: 40, sz: 26, y: 26, count: 260 },
  // Far grey mountains past the cliffs (x, z, radius, height), the ranch only.
  mountains: [[-120, 190, 70, 95], [-20, 230, 90, 120], [90, 200, 75, 100], [180, 150, 60, 80], [-200, 140, 60, 70]],
  // Kiosks just outside the stations' outer edges.
  golden: { x: 39, z: 32 },
  index: { x: 36, z: 43 },
  relics: { x: -39, z: 35 },
  chest: { x: -36, z: 45 },
  // x, z, width, depth, height, yaw
  cliffs: [
    [0, 89, 34, 16, 32, 0],
    [-39.1, 88.7, 32, 18, 27, 0.25],
    [39.1, 88.7, 32, 18, 25, -0.25],
    [-67.7, 49.5, 22, 40, 22, 0.55],
    [67.7, 49.5, 22, 40, 24, -0.55],
    [-79.6, 13.9, 16, 30, 18, 0.2],
    [79.6, 13.9, 16, 30, 16, -0.2],
    [-26.1, 79.3, 12, 8, 13, 0.1],
    [26.1, 79.3, 12, 8, 11, -0.1],
  ],
  // x, z, y (cliff top or 0), height: pines on the ranch (oaks no more), cacti in the Frontier Town
  trees: [
    [-8, 87, 32, 11],
    [10, 92, 32, 12],
    [-33.1, 83.7, 27, 12],
    [-47.1, 90.7, 27, 11],
    [35.1, 84.7, 25, 12],
    [49.1, 91.7, 25, 11],
    [-61.7, 39.5, 22, 11],
    [-69.7, 57.5, 22, 10],
    [61.7, 37.5, 24, 12],
    [71.7, 59.5, 24, 10],
    [-26.1, 78.3, 13, 9],
    [26.1, 78.3, 11, 10],
    [-22, 61, 0, 12],
    [24, 61, 0, 13],
    [14, 71, 0, 11],
    [-14, 72, 0, 12],
    [38, 20, 0, 13],
    [-42, 27, 0, 12],
  ],
  // The ranch's cliffs: grey rock with grassy tops (buildCliff's palette). Those behind the plaza
  // (|x| < `hillsWithin`) are drawn as green grassy hills instead, pines on them (environment.js).
  hillsWithin: 45,
  rock: '#a4a8b2',
  rockDark: '#7c818c',
  grass: '#43c03a',
  grassLight: '#7ae04c',
}

// --- Shop stalls (shops.js) ---------------------------------------------------------
// Either side of the spawn, fronts facing it: Eggs past the statue wall (east
// view, +X) and Horses on the west side (-X). Items are listed left to right as
// seen from the front.
export const SHOPS = {
  // The open egg platform out east, after the reference's east view: a long low concrete
  // platform (front edge toward the spawn, -X) with a stone wall behind it, the eggs on gift-box
  // pedestals in a row along it from z0 to z1 (north to south), the "Eggs" sign over the middle.
  eggs: {
    x: 46, // the pedestals' line
    z0: -14,
    z1: 16.4,
    platform: { front: 41.5, back: 50.5, height: 0.9, overhang: 4 }, // overhang: m past the end eggs
    wall: { height: 3.6, depth: 1.6 }, // dark stone blocks along the platform's back edge
    eggScale: 1.55, // the eggs and pedestals are Roblox-big (an egg ~3 m tall)
    // price: Wins (trophies) per hatch; pets: hatch odds by PETS kind (weights, any total).
    // Look: color, horns, slime (green jelly with drips), rainbow (+ cloud), wings + ring (the
    // premium angel egg); stand = the pedestal ribbon colour, aura = a stronger glow.
    eggs: [
      { name: 'Sunny Egg', price: 30, color: '#ffd21a', stand: '#4f8bff', pets: { dog: 55, cat: 35, bunny: 10 } },
      { name: 'Horned Egg', price: 1e3, color: '#ffa31a', horns: true, stand: '#ff8a1a', pets: { cat: 40, bunny: 35, bear: 20, fox: 5 } },
      { name: 'Jungle Egg', price: 20e3, color: '#3ddc4a', slime: true, glow: 0.8, stand: '#22c84a', pets: { bunny: 30, bear: 40, fox: 25, panda: 5 } },
      { name: 'Rainbow Egg', price: 500e3, rainbow: true, cloud: true, stand: '#e8262b', pets: { fox: 50, panda: 40, dragon: 10 } },
      { name: 'Angel Egg', price: 10e6, color: '#a24bff', wings: true, ring: true, aura: true, glow: 0.9, stand: '#ff3bd8', pets: { panda: 45, dragon: 45, hugeDemon: 10 } },
    ],
  },
  horses: {
    x: 42,
    z: 27,
    yaw: Math.PI, // front faces -Z (north, toward the egg platform's south end)
    width: 16,
    depth: 7,
    horseScale: 1.9,
    horseAngle: 0.55, // rad each horse is turned from side-on toward the front
    horses: [
      // stat: the number under the name; fx: 'aura' (rising glow + sparkles) or 'fire'; glow: neon/particle colour
      // id: the HORSES catalog horse it shows and sells (interact.js); facing: nose toward +X (1) or -X (-1).
      { id: 'royalUnicorn', name: 'ROYAL UNICORN', labelColor: '#ff3b3b', facing: -1, stat: '1699', fx: 'aura', glow: '#3dff6a' },
      { id: 'inferno', name: 'INFERNO NIGHTMARE', labelColor: '#ff3b3b', facing: 1, stat: '90', fx: 'fire', glow: '#ff8a1a' },
    ],
  },
}

// --- The west backdrop (westScenery.js) -----------------------------------------------
// Behind the Partner stage (LOBBY.partner), after the reference's west view: the big red barn
// (front = a gable end `width` wide, turned by yaw toward the spawn; white trim, X-braced doors with
// a wreath, a loft door, a lean-to porch along its south side hung with string lights), the
// "Partner" sign in front of it, pines, an orange autumn pine, candy canes (LOBBY.festive) and grey
// low-poly mountains [x, z, radius, height] on the west horizon.
export const WEST = {
  barn: { x: -52, z: 7, yaw: Math.PI / 2, width: 21, depth: 20, height: 10.5, roofRise: 8.5, wall: '#d42a2a', roof: '#5d6470', trim: '#f4f6f2' },
  porch: { width: 5.5, depth: 10, height: 5.5 },
  pines: [[-45, 28.5, 17], [-51, 31, 14], [-50, -10, 15]],
  orangePines: [[-55, -14, 13]],
  canes: [
    { x: -38.5, z: 24, height: 13 },
    { x: -41.5, z: 28, height: 16, turn: 2.6 },
  ],
  mountains: [[-240, -70, 75, 95], [-270, 40, 95, 125], [-230, 140, 60, 75], [-310, -170, 85, 105]],
}

// --- The east backdrop (eastScenery.js) -----------------------------------------------
// Behind the egg platform, after the reference's east view: the farmhouse (front = gable end with
// the X door, turned by yaw toward the spawn), a block of corn behind the stone wall, a round oak,
// candy canes (LOBBY.festive), pines, and grey low-poly mountains [x, z, radius, height, seed].
export const EAST = {
  barn: { x: 74, z: -15, yaw: -Math.PI / 2, width: 19, depth: 16, height: 11, roofRise: 8, wall: '#a8b8aa', roof: '#6d7d92', trim: '#f4f6f2' },
  corn: { x0: 53, x1: 60, z0: -12, z1: 12, spacing: 1.1, height: 4.4 },
  oak: [57, 1, 12],
  canes: [
    { x: 56, z: 13, height: 18 },
    { x: 58.5, z: 18, height: 13, turn: 2.6 },
  ],
  pines: [
    [76, -30, 20],
    [60, -26, 15],
    [66, -4, 14],
  ],
  mountains: [
    [190, -70, 70, 80, 1],
    [235, 10, 95, 110, 2],
    [200, 95, 70, 75, 3],
    [260, -150, 90, 95, 4],
    [165, -15, 42, 48, 5],
  ],
  mountainColors: ['#7d848e', '#8e959f', '#a2a9b2', '#b8bec6'],
}

// --- Hub pads (hub.js) ----------------------------------------------------------------
// A glowing touch pad in front of each shop object; driving onto one opens its
// window (once per visit: leave the pad to re-arm it). `open` names the window
// main.js passes in; keep them on the open yard (the boardwalk runs past the Eggs
// stall's front, x > 17). Pets = the Eggs stall, Horses = the Horses stall, Partner = the
// Partner stage (in front of its middle carpets).
export const HUB = {
  radius: 2.6, // m: the pad's size and its trigger distance from the horse's centre
  beamHeight: 1.8, // m of glowing light wall round the rim
  labelY: 3.4,
  labelHeight: 1.3,
  pads: [
    { open: 'pets', name: 'PETS', x: 37.5, z: 1.2, color: '#ffd21a' },
    { open: 'horses', name: 'HORSES', x: 37.5, z: 19.5, color: '#3dff6a' },
    { open: 'partner', name: 'PARTNERS', x: -25.5, z: 6, color: '#ff5fd8' },
    // plain: just the glowing ring (no light wall or tag): it lies under the Trails display horse,
    // whose own "Trails" sign floats above it (lobby.js).
    { open: 'trails', name: 'TRAILS', x: -37.5, z: -22.5, color: '#ff8a1a', plain: true },
  ],
}

// --- Interact prompts (interact.js) ---------------------------------------------------
// Near a shop object, a prompt over it says what E (or a tap on the prompt) does:
// hatch an egg, buy / equip a display horse or a partner on the Partner stage, or
// open a hub pad's window. The nearest
// object in range wins. Radii are m (ground distance) from the object's centre.
export const INTERACT = {
  radius: { egg: 9, horse: 8, statue: 4.5 },
  toastSeconds: 1.8,
}

// --- Eggs and hatching (eggs.js, hatch.js) -----------------------------------------------
// E at a stall egg opens its window (the egg, its Wins price, every pet with its
// odds + multiplier, Open 1 / Open N / Auto); a hatch pays, rolls (SHOPS.eggs
// `pets` weights, then a tier at its chance x luck) and plays the overlay. Ported
// from Kayak & Surf's eggs.js / hatch.js.
export const EGG_HATCH = {
  closeRange: 13, // m: driving further than this from the open egg closes its window
  openMany: 3, // eggs per Open N
  autoDelay: 0.35, // s between Auto's hatches
  time: { shake: 1.6, reveal: 1.8, auto: 0.55 }, // s: eggs shaking, cards shown; Auto plays at x`auto`
  // [PETS.tiers index, chance per hatch], rarest first; each chance x luck (1 + the boosts' luck %).
  tiers: [
    [2, 1 / 1000], // Rainbow
    [1, 1 / 50], // Golden
  ],
  rays: ['rare', 'epic', 'legendary'], // rarities with light rays behind the revealed card
  rarityColor: { common: '#e4e8f0', uncommon: '#6ee36e', rare: '#59b8ff', epic: '#c77dff', legendary: '#ffc93a' },
}

// --- Horses window (horses.js) + catalog looks (horseModels.js) ---------------------
// The whole horse inventory, in window order (4 per row), in the slots of the boat
// game's Boats reference: same prices and stats. Every horse is
// bought with Wins (the HUD's trophy counter); only the Brown Pony is free (price
// null). wins / luck / acc are % boosts; `rarity` colours the
// tile, preview and name. The first two were Robux items in the reference: their
// Wins price comes from where their stats land on the ladder.
export const HORSES = {
  preloadDelayMs: 4000, // tile pictures start drawing this long after boot
  start: { owned: ['pony'], equipped: 'pony' },
  rarity: { premium: '#ff5b37', common: '#d4d4d4', uncommon: '#62d65c', rare: '#2ba8f4', epic: '#ec5fc0', legendary: '#ffc61f' },
  // Horse name colour on the blue card, per rarity.
  nameColor: { premium: '#ff5b37', common: '#e4e4e4', uncommon: '#7dff6a', rare: '#bfeaff', epic: '#ff9ce0', legendary: '#ffd52e' },
  // The 20 horses, in grid order: two premium horses (priced from their stats), then the ladder.
  // Only the Brown Pony is free. stats are % boosts (wins, luck, acc). look dresses the model (horseModels.js):
  // colours (coat, mane = one or a list per tuft, tail, muzzle, hoof, blaze, sock(s), blanket, trim,
  // saddle) and extras (size, ears, horn, wings, armor, stripes, spots, feathers, maneGlow, eyesGlow,
  // hornGlow, shine = metallic coat).
  list: [
    { id: 'inferno', name: 'Inferno Nightmare', rarity: 'premium', price: 50e9, wins: 300, luck: 60, acc: 300, look: { coat: '#1b1518', mane: ['#ff3a12', '#ff8a1a', '#ffd23a'], maneGlow: true, eyesGlow: '#ff6a1a', muzzle: '#241c1f', hoof: '#ff5a1a', blaze: false, blanket: '#2a2226', trim: '#ff6a1a', saddle: '#3a2a22' } },
    { id: 'royalUnicorn', name: 'Royal Unicorn', rarity: 'premium', price: 1e18, wins: 1200, luck: 150, acc: 800, look: { coat: '#f4fbf6', mane: ['#3dff4a', '#a8ffb0'], maneGlow: true, horn: '#3dff4a', hornGlow: true, muzzle: '#e2efe6', hoof: '#c9a43a', blaze: false, blanket: '#0d1f10', trim: '#3dff4a', saddle: '#1d5a26', size: 1.08 } },
    { id: 'pony', name: 'Brown Pony', rarity: 'common', price: null, wins: 10, luck: 5, acc: 20, look: { size: 0.86 } },
    { id: 'palomino', name: 'Palomino', rarity: 'common', price: 200, wins: 20, luck: 7, acc: 50, look: { coat: '#e0ab4f', mane: '#fbf0d2', muzzle: '#c78e3a', blanket: '#2f8ad8' } },
    { id: 'greyMare', name: 'Dapple Grey', rarity: 'common', price: 1e3, wins: 30, luck: 9, acc: 70, look: { coat: '#9da3ab', mane: '#4a4e55', muzzle: '#6e737b', blaze: false, spots: { color: '#c9ced4', where: 'all', count: 22, size: 0.08 }, blanket: '#5a2e8a' } },
    { id: 'donkey', name: 'Speedy Donkey', rarity: 'common', price: 5e3, wins: 45, luck: 12, acc: 95, look: { coat: '#8a8178', mane: '#3a3532', muzzle: '#e8e2d8', ears: 'long', blaze: false, size: 0.84, blanket: '#c8262b' } },
    { id: 'mustang', name: 'Wild Mustang', rarity: 'uncommon', price: 40e3, wins: 65, luck: 15, acc: 120, look: { coat: '#c4894a', mane: '#1d1714', muzzle: '#8a5a2e', socks: true, sock: '#2a211c', blaze: false, blanket: '#4c5a2c', trim: '#c9b45a' } },
    { id: 'blackStallion', name: 'Black Stallion', rarity: 'uncommon', price: 320e3, wins: 90, luck: 19, acc: 150, look: { coat: '#1f1d22', mane: '#0d0c0f', muzzle: '#2c2a30', blaze: '#f2ece0', blanket: '#a8561a', trim: '#f2ece0' } },
    { id: 'appaloosa', name: 'Appaloosa', rarity: 'uncommon', price: 2.6e6, wins: 120, luck: 24, acc: 185, look: { coat: '#f3eee4', mane: '#4a3424', muzzle: '#8a6a52', blaze: false, spots: { color: '#6b4428', count: 18, size: 0.075 }, blanket: '#13857a' } },
    { id: 'arabian', name: 'Red Arabian', rarity: 'uncommon', price: 21e6, wins: 150, luck: 29, acc: 220, look: { coat: '#a8411f', mane: '#f0c98a', muzzle: '#7a2e16', socks: true, blanket: '#2a2a33', trim: '#ffcf3a', size: 0.96 } },
    { id: 'zebra', name: 'Zebra', rarity: 'rare', price: 170e6, wins: 185, luck: 34, acc: 260, look: { coat: '#f6f6f2', mane: ['#16161a', '#f6f6f2'], tail: '#16161a', muzzle: '#2a2a2e', blaze: false, stripes: { color: '#16161a' }, blanket: '#25335a' } },
    { id: 'clydesdale', name: 'Clydesdale', rarity: 'rare', price: 1.4e9, wins: 225, luck: 40, acc: 300, look: { coat: '#6b3a1e', mane: '#1d140f', muzzle: '#4a2814', socks: true, feathers: true, size: 1.16, blanket: '#b83a2c' } },
    { id: 'thoroughbred', name: 'Racing Thoroughbred', rarity: 'rare', price: 11e9, wins: 270, luck: 46, acc: 340, look: { coat: '#5a2e18', mane: '#151110', muzzle: '#3d1f10', socks: true, blanket: '#f4f4f4', trim: '#2f9df0', size: 1.04 } },
    { id: 'knight', name: "Knight's Charger", rarity: 'rare', price: 88e9, wins: 320, luck: 52, acc: 380, look: { coat: '#e9e6e0', mane: '#8a8f98', muzzle: '#bdb8b0', blaze: false, armor: { plate: '#b9c1cc', cloth: '#24427e', trim: '#ffd23a' }, blanket: '#24427e', size: 1.06 } },
    { id: 'mecha', name: 'Mecha Horse', rarity: 'epic', price: 700e9, wins: 375, luck: 58, acc: 420, look: { coat: '#7c828c', mane: ['#3aa6ff', '#9ae0ff'], maneGlow: true, eyesGlow: '#4ad8ff', muzzle: '#4a4f57', hoof: '#33373d', blaze: false, stripes: { color: '#3ad8ff', kind: 'seams' }, shine: 0.75, blanket: '#3c3f46', trim: '#3ad8ff', saddle: '#2a2c33' } },
    { id: 'skeleton', name: 'Skeleton Horse', rarity: 'epic', price: 5.6e12, wins: 430, luck: 63, acc: 455, look: { coat: '#ece6d4', mane: '#2a2b30', muzzle: '#d6cfba', hoof: '#2a2b30', blaze: false, eyesGlow: '#7aff4a', stripes: { color: '#3a3b40', kind: 'ribs' }, blanket: '#26272c', trim: '#ffcc22' } },
    { id: 'pegasus', name: 'Pegasus', rarity: 'epic', price: 45e12, wins: 480, luck: 68, acc: 480, look: { coat: '#f7f8fc', mane: ['#9fd8ff', '#d6eeff'], muzzle: '#e4e7f0', hoof: '#c9a43a', blaze: false, wings: '#ffffff', wingTips: '#cfe9ff', blanket: '#3a6ad8', trim: '#ffd23a' } },
    { id: 'galaxy', name: 'Galaxy Steed', rarity: 'epic', price: 360e12, wins: 530, luck: 72, acc: 500, look: { coat: '#2a1452', mane: ['#d06bff', '#5ab8ff', '#ff8af3'], maneGlow: true, eyesGlow: '#ffffff', muzzle: '#1d0e3a', hoof: '#d06bff', blaze: false, spots: { color: '#ffffff', where: 'all', count: 26, size: 0.035, glow: true }, blanket: '#17171b', trim: '#d06bff' } },
    { id: 'golden', name: 'Golden Stallion', rarity: 'legendary', price: 2.9e15, wins: 565, luck: 76, acc: 515, look: { coat: '#f2b818', mane: ['#fff2a8', '#ffd84a'], maneGlow: true, muzzle: '#d99a10', hoof: '#fff2a8', blaze: false, shine: 0.85, blanket: '#1e1f24', trim: '#d8a21a', saddle: '#3a2a1c', size: 1.08 } },
    { id: 'rainbowAlicorn', name: 'Rainbow Alicorn', rarity: 'legendary', price: 23e15, wins: 600, luck: 80, acc: 530, look: { coat: '#fdf6ff', mane: ['#ff3b3b', '#ff9a1a', '#ffe11a', '#3ddc4a', '#2f9df0', '#a05aff'], maneGlow: true, horn: '#ffe9a8', hornGlow: true, wings: '#ffffff', wingTips: '#ffc8f4', muzzle: '#f0e4f6', hoof: '#c9a43a', blaze: false, blanket: '#2f9df0', trim: '#ffe11a', size: 1.1 } },
  ],
  thumb: { width: 256, height: 320, outline: 7, budgetMs: 12 }, // px of each rendered tile picture, ms of drawing per frame (horseThumbs.js)
}

// A wooded hill out in the meadow, seen past the stall in the east view (the Frontier Town's
// water tower stands on top). trees: [x, z, height] from its centre.
export const HILL = { x: 115, z: -40, hill: { rx: 36, ry: 9, rz: 24 }, trees: [[-6, -3, 12], [5, 4, 10], [12, -6, 9], [-14, 6, 8]] }

// --- Player horse (horse.js) -----------------------------------------------------
export const HORSE = {
  length: 3.1, // m nose to tail (the Trails scene's framing)
  saddle: 1.7, // m the saddle's top above the hooves
  riderY: 1.08, // m the rider's root (its feet at bind pose) above the hooves: seated, hips on the saddle
  riderZ: -0.04, // m the rider sits behind the saddle's centre
  seatZ: -0.56, // m behind the saddle's centre the partner's seat is (on the back, behind the cantle)
  // Model sizes (m, hooves at y 0, nose +Z): barrel ellipsoid, legs hanging from hipY with the knee
  // (hock) at kneeY and the fetlock at fetlockY, the saddle at saddleZ.
  dims: { barrelY: 1.15, barrelLength: 1.9, barrelHeight: 0.86, barrelWidth: 0.78, hipY: 0.98, kneeY: 0.48, fetlockY: 0.2, frontZ: 0.66, hindZ: -0.64, saddleZ: 0.08, neckRadius: 0.22, neckLength: 0.42 },
  // Default colours (a catalog mount overrides some): blaze = the white stripe down the face (false = none).
  look: {
    coat: '#8a5a32', mane: '#2e1d12', hoof: '#2a2420', muzzle: '#6b4428', blaze: '#f2ece0', socks: false, sock: '#f2ece0',
    blanket: '#d8343a', trim: '#ffd84a', saddle: '#6b3b1d', leather: '#3b2414', metal: '#c9ced6',
  },
  glow: 1.5, // HDR multiplier on a horse's glowing mane / eyes / horn / seams with bloom on
  dust: { color: '#a9845a', opacity: 0.85, from: 2.5, full: 7 }, // hoof dust: fades in between `from` and `full` m/s
  // Gaits (horse.js): walk -> trot over toTrot m/s, trot -> gallop over toGallop; one cycle per
  // `stride` m (rate clamped to minRate..maxRate Hz). The legs are solved (IK) to put each hoof
  // where its gait says: a hoof is down for `duty` of the cycle, sliding back over `reach` x the
  // no-slip distance (duty x stride / 2), then swings forward `lift` m up with the hoof flipped
  // `flip` rad (hind hooves `hindLift` of both). bob = m the body rises per footfall, rock = rad the
  // gallop rocks it. restZ = m the front / hind hooves stand ahead of their hips; stand = m the body
  // sits below its build height so the standing legs keep a little bend; jump* = [upper, lower,
  // pastern] rad tucked in the air.
  gait: {
    idleSpeed: 0.25,
    toTrot: [2.2, 3.6],
    toGallop: [6.5, 9.5],
    minRate: 0.7,
    maxRate: 3,
    reach: 0.85,
    walk: { stride: 1.5, duty: 0.62, lift: 0.11, flip: 0.5, bob: 0.025 },
    trot: { stride: 2.5, duty: 0.48, lift: 0.22, flip: 1.0, bob: 0.05 },
    gallop: { stride: 3.8, duty: 0.38, lift: 0.32, flip: 1.6, bob: 0.08, rock: 0.07 },
    hindLift: 0.7,
    restZ: [0.03, -0.07],
    stand: 0.03,
    jumpFront: [-0.9, 1.9, 0.7],
    jumpHind: [0.6, 0.2, 0.5],
  },
  // How the horse carries itself starting, stopping and turning (horse.js).
  motion: {
    turnRef: 3.5, // rad/s of turning (measured off the horse's own heading) that is a full bend
    rollPerTurn: 0.13, // rad of lean into a full-bend turn at speed
    // Push-off from below `below` m/s at `accel` m/s^2 or more: rump down and nose up (`pitch`,
    // `drop` m), hind hooves gathered `hindTuck` m under the body, neck stretched out and down.
    launch: { accel: 12, below: [6, 12], pitch: -0.11, drop: 0.07, hindTuck: 0.3, neck: 0.3, head: -0.18 },
    // Pulling up at `accel` m/s^2 or more: haunches sit, front legs brace `brace` m ahead, the
    // strides shorten, head and neck come up, dust sprays forward.
    halt: { accel: 14, pitch: -0.15, drop: 0.09, brace: 0.3, hindTuck: 0.34, neck: -0.42, head: -0.2 },
    // [rad/s, damping ratio] of the body's and neck's weight: under-damped, so it rocks and settles.
    spring: { body: [10, 0.42], neck: [8, 0.38] },
    settleFrom: 6, // m/s a stop from at least this fast ends in a head toss and shake
    idleEvery: [2.5, 6], // s between idle fidgets (look round, paw, sniff, shake, rest a hind leg)
  },
  pitchPerAccel: 0.006, // rad of nose-up per m/s^2 of acceleration (on top of the launch / halt poses)
  ease: 6, // 1/s the tilt eases
}

// --- Look ------------------------------------------------------------------
export const RENDER = { exposure: 1.0 }
export const FOG = { near: 170, far: 650 }
// The two lighting moods lighting.js blends between (key N toggles).
export const TIME_OF_DAY = {
  transition: 2.5, // s to blend day <-> night
  day: {
    zenith: '#1576f0',
    horizon: '#a9e2ff',
    sunColor: '#fff4de',
    // Sun + hemi + env together keep the pale dirt and grass near their own colours;
    // much more and ACES washes it (and the props) out to grey-white.
    sunIntensity: 2.4,
    sunElevation: 55, // degrees above the horizon
    sunAzimuth: 35, // degrees, 0 = from +Z
    hemiSky: '#e4f2ff',
    hemiGround: '#d8c39a',
    hemiIntensity: 0.8,
    envIntensity: 0.45,
    lampIntensity: 0,
    stars: 0,
    exposure: 0.95,
  },
  night: {
    zenith: '#050b22',
    horizon: '#24345e',
    sunColor: '#9fb4ff', // the moon
    sunIntensity: 0.55,
    sunElevation: 38,
    sunAzimuth: -60,
    hemiSky: '#3a4c80',
    hemiGround: '#1a1a22',
    hemiIntensity: 0.35,
    envIntensity: 0.25,
    lampIntensity: 30,
    stars: 1,
    exposure: 1.15,
  },
}
export const LIGHT = {
  shadowRange: 40, // half-width of the sun's shadow box around the player
  lampColor: '#ffb35c',
  lampDistance: 22,
}

// --- Worlds (worlds.js, environment.js, town.js) -------------------------------------
// One start island in two looks: the ranch (id `beach`) and the Frontier Town (id `city`;
// the ids are saved, so they keep the boat game's names). The layout, colliders, shops,
// tracks, portal and races are shared; a world only changes the scenery: the yard, the
// meadow tint, sky, the far horizon, the plaza's cliffs, the trees, the pump and the hill. The VIP portal on the plaza
// (PLAZA.vip) moves the player between them: to a world with `req` once the player
// has that many rebirths and that much Power (lightning) at the same time (after that
// it stays open, saved by the server), back to the ranch at any time.
export const WORLDS = {
  start: 'beach',
  // Driving into this circle (radius m, `dz` m from the dais centre toward the spawn) uses the portal.
  portal: { dz: -5.2, radius: 3.2, swapDelay: 0.12 }, // swapDelay: s into the white flash the world changes
  list: {
    beach: { name: 'Ranch', ground: { texture: 'grass', tint: GROUND.tint }, sky: TIME_OF_DAY },
    city: {
      name: 'Frontier Town',
      req: { rebirths: 10, power: 200 },
      ground: { texture: 'sand', tint: '#ffffff' }, // sun-baked desert (TOWN.sand)
      // Golden-hour desert by day, purple by night (N).
      sky: {
        day: {
          zenith: '#4560c4',
          horizon: '#ffc4a0',
          sunColor: '#ffd8b0',
          sunIntensity: 2.2,
          sunElevation: 26,
          sunAzimuth: 35,
          hemiSky: '#ffe2d2',
          hemiGround: '#8e909a',
          hemiIntensity: 0.8,
          envIntensity: 0.5,
          lampIntensity: 0,
          stars: 0,
          exposure: 0.95,
        },
        night: {
          zenith: '#0b0724',
          horizon: '#3c2860',
          sunColor: '#b4acff',
          sunIntensity: 0.5,
          sunElevation: 38,
          sunAzimuth: -60,
          hemiSky: '#4a3c84',
          hemiGround: '#1c1a26',
          hemiIntensity: 0.4,
          envIntensity: 0.3,
          lampIntensity: 30,
          stars: 0.45,
          exposure: 1.15,
        },
      },
    },
  },
}

// The Frontier Town look (town.js), the second world (id `city`). It stands on the ranch's
// footprints with the same colliders: the tall plaza cliffs become red sandstone buttes, the low
// ones wooden storefronts facing the plaza (`plaza` = the point their fronts turn toward), cacti
// and oil lamps take the oaks' places, a water tower stands on the hill, red mesas ring the horizon.
export const TOWN = {
  sand: ['#d6a46c', '#f0d09c'], // the desert dirt's dark / light (paintDirt), on the slab and to the horizon
  side: '#b07a4a',
  butteFrom: 20, // m: a footprint at least this tall is a butte, not a building
  rock: { rock: '#d07a48', rockDark: '#8a3a22', grass: '#e3b27a', grassLight: '#f2cf98' }, // buildCliff palette
  plaza: [0, 30],
  shops: ['SALOON', 'GENERAL STORE', 'SHERIFF', 'BANK', 'HOTEL', 'BARBER', 'BLACKSMITH', 'POST OFFICE'],
  planks: '#e6dccb', // pale weathered boards, painted by `walls`
  walls: ['#b07a4a', '#f4ead8', '#9cc4d8', '#e89a82', '#b8d49a', '#f2d27a', '#c8a0d8', '#8a5a32'], // paint on the plank walls
  trim: '#f6f1e6',
  roof: '#6b4428',
  cactus: '#3f8a3a',
  lamp: { post: '#4a2f1c', light: '#ffcf7a' },
  tower: { wood: '#9a6a3e', tank: '#b07a4a', roof: '#6b4428' }, // the water tower on the hill
  // Far horizon: red mesas instead of the hills, none in the race track's way.
  mesas: { count: 26, distance: [260, 470], height: [22, 60], width: [40, 110], seed: 77 },
}

// Default (fallback) character look, used only when player.glb cannot load.
export const CHARACTER_COLORS = { skin: '#f2c79a', suit: '#2f6fd0', hair: '#4a2f1c' }

export const MATERIAL_PBR = {
  PLAYER: { roughness: 0.7, metalness: 0 },
  GROUND: { roughness: 0.95, metalness: 0 },
}

// --- Graphics presets, picked by the Bloxity graphics_quality setting ----------
export const GRAPHICS_PRESETS = {
  Low: { shadows: false, shadowMap: 512, antialias: false, dpr: 1, bloom: false, particles: 0.35 },
  Medium: { shadows: true, shadowMap: 1024, antialias: false, dpr: 1.25, bloom: false, particles: 0.6 },
  High: { shadows: true, shadowMap: 2048, antialias: true, dpr: 2, bloom: true, particles: 1 },
  Ultra: { shadows: true, shadowMap: 4096, antialias: true, dpr: 2, bloom: true, particles: 1 },
}

// Bloom (postfx.js): only HDR-bright pixels (above threshold, linear, before
// tone mapping) glow: neon rails, treadmill belts, portal, particles. Sunlit sand
// stays under the threshold.
export const BLOOM = { strength: 0.6, radius: 0.35, threshold: 2.0 }
// Neon materials (propkit.js): k = HDR colour multiplier with bloom on; with
// bloom off they are capped at plainMax so they stay coloured, not white.
export const NEON = { k: 3.5, plainMax: 1.2 }

// Phones and tablets default to a lighter preset when the portal sends no value,
// and any preset is capped there (a phone at DPR 3 renders 9x the pixels; bloom
// is a full-screen multi-pass blur, so it stays off on phones).
export const COARSE_POINTER = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
export const DEFAULT_GRAPHICS = COARSE_POINTER ? 'Medium' : 'High'
export const MOBILE_GRAPHICS_CAP = { dpr: 1.5, shadowMap: 1024, particles: 0.6 }

// The preset to render with on this device.
export function graphicsPreset(name) {
  const p = GRAPHICS_PRESETS[name] ?? GRAPHICS_PRESETS[DEFAULT_GRAPHICS]
  if (!COARSE_POINTER) return p
  const cap = MOBILE_GRAPHICS_CAP
  return { ...p, dpr: Math.min(p.dpr, cap.dpr), shadowMap: Math.min(p.shadowMap, cap.shadowMap), bloom: false, particles: Math.min(p.particles, cap.particles) }
}

// --- Touch controls (touch.js) --------------------------------------------------
export const TOUCH = {
  deadZone: 0.12, // fraction of the joystick radius that does nothing
  lookScale: 1.5, // touch drag pixels -> look, relative to a mouse pixel
  pinchPixelsPerNotch: 30, // finger spread change that equals one wheel notch
}

// --- Rebirth (rebirth.js) -------------------------------------------------------
// A rebirth spends all energy (the lightning total) for a permanent boost.
export const REBIRTH = {
  baseCost: 400, // energy needed for the first rebirth
  costGrowth: 1.75, // each rebirth costs this much more than the one before
  boostPerRebirth: 10, // % boost gained per rebirth (training gains and race Wins, boosts.js)
  startEnergy: 50, // a new player's lightning
}

// --- Training (training.js) ------------------------------------------------------------
// Standing on an unlocked treadmill lane (PLAZA.trains: `req` Wins = trophies to
// unlock, `power` lightning per tick) trains: every `tick` s it pays that power x
// the train boost (boosts.js) in lightning, which is race speed (RACE.speedPerBolt)
// and rebirth energy (one counter, rebirth.js). AUTO TRAIN pays `autoRate` of the
// best unlocked lane anywhere, also mid-race. Driving onto a locked lane says what it needs.
export const TRAIN = {
  tick: 1,
  autoRate: 0.5,
  popupSeconds: 1.1, // the "+N" bolt floating off the horse
}

// --- Pets (pets.js) ----------------------------------------------------------------
// Equipped pets add their multiplier above 1 to the boost (one 1.1x pet = 1.1x).
export const PETS = {
  equipSlots: 3, // pets equipped at once (the "1/3" counter)
  storage: 100, // pets owned at most (the "1/100" counter)
  craftCount: 5, // identical pets that Craft All turns into one of the next tier
  starter: [], // a new player's pets (all equipped): none, every pet is hatched from eggs
  // Pet kinds: name, multiplier, rarity (the portrait disc colour). Looks live in pets.js.
  kinds: {
    dog: { name: 'Doggy', mult: 1.1, rarity: 'common' },
    cat: { name: 'Kitty', mult: 1.25, rarity: 'common' },
    bunny: { name: 'Bunny', mult: 1.5, rarity: 'uncommon' },
    bear: { name: 'Bear', mult: 2, rarity: 'uncommon' },
    fox: { name: 'Fox', mult: 3, rarity: 'rare' },
    panda: { name: 'Panda', mult: 5, rarity: 'epic' },
    dragon: { name: 'Dragon', mult: 10, rarity: 'legendary' },
    // Online Gifts rewards (gifts.js).
    verdant: { name: 'Verdant Demon', mult: 15, rarity: 'legendary' },
    greenfire: { name: 'Greenfire Demon', mult: 25, rarity: 'legendary' },
    star: { name: 'Eternal Star', mult: 60, rarity: 'legendary' },
    // Daily Reward pets (daily.js): Day 2's Ghost Axolotl and the Axolotl Egg's (DAILY.egg).
    axolotl: { name: 'Axolotl', mult: 4, rarity: 'rare' },
    blueAxolotl: { name: 'Blue Axolotl', mult: 8, rarity: 'epic' },
    ghostAxolotl: { name: 'Ghost Axolotl', mult: 12, rarity: 'legendary' },
    sunAxolotl: { name: 'Sun Axolotl', mult: 40, rarity: 'legendary' },
    // Spin wheel jackpot (spin.js): the wheel's "250% HUGE" = +250% boost.
    hugeDemon: { name: 'Huge Ruby Demon', mult: 3.5, rarity: 'legendary' },
  },
  // Craft tiers, in order; a tier multiplies the kind's multiplier.
  tiers: [
    { name: 'Normal', mult: 1 },
    { name: 'Golden', mult: 2.5 },
    { name: 'Rainbow', mult: 6 },
  ],
}

// --- Pets + partner in the world (companions.js) ----------------------------------------
// Equipped pets hover in these slots round the horse (horse frame: +Z = forward, metres; the
// first ones beside the stern, the rest further back and higher), bobbing `bob` m and swinging
// after turns (`turnLag` 1/s). The partner rides pillion on the horse's seat behind the rider.
export const COMPANIONS = {
  slots: [[-2.1, 0.9, -1.4], [2.1, 0.9, -1.4], [0, 1.4, -3.2], [-2.3, 1.4, -3.5], [2.3, 1.4, -3.5], [-1.2, 1.9, -4.8], [1.2, 1.9, -4.8], [0, 2.3, -5.6]],
  petScale: 0.95,
  hugeScale: 1.7, // 'huge…' pet kinds
  bob: 0.14,
  turnLag: 4,
  partnerScale: 0.8,
  // The partner riding (companions.js createRide). Angles in rad; a limb's z is mirrored per side
  // (+ = outward for legs, inward for arms when negative). seat = figure units the hip joints sit
  // above the seat; spring = [rad/s, damping ratio] of its weight sideways, up-down, fore-aft;
  // maxSway m it may drift, sink / lift m the hips may press into / rise off the seat. pitch, slump,
  // roll = rad of torso per m of fore-aft drift, of sinking, of sideways drift; swing / dangle =
  // rad of the lower legs per m of fore-aft drift / of rising; lean (rad, full at leanSpeed m/s)
  // matches the rider's ANIM.ride; look / peekRoll = rad of a glance round / a lean out past the rider.
  ride: {
    seat: 0.12,
    pose: { spine: 0.14, head: -0.08, thigh: [-1.15, 0, 0.62], shin: [1.25, 0, -0.42], arm: [-1.05, 0, -0.42], fore: [-0.75, 0, 0] },
    spring: [[8, 0.5], [15, 0.32], [8, 0.42]],
    accelSmooth: 14,
    maxAccel: 40,
    maxSway: 0.25,
    sink: 0.025,
    lift: 0.06,
    pitch: 2.4,
    slump: 3,
    roll: 2,
    swing: 4,
    dangle: 5,
    lean: 0.28,
    leanSpeed: 14,
    breath: 0.025,
    breathRate: 0.3,
    look: 0.8,
    peekRoll: 0.18,
    fidgetEvery: [2, 5],
  },
}

// --- Online Gifts (gifts.js) -------------------------------------------------------
// Play-time rewards. Order = grid order (4 per row). at = minutes online until the
// gift can be claimed; the clock only runs while the game is open and visible, and
// it starts over once every gift is claimed. type: 'bolt' | 'trophy' (n of them),
// 'pet' (id = PETS.kinds key) or 'potion' (id = GIFTS.potions key). card = card
// colour (grey by default), tag = the small rainbow text over a pet's name.
export const GIFTS = {
  list: [
    { at: 1, type: 'bolt', n: 10 },
    { at: 3, type: 'trophy', n: 10 },
    { at: 5, type: 'bolt', n: 30 },
    { at: 8, type: 'trophy', n: 50 },
    { at: 10, type: 'bolt', n: 100 },
    { at: 15, type: 'pet', id: 'verdant', card: 'yellow' },
    { at: 20, type: 'bolt', n: 150, card: 'blue' },
    { at: 25, type: 'potion', id: 'doubleWin', card: 'red' },
    { at: 30, type: 'pet', id: 'greenfire', card: 'yellow' },
    { at: 40, type: 'potion', id: 'superLuck', card: 'red' },
    { at: 50, type: 'potion', id: 'golden', card: 'purple' },
    { at: 60, type: 'pet', id: 'star', card: 'orange', tag: 'OP!' },
  ],
  // Potions are only counted for now (no potion effects yet). color = liquid.
  potions: {
    doubleWin: { name: 'Potion Double Win', color: '#e8262e', light: '#ff7a7a' },
    superLuck: { name: 'Potion Super Luck', color: '#2fbf4a', light: '#8ff0a0' },
    golden: { name: 'Potion Golden', color: '#ffb800', light: '#ffe88a' },
    rainbow: { name: 'Potion Rainbow', color: '#b05cff', light: '#ffe14a', rainbow: true }, // Daily Reward day 6
  },
}

// --- Daily Reward (daily.js) -------------------------------------------------------------
// A 7-day calendar on the server's UTC clock (backend daily.ts, DAILY_DAYS): each new UTC
// day the player plays unlocks the next day; unlocked days stay claimable (they need not be
// consecutive) and once all 7 are claimed the next day starts over at Day 1. Claims are
// decided by the server; the reward is granted when it says yes. type: 'trophy' (n Wins),
// 'pet' (id = PETS.kinds key), 'potion' (id = GIFTS.potions key, only counted like the
// gifts' ones), 'egg' (n free hatches of DAILY.egg). title = the card's heading; the last
// day is the big card on the right.
export const DAILY = {
  autoOpen: 2.5, // s after joining that a claimable reward pops the window open (0 = never)
  days: [
    { type: 'trophy', n: 30, title: '30 Wins' },
    { type: 'pet', id: 'ghostAxolotl', title: 'Ghost Axolotl' },
    { type: 'trophy', n: 5e3, title: '5K Wins' },
    { type: 'potion', id: 'golden', title: 'Golden Potion' },
    { type: 'trophy', n: 20e3, title: '20K Wins' },
    { type: 'potion', id: 'rainbow', title: 'Rainbow Potion' },
    { type: 'egg', n: 4, title: 'Axolotl Egg' },
  ],
  // Day 7's egg (hatched for free through eggs.js's overlay): hatch weights by PETS kind.
  egg: { name: 'Axolotl Egg', color: '#ff8a1a', pets: { axolotl: 60, blueAxolotl: 30, ghostAxolotl: 8, sunAxolotl: 2 } },
}

// --- Camera (camera.js) -------------------------------------------------------
export const CAMERA = {
  fov: 70,
  near: 0.1,
  far: 1200,
  startPitch: 0.14, // radians above the horizon (low chase cam, like the reference)
  minPitch: -0.35,
  maxPitch: 1.25,
  firstPersonPitch: 1.45, // |pitch| limit looking up/down in player mode
  eyeHeight: 0.92, // eye height as a fraction of player height (player mode)
  distance: 12.4, // resting boom length, m
  minDistance: 2.5, // wheel in past this enters player mode
  maxDistance: 26,
  followLerp: 14, // 1/s: the one smoothing stage, on the point the camera follows
  targetHeight: 1.2, // look-at point as a fraction of player height
  lookSensitivity: 0.0026, // rad per pixel of mouse movement
  zoomStep: 0.9, // m per wheel notch
  zoomEase: 12, // 1/s the zoom glides to its target
  speedFov: 6, // degrees the FOV widens at sprint speed
  speedEase: 3, // 1/s the speed framing eases in and out
  clearEase: 6, // 1/s the boom eases back out once a wall stops blocking it
}

// --- Bloxity (bloxity.js, avatar/) -------------------------------------------------
// SDK setting keys this game listens for; registering a listener makes the control
// appear in the portal's settings menu.
export const SETTINGS = {
  graphics_quality: { def: DEFAULT_GRAPHICS, type: 'enum', values: ['Low', 'Medium', 'High', 'Ultra'] },
  camera_sensitivity: { def: '1', type: 'number', min: 0.1, max: 5 },
  show_fps: { def: 'false', type: 'bool' },
  fullscreen: { def: 'false', type: 'bool' },
  sound_volume: { def: '0.8', type: 'number', min: 0, max: 1 }, // audio/core.js master level
}

// The base rig, measured from player.glb: origin at the feet, 6.4 units tall at bind pose.
export const RIG_HEIGHT = 6.4
// Bind-pose values of the rig nodes the SDK proportions drive.
export const RIG = { armOffsetX: 2, legOffsetX: 0.6, neckOffsetY: 0.6 }
// getProportions() ranges, straight from the SDK spec; clamped before they reach the scene graph.
export const PROPORTIONS = {
  height: { def: 1, min: 0.5, max: 1.6 },
  shoulderWidth: { def: 1, min: 0.5, max: 1.5 },
  armLength: { def: 1, min: 0.05, max: 3 },
  legOffsetX: { def: 1, min: -0.7, max: 5 },
  torsoScaleX: { def: 1, min: 0.3, max: 2 },
  neckHeight: { def: 1, min: 0.94, max: 1.2 },
  headScale: { def: 1, min: 0.3, max: 2.6 },
}

// Procedural animation (avatar/animator.js), ported from Clean Leaves for Loot.
// Rotations are radians in CHARACTER space: +X swings a limb backward, +Y yaws, +Z rolls.
const deg = (d) => (d * Math.PI) / 180
export const ANIM = {
  airborneDelay: 0.07, // s off the ground before the air pose (ignores a step down a ledge)
  // Walk -> run is one cycle at two depths; phase advances with distance travelled.
  locomotion: {
    minFrequency: 0.7,
    maxFrequency: 3.6,
    strideDistance: 3.8, // m per cycle
    idleSpeed: 0.6,
    walkSpeed: 2.5,
    runSpeed: 8,
    sprintSpeed: 13,
    hipSwing: { walk: deg(22), run: deg(42), sprint: deg(56) },
    kneeBend: { walk: deg(30), run: deg(58), sprint: deg(72) },
    armSwing: { walk: deg(18), run: deg(36), sprint: deg(52) },
    elbowBend: { walk: deg(14), run: deg(44), sprint: deg(70) },
    torsoTwist: { walk: deg(4), run: deg(7), sprint: deg(9) },
    torsoLean: { walk: deg(3), run: deg(10), sprint: deg(18) },
    headCounterTwist: { walk: deg(2), run: deg(4), sprint: deg(5) },
    torsoRoll: { walk: deg(2), run: deg(3), sprint: deg(3) },
    bob: { walk: 0.03, run: 0.07, sprint: 0.09 }, // m, on the avatar root
    bankAngle: deg(9),
    bankRate: 8,
  },
  idle: {
    breathFrequency: 0.35,
    breathAmount: deg(1.8),
    breathBob: 0.007,
    basePose: {
      ArmL1: { x: deg(-4), z: deg(8) },
      ArmL2: { x: deg(12) },
      ArmR1: { x: deg(-4), z: deg(-8) },
      ArmR2: { x: deg(12) },
      LegL1: { x: deg(-4) },
      LegR1: { x: deg(4) },
    },
  },
  airborne: {
    rise: {
      LegL1: { x: deg(-38) }, LegR1: { x: deg(8) }, LegL2: { x: deg(62) }, LegR2: { x: deg(40) },
      ArmL1: { x: deg(-40), z: deg(34) }, ArmR1: { x: deg(-30), z: deg(-34) },
      ArmL2: { x: deg(30) }, ArmR2: { x: deg(30) }, Spine1: { x: deg(6) },
    },
    fall: {
      LegL1: { x: deg(-14) }, LegR1: { x: deg(10) }, LegL2: { x: deg(22) }, LegR2: { x: deg(18) },
      ArmL1: { x: deg(-70), z: deg(40) }, ArmR1: { x: deg(-60), z: deg(-40) },
      ArmL2: { x: deg(20) }, ArmR2: { x: deg(20) }, Spine1: { x: deg(-4) },
    },
    velocityReference: 8, // m/s vertical speed that reads as fully rising / falling
  },
  landing: {
    duration: 0.16,
    pose: {
      LegL1: { x: deg(-34) }, LegR1: { x: deg(-34) }, LegL2: { x: deg(58) }, LegR2: { x: deg(58) },
      ArmL1: { x: deg(-18), z: deg(20) }, ArmR1: { x: deg(-18), z: deg(-20) }, Spine1: { x: deg(14) },
    },
    bobY: -0.2,
  },
  // Seated in the saddle (horse.js carries the bob and lean): thighs forward and splayed round the
  // barrel, shins hanging, hands forward on the reins; leans forward up to `lean` by `leanSpeed` m/s.
  ride: {
    pose: {
      LegL1: { x: deg(-40), y: deg(20), z: deg(30) }, LegR1: { x: deg(-40), y: deg(-20), z: deg(-30) },
      LegL2: { x: deg(45) }, LegR2: { x: deg(45) },
      ArmL1: { x: deg(-42), z: deg(4) }, ArmR1: { x: deg(-42), z: deg(-4) },
      ArmL2: { x: deg(48) }, ArmR2: { x: deg(48) },
      Spine1: { x: deg(3) },
    },
    lean: deg(16),
    leanSpeed: 14,
    breath: deg(1.5),
  },
  transitions: { toLocomotion: 0.14, toAirborne: 0.12, toLanding: 0.06, toRide: 0.2 }, // s to blend a pose change
}

export const FONT_FAMILY = 'Fredoka'

export function clamp(n, min, max) {
  return n < min ? min : n > max ? max : n
}

// Coerce one raw SDK string against its SETTINGS entry.
export function coerceSetting(key, raw) {
  const spec = SETTINGS[key]
  if (!spec) return raw
  const value = raw === '' || raw == null ? spec.def : raw
  if (spec.type === 'bool') return value === 'true' || value === true
  if (spec.type === 'enum') return spec.values.includes(value) ? value : spec.def
  const n = Number(value)
  return clamp(Number.isFinite(n) ? n : Number(spec.def), spec.min, spec.max)
}

// --- HUD (hud.js) ------------------------------------------------------------
// Layout is authored in pixels of the 1920x992 reference screenshot and scaled
// by --u = clamp(min(w / design.w, h / design.h), minScale, maxScale).
export const HUD = {
  design: { w: 1920, h: 992 },
  minScale: 0.46,
  maxScale: 1.25,
  stats: { trophies: 0, wins: 50, gems: 0 }, // a new player's values; `wins` (lightning) mirrors the rebirth energy
  rollMs: 450, // a counter rolls to its new value over this long
  chatUnread: 3,
  dailyGems: 9,
  boosts: { friends: 0, playtime: 2 }, // percent shown bottom-left
  // Race distance milestones: one row per zoom level, the bottom row is the
  // finest (0..2K), then 2K..13K, then 13K..the finish (RACE.finish, 2.5M). `to` = distance at the
  // segment's right edge, `at` = that edge in reference pixels (bar spans
  // 438..1482, the bottom row starts at 462 after the player's head at 440).
  progress: [
    [
      { label: '30K', to: 30000, color: '#8f3dff', at: 560 },
      { label: '100K', to: 100000, color: '#b13dff', at: 760 },
      { label: '500K', to: 500000, color: '#d83dff', at: 1010 },
      { label: '1M', to: 1000000, color: '#ff3dd8', at: 1230 },
      { label: '2.5M', to: 2500000, color: '#ffd23d', at: 1482 },
    ],
    [
      { label: '3K', to: 3000, color: '#ffff00', at: 710 },
      { label: '7K', to: 7000, color: '#1a3cff', at: 1088 },
      { label: '13K', to: 13000, color: '#ff2a1a', at: 1482 },
    ],
    [
      { label: '3', to: 3, color: '#ff2a1a', at: 487 },
      { label: '4', to: 4, color: '#1a3cff', at: 528 },
      { label: '5', to: 5, color: '#2a62ff', at: 580 },
      { label: '10', to: 10, color: '#4dff7a', at: 650 },
      { label: '25', to: 25, color: '#6dffc9', at: 730 },
      { label: '50', to: 50, color: '#ff9ade', at: 830 },
      { label: '100', to: 100, color: '#3a3a3a', at: 945 },
      { label: '500', to: 500, color: '#ff9500', at: 1073 },
      { label: '1K', to: 1000, color: '#0a9a1a', at: 1250 },
      { label: '2K', to: 2000, color: '#ff38ff', at: 1482 },
    ],
  ],
  // Cartoon heads (head() in hudIcons) for remote racers until (or unless) their Bloxity
  // profile picture loads; each racer gets one picked from its session id.
  racerLooks: [
    { skin: '#a7adb5', hair: '#2a2a33', style: 'ears' },
    { skin: '#f4dccb', hair: '#1d1d24', style: 'long' },
    { skin: '#f6e3cf', hair: '#7a3e1a', style: 'short' },
    { skin: '#c98f5f', hair: '#1e7a3a', style: 'cap' },
    { skin: '#f2c79a', hair: '#5a2f12', style: 'short' },
    { skin: '#3a3a44', hair: '#141418', style: 'bald' },
  ],
}

// --- Race (race.js) ----------------------------------------------------------------
// Riding through the START gate starts a race: the horse gallops itself down the
// buoy lane (A/D or the joystick steer inside it) until `duration` runs out or
// the player taps Leave. Speeds and distances are in studs; the world moves at a real gallop's
// pace (`kmh`, a per-race metres per stud). Top speed = (baseSpeed + speedPerBolt * lightning)
// x the Acc speed boost (121 bolts -> 145 before boosts, like the reference). Past `cruiseZ` the horse stays put and the
// track, meadow and trail scroll instead (the meadow is only GROUND.size wide).
// --- Race track (track.js) ----------------------------------------------------------------
// The dirt track past the START gate, the lobby's short one and the race's long one: a dirt strip
// `margin` m wider than the gate either side, between white rail fences on the gate posts' lines.
// A race slides the race track by the scroll modulo `tile` (the dirt texture's length, a multiple
// of postSpacing), so the pattern never jumps.
// The race road (track.js): asphalt with a dashed white centre line (one dash every `tile` m), and a
// low red-and-white striped barrier on white legs along each edge.
export const TRACK = {
  postSpacing: 4, tile: 8, margin: 1.4, postSize: [0.2, 0.7, 0.2], dash: [0.5, 4],
  barrier: { y: 1.0, height: 0.85, thick: 0.18, stripe: 2 }, // stripe: m per red + white pair (divides `tile`: the road jumps back a tile at a time while racing)
  leg: '#f4f4f4', red: '#e8262b', line: '#ffffff',
}

export const RACE = {
  baseSpeed: 24,
  speedPerBolt: 1,
  // Acc (horse + partner + trail, boosts.js) also raises top
  // speed: x (1 + accSpeed x acc %). 1 = a "+50% Acc" card is +50% speed; 0 = acceleration only.
  accSpeed: 1,
  // Luck (horse + partner) gives each checkpoint a chance of paying double ("LUCKY x2"):
  // luck / (luck + half), at most `max` (20% luck -> 9%, 200% -> 50%).
  luck: { half: 200, max: 0.75 },
  accelTime: 5, // s from 0 to top speed (shortened by the acc boost, boosts.js)
  // Real-world speed: a race whose top speed is v studs/s gallops at kmh.max x v / (v + kmh.half)
  // km/h at the top (a new player's 262 -> 56 km/h, 1K -> 78, 10K -> 89; never past `max`, about
  // a racehorse's record pace). The horse moves through the world, and the speedometer reads, in
  // proportion to its studs/s (so the tap boost adds on top, up to ~73 km/h); studs, checkpoints and
  // Wins still count the race's own studs/s, so training still pays.
  kmh: { max: 90, half: 160 },
  cruiseZ: -130,
  // The race ends at the finish line (or on Leave): `finish` studs down the lane. A new player
  // tops out at 262 studs/s (145 x the starter gear's +81%), 341 with the tap boost held full,
  // so 2.5M studs is at least 2 h of racing (~2.65 h without tapping).
  finish: 2.5e6,
  steerSpeed: 12, // m/s sideways at full stick
  laneMargin: 3, // m kept clear of the ropes
  lane: { length: 700 }, // race track past the gate (track.js; replaces the lobby's while racing)
  // Scenery streaming past the lane (raceScenery.js): set pieces built once and recycled. One comes
  // every `gap` m (random in the range, mostly alternating sides) from `first` m past the gate; each
  // appears `ahead` m in front of the horse (inside the fog) and is recycled `behind` m behind it. An
  // arch spans the lane every `archEvery` m from `archFirst`. Per kind: `weight` (how often it comes up),
  // `x` = distance from the lane's centre line (m, either side), `y` = height (balloons).
  // The start island slides away with the scroll and is hidden once `homeHide` m gone (past the fog).
  scenery: {
    first: 150,
    gap: [34, 60],
    ahead: 720,
    behind: 260,
    archFirst: 420,
    archEvery: 700,
    homeHide: 650,
    kinds: {
      farm: { weight: 4, x: [55, 120] },
      windmill: { weight: 2, x: [45, 100] },
      grove: { weight: 5, x: [30, 140] },
      hay: { weight: 3, x: [27, 60] },
      grandstand: { weight: 2, x: [34, 40], facesLane: true },
      herd: { weight: 3, x: [30, 75] },
      balloon: { weight: 2, x: [22, 90], y: [30, 58] },
    },
    barns: ['#c8342a', '#b0442a', '#7a3b2a'], // farm barn walls (trim and roof are white / slate)
    crowd: ['#ff3b3b', '#2f9df0', '#ffd21a', '#3ddc4a', '#ff7ad8', '#ffffff', '#ff9a1a', '#7a5cff'], // grandstand shirts
    balloons: [['#ff3b3b', '#ffe11a'], ['#2f9df0', '#ffffff'], ['#a01aff', '#3ff0d0', '#ffb21a'], ['#22d34a', '#ffffff', '#ff4a1a']],
    rainbow: ['#ff2a2a', '#ff8a1a', '#ffe11a', '#22d34a', '#1a9cff', '#3a3cff', '#a01aff'],
  },
  // Chase cam: behind and above, looking a little down the lane.
  // `compact` (portrait, or under compactHeight px tall) looks further down so the horse sits above the speedometer.
  // `orbit`: drag (mouse, or the touch look zone) swings the cam around the horse at `pivot` m above
  // it; pitch is the boom's angle above the horizon, kept in min..max (min keeps it above the ground).
  camera: { distance: 13, height: 5.2, lookAhead: 14, lookHeight: 0.6, fov: 72, speedFov: 14, follow: 8, compactHeight: 500, compact: { distance: 15, height: 6.5, lookHeight: -4.5 }, orbit: { pivot: 1.2, minPitch: 0.06, maxPitch: 1.2 } },
  // Checkpoints: pale see-through walls across the lane (the last one passed +
  // the next `ahead - 1` are drawn). Spacing is picked per race from the top
  // speed: the `steps` value nearest (in log) to topSpeed x `seconds`, so one
  // comes every ~7 s at any speed (145 -> every 1K, like the reference); the
  // `early` distances below that step come first. A regular checkpoint pays
  // floor(studs x step / 1M) Wins, at least 1 (9K with a 1K step -> +9, like the
  // reference; total ~ distance^2 / 2M whatever the step), an early one 1. The studs in that
  // formula stop growing at top speed x `paySeconds`, so past there every checkpoint pays the
  // same and Wins come in at a steady rate: 45 s matches the old 90 s races back to back
  // (Wins per hour ~ 45 x speed^2 x 3600 / 1M at any speed; a new player's 2.5M-stud race ~29K),
  // instead of growing with the square of a 2 h race's distance,
  // x the Wins boost (boosts.js): a trophy "+N" pops by the studs callout, `trophies` trophy icons
  // fly from the horse into the trophy counter (each adds its share as it lands)
  // and confetti rains down (`confetti` pieces, `confettiTouch` on touch screens).
  checkpoint: { early: [10, 25, 50, 100, 250, 500], seconds: 7, paySeconds: 45, steps: [100, 250, 500, 1e3, 2.5e3, 5e3, 1e4, 2.5e4, 5e4, 1e5, 2.5e5, 5e5, 1e6], ahead: 4, wallHeight: 36, color: '#e4fbff', opacity: 0.5 },
  reward: { trophies: [3, 7], flight: 1.15, stagger: 0.09, popup: 2.2, confetti: 70, confettiTouch: 36, colors: ['#ff2a2a', '#ffe11a', '#22d34a', '#1a3cff'] },
  gauge: ['#3ff0d0', '#5fe84a', '#d8f23a', '#ffb21a', '#ff4a1a', '#e81a3a', '#a01aff'], // speedometer arc, slow -> fast
  resultSeconds: 3.2, // how long the race result stays up
  // Tap to boost: every tap / click / Space / touch JUMP mid-race adds `perTap`
  // to a boost (capped at `max`) that fades by `decay` of itself per second, so
  // ~3 taps/s holds +15% and ~6 taps/s the full +30%. Speed = top-speed curve x (1 + boost).
  tap: { perTap: 0.04, max: 0.3, decay: 0.8 },
  // Personal best (saved by the server, net.js): a BEST flag on the distance bar, "NEW RECORD!"
  // when a race passes it, and `bonus` x that race's Wins (at least 1) on top.
  best: { bonus: 0.2 },
}

// --- Partners (partner.js) ----------------------------------------------------------
// The Partner window's catalog, in grid order (rows of 4). Nothing is free: every
// partner is bought with Wins (the HUD's trophy counter). Theme (after the real
// game's update): Squid Game players / staff and princesses. The first row are the
// premium partners (red NEW ribbon), priced above the ladder below them (whose
// prices grow ~5x per step). stats are % boosts: wins, luck,
// acc (horse acceleration). tint colours the name in the side panel. look
// dresses the blocky portrait (partner.js): hair/hat, face, shirt pattern, colours.
export const PARTNER = {
  featured: 'elsa', // shown when the window opens
  partners: [
    // Premium row (the reference's Robux princesses Anna / Grace / Diana / Elsa), bought with Wins here.
    { id: 'anna', name: 'Anna', price: 500e12, isNew: true, tint: '#ff7ac8', stats: { wins: 520, luck: 350, acc: 500 }, look: { face: 'princess', eyes: '#3a7bd5', hair: 'twinbraids', hairColor: '#c8501f', ties: '#2a6ad0', shirt: 'plain', color: '#2a6ad0', color2: '#1d1d23', arms: '#2a6ad0', bodice: '#1d1d23', lace: '#e0408a', skirt: '#2a3a8c', hem: '#e0408a', overskirt: '#2a3a8c', pants: '#2a3a8c', shoes: '#1d1d23', cape: '#c8327a' } },
    { id: 'grace', name: 'Grace', price: 30e15, isNew: true, tint: '#7dff9a', stats: { wins: 600, luck: 410, acc: 580 }, look: { face: 'princess', eyes: '#3a9a5a', hair: 'long', hairColor: '#f3d98a', crown: '#ffd23a', gem: '#5dff9a', shirt: 'plain', color: '#fff4d6', color2: '#d9b04a', arms: '#fff4d6', gloves: '#fffaf0', bodice: '#f4e3a8', lace: '#d9b04a', neckline: true, sleeves: '#fffaf0', necklace: '#ffd23a', skirt: '#fffaf0', overskirt: '#f4e3a8', hem: '#d9b04a', sparkle: '#ffe680', pants: '#fffaf0' } },
    { id: 'diana', name: 'Diana', price: 1.5e18, isNew: true, tint: '#ffd23a', stats: { wins: 700, luck: 480, acc: 680 }, look: { face: 'princess', eyes: '#4a6ad0', lips: '#b5205e', hair: 'long', hairColor: '#efe6d6', crown: '#d8dde8', gem: '#7fd0ff', shirt: 'plain', color: '#2a3140', color2: '#8a93a8', arms: '#2a3140', gloves: '#1d2433', bodice: '#1d2433', lace: '#8a93a8', neckline: true, sleeves: '#3a4256', necklace: '#d8dde8', pendant: '#7fd0ff', skirt: '#1d2433', overskirt: '#2a3140', hem: '#c9ced8', sparkle: '#c9ced8', pants: '#1d2433' } },
    { id: 'elsa', name: 'Elsa', price: 80e18, isNew: true, tint: '#9fe0ff', stats: { wins: 850, luck: 580, acc: 830 }, look: { face: 'princess', eyes: '#3a9ad8', lips: '#e05a8a', hair: 'braid', hairColor: '#f2ecd8', ties: '#9fe0ff', shirt: 'plain', color: '#7fd0ff', color2: '#e8f8ff', arms: '#bfe8ff', bodice: '#5fb8f0', neckline: true, skirt: '#7fd0ff', overskirt: '#bfe8ff', hem: '#e8f8ff', sparkle: '#ffffff', pants: '#7fd0ff', cape: '#bfe8ff', capeAlpha: 0.7 } },
    // Ladder: Squid Game players and staff mixed with princesses, ~5x per step.
    { id: 'p456', name: 'Player 456', price: 300, tint: '#4fe0c8', stats: { wins: 30, luck: 20, acc: 20 }, look: { hair: 'short', hairColor: '#15151a', number: '456', shirt: 'jumpsuit', color: '#2a9d9a', color2: '#ffffff', arms: '#2a9d9a', pants: '#2a9d9a', trim: '#ffffff', shoes: '#f4f4f4' } },
    { id: 'p067', name: 'Player 067', price: 1.5e3, tint: '#4fe0c8', stats: { wins: 35, luck: 25, acc: 25 }, look: { face: 'stern', hair: 'bob', hairColor: '#15151a', number: '067', shirt: 'jumpsuit', color: '#2a9d9a', color2: '#ffffff', arms: '#2a9d9a', pants: '#2a9d9a', trim: '#ffffff', shoes: '#f4f4f4' } },
    { id: 'younghee', name: 'Young-hee', price: 8e3, tint: '#ffc21a', stats: { wins: 45, luck: 30, acc: 30 }, look: { face: 'doll', eyes: '#1d1a22', hair: 'bob', hairColor: '#15151a', tufts: '#ff9a1a', shirt: 'plain', color: '#ff9a1a', color2: '#ffffff', arms: '#ff9a1a', straps: '#ffc21a', skirt: '#ffc21a', pants: '#f4f4f4', shoes: '#1d1d23' } },
    { id: 'p199', name: 'Player 199', price: 40e3, tint: '#4fe0c8', stats: { wins: 55, luck: 35, acc: 35 }, look: { skin: '#c98f5f', hair: 'short', hairColor: '#2a1a10', number: '199', shirt: 'jumpsuit', color: '#2a9d9a', color2: '#ffffff', arms: '#2a9d9a', pants: '#2a9d9a', trim: '#ffffff', shoes: '#f4f4f4' } },
    { id: 'p212', name: 'Player 212', price: 220e3, tint: '#4fe0c8', stats: { wins: 65, luck: 40, acc: 45 }, look: { face: 'smirk', hair: 'bob', hairColor: '#3a2210', number: '212', shirt: 'jumpsuit', color: '#2a9d9a', color2: '#ffffff', arms: '#2a9d9a', pants: '#2a9d9a', trim: '#ffffff', shoes: '#f4f4f4' } },
    { id: 'snowwhite', name: 'Snow White', price: 1.2e6, tint: '#ff6a6a', stats: { wins: 75, luck: 50, acc: 55 }, look: { face: 'princess', eyes: '#5a3418', lips: '#d9263a', skin: '#fbe3d0', hair: 'bob', hairColor: '#15151a', bow: '#d9263a', shirt: 'plain', color: '#2a5fd0', color2: '#d9263a', arms: '#2a5fd0', bodice: '#2a5fd0', lace: '#d9263a', collar: '#ffffff', sleeves: '#6fa8ff', skirt: '#ffd23a', hem: '#ffffff', pants: '#ffd23a', shoes: '#ffd23a', cape: '#d9263a' } },
    { id: 'cinderella', name: 'Cinderella', price: 6.5e6, tint: '#9fd8ff', stats: { wins: 90, luck: 60, acc: 70 }, look: { face: 'princess', eyes: '#3a7bd5', hair: 'bun', hairColor: '#f0d27a', band: '#2a6ad0', shirt: 'plain', color: '#bfe8ff', color2: '#ffffff', arms: '#ffffff', gloves: '#ffffff', bodice: '#9fd8ff', neckline: true, sleeves: '#e8f8ff', necklace: '#1d1d23', pendant: '#9fd8ff', skirt: '#9fd8ff', overskirt: '#d8f2ff', hem: '#ffffff', sparkle: '#ffffff', pants: '#9fd8ff' } },
    { id: 'belle', name: 'Belle', price: 36e6, tint: '#ffd23a', stats: { wins: 110, luck: 70, acc: 85 }, look: { face: 'princess', eyes: '#7a4a1a', hair: 'bun', hairColor: '#5a3418', shirt: 'plain', color: '#ffd23a', color2: '#e0a81a', arms: '#ffd23a', gloves: '#ffd23a', bodice: '#ffc21a', neckline: true, sleeves: '#ffd23a', skirt: '#ffd23a', overskirt: '#ffe27a', hem: '#e0a81a', sparkle: '#fff3b0', pants: '#ffd23a' } },
    { id: 'ariel', name: 'Ariel', price: 200e6, tint: '#5dffc0', stats: { wins: 130, luck: 85, acc: 105 }, look: { face: 'princess', eyes: '#3ab0d8', hair: 'long', hairColor: '#e0451f', shirt: 'plain', color: '#f1c9a5', color2: '#9a5fd8', arms: '#f1c9a5', shell: '#9a5fd8', skirt: '#2fd0a0', scales: true, pants: '#2fd0a0' } },
    { id: 'jasmine', name: 'Jasmine', price: 1.1e9, tint: '#4fe0d8', stats: { wins: 160, luck: 105, acc: 130 }, look: { face: 'princess', eyes: '#5a3418', skin: '#d9a066', hair: 'braid', hairColor: '#15151a', ties: '#2fc8c0', band: '#2fc8c0', gem: '#2f63c8', shirt: 'plain', color: '#d9a066', color2: '#2fc8c0', arms: '#d9a066', top: '#2fc8c0', necklace: '#ffd23a', pendant: '#2f63c8', skirt: '#2fc8c0', hem: '#ffd23a', pants: '#2fc8c0', shoes: '#ffd23a' } },
    { id: 'rapunzel', name: 'Rapunzel', price: 6e9, tint: '#e0a0ff', stats: { wins: 190, luck: 125, acc: 160 }, look: { face: 'princess', eyes: '#3a9a5a', hair: 'long', hairColor: '#f6d24a', flower: '#ff8fd0', shirt: 'plain', color: '#c070e0', color2: '#ffd0f0', arms: '#ffd0f0', bodice: '#a050c8', lace: '#ffd0f0', sleeves: '#ffd0f0', skirt: '#c070e0', hem: '#ffd0f0', pants: '#c070e0' } },
    { id: 'moana', name: 'Moana', price: 33e9, tint: '#ff8a5a', stats: { wins: 230, luck: 150, acc: 195 }, look: { face: 'princess', eyes: '#3a1a0a', skin: '#c98f5f', hair: 'curly', hairColor: '#2a1a10', flower: '#ff5a5a', shirt: 'plain', color: '#c98f5f', color2: '#e0451f', arms: '#c98f5f', top: '#e8d0a0', necklace: '#2a1a10', pendant: '#2fc8c0', skirt: '#e0451f', overskirt: '#e8d0a0', hem: '#c8a060', pants: '#e0451f' } },
    { id: 'recruiter', name: 'Recruiter', price: 400e9, tint: '#d0d0d8', stats: { wins: 270, luck: 180, acc: 240 }, look: { face: 'smirk', hair: 'swept', hairColor: '#15151a', shirt: 'suit', color: '#23232b', color2: '#2a2a33', arms: '#23232b', tie: '#1d1d23', pants: '#23232b', shoes: '#0e0e12', ddakji: true } },
    { id: 'guard', name: 'Guard', price: 2e12, tint: '#ff5fb0', stats: { wins: 330, luck: 220, acc: 300 }, look: { hat: 'mask', hatColor: '#141418', hood: '#e0337a', symbol: 'circle', shirt: 'suit', color: '#e0337a', color2: '#b5205e', pants: '#e0337a', belt: '#15151a', gloves: '#15151a', shoes: '#15151a' } },
    { id: 'frontman', name: 'Front Man', price: 12e12, tint: '#a0a0b0', stats: { wins: 400, luck: 265, acc: 380 }, look: { hat: 'mask', hatColor: '#15151a', hood: '#15151a', symbol: 'facets', shirt: 'suit', color: '#15151a', color2: '#2a2a33', arms: '#15151a', pants: '#15151a', belt: '#2a2a33', gloves: '#0e0e12', shoes: '#0e0e12', cape: '#0e0e12' } },
    { id: 'vip', name: 'VIP', price: 70e12, tint: '#ffd23a', stats: { wins: 480, luck: 320, acc: 470 }, look: { hat: 'mask', hatColor: '#d9a82a', hood: '#d9a82a', symbol: 'lion', mane: '#c88a1a', shirt: 'suit', color: '#3a1a3a', color2: '#d9a82a', arms: '#3a1a3a', gloves: '#d9a82a', necklace: '#ffd23a', pendant: '#d9263a', sash: '#d9a82a', pants: '#2a1a2a', shoes: '#1d1d23', cape: '#8a1f2a' } },
  ],
}

// --- Trails (trails.js scene, trail.js ribbon) -------------------------------------
// The whole Trails catalog, in grid order (3 per row), as in the reference
// shots. White is free from the start; every other trail is bought with Wins.
// Its price comes from its benefit (pricing below), so a stronger trail always
// costs more: Red ~800, Orange ~3K ... Water Ripple ~2.5Qa, and the four gold
// "gem" cards (premium art, no rebirth needed) sit on the same curve by their
// boosts. rebirth: N = can only be bought from N rebirths on. stats are % boosts.
// look: the ribbon (trail.js) and card art: color tints it; texture names a
// painter in trailTextures.js (also used for the card + swatch picture); art
// names a card drawing in trails.js (gold cards); add = additive glow; width
// (m) and tile (m per texture repeat) override the ribbon defaults.
export const TRAILS = {
  start: { owned: ['white'], equipped: 'white' },
  // price = base * (average boost / benefit)^power, rounded to 2 significant digits.
  pricing: { base: 800, benefit: 60, power: 8.5 },
  list: [
    { id: 'ghost', name: 'Ghost', gold: true, stats: { wins: 5000, acc: 5000 }, look: { art: 'ghost', texture: 'wisps', add: true, width: 0.9, tile: 3.5 } },
    { id: 'magma', name: 'Magma', gold: true, stats: { wins: 3100, acc: 3000 }, look: { texture: 'magma' } },
    { id: 'soundWave', name: 'Sound Wave', gold: true, stats: { wins: 1750, acc: 1500 }, look: { art: 'wave', texture: 'soundwave', width: 0.75, tile: 3 } },
    { id: 'musicalNote', name: 'Musical Note', gold: true, stats: { wins: 850, acc: 900 }, look: { art: 'notes', texture: 'notes', width: 0.62, tile: 3.2 } },
    { id: 'white', name: 'White', stats: { wins: 50, acc: 50 }, look: { color: '#ffffff' } },
    { id: 'red', name: 'Red', stats: { wins: 60, acc: 60 }, look: { color: '#ff1414' } },
    { id: 'orange', name: 'Orange', stats: { wins: 70, acc: 70 }, look: { color: '#ff7c00' } },
    { id: 'olive', name: 'Olive', rebirth: 5, stats: { wins: 80, acc: 85 }, look: { color: '#d6c51a' } },
    { id: 'green', name: 'Green', rebirth: 5, stats: { wins: 90, acc: 95 }, look: { color: '#1bc41b' } },
    { id: 'teal', name: 'Teal', rebirth: 5, stats: { wins: 110, acc: 100 }, look: { color: '#16c9a0' } },
    { id: 'blue', name: 'Blue', rebirth: 10, stats: { wins: 120, acc: 130 }, look: { color: '#2140ff' } },
    { id: 'purple', name: 'Purple', rebirth: 10, stats: { wins: 140, acc: 145 }, look: { color: '#9a1cff' } },
    { id: 'sage', name: 'Sage', rebirth: 10, stats: { wins: 175, acc: 155 }, look: { color: '#8fd08a' } },
    { id: 'navy', name: 'Navy', rebirth: 15, stats: { wins: 180, acc: 200 }, look: { color: '#3048d0' } },
    { id: 'mauve', name: 'Mauve', rebirth: 15, stats: { wins: 220, acc: 220 }, look: { color: '#b85cc8' } },
    { id: 'circuit', name: 'Circuit', rebirth: 25, stats: { wins: 270, acc: 235 }, look: { texture: 'circuit' } },
    { id: 'rainbow', name: 'Rainbow', rebirth: 30, stats: { wins: 280, acc: 310 }, look: { texture: 'rainbow' } },
    { id: 'orbit', name: 'Orbit', rebirth: 30, stats: { wins: 340, acc: 350 }, look: { texture: 'orbit' } },
    { id: 'carpet', name: 'Royal Carpet', rebirth: 30, stats: { wins: 420, acc: 370 }, look: { texture: 'carpet' } },
    { id: 'matrix', name: 'Matrix', rebirth: 35, stats: { wins: 430, acc: 480 }, look: { texture: 'matrix' } },
    { id: 'paws', name: 'Paw Prints', rebirth: 35, stats: { wins: 520, acc: 530 }, look: { texture: 'paws' } },
    { id: 'runes', name: 'Ancient Runes', rebirth: 35, stats: { wins: 650, acc: 570 }, look: { texture: 'runes' } },
    { id: 'abyss', name: 'Abyss', rebirth: 40, stats: { wins: 660, acc: 750 }, look: { texture: 'abyss' } },
    { id: 'film', name: 'Film Reel', rebirth: 40, stats: { wins: 810, acc: 820 }, look: { texture: 'film' } },
    { id: 'honeycomb', name: 'Honeycomb', rebirth: 40, stats: { wins: 1010, acc: 880 }, look: { texture: 'honeycomb' } },
    { id: 'skeleton', name: 'Skeleton', rebirth: 45, stats: { wins: 1020, acc: 1150 }, look: { texture: 'skeleton' } },
    { id: 'bubbles', name: 'Bubbles', rebirth: 45, stats: { wins: 1250, acc: 1260 }, look: { texture: 'bubbles' } },
    { id: 'toxic', name: 'Toxic', rebirth: 45, stats: { wins: 1500, acc: 1400 }, look: { texture: 'toxic' } },
    { id: 'waterRipple', name: 'Water Ripple', rebirth: 50, stats: { wins: 1550, acc: 1840 }, look: { texture: 'ripple', add: true } },
  ],
  // The ribbon behind the horse (trail.js): a band fed from just behind the hind hooves (`back` m
  // back, `height` m up) that turns to face the camera (upright seen from the side, flat on the
  // ground from behind), fading out over its life. width/tile are the defaults per look.
  ribbon: { points: 72, life: 0.9, spacing: 0.35, width: 0.7, tile: 2.4, opacity: 0.95, height: 0.04, back: 1.0 },
  // The scene's showcase: the horse galloping in place on the meadow off the east wing, broadside
  // to a low camera that looks back at the ranch yard and cliffs (like the reference).
  // view = horizontal direction the camera looks; the horse faces the camera's right. horseWidth =
  // share of the screen width the horse's length fills (portrait*: on tall screens); lookAt = the
  // camera aims this share of the saddle height up.
  showcase: { x: 53, z: -18.5, y: GROUND.level, view: [-0.795, 0.607], speed: 24, distance: 5.2, height: 0.55, lookAt: 0.55, horseWidth: 0.34, portraitHorseWidth: 0.6, portraitRaise: 0.3 },
}

// --- Audio (src/audio/) ---------------------------------------------------------------
// Everything is synthesised at runtime (no sound files). volume = default master
// level (the portal's sound_volume setting overrides it; M mutes, saved under storageKey).
export const AUDIO = {
  volume: 0.8,
  storageKey: 'horse-race-99.sound',
  buses: { ui: 0.8, sfx: 0.9, amb: 0.55, mount: 0.5 }, // per-bus levels before the master
  duck: 0.45, // world (ambience + the horse) level while a menu window is open
  maxVoices: 48, // one-shot sounds at once before low-priority ones are skipped
  maxVoicesTouch: 24,
  // Output buffer (s, the AudioContext latencyHint): 'interactive' (~10 ms) crackles and drops out
  // whenever a window open or a shader compile hogs the CPU; this much headroom rides those out.
  // lead = s every one-shot is scheduled ahead, so a short main-thread stall doesn't clip its start.
  latency: 0.04,
  latencyTouch: 0.07,
  lead: 0.02,
  // Generated impulse response: pre-delay s, early reflections [ms, gain], tail decay s (to -60 dB),
  // tail level, how fast the tail darkens, and the default send level.
  reverb: { seconds: 1.8, preDelay: 0.012, early: [[19, 0.5], [31, 0.35], [47, 0.28], [73, 0.2], [97, 0.12]], decay: 1.4, tail: 0.18, darken: 1.6, send: 0.9 },
  // The horse (audio/mount.js): hooves = the hoofbeats' and breaths' level, thud / clop / crunch /
  // breath / snort = their parts; snortEvery = s between snorts standing still; settle = their
  // racing level once the speed is steady (taps, boosts and the start bring them back up).
  mount: { hooves: 0.9, thud: 0.3, clop: 0.22, crunch: 0.12, breath: 0.32, snort: 0.9, snortEvery: [7, 16], settle: 0.62 },
  // The countryside (audio/ambience.js): scheduler tick s; wind level and how much a race's rush of
  // air adds; grass rustle in the gusts; bird level and the gap range s (fewer while racing); crowd
  // level (racing), its lobby share and the gap range s between cheers while racing; crickets [Hz,
  // pan] and their level.
  ambience: {
    tick: 0.25,
    wind: 0.035,
    rush: 5,
    rustle: 0.025,
    bird: 0.035,
    birdEvery: [3, 9],
    birdEveryRacing: [8, 18],
    crowd: 0.06,
    crowdLobby: 0.12,
    cheerEvery: [12, 28],
    cricket: 0.025,
    crickets: [[4400, -0.6], [4750, 0.5], [5100, 0.1]],
  },
}

// --- UI juice (juice.js) -------------------------------------------------------------
// Particles per burst kind, the touch-screen scale on those counts, and how many grid
// cards cascade in when a window opens.
export const JUICE = { coins: 16, stars: 18, sparks: 12, big: 40, touchScale: 0.55, cascade: 28 }

// --- Spin wheel (spin.js) ---------------------------------------------------------------
// The server owns the spins and rolls every spin (backend spin.ts + constants.ts SPIN_*): keep
// freeEvery / cap and the wedge ids in step with it. One free spin every `freeEvery` minutes
// (real time, also offline) until `cap` are stored. Wedges clockwise from the pointer, each 72
// degrees; `chance` is only the label (the server's weights decide). Prize: type 'trophy' (n
// Wins), 'potion' (id = GIFTS.potions key, counted like the gift potions) or 'pet' (PETS kind).
export const SPIN = {
  freeEvery: 15,
  cap: 5,
  turns: 6, // full turns before it lands
  seconds: 5.2, // spin length
  timeout: 6, // s to wait for the server's answer
  wedges: [
    { id: 'doubleWins', chance: '35%', type: 'potion', potion: 'doubleWin', label: 'x2 WINS', color: '#ff6b6b', dark: '#d94848' },
    { id: 'wins50', chance: '25%', type: 'trophy', n: 50, label: '50 Wins', color: '#ffd84a', dark: '#e8b81c' },
    { id: 'luck', chance: '35%', type: 'potion', potion: 'superLuck', label: 'LUCK', color: '#4cd964', dark: '#2fb648' },
    { id: 'wins250', chance: '4.9%', type: 'trophy', n: 250, label: '250 Wins', color: '#a24cf0', dark: '#7f2fd0' },
    { id: 'hugePet', chance: '0.1%', type: 'pet', pet: 'hugeDemon', label: '250% HUGE', tag: 'OP', color: '#1f9cf0', dark: '#1478c8' },
  ],
}
