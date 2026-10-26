# DEAD CIRCUIT — verification and boundaries

## Latest: user-supplied animated player and third-person camera

24 October 2026. The user's uploaded **pacman_animated.glb** is integrated as the
visible default third-person player. No deployment or other application edits.
Original upload is retained; runtime copy has identical SHA-256. Dependencies and
gameplay collision/AI/scoring sources are unchanged.

### Final gate and source evidence

- **173/173 units in 13 suites pass**, including nine new camera/fit/preference
  checks over every walkable chapter/training cell, orbit angles and near-wall
  pitch positions.
- **71/71 Chrome workflows pass** in the complete final run (~8.5 minutes),
  without configured retries. Six new actual-model/motion/pause/viewpoint/warp/
  missing-asset workflows; prior controls, audio, map and recovery regressions pass.
- Isolated clean `npm ci`, all units and strict production build pass, with zero
  npm audit vulnerabilities reported. No oversized-chunk warning.
- Asset audit checks **23 local external files, nine file hashes**, four external
  GLB texture references and notices. Full output is **4,192,338 bytes** before
  transfer compression, including the 1,107,616-byte self-contained player.
- Bounded fixture-free Chrome and Playwright WebKit production smoke pass.
  Real Safari/Firefox/device qualification is still not inferred.

The generic IDE observer does not support this GLB, so actual verification used
Three.js GLTFLoader/AnimationMixer and the live game renderer, not a text preview
or a claim that an unsupported editor observation succeeded.

[Source inspection](artifacts/testing/third-person/source-inspection.json) and
[live player record](artifacts/testing/third-person/runtime-player.json) identify:
**Eating**, 0.833333 seconds, two real quaternion tracks (Bone001_01 and Bone_00),
41 keys each, two skinned meshes and 30,204 triangles. Native tests compare changing
jaw-bone poses and freeze both pose/animation time under pause, then resume only
after explicit input. No static/generated player was substituted.

### Camera and fit contract

The full deformed radial/vertical envelope was measured at all 41 key times in
the native runtime, with radius 117.273064 source units. Whole-rig normalization
fits it to a **255 mm** radius inside the existing **280 mm** player collider,
with 25 mm radial margin and animated grounding. The source rig/geometry and
animation bytes are unchanged. To avoid startup rescanning, the measured envelope
is reused only after the exact uploaded SHA-256 matches; other bytes or unavailable
WebCrypto take the full measurement path.

The face was visually calibrated from source +Z to game -Z via a whole-rig turn,
not edits to jaw keys. Body heading follows actual displacement; idle retains the
last movement heading, and spawn initially presents the face. Mouse/J/L orbits the
view without changing movement rules. All arrows/WASD remain camera-relative.

The camera uses the shared wall/gate collision authority, a 160 mm clearance
radius with extra sampling margin, bounded height below conduits, and a shortened
boom near walls. It recalculates locally across tunnel warps, rather than smoothing
across the whole maze. Native checks compare visible actor position, local camera
position and wall clearance. The flashlight is anchored above the actor, avoiding
an obstructed forward beam from a behind-body camera. Fixed light count remains.

Default camera preference is third person for older saves. Explicit first-person
choice persists, hides the body and does not change paused position/score. Missing
required player bytes/clip show an honest retry screen, never a silent replacement.
Reduced Motion freezes decorative idle chewing but leaves functional moving-mouth
animation; pause/tab loss always freezes all game-time animation.

### Visual and performance review

Inspected [visible spawn](artifacts/testing/third-person/spawn-mouth.png),
[moving body](artifacts/testing/third-person/moving-player.png), and actual-game
[animation preview](artifacts/testing/third-person/animated-player.gif). The GIF
uses captured game frames, not public-viewer footage or invented model poses.

The reused four-near-enemy workload passes with the visible player: ~60 fps,
1440×900 standard quality, **104 draw calls / 102,213 triangles** in the short
headless Apple M1 sample. Repeated-entry resource bounds still pass. These are
laboratory observations, not sustained hardware performance or human comfort.

