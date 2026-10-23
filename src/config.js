// Every tunable constant lives here; the rest of src/ holds no theme values.

// --- Identity -------------------------------------------------------------
export const GAME_SLUG = 'horse-race-with-99-engine' // slug registered on bloxity.io
export const GAME_TITLE = 'Horse Race with 99 Engine'

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
// The start island (world.js): one convex slab, a grass ranch yard with packed-dirt areas. Its
// front edge sweeps from the start gate (front, -Z) back toward +Z on both wings, so the side
// barriers funnel toward the gate like the reference shot.
export const BEACH = {
  front: -46, // z of the shoreline at the start gate
  back: 90, // z of the back edge
  halfWidth: 75, // x extent of the wings
  wingZ: 24, // z of the shoreline at the far left/right ends
  gateEdge: 21.5, // half-width of the straight shoreline in front of the gate
  depth: 4, // slab thickness
  fenceHeight: 3, // invisible wall around the yard so nobody rides off into the meadow
  side: '#7a5a3a', // the slab's earth edge
  grass: '#e8ffd8', // tint on the yard's grass (the meadow's texture, a little fresher)
  dirtTile: 8, // m per dirt texture tile
  // Packed-dirt areas, rounded rectangles [x0, z0, x1, z1, corner radius]: the arena from the
  // spawn to the gate, the stall aprons, the path to the plaza and the training yards.
  dirt: [
    [-21, -46, 21, 16, 8],
    [-34, 0, -16, 24, 4],
    [16, 0, 34, 24, 4],
    [-8, 10, 8, 50, 5],
    [-31, 27, -10, 50, 6],
    [10, 27, 31, 50, 6],
  ],
}
// The meadow every world stands in (world.js): grass out to the horizon, under the start island
// and the race track, scrolled by a race. `tint` multiplies the grass (per world: WORLDS.list.*.ground,
// which can also swap the grass for dirt).
export const GROUND = { level: -0.05, size: 1400, tile: 9, tint: '#ffffff' }
// Old sea height: still the sunk foot of the far hills, the plaza cliffs' neighbours and the hill.
export const WATER = { level: -0.6, size: 1400, color: '#12a9e6', shallow: '#7ff0ff' }
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
  accel: 70, // m/s^2 toward the target velocity on the ground
  airAccel: 22, // m/s^2 steering while airborne
  decel: 60, // m/s^2 when no key is held
  turnSpeed: 12, // rad/s the body turns toward its heading
  jumpSpeed: 8.5, // m/s
  coyoteTime: 0.1, // s after leaving a ledge a jump still counts
  jumpBuffer: 0.12, // s a jump pressed before landing is remembered
  stepHeight: 0.45, // m autostep
  maxSlope: 50, // degrees the player can walk up
  snapToGround: 0.4, // m the controller stays glued to downward steps and slopes
  pushMass: 80, // kg the character weighs when shoving crates
  killY: -6, // sank this far: respawn
}
export const PLAYER_DIMS = { radius: 0.75, height: 1.8 } // wide capsule: it carries the boat

// --- Lobby props (lobby.js) ---------------------------------------------------
// Roblox-scale, measured off the reference shot: the gate is ~38 m wide and
// ~50 m ahead of the spawn. Positions are (x, z) in metres.
export const LOBBY = {
  gate: { z: -43.5, halfWidth: 19, postHeight: 18.5, bannerY: 14.2, bannerHeight: 5.3, padDepth: 4.6, arrowY: 22.5, arrowScale: 3, arrowSpacing: 10.5 },
  lane: { length: 600 }, // the dirt track and rail fences from the gate posts out into the meadow, into the fog (track.js)
  // Plank corral walls, each from its gate end to its far end. The left one follows
  // the yard's front edge; the right one runs straight back past the spawn, like the shot.
  barrier: {
    height: 2,
    lines: [
      { from: [-22.5, -43], to: [-62, 8] },
      // wall: metres of plank wall from the gate end (default the whole line, 0 = none)
      { from: [23, -43], to: [20, 25], wall: 47, height: 3.2, walkway: true, statues: true },
    ],
  },
  walkway: { width: 3.2, height: 0.4, check: 3.2 }, // raised plank boardwalk with wooden sides; check = m per plank texture tile
  statues: { at: [22, 28, 34, 40], scale: 1.05 }, // on the right walkway, m from the wall's gate end
  upgrade: { x: -20, z: -18, scale: 1.6 },
  rockets: [
    // engine: the ENGINE gem engine it sells (interact.js).
    { name: 'GALACTIC THRUSTER', engine: 'galactic', x: -25, z: -7, label: '#ff4fd8', body: '#f4f6fb', nose: '#e8262b', fin: '#2f7dff', stripe: '#e8262b' },
    { name: 'BLAZE DRIFT', engine: 'blaze', x: -16, z: -31, label: '#ff3b3b', body: '#1a1b22', nose: '#e8262b', fin: '#e8262b', stripe: '#ffffff' },
  ],
  rocketScale: 1.25,
  pump: { x: -31, z: -20, scale: 1.6 }, // the ranch's wind pump (the Frontier Town's welcome sign)
  trees: [
    // x, z, height (the plaza has its own, in PLAZA)
    [-36, 0, 16],
    [-46, -6, 12],
    [25, -6, 15],
    [36, -14, 12],
    [52, 6, 11],
    [-50, 10, 14], // behind the horse stall (west view)
    [-38, -12, 12], // clear of the wind pump
  ],
  colors: {
    banner: '#0c0d14',
    bannerFrame: '#3d8bff',
    pad: '#ffd21a',
    barrier: '#8a5a32', // the plank corral walls' frame
    walkway: '#c99a62', // the boardwalks' plank tint
    arrow: '#e81e1e',
  },
}

// Oak trees (propkit.js), shared by the ranch, the plaza, the hill and the race scenery.
export const OAK = { trunk: '#7a4f2a', leaves: ['#3f9e32', '#4fb33c', '#5cbf45', '#378a2c'] }

