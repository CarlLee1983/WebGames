# Babylon RPG: Skybound Relics

Babylon RPG is a three-chapter browser action quest rendered with Babylon.js. Each chapter is assembled from procedural 3D meshes and JSON level data, while combat, objectives, persistence, and chapter transitions remain deterministic TypeScript rules.

## Chapters

- **Forest Shrine** — defeat all three roaming guardians. Enemies chase, attack, respect hit cooldowns, and remain defeated after an autosave.
- **Sunken Treasury** — locate and open the ancient chest to recover its relic, then enter the unlocked treasury door.
- **Sky Bridge** — cross moving platforms and damaging trap zones, recover the bridge cache, and reach the Sky Exit.

An objective must be complete before its chapter gate or the Next Chapter control unlocks. Clearing the Sky Bridge completes the expedition.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | `WASD` or arrow keys | Direction pad |
| Attack | `Space` or `Enter` | `ATTACK` |
| Open a chest / enter a gate | `E` | `ACT` |
| Pause / resume | `P` or toolbar | Center direction-pad button or toolbar |
| Inspect the realm | Drag and zoom the camera | Drag and pinch the camera |

All primary phone controls are at least 56 CSS pixels, the attack button is 80 pixels high, and objective, health, inventory, chapter state, and event feedback remain available as regular DOM content outside the canvas.

The default camera looks toward positive `z`, so `W`, Arrow Up, and the upward touch control all move visually forward. The tracked-objective HUD selects the nearest unfinished guardian or cache, then the chapter gate, and reports an eight-way compass direction plus distance.

## Combat and recovery

- The player starts with 8 HP, attack, defense, a short attack cooldown, and invulnerability frames after taking damage.
- Nearby enemies pursue the player and strike back. Trap zones deal their configured damage and push the player away.
- The tactical readout distinguishes safe, pursuing, sword-range, and enemy-strike distances. A visible sword meter and touch-button state expose the 420 ms attack recharge instead of silently ignoring early attacks.
- Guardians carry world-space health bars, while the cyan objective marker follows the nearest active target rather than level-data order.
- Reaching 0 HP freezes the chapter in a defeated state and offers a chapter retry with full health.
- A new expedition requires an explicit confirmation because it replaces the current browser save.

## Save model

Progress is stored in IndexedDB and autosaved during play. The versioned save records the active chapter, player position and stats, inventory, unlocked gates, opened chests, and defeated enemies. Invalid or legacy-shaped records are rejected instead of being partially restored.

## Rendering and static export

The React route owns UI, rules, and lifecycle management. `scene.ts` creates Babylon cameras, lighting, shadows, fog, meshes, effects, and chapter entities; `utils.ts` remains independent of Babylon for fast rule tests.

To keep the Next.js route bundle and static export stable, the required Babylon modules are built into `public/games/babylon-rpg/runtime.js`:

```bash
bun run build:babylon-runtime
```

UnoCSS scans only the UI-bearing `src/` and `public/` sources and excludes this generated third-party runtime bundle.

## Verification

`utils.test.ts` covers camera-forward movement, diagonal normalization, nearest-objective compass guidance, threat bands and attack recharge, combat and defeat, enemy damage and invulnerability, chest and gate interaction, moving platforms, terrain completion, pause behavior, save validation, and the inspectable text snapshot. Manual checks target desktop `1280×720` and mobile `390×844`, including WebGL startup, forward movement, keyboard and touch attack, pause/resume control states, save/load, reset confirmation, 48–80px controls, and horizontal overflow.