### Attribution and remaining gates

[Model notice](public/assets/player/LICENSE.txt), [runtime notices](public/licenses.txt),
[asset register](asset-manifest.json) and in-game credits retain Luall_Studio,
the source URL, CC BY 4.0 and runtime change disclosure (scale/ground/facing/rate/
material fill). The uploaded file's embedded attribution matches the selected
model; no authenticated download was bypassed or viewer geometry extracted.

The prior all-CC0/no-franchise-art description no longer applies to the player.
The creator's license is not underlying Pac-Man trademark/franchise clearance;
commercial/public use review is a separate gate. Human third-person camera comfort,
balance/scares/audio, native Safari/Firefox, physical devices and long sessions
remain unverified. No public release or deployment approval is claimed.

---

## Historical: v2 Phase 5 — engineering candidate, arrow movement and handoff

24 October 2026. **All engineering checkpoints are complete; public/human release
approval is not.** No deployment or changes to other applications. Dependency
versions/lockfile are unchanged; package scripts now expose reproducible checks.

### Final gate

- **164/164 units in twelve suites pass**, including ten controls and four save
  protection tests added for this checkpoint.
- **65/65 Chrome browser workflows pass** in the final full run (~4.5 minutes),
  without configured retries. Five new control and three recovery workflows.
- **Fresh isolated `npm ci`, units and production build pass**; npm reported
  zero vulnerabilities. The disposable copy is removed afterward, leaving the
  active preview/node_modules untouched. [Clean record](artifacts/testing/phase5/clean-install.json).
- Strict build passes with **no oversized-chunk advisory**. Supported Rolldown
  library chunking emits a largest JS file of 352,272 bytes, without raising
  limits. Full output is 3,061,289 bytes before transfer compression.
- [Release audit](artifacts/testing/phase5/release-check.json) checks 22 external
  local files, eight audio SHA-256 values, four referenced GLB textures, notices,
  chunk budgets and absence of private/source-archive paths/development namespace.
- Bounded, fixture-free **Chrome 155.0.8059.85 and Playwright WebKit 27.2
  production smoke workflows pass**. These are not full WebKit-suite or real
  Safari/device qualification. Firefox's cached availability probe could not
  launch; Firefox remains unqualified.

### Input and recovery evidence

All four arrow keys now mirror camera-relative WASD movement. Left/right strafe
instead of turning; J/L preserve keyboard turning and mouse/drag look stays.
[Controls units](tests/unit/controls-phase5.test.ts) verify alias deduplication,
opposition cancellation, diagonal normalization, custom remaps, sprint and
reserved-key migration. [Native controls checks](tests/browser/controls-phase5.spec.ts)
verify each direction moves without yaw, real keyboard fallback, blur/resume
clearing, slider isolation and retained progress after conflicting old remaps.

[Save protection units](tests/unit/recovery-phase5.test.ts) and
[recovery workflows](tests/browser/recovery-phase5.spec.ts) prove exact unreadable/
future-version raw bytes are copied before replacement, an earlier distinct
recovery snapshot is never overwritten, and normal v2 saves avoid unnecessary
backups. Native graphics loss/restoration preserves position, score and game time
while paused, then resumes drawing/input explicitly. Native mouse release shows
a short cooldown and Resume reacquires capture after it.

The asset audit initially found the development namespace only in a leftover
cleanup `delete` statement, not an exposed production API. That cleanup is now
also development-gated; the strict audit and fixture-free production checks pass.
Existing movement-driven campaign, audio, map, storage, graphics/performance and
DOM accessibility regressions all remain green. No enemy/score/maze balance was
silently retuned without human evidence.

### Smoke scope, visuals and limits

Production smoke uses only the real UI and keyboard (no game-state fixtures):
local loading, arrow collection, J/L input, pause/native audio suspension and
enlarged map, with no page errors, remote assets or production fixture API.
Inspected [Chrome](artifacts/testing/phase5/chrome-production.png),
[WebKit](artifacts/testing/phase5/webkit-production.png),
[arrow controls](artifacts/testing/phase5/arrow-movement.png) and
[graphics restored](artifacts/testing/phase5/context-restored.png) screenshots.

