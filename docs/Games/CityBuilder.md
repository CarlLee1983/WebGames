# City Builder

City Builder is a browser-based city planning sandbox. The player lays out roads and public utilities, then grows serviced residential districts and uses commercial or industrial zones to balance the city budget.

## Controls

- Choose a facility from the build menu, then click or tap a map cell to place it.
- On phones, use the horizontally scrollable action toolbar directly above the map instead of leaving the planning area.
- Move the keyboard cursor with the arrow keys and build with `Enter` or `Space`.
- Press `B` while the map is focused to select the bulldozer.
- Use 75%, 100%, or 150% zoom. The map remains independently scrollable on small screens.
- Pause, resume, or accelerate the simulation with the native speed controls.

## City loop

- Residential, commercial, and industrial districts must directly touch a road.
- A power plant supplies cells within five tiles; a water pump supplies cells within four tiles.
- Fully serviced residential districts gain five residents per tick, up to 100 per district.
- Fully serviced commercial and industrial districts generate revenue, while every facility has a maintenance cost.
- Parks improve nearby residential happiness, while nearby industry lowers it.
- The city advances from Settlement to Village, Town, City, and Metropolis as population grows.

## Planning feedback

- Selecting a power plant, water pump, or park shades its exact coverage footprint on the map before construction.
- The preview reports its covered cell count, how many existing districts it reaches, and whether the current cell is buildable.
- Existing facilities of the selected type remain softly visible, making overlapping service areas easier to compare.
- Road access, power, water, production, usage, maintenance, and active income refresh immediately after construction or demolition; population growth still advances on simulation ticks.

## Save and recovery

- Construction, demolition, and speed changes save immediately in browser storage.
- The running simulation autosaves every 20 ticks.
- Saved data is checked for the expected 30×20 grid, known facility types, finite resource values, and valid tool and speed settings before it is loaded.
- Starting a new city requires confirmation because it replaces the current browser save.

## Responsive and accessible play

- Desktop defaults to a complete 75% planning view; phones default to a scrollable 150% map with 48 CSS-pixel cells.
- Pointer coordinates are translated back to the 960×640 logical grid, so placement remains accurate at every zoom.
- The canvas backing resolution follows device pixel ratio, capped at 2× for clarity and performance.
- Primary controls use native buttons with visible focus states and at least 48 CSS-pixel targets.
- Resource totals, selected-cell services, build feedback, and notifications are available as regular DOM content rather than canvas-only information.
- The inspectable game snapshot includes the keyboard cursor, selected-cell service state, placement error, and coverage cells.

## Verification

- Core placement, exact coverage footprints, immediate service refresh, finance, simulation, rank, demolition, and save-validation rules are covered in `src/app/games/city-builder/utils.test.ts`.
- Manual checks target desktop `1280×720` and mobile `390×844` layouts, including keyboard construction, the mobile action toolbar, coverage preview, immediate service badges, zoom, speed changes, and reset confirmation.
