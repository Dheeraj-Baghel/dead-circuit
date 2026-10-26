# DEAD CIRCUIT

Horror maze with a visible **animated third-person player**, optional first-person
view, and a persistent **2D minimap on the left**.

**Play locally: [http://127.0.0.1:4332](http://127.0.0.1:4332/)**

## Current checkpoint: uploaded animated player + third-person follow camera

The approved [v2 plan](../.designer/plans/dead-circuit-v2-first-person-horror-pac-man-4ac88def.md)
upgrades this app in place. **All five engineering checkpoints are implemented
and verified.** This is a local playtest candidate, not human release approval.
Human balance/scare/sound review, Firefox/physical Safari/device qualification
and any deployment remain open. See the [release handoff](RELEASE.md).

### Uploaded model is now in use

- Uses the exact user-supplied **Pacman animated** GLB by **Luall_Studio**,
  credited under **CC BY 4.0**, not a static/generated replacement.
- Real **Eating** skeletal clip: 0.833333 seconds, two animated jaw-bone rotation
  channels, 41 key times per track. Walking/sprint and slow idle playback use
  game time; pause/tab loss freezes the actual jaw pose.
- Body faces movement; mouse/J/L orbits the camera. Spawn presents the face;
  then idle retains the last movement heading. Orbit or strafe to see its mouth
  from different angles. WASD/arrows and the left minimap remain intact.
- All-key animated geometry envelope fits inside the unchanged player collider.
  Camera clearance follows the shared grid and shortens its boom near walls;
  portal transitions remain local. No enemy/score/collection rules were changed.
- Third person is default; **Settings → Camera view → First person** restores
  the original view. Missing required player data gives an explicit retry state,
  not a silent static substitute.
- **173 units / 71 Chrome workflows**, fresh isolated install/build, asset hash
  audit and bounded Chrome/WebKit production smoke pass. No deployment.

[Animated gameplay preview](artifacts/testing/third-person/animated-player.gif) ·
[Model and camera notes](PLAYER_MODEL.md) ·
[Model attribution](public/assets/player/LICENSE.txt).

The uploaded model adds a fan/franchise-rights review gate to any public release;
the uploader's CC license does not itself establish underlying franchise clearance.

### Phase 5 final engineering checks

- All four **arrow keys now mirror WASD movement**: Up/Down walk forward/back;
  Left/Right strafe. Mouse look remains; **J/L** provide keyboard turning.
  Combined aliases do not double speed; diagonals remain normalized.
- Arrows/J/L/Escape are reserved during remapping. Legacy conflicting remaps
  repair safely while valid custom bindings and progress remain. Slider/menu
  arrows keep their native behavior when paused. Held keys clear on blur.
- Native pointer release gets a visible short resume cooldown; mouse capture
  is reacquired from a deliberate click. Keyboard/drag fallback remains available.
- Corrupt/future-version saves are retained in a protected recovery copy before
  replacement. Existing distinct recovery snapshots are never overwritten.
- Graphics context loss/restoration preserves the paused run and requires
  explicit resume. The restored scene and input are browser-tested.
- Cacheable library chunks replace the monolithic JS bundle: largest generated
  JS is ~352 kB; the prior chunk-size advisory is gone without increasing limits.
- **173 units, 71 Chrome workflows**, isolated clean install/build, and an asset/
  chunk/license audit pass. Bounded fixture-free Chrome and Playwright WebKit
  production smoke workflows pass. Firefox could not launch in its availability
  probe and is not qualified; WebKit smoke is not physical Safari certification.

Evidence: [release audit](artifacts/testing/phase5/release-check.json),
[clean install](artifacts/testing/phase5/clean-install.json),
[arrow controls](artifacts/testing/phase5/arrow-movement.png), and
[graphics restored](artifacts/testing/phase5/context-restored.png).

### Phase 4 audio and contextual scares

- Independent **master, music, ambience and effects** gains, persistent mute,
  and an optional **proximity heartbeat**. Old saves preserve their previous
  ambience level when the new independent bus is added.
- Original chapter-specific tonal drones, filtered air/machinery, Drainworks
  drips and Core resonance; low-priority beds duck under priority signals.
- Eight selected **Kenney Impact Sounds CC0** recordings (~63 kB total), all
  bundled locally: concrete footsteps, metal, wood, plate and bell textures.
  Native decoded buffers are peak-normalized and filtered/pitched at runtime.
  Footsteps distinguish tile/concrete, damp Drainworks and grated metal tunnels.
  Failed requests/decoding use actual synthesis fallback, not silent fake cues.
- Distinct spatial hunter signatures: heavy dragging impacts, Mimic footsteps
  from the hunter's location, Puppet knock/wire tone, and synthesized wordless
  Weeper cries. Wall occlusion muffles and low-passes them; no recorded speech.
- Five cosmetic events: one slow lamp fade/recovery, a cabinet screen powering
  up, distant footsteps, a translucent crossing shadow and whisper-like tunnel
  air. Events do not become real hunters or add map markers/collision objects.
- First eligibility after **60 game seconds**, then **65–85 seconds** between
  actual starts. Strict gates require enough remaining **scatter** relief,
  no nearby/visible threat, no refuge, training, grace, overload or blackout.
  Events are skipped/deferred when unsafe, and stop if danger approaches.
  **No events run during permanent chase**; the interval is a maximum-frequency
  constraint, not a promise that a scare occurs every minute.
- **Reduced Scares** immediately cancels optional events, sounds and captions,
  while retaining softer capture presentation. **Reduced Motion** excludes
  animated lamp/screen/shadow events; only eligible audio events remain.
  Essential signal and contextual sound captions remain available with mute
  or unsupported audio. Frequent hunter captions do not use a live announcer.
- AudioContext creation/resume is Play/Resume-only. Pause stops transient cues
  and suspends native loop phase; all atmosphere timing uses simulation time.
  Resume has no catch-up burst. Retries reuse one context and five loops;
  transient voices are capped at 14 with per-group caps and priority handling.

Previews: [audio/comfort controls](artifacts/testing/phase4/audio-comfort-settings.png),
[screen event and caption](artifacts/testing/phase4/event-screen.png),
[distant shadow](artifacts/testing/phase4/event-silhouette.png).
The [native audio record](artifacts/testing/phase4/native-audio.json) proves
decoding/graph signal, **not human listening quality or calibrated loudness**.

### Phase 3 environment and creatures

- Local **ambientCG CC0** concrete, tiles and metal, each with 1024 × 1024
  color/OpenGL-normal/roughness maps. Original oxide-like grime, cracks,
  signage and screen art break up surface repetition. A procedural fallback
  keeps Play usable if an optional texture request fails.
- A boundary-face wall shell adds **recessed landmark bays**: Kenney Mini Arcade
  CC0 cabinets, claw machine, ticket machine and prizes in the Service Loop;
  original lockers, pumps/tanks and electrical panels in the utility chapters.
  Measured scene bounds remain entirely inside original wall cells, never the
  navigable aisle. Decoration does not add invisible collision blockers.
- Warm amber basement, cool blue Drainworks and copper/red Core treatments;
  four fixed practical lights, a patterned shadowed flashlight, red blackout,
  ceiling conduits, damp floor patches, dust and lightweight light-shaft meshes.
  Illumination gently dims with collection progress; no repetitive strobing.
- Four original stylized low-poly models: porcelain-masked long-coat **Stalker**,
  crawling four-limbed **Mimic**, suspended wire **Puppet**, and hunched **Weeper**.
  Merged geometry limits draw calls; limbs have state-driven posing. Returning
  hunters render as a small glowing wisp, not a shrunken full body.
- Restrained bloom, grain, vignette and proximity color fringing affect only
  the 3D scene, not the minimap or DOM HUD. No motion blur, head bob or forced
  camera movement. Reduced Motion freezes effect time/poses and removes fringing;
  Reduced Scares removes fringing. Low quality bypasses postprocessing and the
  shadow-dependent flashlight cookie, with reduced drawing resolution.
- Only selected local assets ship. Credits/licenses are included in-game and
  in the [asset register](asset-manifest.json). Initial local material/model
  preparation gates Play; no runtime CDN or asset-service dependence.
- Final short headless Chrome/Apple M1 sample: **~60 fps**, 1440 × 900,
  standard quality, **107 draw calls / 41,801 triangles**, four near-camera models.
  This is a six-second stationary rendering fixture, not sustained device FPS
  or a human playtest. The separate moving-AI/retry inventory check also passes.

Previews: [arcade bay](artifacts/testing/phase3/arcade-landmark.png),
[Stalker](artifacts/testing/phase3/creature-stalker.png),
[Mimic](artifacts/testing/phase3/creature-mimic.png),
[Puppet](artifacts/testing/phase3/creature-puppet.png),
[Weeper](artifacts/testing/phase3/creature-weeper.png), and
[red blackout](artifacts/testing/phase3/blackout.png).

### Phase 2 map and HUD

- Persistent left-side Canvas map, with a visible hunter-only cage/gate,
  paired tunnel arrows, power cells, lift state, refuge, relays and bonus relic.
- **S / M / P / W** letters plus four distinct shapes identify hunters without
  relying only on color. Visible returning hunters use a separate wisp symbol.
- **Confirmed + heard** is the default: solid markers are direct sight/radar
  fixes; dashed markers retain the actual recorded last-seen position for four
  seconds. Nearby sounds use coarse cell-centred **? uncertainty rings**, not
  precise live tracking. Unknown distant hunters stay hidden.
- Optional **Arcade** map shows all hunters live, including those in Lockup.
  Observation labels make that information policy explicit.
- **North-up** default or **heading-up** rotation; one transform fits all maze
  corners at any angle. The enlarged paused map always stays north-up.
- A **scatter/chase/overload timer ring**, permanent-chase and blackout states,
  memory progress bar, relic countdown and shared symbol legend.
- Visibility/orientation preferences persist with existing v2 settings. Old
  saves receive safe defaults; settings never change AI, collisions or clocks.
- Responsive map sizing keeps the full map and enlargement action visible at
  the tested viewports, including maximum scale. Short screens compact secondary
  legends; the enlarged paused map retains full explanations.

See [production map](artifacts/testing/phase2/production-map.png) and
[enlarged observations](artifacts/testing/phase2/enlarged-observations.png).

### Implemented rules

- Three original, distinct **21 × 23 text mazes**, plus capture-free training.
  Campaign walls are mirrored; every normal corridor has at least two exits.
  Every objective is reachable before optional relay shortcuts open.
- A central **Lockup** has a player-blocking gate and hunter-only routes.
  Stalker starts outside; other hunters release after mote thresholds or
  elapsed deadlines, never before spawn grace. They defer departure when the
  player is too close to the doorway.
- **Stalker** targets your cell; **Mimic** targets four cells ahead of camera
  facing; **Puppet** reflects Stalker around the point two cells ahead;
  **Weeper** retreats nearby, chases at distance and investigates expiring noise.
  Chase intentionally knows the player tile; it no longer uses v1's sight-memory AI.
- Hunters choose junction exits by squared target distance with stable ties,
  don't normally reverse, and turn only at tile centres. Scatter/chase switches
  and power cells request a reversal at the next centre. Frightened turns use
  seeded randomness. Shortest paths are used only for Lockup exit/return.
- Chapter 1 alternates **9 s scatter / 18 s chase** three times, then permanent
  chase. Overload pauses the wave schedule. Later chapters/nights reduce relief.
- Paired edge tunnels wrap player and hunter movement. Hunters slow in marked
  tunnel tiles. Portal travel is split into local collision segments, so it
  cannot collect motes or hit hunters across the middle of the maze.
- Four campaign power cells: **8 / 6 / 4 seconds** by chapter, ×1.5 in Relaxed.
  Power refreshes rather than stacks. Banish chains score **200 / 400 / 800 / 1600**.
  A banished hunter becomes a small returning wisp, moves back to its home,
  waits, and re-enters safely rather than teleporting onto the player.
- **Bonus relics** appear near entry at 30% and 70% of motes collected, for 10 s.
  They are optional. One **extra chance at 10,000 points**; starts with three.
- The last required mote triggers **blackout**: power and relics end, all hunter
  personalities target the player, flashlight illumination stops, emergency
  lighting turns red and the exit lift becomes available.
- **Night Shift** unlocks after campaign completion. It cycles the three authored
  mazes, carries score/chances/extra-life eligibility, increases hunter pressure
  and shortens power duration to a floor. It is not procedural maze generation.
- Save v2 preserves v1 preferences, bindings and chapter unlocks, but does not
  compare old v1 scores with the new mazes. The original v1 storage value stays
  untouched. Night Shift records and campaign completion persist separately.

## Run and verify

From this folder, `npm ci` then `npm run dev`. Node 24.13.0 / npm 11.6.2 were
available for this checkpoint; on this Mac their directory is `/usr/local/bin`.

- `npm run build`: strict TypeScript check and production Vite build.
- `npm run preview`: production on 4332; stop this app's dev process first.
- `npm test`: **173 unit tests** across thirteen suites.
- `npm run test:browser`: **71 Chrome workflows**, including production checks.
  Uses this app's dev server on 4332 and a temporary production preview on 4333.
- `npm run verify:clean`: isolated clean install, units and production build;
  leaves the user's active node_modules and preview intact.
- `npm run build && npm run test:release`: assets/hashes/chunks/notices and
  bounded Chrome/WebKit production smoke on an owned ephemeral loopback port.

No backend, account, keys, CDN runtime requests, deployment or changes to other
applications. The production fixture API and its namespace are absent from
built JS. Full output is ~4.19 MB before transfer compression, including the
self-contained 1.11 MB player GLB.

## Controls

| Control | Action |
| --- | --- |
| W / A / S / D or ↑ / ↓ / ← / → | Walk forward/back, strafe left/right |
| Mouse | Orbit the third-person view / first-person look |
| Shift | Sprint; uses stamina and produces noise |
| Q | Radar pulse; Weeper can hear it |
| F | Flashlight on/off (illumination disabled during blackout) |
| E | Restore an optional relay |
| Escape | Pause everything and release mouse capture |
| J / L | Keyboard view turning/orbit |

Remapping, sensitivity, inversion, horizontal FOV, map scale/contrast, volumes,
graphics and comfort/challenge settings remain. Drag-to-look and keyboard-turn
fallbacks work when mouse capture is denied. Returning to a hidden tab never
silently resumes play. No head bob, sprint FOV change or motion blur. The
third-person camera shortens only as needed for wall clearance.
Touch gameplay and interrupted-run restoration remain unsupported.

## Architecture and evidence

- [Maze authority](src/game/maze.ts): symbols, permissions, graph queries, validation.
- [Authored chapters](src/game/levels.ts): original text layouts and named test spots.
- [Hunters](src/game/hunters.ts): targets, junction turns, waves, Lockup and speed rules.
- [Simulation](src/game/simulation.ts): resources, ordered contacts, scoring, blackout and Night Shift.
- [Movement](src/game/movement.ts): circle collision and split portal travel.
- [Lifecycle](src/ui/useGame.ts): fixed-step loop, input, audio, pause, recovery and saves.
- [Player](src/render/player.ts): exact uploaded GLB, measured normalization, real Eating clip and lifecycle.
- [Chase camera](src/render/chaseCamera.ts): collision-aware shared-grid camera placement.
- [Controls](src/services/controls.ts): fixed movement aliases, reserved bindings and keyboard-turn policy.
- [Map model](src/ui/mapModel.ts): observation policies, identity registry, world transforms and wave readout.
- [Minimap](src/ui/minimap.ts): Canvas 2D layers over the shared maze and map model.
- [Map panel](src/ui/MapPanel.tsx): timer ring, hunter observations and symbol legends.
- [Materials](src/render/materials.ts): local PBR/fallback loading and shared texture ownership.
- [Lighting](src/render/lighting.ts): chapter treatments, fixed light inventory and flashlight pattern.
- [Landmarks](src/render/landmarks.ts): collision-safe recess placement contract.
- [Props](src/render/props.ts): exact GLB loading, measured normalization and original utility props.
- [Creatures](src/render/creature.ts): merged geometry and articulated original silhouettes.
- [Postprocessing](src/render/postfx.ts): compositor, bloom, grade and explicit output conversion.
- [Sound policy](src/services/soundModel.ts): surfaces, directions, chapter mixes and threat pressure.
- [Audio engine](src/services/audio.ts): local samples, native graph, voice limits, lifecycle and captions.
- [Atmosphere director](src/game/atmosphere.ts): non-authoritative relief gates and game-time scheduling.
- [Atmosphere rendering](src/render/atmosphere.ts): lightweight single-fade lights/screens and cosmetic shadow.
- [Verification](VERIFICATION.md): automated results and limits.
- [Release handoff](RELEASE.md): reproducible checks, recovery behavior and remaining human gates.
- [Lockup capture](artifacts/testing/v2-phase1-lockup.png).
- [Blackout capture](artifacts/testing/v2-phase1-blackout.png).
- [Creature/corridor capture](artifacts/testing/horror-encounter.png).

Maze/enemy/utility geometry, signs, effects and synthesized sounds are original
project work. The player is the user's CC BY 4.0 Luall_Studio model, separately
credited with runtime changes disclosed. Phases 3–4 bundle ambientCG/Kenney CC0 art and effects
with source, archive/file hashes, modifications and original licenses tracked in the
[asset register](asset-manifest.json) and [runtime/asset notices](public/licenses.txt).
No full authoring archives or unused model/audio packs ship. Lighting is stylized, not a
photorealistic rendering or physically measured building simulation.
Original arcade maps/code/audio are not bundled. The user-supplied Pacman fan
model means franchise clearance must be reviewed before public/commercial use.
The working title has not received commercial name clearance.

**Not yet verified:** human fairness/scare playtests, audible mix, native
Safari/Firefox, physical devices, long-session performance and manual assistive
technology. Accessible menus do not imply screen-reader-playable 3D navigation.
Movement-driven unit routes use capture-free practice; complex browser scenarios
use declared development-only setups, not human campaign playthroughs.