The full Chrome suite still includes explicit development setups for complex
state transitions. Scripted capture-free campaign unit routes are not human
survival/fairness tests. Short GPU samples and bounded renderer inventory are
not sustained performance or whole-heap leak proof.

[Release handoff](RELEASE.md) records controls, reproducible checks, recovery
behavior and remaining release gates. **Still required:** first-time human
training/chapter/blackout runs, natural scare pacing, audible headphone/speaker
quality and physical loudness, real Safari/Firefox, physical devices, long
sessions and manual assistive-technology review. Touch gameplay, interrupted-run
restore and online services remain unsupported. No deployment is authorized or
inferred from passing engineering checks.

---

## Historical: v2 Phase 4 — layered audio and contextual cosmetic scares

24 October 2026. **Phases 1–4 complete; Phase 5 final balance/release work remains.**
No deployment, backend, dependency changes or edits to other applications.
Selected original CC0 sample bytes were copied from the existing workspace
Kenney pack; that pack's source/license was inspected first.

### Final automated gate

- **150/150 unit tests in ten suites pass**, including 23 new sound/director tests.
- **57/57 Chrome workflows pass** in the final complete run (~4.9 minutes),
  including nine new audio/atmosphere workflows. No configured retries.
- Strict TypeScript/production build passes through the owned production test
  server. Existing >500 kB JS-chunk advisory remains; no code-splitting fix claimed.
- Prior gameplay, movement-driven campaign routes, save migration, map, input,
  context recovery, graphics/performance and DOM accessibility checks still pass.

### What is actually proven

[Unit evidence](tests/unit/audio-atmosphere-phase4.test.ts): 60-second first
eligibility, 65–85-second spacing after starts, strict scatter/distant-threat
and refuge/training/grace/overload/blackout gates, enough remaining relief time,
approach cancellation, pause freeze, run/capture reset, Reduced Scares immediate
cancellation, Reduced Motion visual exclusion, valid screen/tunnel contexts,
distant cosmetic placement, non-mutating gameplay state and single-fade envelope.
Sound policy tests cover floor treatments, chapter mixes, rotating/local source
captions, wall muffling, bounded heartbeat pressure, inactive hunter exclusion,
old-setting migration and unsupported-audio caption behavior.

[Native browser evidence](tests/browser/audio-phase4.spec.ts): no AudioContext
before Play; all eight real local OGG effects decode; five persistent original
synth/noise sources are created; the actual native output graph has a nonzero
signal. The [sample record](artifacts/testing/phase4/native-audio.json) captured
RMS ~0.00374 at the analyser tap, with eight decoded assets and no failures.
This number is digital signal evidence, **not perceived/calibrated loudness**.
Master mute reduces that graph signal below the test threshold. Independent
music/ambience/effect gains and heartbeat preference survive reload.

Pause stops transient voices and suspends the real native context; event and
game time freeze. Resume does not queue a burst. Reduced Scares cancels active
cosmetics/captions even while paused. Missing sample requests use genuine
synthesis fallback, and unavailable AudioContext still leaves playable visual
cues. A cue storm stays within the 14-transient voice ceiling; three retries
reuse one context and exactly five persistent loop sources. Production separately
checks genuine Play activation, eight same-origin effect responses and native
suspend on Escape, with no development fixture API.

All five event types render/caption in declared development setups. These
setups establish real renderer/audio/UI behavior, not ordinary human-play scare
frequency: strict safety gates can defer or skip events entirely. **Permanent
chase never gets optional scare events.** This preserves the planned no-chase
rule; real chapter pacing and frequency remain a Phase 5 human balance review.
No score, resource, collision, hunter or objective source was changed.

### Visual, resource and performance review

