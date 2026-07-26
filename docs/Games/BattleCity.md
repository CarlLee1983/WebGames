# Battle City

Battle City is a five-stage tank-defense arcade game. The player clears each enemy wave while keeping the Eagle Base at the lower center of the battlefield intact.

## Controls

- Move: `WASD`, arrow keys, or the on-screen directional pad.
- Fire: `Enter`, `Space`, or the Fire button.
- Pause or resume: `P` or the Pause button.
- Restart the full run: `R` or the Restart button.
- Menu, pause, stage-clear, and game-over overlays each provide a native action button for mouse and touch play.

## Combat loop

- Each stage deploys eight enemies in basic, fast, and armored variants.
- Brick walls can be destroyed; steel and water block movement.
- The run ends when all lives are lost or an enemy shell reaches the Eagle Base.
- Clearing the wave opens the next stage while preserving score and remaining lives.

## Power-ups

- Tank: grants an extra life.
- Star: upgrades movement speed and shell power, up to level three.
- Bomb: removes the active enemy squad.
- Shield: absorbs the next direct enemy-shell hit, then grants a brief safety window.
- Clock: temporarily freezes enemies without changing their permanent speed.
- Shovel: temporarily protects the Eagle Base.

## Combat feedback

- Mission status exposes tank level, shell power, movement speed, armor, sector, facing direction, and shells in flight.
- Effect chips show whether the one-hit shield is ready and count down enemy freeze, base fortification, and spawn protection.
- When a supply appears, a regular DOM alert identifies its effect and battlefield sector instead of relying on the blinking canvas icon alone.
- The six-item supply guide explains the Tank, Star, Bomb, Shield, Clock, and Shovel effects on every screen size.

## Responsive and accessible play

- The 480×416 logical canvas scales to the available width without causing horizontal overflow.
- Its backing resolution follows device pixel ratio, capped at 2× for clarity and performance.
- All primary controls use native buttons with visible focus states and at least 48×48 CSS-pixel targets.
- A DOM status panel exposes stage, lives, armor, score, remaining enemies, loadout, active effects, and field supplies; the canvas also carries a live descriptive label.

## Verification

- Core rules, including shield pickup and one-hit absorption, are covered in `src/app/games/battle-city/utils.test.ts`.
- Manual checks target desktop `1280×720` and mobile `390×844` layouts, including start, movement, shooting, loadout feedback, effect countdowns, pause, restart, stage completion, and retry flows.