// --- Training plaza at the back of the beach (plaza.js) ---------------------------
// The reference's south view: two Train stations either side of a VIP portal
// under a waterfall, ringed by grassy cliffs. Facing it (+Z), +X is screen-left.
export const PLAZA = {
  platform: { width: 20, depth: 24, height: 0.35 },
  // Each station: six treadmill lanes in a straight grid of two rows of three
  // (station frame: rowZ/colX are lane centres), the whole station turned
  // (yaw) so the lanes' far ends lean toward the VIP in the middle. Lanes are
  // ~2x the boat's length with 1.8 m aisles between columns and a 2.4 m
  // walkway between the rows (the front row's SPEED boards stand in it).
  // `neon` is each lane's glowing rail colour, listed front row first, left to
  // right as seen from the spawn; `req`/`power` are the lock tags over the
  // SPEED boards. The front edge stays behind the end of the right walkway
  // (LOBBY, ~(20, 25)) and the Eggs stall; the back clears the pool and cliffs.
  lane: { width: 4.2, length: 7.6, rowZ: [-6.5, 4.3], colX: [6.3, 0, -6.3] },
  trains: [
    {
      x: 20.5, z: 39, yaw: -0.15, firstSpeed: 1, boards: ['rebirths', 'trophies'],
      neon: ['#2f8cff', '#33ff6a', '#2f8cff', '#ff3bd8', '#ff2a2a', '#2f8cff'],
      req: ['0', '1K', '5K', '35K', '400K', '1M'],
      power: ['+1', '+3', '+5', '+10', '+20', '+30'],
    },
    {
      x: -20.5, z: 39, yaw: 0.15, firstSpeed: 7, boards: ['energy', 'playtime'],
      neon: ['#e8f4ff', '#33ff6a', '#27e8ff', '#ff3bd8', '#ff2a2a', '#2f8cff'],
      req: ['4M', '15M', '50M', '300M', '1.5B', '5B'],
      power: ['+40', '+50', '+60', '+70', '+80', '+90'],
    },
  ],
  // The two leaderboards behind each station (`boards` above: dark on screen-left, then yellow),
  // keyed by the saved stat the backend ranks (leaderboard.ts LEADERBOARD_STATS): title over the
  // board, the stat column's heading and its colour. Rows come from the server's `leaderboard`.
  leaderboards: {
    rebirths: { title: '🔄 Rebirth', column: 'Rebirth', color: '#ff3d8b' },
    trophies: { title: '🏆 Wins', column: 'Wins', color: '#ffe14a' },
    energy: { title: '⚡ Power', column: 'Power', color: '#5fd0ff' },
    playtime: { title: '⏱️ Playtime', column: 'Time', color: '#7dff6a' },
  },
  vip: { x: 0, z: 42 },
  portal: { open: '#4fc8ff', locked: '#ff4f6a' }, // the VIP arch's glowing fill (worlds.js)
  waterfall: { x: 0, z: 53.6, width: 11, height: 32 },
  // Kiosks just outside the stations' outer edges.
  golden: { x: 39, z: 37 },
  index: { x: 36, z: 48 },
  relics: { x: -39, z: 40 },
  chest: { x: -36, z: 50 },
  // x, z, height: red feather flags. They face +-X, so the east view sees them
  // broadside and the south view edge-on (thin red/white stripes).
  flags: [[24, 19, 13], [44, 60, 16], [-36, 30, 13], [-50, 64, 16], [36, 31, 13], [33, 54, 13], [-20, 21, 12]],
  // x, z, width, depth, height, yaw
  cliffs: [
    [0, 64, 34, 16, 32, 0],
    [-30, 72, 32, 18, 27, 0.25],
    [30, 72, 32, 18, 25, -0.25],
    [-56, 52, 22, 40, 22, 0.55],
    [56, 52, 22, 40, 24, -0.55],
    [-68, 22, 16, 30, 18, 0.2],
    [68, 22, 16, 30, 16, -0.2],
    [-15, 56, 12, 8, 13, 0.1],
    [16, 56, 12, 8, 11, -0.1],
  ],
  // x, z, y (cliff top or 0), height
  trees: [
    [-8, 62, 32, 11],
    [10, 67, 32, 12],
    [-24, 67, 27, 12],
    [-38, 74, 27, 11],
    [26, 68, 25, 12],
    [40, 75, 25, 11],
    [-50, 42, 22, 11],
    [-58, 60, 22, 10],
    [50, 40, 24, 12],
    [60, 62, 24, 10],
    [-15, 55, 13, 9],
    [16, 55, 11, 10],
    [38, 25, 0, 13],
    [-42, 32, 0, 12],
  ],
  rock: '#966a6c',
  rockDark: '#6c4a52',
  grass: '#43c03a',
  grassLight: '#7ae04c',
}