Inspected [screen event](artifacts/testing/phase4/event-screen.png),
[shadow event](artifacts/testing/phase4/event-silhouette.png) and
[audio/comfort settings](artifacts/testing/phase4/audio-comfort-settings.png).
Scare captions remain separate from objectives/map data; cosmetic shadows
are not enemies or minimap threats. One lamp/screen changes smoothly, never a
repeated strobe; reduced motion excludes these animated visual events.
The protected refuge is also excluded from optional scares.

The reused four-near-creature [render workload](artifacts/testing/phase3/performance.json)
still passes with the Phase 4 audio engine: ~60 fps, 1440×900 standard graphics,
108 draw calls / 42,953 triangles in the short headless Apple M1 sample.
Flat tunnel grates add the visible surface corresponding to metallic footsteps.
These are short laboratory observations, not sustained hardware/phone results.

### Source and listening boundaries

Eight selected Kenney Impact Sounds 1.0 OGG files total **62,864 bytes**.
Their original file bytes and copied original CC0 license are retained.
[Asset register](asset-manifest.json) records each filename/hash and runtime
normalization/pitch/filter treatment. [Distributed notices](public/licenses.txt)
and in-game credits now correctly identify recorded effects. Chapter music,
air/machinery, heartbeat, whisper-like air and wordless cries are original
synthesis, not downloaded music, recorded speech or a voice actor.

**Still manual:** listening quality, headphone/speaker mix, physical volume,
scare effectiveness/fairness, natural event frequency, native Safari/Firefox,
physical devices, long sessions and assistive technology. OGG fetch/decode
failure is handled, but that does not certify codecs on untested browsers.
The compressor, normalized buffers and gain caps reduce signal stacking; they
are not a universal acoustic-safety or loudness certification. No public release
or deployment readiness is inferred from these automated passes.

---

## Historical: v2 Phase 3 — environment, materials and four creature models

24 October 2026. **Phases 1–3 complete; Phases 4–5 remain pending.**
No deployment or changes to other applications. Dependencies/lockfile are unchanged.

### Final gate

- **127/127 unit tests in nine suites pass**, including 12 new environment tests.
- **48/48 Chrome browser workflows pass** in the final full run (3.5 minutes),
  including seven new environment checks and enhanced production asset checks.
- Strict TypeScript and the production Vite build pass through test-server
  startup. The existing >500 kB JS-chunk advisory remains; code splitting has
  not been claimed complete.
- Existing keyboard/input/map/save/campaign/recovery and DOM accessibility
  checks pass. No new claim of screen-reader-playable spatial navigation.
- The first full regression invocation reached the shell's 180-second budget
  after 42 passing cases. Its orphaned owned preview was cleaned up; the final
  complete run used a 300-second tool budget and passed all 48. No failed
  assertions were masked by retries. No unrelated server was stopped.

### What is verified

[Unit tests](tests/unit/environment-phase3.test.ts): original landmark planning
never mutates level data; eight distinct initial recess sites per chapter are
in actual wall cells adjacent to real corridors; geometry clearance contracts;
four distinct finite merged creature geometries with bounded mesh counts;
reduced-motion posing; returning-wisp/locked visibility; chapter look separation.

[Browser tests](tests/browser/environment-phase3.spec.ts): all nine local 1K PBR
images and four exact selected GLBs load; no remote runtime requests; eight
rendered landmark AABBs lie within the original wall cells; shadowed cookie and
standard postprocessing are active; all four models appear in the real corridor;
chapter-specific bays/light/material treatments render. A failed concrete-set
request uses procedural fallback and does not block Play. Low quality disables
postprocessing/cookie; reduced motion freezes effect time and removes fringing;
blackout renders and pause holds effect state.

Production checks exercise ordinary Play, movement and mouse capture without
any fixture API, verify selected local material/model responses, and fetch the
shipped ambientCG/Kenney license notices. Existing collision/AI/maze/scoring
sources and Phase 2 map model were not modified for the visual overhaul.

### Performance and fit evidence

