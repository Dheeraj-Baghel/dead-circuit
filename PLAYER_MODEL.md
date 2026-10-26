# Animated third-person player — integrated

## Supplied asset and verification

The user's [original GLB](pacman_animated.glb) is retained untouched. The game
loads an identical [runtime copy](public/assets/player/pacman_animated.glb).

- Title: **Pacman animated**, by **Luall_Studio**.
- [Creator's source](https://sketchfab.com/3d-models/pacman-animated-e5e8dfb614da4fa69182f252fa4274a8).
- Embedded license: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
  Required attribution, source and runtime-change notes are in-game and in the
  [model notice](public/assets/player/LICENSE.txt).
- File: 1,107,616 bytes; SHA-256
  `980059310ad27eef7637077d20788f1d1fad41605ae1d23bf072fceb5817e9f2`.
- Two skinned meshes, 30,204 triangles; no external textures/decoder dependencies.
- **Eating** is a real 0.833333-second skeletal clip, with 41 key times on each
  of **Bone001_01.quaternion** and **Bone_00.quaternion**. Native runtime samples
  and live tests confirm changing jaw-bone poses, not a static replacement.

## In-game behavior

- **Third person is the default.** The visible supplied model follows the actual
  collision position and faces real movement. WASD/arrows retain camera-relative
  movement; mouse/J/L orbits the view independently. The minimap stays on the left.
- The initial idle pose faces the camera to show the mouth. After the first
  movement the body keeps its movement heading while idle, so orbiting the
  camera can reveal the face/profile. This does not invert movement controls.
- The authored clip runs at walking speed, faster for sprint, and slowly while
  idle. Reduced Motion disables decorative idle chewing but retains functional
  chewing while moving. Pause and tab loss freeze the actual animation clock.
- **Settings → Camera view → First person** restores the prior view and hides
  the body; the preference persists without resetting score/progress.
- The flashlight is anchored above the player rather than behind its body,
  preserving the existing fixed light inventory and forward navigation beam.

## Geometry and camera fit

The native Three.js runtime measured deformed vertices at all 41 authored key
positions. The full radial envelope is scaled to **255 mm**, inside the existing
**280 mm** player collision radius (game scale: one world unit = 1000 mm).
Grounding uses the minimum of the animated vertical envelope. No collider, enemy
speed, collection rule or source animation key was changed.

The measured envelope is reused only after the runtime SHA-256 matches this exact
upload. Other bytes or unavailable WebCrypto use full vertex measurement, not
blindly cached dimensions. This avoids expensive rescans on ordinary page loads.

The chase camera checks the shared maze collision authority, including gates,
with a 160 mm clearance radius plus sampling margin. It shortens the horizontal
boom near walls rather than crossing them. Its height is bounded below overhead
conduits. Tunnel transitions recalculate locally, without smoothing through the
whole maze. [Camera source](src/render/chaseCamera.ts) and
[unit checks](tests/unit/chase-camera.test.ts) record this contract.

## Evidence

- [Actual gameplay animation preview](artifacts/testing/third-person/animated-player.gif)
- [Spawn / visible mouth](artifacts/testing/third-person/spawn-mouth.png)
- [Visible body under arrow movement](artifacts/testing/third-person/moving-player.png)
- [Native source inspection](artifacts/testing/third-person/source-inspection.json)
- [Live jaw-pose and normalization record](artifacts/testing/third-person/runtime-player.json)
- [Browser checks](tests/browser/third-person.spec.ts)
- [Full verification](VERIFICATION.md)

**173 units and 71 Chrome workflows pass**, including the complete prior
regression suite and six new model/camera cases. Fresh isolated install/build,
asset hashing/notices and bounded Chrome/WebKit production smoke pass. Automated
sight/pose checks are not human comfort or balance approval.

## Rights and history

This specific GLB was selected by the user after research, then uploaded by the
user; no authenticated download was bypassed or viewer geometry ripped.
Runtime changes are uniform scale/grounding, whole-rig facing correction,
playback rate and a small material readability adjustment. The creator's file
bytes, skin and animation tracks are unchanged.

The creator's license is not underlying Pac-Man franchise/trademark clearance.
The user authorized [Vercel hosting](DEPLOYMENT.md) on 26 October 2026; no creator
endorsement or underlying franchise/public-use clearance is claimed.
The previous all-CC0/no-franchise-art description no longer applies
to the player; scenery/effect provenance remains separately tracked.

The Blender-only [MarbleMan Gobbler](https://opengameart.org/content/marbleman-gobbler-with-animation)
and explicitly static [Poly Pizza Pacman](https://poly.pizza/m/fCDWdpgE7L) were
research alternatives, not imported. Prior public-viewer pose captures remain
under player-research for sourcing history; the evidence above is the real game.