// --- Shop stalls (shops.js) ---------------------------------------------------------
// Either side of the spawn, fronts facing it: Eggs past the statue wall (east
// view, +X) and Horses on the west side (-X). Items are listed left to right as
// seen from the front.
export const SHOPS = {
  eggs: {
    x: 26,
    z: 12,
    yaw: -Math.PI / 2, // local +Z (the front) faces -X
    width: 19,
    depth: 7,
    // price: Wins (trophies) per hatch; pets: hatch odds by PETS kind (weights, any total).
    eggs: [
      { name: 'Sunny Egg', price: 30, color: '#ffd21a', pets: { dog: 55, cat: 35, bunny: 10 } },
      { name: 'Spiky Egg', price: 1e3, color: '#ffb21a', spiky: true, pets: { cat: 40, bunny: 35, bear: 20, fox: 5 } },
      { name: 'Jungle Egg', price: 20e3, color: '#3ddc4a', glow: 0.8, pets: { bunny: 30, bear: 40, fox: 25, panda: 5 } },
      { name: 'Rainbow Egg', price: 500e3, rainbow: true, pets: { fox: 50, panda: 40, dragon: 10 } },
    ],
  },
  horses: {
    x: -27,
    z: 12,
    yaw: Math.PI / 2, // front faces +X
    width: 21,
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

// --- Hub pads (hub.js) ----------------------------------------------------------------
// A glowing touch pad in front of each shop object; driving onto one opens its
// window (once per visit: leave the pad to re-arm it). `open` names the window
// main.js passes in; keep them on open sand (the pink walkway runs past the Eggs
// stall's front, x > 17). Pets = the Eggs stall, Horses = the Horses stall, Engine =
// the Engine Upgrade machine, Partner = the hero statues on the right walkway.
export const HUB = {
  radius: 2.6, // m: the pad's size and its trigger distance from the horse's centre
  beamHeight: 1.8, // m of glowing light wall round the rim
  labelY: 3.4,
  labelHeight: 1.3,
  pads: [
    { open: 'pets', name: 'PETS', x: 14.2, z: 12, color: '#ffd21a' },
    { open: 'horses', name: 'HORSES', x: -19.6, z: 12, color: '#3dff6a' },
    { open: 'engine', name: 'ENGINES', x: -15.6, z: -12.5, color: '#3ff0ff' },
    { open: 'partner', name: 'PARTNERS', x: 15.2, z: -12, color: '#ff5fd8' },
  ],
}

// --- Interact prompts (interact.js) ---------------------------------------------------
// Near a shop object, a prompt over it says what E (or a tap on the prompt) does:
// hatch an egg, buy / equip a display horse, rocket engine or statue partner,
// upgrade to the next ladder engine, or open a hub pad's window. The nearest
// object in range wins. Radii are m (ground distance) from the object's centre.
export const INTERACT = {
  radius: { egg: 9, horse: 8, upgrade: 6.5, rocket: 5, statue: 5 },
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
// game's Boats reference: same prices, stats and booster counts. Every horse is
// bought with Wins (the HUD's trophy counter); only the Brown Pony is free (price
// null). wins / luck / acc are % boosts, engines the rocket xN; `rarity` colours the
// tile, preview and name. The first two were Robux items in the reference: their
// Wins price comes from where their stats land on the ladder.
export const HORSES = {
  preloadDelayMs: 4000, // tile pictures start drawing this long after boot
  start: { owned: ['pony'], equipped: 'pony' },
  rarity: { premium: '#ff5b37', common: '#d4d4d4', uncommon: '#62d65c', rare: '#2ba8f4', epic: '#ec5fc0', legendary: '#ffc61f' },
  // Horse name colour on the blue card, per rarity.
  nameColor: { premium: '#ff5b37', common: '#e4e4e4', uncommon: '#7dff6a', rare: '#bfeaff', epic: '#ff9ce0', legendary: '#ffd52e' },
  // The 20 horses, in grid order: two premium horses (priced from their stats), then the ladder.
  // Only the Brown Pony is free. stats are % boosts (wins, luck, acc); engines = rocket boosters
  // carried (x the equipped engine's boosts, boosts.js). look dresses the model (horseModels.js):
  // colours (coat, mane = one or a list per tuft, tail, muzzle, hoof, blaze, sock(s), blanket, trim,
  // saddle) and extras (size, ears, horn, wings, armor, stripes, spots, feathers, maneGlow, eyesGlow,
  // hornGlow, shine = metallic coat).
  list: [
    { id: 'inferno', name: 'Inferno Nightmare', rarity: 'premium', price: 50e9, wins: 300, luck: 60, acc: 300, engines: 5, look: { coat: '#1b1518', mane: ['#ff3a12', '#ff8a1a', '#ffd23a'], maneGlow: true, eyesGlow: '#ff6a1a', muzzle: '#241c1f', hoof: '#ff5a1a', blaze: false, blanket: '#2a2226', trim: '#ff6a1a', saddle: '#3a2a22' } },
    { id: 'royalUnicorn', name: 'Royal Unicorn', rarity: 'premium', price: 1e18, wins: 1200, luck: 150, acc: 800, engines: 8, look: { coat: '#f4fbf6', mane: ['#3dff4a', '#a8ffb0'], maneGlow: true, horn: '#3dff4a', hornGlow: true, muzzle: '#e2efe6', hoof: '#c9a43a', blaze: false, blanket: '#0d1f10', trim: '#3dff4a', saddle: '#1d5a26', size: 1.08 } },
    { id: 'pony', name: 'Brown Pony', rarity: 'common', price: null, wins: 10, luck: 5, acc: 20, engines: 1, look: { size: 0.86 } },
    { id: 'palomino', name: 'Palomino', rarity: 'common', price: 200, wins: 20, luck: 7, acc: 50, engines: 1, look: { coat: '#e0ab4f', mane: '#fbf0d2', muzzle: '#c78e3a', blanket: '#2f8ad8' } },
    { id: 'greyMare', name: 'Dapple Grey', rarity: 'common', price: 1e3, wins: 30, luck: 9, acc: 70, engines: 1, look: { coat: '#9da3ab', mane: '#4a4e55', muzzle: '#6e737b', blaze: false, spots: { color: '#c9ced4', where: 'all', count: 22, size: 0.08 }, blanket: '#5a2e8a' } },
    { id: 'donkey', name: 'Speedy Donkey', rarity: 'common', price: 5e3, wins: 45, luck: 12, acc: 95, engines: 2, look: { coat: '#8a8178', mane: '#3a3532', muzzle: '#e8e2d8', ears: 'long', blaze: false, size: 0.84, blanket: '#c8262b' } },
    { id: 'mustang', name: 'Wild Mustang', rarity: 'uncommon', price: 40e3, wins: 65, luck: 15, acc: 120, engines: 2, look: { coat: '#c4894a', mane: '#1d1714', muzzle: '#8a5a2e', socks: true, sock: '#2a211c', blaze: false, blanket: '#4c5a2c', trim: '#c9b45a' } },
    { id: 'blackStallion', name: 'Black Stallion', rarity: 'uncommon', price: 320e3, wins: 90, luck: 19, acc: 150, engines: 2, look: { coat: '#1f1d22', mane: '#0d0c0f', muzzle: '#2c2a30', blaze: '#f2ece0', blanket: '#a8561a', trim: '#f2ece0' } },
    { id: 'appaloosa', name: 'Appaloosa', rarity: 'uncommon', price: 2.6e6, wins: 120, luck: 24, acc: 185, engines: 3, look: { coat: '#f3eee4', mane: '#4a3424', muzzle: '#8a6a52', blaze: false, spots: { color: '#6b4428', count: 18, size: 0.075 }, blanket: '#13857a' } },
    { id: 'arabian', name: 'Red Arabian', rarity: 'uncommon', price: 21e6, wins: 150, luck: 29, acc: 220, engines: 3, look: { coat: '#a8411f', mane: '#f0c98a', muzzle: '#7a2e16', socks: true, blanket: '#2a2a33', trim: '#ffcf3a', size: 0.96 } },
    { id: 'zebra', name: 'Zebra', rarity: 'rare', price: 170e6, wins: 185, luck: 34, acc: 260, engines: 3, look: { coat: '#f6f6f2', mane: ['#16161a', '#f6f6f2'], tail: '#16161a', muzzle: '#2a2a2e', blaze: false, stripes: { color: '#16161a' }, blanket: '#25335a' } },
    { id: 'clydesdale', name: 'Clydesdale', rarity: 'rare', price: 1.4e9, wins: 225, luck: 40, acc: 300, engines: 4, look: { coat: '#6b3a1e', mane: '#1d140f', muzzle: '#4a2814', socks: true, feathers: true, size: 1.16, blanket: '#b83a2c' } },
    { id: 'thoroughbred', name: 'Racing Thoroughbred', rarity: 'rare', price: 11e9, wins: 270, luck: 46, acc: 340, engines: 4, look: { coat: '#5a2e18', mane: '#151110', muzzle: '#3d1f10', socks: true, blanket: '#f4f4f4', trim: '#2f9df0', size: 1.04 } },
    { id: 'knight', name: "Knight's Charger", rarity: 'rare', price: 88e9, wins: 320, luck: 52, acc: 380, engines: 4, look: { coat: '#e9e6e0', mane: '#8a8f98', muzzle: '#bdb8b0', blaze: false, armor: { plate: '#b9c1cc', cloth: '#24427e', trim: '#ffd23a' }, blanket: '#24427e', size: 1.06 } },
    { id: 'mecha', name: 'Mecha Horse', rarity: 'epic', price: 700e9, wins: 375, luck: 58, acc: 420, engines: 5, look: { coat: '#7c828c', mane: ['#3aa6ff', '#9ae0ff'], maneGlow: true, eyesGlow: '#4ad8ff', muzzle: '#4a4f57', hoof: '#33373d', blaze: false, stripes: { color: '#3ad8ff', kind: 'seams' }, shine: 0.75, blanket: '#3c3f46', trim: '#3ad8ff', saddle: '#2a2c33' } },
    { id: 'skeleton', name: 'Skeleton Horse', rarity: 'epic', price: 5.6e12, wins: 430, luck: 63, acc: 455, engines: 5, look: { coat: '#ece6d4', mane: '#2a2b30', muzzle: '#d6cfba', hoof: '#2a2b30', blaze: false, eyesGlow: '#7aff4a', stripes: { color: '#3a3b40', kind: 'ribs' }, blanket: '#26272c', trim: '#ffcc22' } },
    { id: 'pegasus', name: 'Pegasus', rarity: 'epic', price: 45e12, wins: 480, luck: 68, acc: 480, engines: 5, look: { coat: '#f7f8fc', mane: ['#9fd8ff', '#d6eeff'], muzzle: '#e4e7f0', hoof: '#c9a43a', blaze: false, wings: '#ffffff', wingTips: '#cfe9ff', blanket: '#3a6ad8', trim: '#ffd23a' } },
    { id: 'galaxy', name: 'Galaxy Steed', rarity: 'epic', price: 360e12, wins: 530, luck: 72, acc: 500, engines: 5, look: { coat: '#2a1452', mane: ['#d06bff', '#5ab8ff', '#ff8af3'], maneGlow: true, eyesGlow: '#ffffff', muzzle: '#1d0e3a', hoof: '#d06bff', blaze: false, spots: { color: '#ffffff', where: 'all', count: 26, size: 0.035, glow: true }, blanket: '#17171b', trim: '#d06bff' } },
    { id: 'golden', name: 'Golden Stallion', rarity: 'legendary', price: 2.9e15, wins: 565, luck: 76, acc: 515, engines: 6, look: { coat: '#f2b818', mane: ['#fff2a8', '#ffd84a'], maneGlow: true, muzzle: '#d99a10', hoof: '#fff2a8', blaze: false, shine: 0.85, blanket: '#1e1f24', trim: '#d8a21a', saddle: '#3a2a1c', size: 1.08 } },
    { id: 'rainbowAlicorn', name: 'Rainbow Alicorn', rarity: 'legendary', price: 23e15, wins: 600, luck: 80, acc: 530, engines: 6, look: { coat: '#fdf6ff', mane: ['#ff3b3b', '#ff9a1a', '#ffe11a', '#3ddc4a', '#2f9df0', '#a05aff'], maneGlow: true, horn: '#ffe9a8', hornGlow: true, wings: '#ffffff', wingTips: '#ffc8f4', muzzle: '#f0e4f6', hoof: '#c9a43a', blaze: false, blanket: '#2f9df0', trim: '#ffe11a', size: 1.1 } },
  ],
  thumb: { width: 256, height: 320, outline: 7, budgetMs: 12 }, // px of each rendered tile picture, ms of drawing per frame (horseThumbs.js)
}

// A wooded hill out in the meadow, seen past the stall in the east view (the Frontier Town's
// water tower stands on top). trees: [x, z, height] from its centre.
export const ISLET = { x: 115, z: -40, hill: { rx: 36, ry: 9, rz: 24 }, trees: [[-6, -3, 12], [5, 4, 10], [12, -6, 9], [-14, 6, 8]] }

// --- Player horse (horse.js) -----------------------------------------------------
export const HORSE = {
  length: 3.1, // m nose to tail (the Trails scene's framing)
  saddle: 1.7, // m the saddle's top above the hooves
  riderY: 1.08, // m the rider's root (its feet at bind pose) above the hooves: seated, hips on the saddle
  riderZ: -0.04, // m the rider sits behind the saddle's centre
  // Model sizes (m, hooves at y 0, nose +Z): barrel ellipsoid, legs hanging from hipY with the knee
  // at kneeY, the saddle at saddleZ and the booster rack across the croup at rackY / rackZ.
  dims: { barrelY: 1.15, barrelLength: 1.9, barrelHeight: 0.86, barrelWidth: 0.78, hipY: 0.98, kneeY: 0.48, frontZ: 0.66, hindZ: -0.64, saddleZ: 0.08, rackY: 1.4, rackZ: -0.5, neckRadius: 0.22, neckLength: 0.42 },
  // Default colours (a catalog mount overrides some): blaze = the white stripe down the face (false = none).
  look: {
    coat: '#8a5a32', mane: '#2e1d12', hoof: '#2a2420', muzzle: '#6b4428', blaze: '#f2ece0', socks: false, sock: '#f2ece0',
    blanket: '#d8343a', trim: '#ffd84a', saddle: '#6b3b1d', leather: '#3b2414', metal: '#c9ced6', rack: '#3a3f48',
  },
  engine: '#1d6b55',
  engineBand: '#8dff6a',
  flame: '#38d7ff',
  flameGlow: 3, // HDR multiplier on the engine flames when bloom is on (propkit neon)
  glow: 1.5, // HDR multiplier on a horse's glowing mane / eyes / horn / seams with bloom on
  dust: { color: '#a9845a', opacity: 0.85, from: 2.5, full: 7 }, // hoof dust: fades in between `from` and `full` m/s
  engineScale: 0.66, // boosters are a bit smaller than the lobby's parked engines
  // Gaits (horse.js): walk -> trot over toTrot m/s, trot -> gallop over toGallop; one cycle per
  // `stride` m (rate clamped to minRate..maxRate Hz). Per gait: duty = share of the cycle a hoof is
  // down, swing / flex = rad of leg swing and knee lift, bob = m the body rises per footfall, rock =
  // rad the gallop rocks the body. *Rest = [upper, lower] rad of a standing leg; jump* = tucked in the air.
  gait: {
    idleSpeed: 0.25,
    toTrot: [2.2, 3.6],
    toGallop: [6.5, 9.5],
    minRate: 0.7,
    maxRate: 3,
    walk: { stride: 1.5, duty: 0.62, swing: 0.32, flex: 0.7, bob: 0.025 },
    trot: { stride: 2.5, duty: 0.48, swing: 0.45, flex: 1.2, bob: 0.05 },
    gallop: { stride: 3.8, duty: 0.38, swing: 0.7, flex: 1.6, bob: 0.08, rock: 0.07 },
    frontRest: [0, 0],
    hindRest: [0.12, -0.2],
    hindFlex: 0.6,
    jumpFront: [-0.9, 1.9],
    jumpHind: [0.6, 0.2],
  },
  pitchPerAccel: 0.01, // rad of nose-up per m/s^2 of acceleration
  rollPerTurn: 0.1, // rad of lean into a turn
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
    // Sun + hemi + env together keep the pale sand (#eed39c) near its own tan;
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
// it stays open, saved by the server), back to the beach at any time.
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
// tone mapping) glow: neon rails, waterfall, VIP gate, particles. Sunlit sand
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
  startEnergy: 121, // a new player's lightning (the reference's 121 -> top speed 145)
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
  popupSeconds: 1.1, // the "+N" bolt floating off the boat
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
// Equipped pets hover in these slots round the boat (boat frame: +Z = forward, metres; the
// first ones beside the stern, the rest further back and higher), bobbing `bob` m and swinging
// after turns (`turnLag` 1/s). The partner stands on the boat behind the rider.
export const COMPANIONS = {
  slots: [[-2.1, 0.9, -1.4], [2.1, 0.9, -1.4], [0, 1.4, -3.2], [-2.3, 1.4, -3.5], [2.3, 1.4, -3.5], [-1.2, 1.9, -4.8], [1.2, 1.9, -4.8], [0, 2.3, -5.6]],
  petScale: 0.95,
  hugeScale: 1.7, // 'huge…' pet kinds
  bob: 0.14,
  turnLag: 4,
  partnerScale: 0.8,
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
  stats: { trophies: 433, wins: 121, gems: 0 }, // a new player's values; `wins` (lightning) mirrors the rebirth energy
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
// Driving through the START gate starts a race: the boat drives itself down the
// buoy lane (A/D or the joystick steer inside it) until `duration` runs out or
// the player taps Leave. Speeds and distances are in studs; the world moves
// `metresPerStud` m per stud. Top speed = (baseSpeed + speedPerBolt * lightning)
// x the Acc speed boost (121 bolts -> 145 before boosts, like the reference). Past `cruiseZ` the boat stays put and the
// lane, sea and trail scroll instead (the sea is only WATER.size wide).
// --- Race track (track.js) ----------------------------------------------------------------
// The dirt track past the START gate, the lobby's short one and the race's long one: a dirt strip
// `margin` m wider than the gate either side, between white rail fences on the gate posts' lines.
// A race slides the race track by the scroll modulo `tile` (the dirt texture's length, a multiple
// of postSpacing), so the pattern never jumps.
export const TRACK = { postSpacing: 4, tile: 8, margin: 1, postSize: [0.22, 1.35, 0.22], rails: [0.62, 1.12], railSize: [0.1, 0.16], wood: '#f6f3ea' }

export const RACE = {
  baseSpeed: 24,
  speedPerBolt: 1,
  // Acc (engine x boat engines + boat + partner + trail, boosts.js) also raises top
  // speed: x (1 + accSpeed x acc %). 1 = a "+50% Acc" card is +50% speed; 0 = acceleration only.
  accSpeed: 1,
  // Luck (boat + partner) gives each checkpoint a chance of paying double ("LUCKY x2"):
  // luck / (luck + half), at most `max` (20% luck -> 9%, 200% -> 50%).
  luck: { half: 200, max: 0.75 },
  accelTime: 5, // s from 0 to top speed (shortened by the acc boost, boosts.js)
  metresPerStud: 0.35,
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
  // appears `ahead` m in front of the boat (inside the fog) and is recycled `behind` m behind it. An
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
  // `compact` (portrait, or under compactHeight px tall) looks further down so the boat sits above the speedometer.
  // `orbit`: drag (mouse, or the touch look zone) swings the cam around the boat at `pivot` m above
  // it; pitch is the boom's angle above the horizon, kept in min..max (min keeps it above the water).
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
  // fly from the boat into the trophy counter (each adds its share as it lands)
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

// --- Engines (engine.js) ----------------------------------------------------------
// The Engine window's catalog. Everything but the free Basic Engine is bought with
// Wins (the HUD's trophy counter). Grid order: the three gem engines (red NEW
// cards), the Basic Engine, then the 30-engine ladder, one card colour per row of 4.
// stats are % boosts: wins, acc (boat acceleration), train (training gains).
// look colours the card art: kind 'rocket' | 'missile' | 'jet' | 'ship' | 'satellite'.
export const ENGINE = {
  starter: {
    id: 'basic',
    name: 'Basic Engine',
    stats: { wins: 6, acc: 11, train: 6 },
    look: { kind: 'rocket', body: '#f4f7f6', band: '#2fd05a', nose: '#f4f7f6', fin: '#e2e8e6', flame: '#3fc8ff' },
  },
  // Gem engines cost what a ladder engine with the same Wins boost would cost
  // (gemPrice in engine.js): Galactic 200M, Blaze 1.9Qa and Cyan Volt, past the
  // top of the ladder, 36Oc. Set `price` on one to override.
  gemTier: '#ff5d3a',
  gems: [
    { id: 'galactic', name: 'Galactic Thruster', stats: { wins: 55, acc: 105, train: 55 }, look: { kind: 'rocket', body: '#f6f8fb', band: '#ff3b3b', nose: '#ff3b3b', fin: '#2f6bff', flame: '#ff4fd8' } },
    { id: 'blaze', name: 'Blaze Drift', stats: { wins: 105, acc: 205, train: 105 }, look: { kind: 'jet', body: '#1b1b20', band: '#ff2a2a', nose: '#ff2a2a', fin: '#26262c', flame: '#ffb02e' } },
    { id: 'cyanvolt', name: 'Cyan Volt', stats: { wins: 200, acc: 355, train: 200 }, look: { kind: 'ship', body: '#eef6ff', band: '#3aa6ff', nose: '#20242c', fin: '#e63a3a', flame: '#5fd8ff' } },
  ],
  // Ladder engine k (1..30): price = firstPrice * priceGrowth^(k-1), rounded to 2
  // significant digits (100, 500, 2.5K, 13K, ... 4.8Sx, 24Sx); wins and train
  // boosts = winsStep * (k+1) % (10% ... 155%), acc = twice that.
  ladder: {
    firstPrice: 100,
    priceGrowth: 5,
    winsStep: 5,
    tiers: ['#c9c9c9', '#69d36b', '#4cb6ff', '#ff6fc8', '#ff4a4a', '#ffc81a', '#a51cff'], // card colour per row of 4 (the last repeats)
    engines: [
      { name: 'Red Rocket', look: { body: '#2e2f38', band: '#ff4141', nose: '#f2f2f2', fin: '#8a1d1d' } },
      { name: 'Blue Rocket', look: { body: '#24304f', band: '#4f7dff', nose: '#c9d6ff', fin: '#1b2850' } },
      { name: 'Olive Rocket', look: { body: '#5e5a1e', band: '#c9b832', nose: '#d8cc5a', fin: '#403d12' } },
      { name: 'Violet Rocket', look: { body: '#2c2448', band: '#8a5cff', nose: '#b49aff', fin: '#1d1733' } },
      { name: 'Navy Booster', look: { body: '#1f2b4d', band: '#3d5aa8', nose: '#2b3c6d', fin: '#141d36' } },
      { name: 'Camo Booster', look: { body: '#5c5a3c', band: '#8b8a5a', nose: '#3e3d28', fin: '#2f2e1e', camo: true } },
      { name: 'Crimson Booster', look: { body: '#d9d6d6', band: '#d62b2b', nose: '#b51f1f', fin: '#7d1414' } },
      { name: 'Jade Booster', look: { body: '#2c3a33', band: '#2fae5d', nose: '#1f7a40', fin: '#1a2620' } },
      { name: 'Sky Thruster', look: { body: '#e8f6ff', band: '#38b4ff', nose: '#38b4ff', fin: '#1f78c4' } },
      { name: 'Frost Thruster', look: { body: '#d5f3ff', band: '#8ee7ff', nose: '#ffffff', fin: '#5cb8d8', flame: '#9af0ff' } },
      { name: 'Tidal Thruster', look: { body: '#0d4f78', band: '#20d1ff', nose: '#0a3350', fin: '#073049', flame: '#20d1ff' } },
      { name: 'Storm Thruster', look: { body: '#39405a', band: '#ffe03a', nose: '#ffe03a', fin: '#232838', flame: '#ffe96a' } },
      { name: 'Candy Drive', look: { body: '#ffffff', band: '#ff4fa8', nose: '#ff4fa8', fin: '#c4307a', flame: '#ff8fd0' } },
      { name: 'Nebula Drive', look: { body: '#3a1d63', band: '#d06bff', nose: '#ff8af3', fin: '#24103f', flame: '#e58aff' } },
      { name: 'Plasma Drive', look: { body: '#4a1a6e', band: '#ff4fd8', nose: '#ffffff', fin: '#2d0f45', flame: '#ff6af0' } },
      { name: 'Quasar Drive', look: { body: '#f4ecff', band: '#9b4dff', nose: '#c08bff', fin: '#6a2ad1', flame: '#c9a2ff' } },
      { name: 'Ember Jet', look: { kind: 'jet', body: '#3a2a26', band: '#ff7a2e', nose: '#ff7a2e', fin: '#5a3a30', flame: '#ffb02e' } },
      { name: 'Magma Jet', look: { kind: 'jet', body: '#2a1c1c', band: '#ffcf3a', nose: '#ff4a1a', fin: '#7a1f12', flame: '#ff6a2e' } },
      { name: 'Inferno Jet', look: { kind: 'jet', body: '#d9d6d6', band: '#d62b2b', nose: '#d62b2b', fin: '#9a1a1a', flame: '#ff8a2e' } },
      { name: 'Volcano Jet', look: { kind: 'jet', body: '#141414', band: '#ff3a1a', nose: '#ffcf3a', fin: '#3a1410', flame: '#ff5a1a' } },
      { name: 'Sun Missile', look: { kind: 'missile', body: '#6a1e18', band: '#ffcf3a', nose: '#9a2a20', fin: '#3a0f0c' } },
      { name: 'Bronze Missile', look: { kind: 'missile', body: '#7a4a2a', band: '#c98a4a', nose: '#3a2418', fin: '#4a2a18' } },
      { name: 'Checker Missile', look: { kind: 'missile', body: '#5a1a1a', band: '#f2f2f2', nose: '#2a2a2a', fin: '#1d1d1d', checker: true } },
      { name: 'Shadow Missile', look: { kind: 'missile', body: '#1d1d24', band: '#3a3a46', nose: '#2a2a33', fin: '#101015' } },
      { name: 'Rust Orbiter', look: { kind: 'satellite', body: '#8a3a2a', band: '#c96a4a', nose: '#e8e0d8', fin: '#4a1f18', flame: '#ffb07a' } },
      { name: 'Night Orbiter', look: { kind: 'satellite', body: '#1d1d24', band: '#3a3a46', nose: '#c9d1d9', fin: '#1f2b6d', flame: '#9ab8ff' } },
      { name: 'Bee Orbiter', look: { kind: 'satellite', body: '#ffcf1a', band: '#1d1d24', nose: '#e8e8e8', fin: '#2a4fb8', flame: '#ffe96a' } },
      { name: 'Void Orbiter', look: { kind: 'satellite', body: '#2a1446', band: '#5a2a8a', nose: '#3a2a55', fin: '#2a1a4a', flame: '#c9a2ff' } },
      { name: 'Horn Satellite', look: { kind: 'satellite', body: '#1d4a4a', band: '#2a2a33', nose: '#1d1d24', fin: '#1f2f6d', flame: '#7affe0' } },
      { name: 'Wave Point Thruster', look: { kind: 'satellite', body: '#f2f4f8', band: '#ff8fb0', nose: '#f2f4f8', fin: '#2f6bdc', flame: '#ffffff' } },
    ],
  },
}

// --- Partners (partner.js) ----------------------------------------------------------
// The Partner window's catalog, in grid order (rows of 4). Nothing is free: every
// partner is bought with Wins (the HUD's trophy counter). The first row are the
// premium partners (red NEW ribbon), priced by performance against the ladder
// below them (whose prices grow ~8x per step). stats are % boosts: wins, luck,
// acc (boat acceleration). tint colours the name in the side panel. look
// dresses the blocky portrait (partner.js): hair/hat, face, shirt pattern, colours.
export const PARTNER = {
  featured: 'hacker', // shown when the window opens
  partners: [
    // Premium row (the reference's Robux 49 / 699 / 1999 / 4999 partners).
    { id: 'jester', name: 'Jester', price: 85e9, isNew: true, tint: '#ff9ad5', stats: { wins: 120, luck: 80, acc: 115 }, look: { skin: '#fff1ea', hair: 'pigtails', hairColor: '#e9e4dc', tipA: '#ff5fa2', tipB: '#5fb8ff', face: 'clown', shirt: 'stripes', color: '#e8eef5', color2: '#d9263a', pants: '#2b3fa8', pants2: '#d9263a' } },
    { id: 'batman', name: 'Batman', price: 12e15, isNew: true, tint: '#ffd400', stats: { wins: 340, luck: 230, acc: 330 }, look: { hat: 'cowl', hatColor: '#26262e', shirt: 'emblem', color: '#33343d', color2: '#ffd23a', arms: '#26262e', pants: '#26262e', cape: '#1d1d23' } },
    { id: 'hacker', name: 'Hacker', price: 800e15, isNew: true, tint: '#f59dff', stats: { wins: 500, luck: 340, acc: 490 }, look: { skin: '#fff1ea', hair: 'pigtails', hairColor: '#f4f1ec', tipA: '#ff4f86', tipB: '#3f8bff', face: 'clown', shirt: 'stripes', color: '#f4f4f4', color2: '#e3263a', pants: '#e3263a', pants2: '#2846c8' } },
    { id: 'darkknight', name: 'Dark Knight', price: 80e18, isNew: true, tint: '#b9a7ff', stats: { wins: 750, luck: 510, acc: 730 }, look: { hat: 'cowl', hatColor: '#141418', shirt: 'armor', color: '#1d1d23', color2: '#4a4a55', arms: '#141418', pants: '#141418', cape: '#0e0e12' } },
    // Ladder.
    { id: 'prisoner', name: 'Prisoner', price: 100, tint: '#ffa31a', stats: { wins: 30, luck: 20, acc: 20 }, look: { hair: 'short', hairColor: '#6b3d1f', shirt: 'jumpsuit', color: '#ff8a1f', color2: '#fff', pants: '#ff8a1f' } },
    { id: 'police', name: 'Police', price: 2e3, tint: '#7fc4ff', stats: { wins: 35, luck: 25, acc: 25 }, look: { hat: 'police', hatColor: '#1d2c5e', shirt: 'police', color: '#2f63c8', color2: '#ffd23a', pants: '#1d2c5e' } },
    { id: 'courier', name: 'Courier', price: 80e3, tint: '#ffd400', stats: { wins: 45, luck: 30, acc: 30 }, look: { skin: '#ffd23a', hat: 'cap', hatColor: '#e3263a', shirt: 'bands', color: '#ffd23a', color2: '#1d1d23', arms: '#1d1d23', pants: '#1d1d23' } },
    { id: 'robber', name: 'Robber', price: 2.4e6, tint: '#d0d0d8', stats: { wins: 55, luck: 35, acc: 35 }, look: { hat: 'balaclava', hatColor: '#1d1d23', shirt: 'hoodie', color: '#2a2a31', color2: '#3d3d46', pants: '#1d1d23', bat: true } },
    { id: 'builder', name: 'Builder', price: 48e6, tint: '#ffc21a', stats: { wins: 65, luck: 40, acc: 45 }, look: { hat: 'hardhat', hatColor: '#c98a2a', face: 'shades', shirt: 'vest', color: '#2f4f86', color2: '#ff8a1f', pants: '#2b3550' } },
    { id: 'detective', name: 'Detective', price: 480e6, tint: '#e0b77a', stats: { wins: 75, luck: 50, acc: 55 }, look: { hair: 'swept', hairColor: '#1d1d23', shirt: 'jacket', color: '#b08a4a', color2: '#1d1d23', pants: '#2a2a31' } },
    { id: 'pinkmask', name: 'Pink Mask', price: 3.8e9, tint: '#ff7ab8', stats: { wins: 90, luck: 60, acc: 70 }, look: { hat: 'mask', hatColor: '#1d1d23', hood: '#e0337a', shirt: 'suit', color: '#e0337a', color2: '#b5205e', pants: '#e0337a' } },
    { id: 'soldier', name: 'Soldier', price: 30e9, tint: '#c7ccd4', stats: { wins: 110, luck: 70, acc: 85 }, look: { hair: 'short', hairColor: '#2a2a31', shirt: 'camo', color: '#8a8f96', color2: '#5d6168', pants: '#5d6168' } },
    { id: 'glitch', name: 'Glitch', price: 240e9, tint: '#5dff6a', stats: { wins: 130, luck: 85, acc: 105 }, look: { skin: '#123d18', hat: 'fedora', hatColor: '#0f3313', face: 'code', shirt: 'code', color: '#0f3313', color2: '#3dff5a', arms: '#0f3313', pants: '#0f3313' } },
    { id: 'superhero', name: 'Superhero', price: 1.9e12, tint: '#6fa8ff', stats: { wins: 160, luck: 105, acc: 130 }, look: { hair: 'swept', hairColor: '#15151a', shirt: 'hero', color: '#2456d6', color2: '#e3263a', pants: '#2456d6', cape: '#e3263a', armsUp: true } },
    { id: 'mechanic', name: 'Mechanic', price: 15e12, tint: '#ffd400', stats: { wins: 190, luck: 125, acc: 160 }, look: { skin: '#ffd23a', hat: 'cap', hatColor: '#d9263a', shirt: 'bands', color: '#2a2a31', color2: '#ffd23a', arms: '#ffd23a', pants: '#2a2a31' } },
    { id: 'bandit', name: 'Bandit', price: 120e12, tint: '#d0d0d8', stats: { wins: 230, luck: 150, acc: 195 }, look: { hat: 'balaclava', hatColor: '#141418', shirt: 'hoodie', color: '#1d1d23', color2: '#4a4a55', pants: '#141418', bat: true } },
    { id: 'foreman', name: 'Foreman', price: 1e15, tint: '#ffc21a', stats: { wins: 270, luck: 180, acc: 240 }, look: { hat: 'hardhat', hatColor: '#ffc21a', face: 'shades', shirt: 'vest', color: '#1f3a6b', color2: '#ffd400', pants: '#1d2c5e' } },
    { id: 'spy', name: 'Spy', price: 8e15, tint: '#e0b77a', stats: { wins: 330, luck: 220, acc: 300 }, look: { hair: 'swept', hairColor: '#1d1d23', face: 'shades', shirt: 'jacket', color: '#2a2a31', color2: '#d9263a', pants: '#1d1d23' } },
    { id: 'commander', name: 'Commander', price: 64e15, tint: '#ff7ab8', stats: { wins: 400, luck: 265, acc: 380 }, look: { hat: 'mask', hatColor: '#141418', hood: '#141418', shirt: 'suit', color: '#1d1d23', color2: '#e0337a', pants: '#1d1d23' } },
    { id: 'guard', name: 'Guard', price: 500e15, tint: '#f2b45a', stats: { wins: 480, luck: 320, acc: 470 }, look: { hair: 'short', hairColor: '#15151a', shirt: 'labcoat', color: '#f2f4f6', color2: '#8fd8d2', arms: '#f2f4f6', pants: '#8fd8d2', clipboard: true } },
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
  // The ribbon behind the boat (trail.js): a band fed from the stern that turns
  // to face the camera (upright seen from the side, flat on the water from
  // behind), fading out over its life. width/tile are the defaults per look.
  ribbon: { points: 72, life: 0.9, spacing: 0.35, width: 0.6, tile: 2.4, opacity: 0.95, height: 0.14, stern: 1.45 },
  // The scene's showcase: the boat parked in the sea off the east wing, broadside
  // to a low camera that looks back at the beach and cliffs (like the reference).
  // view = horizontal direction the camera looks; the boat faces the camera's right.
  showcase: { x: 57, z: -18.5, y: -0.72, view: [-0.795, 0.607], speed: 24, distance: 4.6, height: 0.95, boatWidth: 0.25, portraitBoatWidth: 0.62, portraitRaise: 0.3 },
}

// --- Audio (src/audio/) ---------------------------------------------------------------
// Everything is synthesised at runtime (no sound files). volume = default master
// level (the portal's sound_volume setting overrides it; M mutes, saved under storageKey).
export const AUDIO = {
  volume: 0.8,
  storageKey: 'horse-race-99.sound',
  buses: { ui: 0.8, sfx: 0.9, amb: 0.55, engine: 0.5 }, // per-bus levels before the master
  duck: 0.45, // world (ambience + engine) level while a menu window is open
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
  // The boat (audio/engine.js): rpm at idle / flat out, layer levels; idleLevel = mix level standing
  // still in the lobby, settle = racing level once the speed is steady, eased to over settleTime s.
  engine: { idle: 720, max: 4800, motor: 0.45, roar: 0.2, rumble: 0.1, wash: 0, spray: 0, slap: 0.2, sand: 0.06, idleLevel: 0.3, settle: 0.62, settleTime: 4 },
  // The beach (audio/ambience.js): scheduler tick s, layer levels, foam bubbles per second of a
  // receding wave, gull call gap range s, crickets [Hz, pan], waterfall level and the distance (m)
  // at which it is at half level.
  ambience: { tick: 0.25, foam: 16, foamTouch: 7, gull: 0.05, gullEvery: [14, 34], cricket: 0.025, crickets: [[4400, -0.6], [4750, 0.5], [5100, 0.1]], waterfall: 0.55, waterfallNear: 16 },
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