[Latest Phase 3 workload](artifacts/testing/phase3/performance.json): headless
Chrome, Apple M1 / arm64, 1440×900, standard graphics, 360 frames (~6 seconds),
four authored near-camera creature models, flashlight shadows, PBR surfaces
and proximity fringing. Final run: **~60.0 fps**, p95 **~16.8 ms**, **107 draw
calls / 41,801 triangles**. Meets this checkpoint's >=55 fps / <150 calls gate.
The models are held stationary in a declared development fixture for a
repeatable rendering workload; this is not a full AI or human performance test.
The separate original moving-AI/radar/overload test and repeated-entry GPU
inventory bounds also pass.

Every bulky landmark is normalized using the actual loaded model bounds and
set behind a recessed wall opening, with its front at least 80 mm behind the
original wall plane. Scene AABBs, including signs, are checked inside the wall
cell. This establishes no new physical aisle blocker, not a manufactured fit
or permission for the player to enter the decorative bays.

The production output is approximately **2.98 MB uncompressed** including local
art. Selected PBR maps total ~1.79 MB; selected arcade files ~0.20 MB. GPU texture
memory is larger than file transfer bytes and is not claimed measured by these
numbers. Shared library ownership keeps textures/models across chapter rebuilds;
compositor/shadow/library resources have explicit disposal. Repeated renderer
inventory is bounded, but this is not a whole-JavaScript-heap leak proof.

### Inspected visual evidence and provenance

Inspected [arcade bay](artifacts/testing/phase3/arcade-landmark.png),
[Drainworks](artifacts/testing/phase3/chapter-2-landmark.png),
[Core](artifacts/testing/phase3/chapter-3-landmark.png),
[Stalker](artifacts/testing/phase3/creature-stalker.png),
[Mimic](artifacts/testing/phase3/creature-mimic.png),
[Puppet](artifacts/testing/phase3/creature-puppet.png),
[Weeper](artifacts/testing/phase3/creature-weeper.png),
[red blackout](artifacts/testing/phase3/blackout.png) and
[stress scene](artifacts/testing/phase3/stress-core.png).
Screen glare was reduced after inspection by using an unlit original screen
overlay and reducing flashlight intensity. This is deliberately stylized
low-poly horror; photorealism or human scare effectiveness is not claimed.

[Asset register](asset-manifest.json) records the official asset pages/downloads,
archive SHA-256 values, selected local files, licenses and modifications.
Official ambientCG CC0 terms were read; the original Kenney Mini Arcade 1.2
license is retained. Only selected color/NormalGL/roughness maps and four GLBs
plus their colormap ship. Palette saturation/brightness, material tinting and
JPEG recompression are disclosed. Original archives/source-page evidence stay
in ignored asset-inbox, outside production output. No franchise artwork or
recorded audio was added. [Distributed notices](public/licenses.txt) and the
in-game credits now identify the external CC0 work accurately.

### Remaining limits

Expanded recorded/layered audio and scare events are **Phase 4**, not silently
included here. Final release/balance work is Phase 5. Human fairness/scare and
sound listening tests, native Safari/Firefox, physical devices, sustained GPU
performance, long sessions and assistive technology remain manual. Browser
viewport emulation is not phone gameplay qualification. No deployment, online
services, touch edition, procedural Night Shift maps or seamless portal
rendering is claimed.

---

## Historical: v2 Phase 2 — minimap and HUD

24 October 2026. **Phases 1–2 complete; Phases 3–5 remain pending.**
No dependency changes, asset downloads, deployment or other application edits.

- **115/115 units in eight suites pass**, including 19 new map-model tests.
- **41/41 Chrome browser workflows pass** in the final full run without retries:
  six new development map workflows and one new production map workflow.
- Strict TypeScript/production build passes. The existing chunk-size advisory
  remains; no loading/code-splitting fix is claimed.
- New settings and enlarged-map surfaces have no detected A/AA accessibility
  violations; prior menu/settings/help/pause and production checks also pass.

### Evidence and fixes

