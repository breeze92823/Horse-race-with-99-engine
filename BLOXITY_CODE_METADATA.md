---
canDie: false
hasScore: true
leaderboards:
  - wins
  - power
  - rebirths
notApplicable:
  deathScreen: The player cannot die. Falling off the island only puts the horse back at the spawn, and the developer chose not to count that as a death.
---

# Bloxity integration notes

- **canDie: false**: there is no death in Horse Race, so the game shows no Boxity death screen.
- **hasScore: true**: Boxity shows three boards. They are declared in `src/config.js` `BOXITY_BOARDS` and in the backend's `src/constants.ts`.
  - `wins`: Wins (trophies), current value, compact format.
  - `power`: Power (lightning), current value, compact format.
  - `rebirths`: rebirth count, best value.
  The game server reports the scores from its saved docs (`../Horse-race-backend/src/boxityBoards.ts`), never from client packets.
- **Party play and Play with friends**: these come from Boxity with no extra code. The game is hosted on Boxity, loads the SDK by script tag from `sdk.bloxity.io/v1`, connects with `Legion.SDK.net.resolveEndpoint` then `joinOrCreate`, and its room has `maxClients` 50. The game therefore does not call `party.enable` or `registerFeature('play_with_friends')`.