[Map-model tests](tests/unit/map-phase2.test.ts) cover north/heading transforms,
all corners fitting at arbitrary rotation, true player-facing arrows, four
shape/letter identities, sight versus wall-blocked sound, radar, immutable
last-seen coordinates/expiry, unknown/locked hunters, returning wisps, timer
precedence, preference validation and non-mutation of gameplay state.

[Browser tests](tests/browser/map-phase2.spec.ts) check preference changes and
reloads, paused clock/score/position preservation, declared observation types,
actual keyboard turning, north-up enlarged maps, real Canvas pixel colors for
objectives/Lockup, and layout at maximum map scale on 1440×900, 1280×720,
768×1024, 390×844, 320×568 and 812×375. A layout check caught the enlargement
button below the clipped panel at maximum scale; height-aware sizing fixed it.

The [production workflow](tests/browser/production.spec.ts) sets Arcade and
heading-up via actual UI controls, renders the ring/four identities, turns,
pauses, and confirms the development fixture API is absent.

Inspected [production map](artifacts/testing/phase2/production-map.png),
[heading-up map](artifacts/testing/phase2/heading-arcade.png),
[enlarged observations](artifacts/testing/phase2/enlarged-observations.png), and
[short-landscape layout](artifacts/testing/phase2/max-map-812x375.png).
Short viewports hide secondary legend rows, not the maze or enlargement action.
Small-screen checks are Chromium emulation, not physical-device gameplay.

Confirmed mode has live sight/radar fixes, four-second recorded last-seen fixes,
and coarse cell-centred sound estimates with explicit ?/uncertainty notation.
Arcade mode declares always-live tracking. These are presentation policies;
no AI, collision, movement, scoring or wave-rule source was changed in Phase 2.
The existing four-hunter workload check passes (~60 fps in a short headless
sample); its scenario label describes the reused Phase 1 stress setup. This is
not a sustained-GPU or physical-phone performance claim.

### Still open

Realistic materials/props/creatures and layered audio are Phase 3–4 work. Human
fairness, scary/enjoyable playtests, sound listening, native Safari/Firefox,
physical hardware, long sessions and assistive-technology review remain manual.
The spatial game is not claimed screen-reader playable. Some spatial browser
checks use declared development fixtures; ordinary production play checks do not.

---

## Historical: v2 Phase 1 — rules core

24 October 2026. In-place upgrade under the accepted v2 plan. **Phase 1 is complete;
Phases 2–5 are not complete.** No deployment, asset downloads, dependency changes
or modifications to other applications.

### Fresh automated gate

- **96/96 units in seven suites pass.** Preserved collision, input-direction,
  fixed-timestep, pause, contact-order and save regressions; replaced tests tied
  to v1 AI or hard-coded grid coordinates with the new rule contracts.
- **34/34 Chrome browser workflows pass**, without configured retries in the
  final full run, including five production checks and six v2-specific checks.
- Strict TypeScript/production build passes through the browser suite's owned
  production-preview startup. The existing >500 kB JS-chunk advisory remains.
- Menu/settings/help/pause accessibility scans and production settings report
  no detected A/AA violations. This is not accessibility certification.
- No clean install or dependency audit was repeated for v2; v1's results below
  are historical. Dependencies and lockfile were not changed.

### New evidence

Unit tests cover maze connectivity, no normal dead ends, permission-correct
Lockup routes, four power corners, local wrap movement/contact sweeps, hunter
junction targeting/tie order/reversals, seeded frightened turns, releases,
returning wisps, tunnel speed, frenzy, permanent final chase, power chains,
relic thresholds/expiry, extra life, blackout and Night Shift carry-over.

[Movement-driven routes](tests/unit/traversal-v2.test.ts) visit every pickup and
exit in all three mazes using the actual simulation movement/collision, without
teleporting positions or setting pickup flags. They use **capture-free practice**
and scripted route selection, so they establish mechanical reachability, not
human fairness or enjoyment.

Browser checks exercise native timed waves/releases, keyboard travel through a
portal, player blocking at the rendered gate, last-mote blackout, relic/life HUD,
and campaign-to-Night-Shift unlock/continue/reload. Spatial and completion setups
are explicitly development fixtures. Production has no fixture interface.
A rapid chapter transition exposed missed UI/result processing when two runs
shared a terminal mode; run identity is now observed as well as mode. The
regression passes without adding sleeps to hide the defect.

### Visual and performance observations

Inspected [Lockup](artifacts/testing/v2-phase1-lockup.png),
[tunnel](artifacts/testing/v2-phase1-tunnel.png),
[blackout](artifacts/testing/v2-phase1-blackout.png), and
[creature corridor](artifacts/testing/horror-encounter.png) captures. Gate and
portal rules are visible; red blackout remains navigable. A straight-ahead
production-movement capture reaches a nearby wall; it is a collision check,
not a representative composition of the maze.

[Workload sample](artifacts/testing/performance.json): headless Chrome / Apple M1
ANGLE Metal, 1440 × 900, standard quality, four-hunter controlled Core setup,
150 frames: **~60.3 fps**, p95 **~16.8 ms**, snapshot **25 draw calls / 27,926
triangles**. Geometry/texture inventory is unchanged across four re-entries.
This short sample is not sustained device performance or whole-heap leak proof.

### Remaining work and limits

Phase 2's distinct hunter icons/map settings/wave presentation and Phase 3's
material/prop/creature overhaul remain pending. Phase 1 only adapts existing art
and synth audio to make the rules playable. No claim of realistic horror art,
new recorded audio, procedural Night Shift maps, or seamless portal aesthetics.
Manual fairness, sound quality, Safari/Firefox, physical hardware, long-session
and assistive-technology review remain open.

Save v2 migration retains valid v1 preferences/bindings/unlocks and preserves
the original v1 value. Old maze scores are not carried into v2 bests. Valid v1
Core completion can retain the campaign-complete unlock. Night Shift records
are separate; reset progress keeps settings.

---

## Historical v1 delivery record

The narrative and numbers below describe the initial release, not the current
v2 checkpoint. Some linked test-output/screenshot paths are reused by the latest
suite, so their current contents are v2 evidence.

24 October 2026. New independent app, constructed after the user accepted the research plan and returned to act mode. No existing app source/assets were reused. No deployment.

## Verified automated gate

- Node 24.13.0 / npm 11.6.2: clean `npm ci` passes.
- Strict TypeScript checking and production Vite build pass.
- **62/62 unit tests** in five suites pass.
- **28/28 Google Chrome browser workflows** pass, without configured retries: 23 development/workload checks and five production checks.
- `npm audit --omit=dev`: zero reported vulnerabilities. Clean installation also reported zero audit vulnerabilities at verification time.
- Four DOM surfaces (menu, settings, help, pause) have no detected WCAG 2/2.1/2.2 A/AA violations; a separate production-settings scan also passes. See [scan results](artifacts/testing/accessibility.json). This is not an accessibility certification or nonvisual gameplay guarantee.
- [Browser result record](artifacts/testing/browser-results.json).

## What the tests actually prove

### Unit evidence

Shared grid/world conversions, walkable connectivity and objective reachability for every chapter, adjacency-correct A*, wall-aware sight, corner/wall collision, normalized movement, fixed-step equivalence across 30/60/120 render schedules, NaN/large-delta rejection, expiring awareness/noise, overload/flee/banishment, safe recovery, stamina exhaustion hysteresis, pause freeze, one-time scoring, capture/respawn state, swept contact ordering, relay graph changes, valid saves and corrupt/disabled/unknown-version storage recovery.

All required motes and exits are reachable **before** opening optional relay shortcuts. Shortcut cells are shared by the renderer, collision, AI and map; a new run restores the original authored grid.

### Browser evidence

Native Play-to-pointer-lock on Chrome; actual keyboard motion that collects motes; radar input; correct left map placement; Escape/pause/resume; real browser tab blur with held-key clearing; settings/remapping/persistence; corrupt save and pointer-lock denial; native WebGL context loss plus explicit recovery screen; practice record taint; gated progress reset; low-quality drawing-buffer reduction; repeated retry inventories; chapter gate/next/ending transitions; training exclusions; enlarged map; original creature rendering; and menus at 1440×900, 768×1024, 390×844, 375×667, 320×568 and 812×375.

Production checks verify real movement, mouse capture, collection, pause, menu return, reduced-motion defaults/focus/persistence, unavailable-WebGL messaging, and native AudioContext activation only after Play. Production makes no external game-asset requests and exposes no development fixture interface.

**Fixture disclosure:** completion, capture, power, relay positioning and stress setups use a development-only deterministic fixture hook. They still exercise the real simulation/renderer and UI transition, but are not human playthroughs, ordinary full-route browser runs or proof of game balance. The hook is absent in the production bundle.

## Performance observations

[Latest workload sample](artifacts/testing/performance.json): headless Chrome, Apple M1 / ANGLE Metal, standard graphics, 1440×900. A 150-frame (~2.5-second) controlled Core scene with three enemies, radar, overload and a restored relay measured approximately **60 fps**, p95 frame time approximately **16.7 ms**. Snapshot workload: 14 draw calls and 22,270 triangles. Normal repeated entry snapshots used 44 draw calls. Renderer geometry/texture counts stayed bounded over four retries.

These are short laboratory observations. They do not prove real-phone performance, field FPS, long-session stability, or absence of all JavaScript heap leaks. The stress run is development mode and uses a capture-free fixture. The low graphics preset reduces drawing resolution and disables flashlight shadows.

The production JS/CSS together are approximately 0.85 MB uncompressed/minified and roughly 230 kB with gzip at the measured build. Textures are generated locally, not downloaded. **Known build warning:** the single JS bundle exceeds Vite's 500 kB chunk warning threshold; builds pass. Code splitting is a future loading optimization, not claimed solved.

## Inspected images

- [Production menu](artifacts/testing/production-menu.png)
- [Production gameplay](artifacts/testing/production-gameplay.png)
- [Original creature encounter](artifacts/testing/horror-encounter.png)
- [Overload](artifacts/testing/horror-overload.png)
- [Capture](artifacts/testing/horror-capture.png)
- [Settings](artifacts/testing/horror-settings.png)
- [Opened relay shortcut](artifacts/testing/relay-shortcut.png)
- [Core stress scene](artifacts/testing/stress-core.png)
- [390px menu](artifacts/testing/menu-390x844.png)
- [320px menu](artifacts/testing/menu-320x568.png)
- [Landscape menu](artifacts/testing/menu-812x375.png)

Visual inspection identified small-screen overlapping content and landscape cropping even when simple visibility checks passed. Layout was corrected; viewport-height and CTA-bounds assertions were added and rerun. Static images do not prove uninterrupted human play quality.

## Asset / rights evidence

[Asset register](asset-manifest.json) records original procedural geometry, materials, signs, entities and synthesized audio. No researched Kenney, Poly Haven or Freesound files were imported. Runtime library versions/licenses were checked against the installed package records and their notices are included in [distributed license text](public/licenses.txt), also linked in game credits. Working name has not been commercially cleared.

## Open manual release gates

- First-time player training, navigation, fairness, escape opportunities and actual chapter durations.
- Human evaluation of tension, originality, scare intensity and replay value.
- Audible mix, headphone/speaker sound quality, safe loudness and positional interpretation.
- Native Safari/Firefox pointer lock, audio, context recovery and full workflow.
- Physical reference-hardware/low-power GPU and longer-session performance.
- Manual keyboard, screen-reader menu and assistive-technology review. The spatial game is not claimed screen-reader playable.
- Touch gameplay is explicitly deferred; responsive menus do not imply touch controls.

Do not treat the game as fully release-verified until these gates are completed. No account/cloud sync, multiplayer, procedural endless mode, deployment, or in-flight save restoration is implemented or implied.
