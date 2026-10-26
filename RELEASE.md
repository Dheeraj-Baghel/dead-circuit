# DEAD CIRCUIT v2 — local release-candidate handoff

24 October 2026. **Engineering implementation/checkpoints complete; human release
approval is still pending. No publication or deployment has been performed.**

**Current addition:** the user's Luall_Studio **Pacman animated** GLB is now the
visible third-person player, with its real Eating bone animation. Third person
is default; Settings → Camera view can restore first person. Mouse/J/L orbits
the view independently of movement-facing body rotation. The left minimap is
unchanged. See [model notes](PLAYER_MODEL.md) and the
[actual gameplay preview](artifacts/testing/third-person/animated-player.gif).
The asset is CC BY 4.0, not CC0; required credit/change notes are included.
Underlying Pac-Man franchise/public-release clearance is not established.

## Play and controls

[Local game](http://127.0.0.1:4332/) — run `npm ci` then `npm run dev` from this
application folder. Start in Service Entry under Transmissions for capture-free
orientation. This browser-local single-player game needs no account or API key.

| Control | Behavior |
| --- | --- |
| WASD or ↑ / ↓ / ← / → | Camera-relative movement: forward, back, strafe left/right |
| Mouse, or J / L | Look / keyboard turn left/right |
| Shift | Sprint with stamina/noise |
| Q / F / E | Radar / flashlight / optional relay |
| Escape | Freeze the run and release mouse capture |

Holding W and Up does not double movement. Diagonal speed remains normalized.
Arrows remain available when letter bindings are remapped. J/L, arrows and Escape
are reserved; older conflicting remaps repair to defaults without resetting
progress. Settings/sliders retain normal arrow-key operation while paused.
Native mouse-capture release has a brief 1.1-second resume policy; the pause UI
explains the wait. Keyboard/drag fallback remains available if capture is denied.

## Engineering gate and evidence

| Check | Recorded result |
| --- | --- |
| Units | 173/173 across 13 suites |
| Chrome browser suite | 71/71, final complete run, no configured retries |
| Fresh install | Isolated `npm ci`, unit suite and strict production build pass; zero audit vulnerabilities reported during installation |
| Build | Library chunks split using supported Rolldown configuration; largest JS ~352 kB, no oversized-chunk warning |
| Asset audit | 23 declared external files, nine file hashes (including exact player GLB), four GLB texture references and shipped notices checked |
| Production output | ~4.19 MB before transfer compression; no source archives/private project files or development fixture namespace |
| Chrome production smoke | Ordinary arrow collection, J/L input, pause/audio suspend, enlarged map; no fixture API or remote assets |
| Playwright WebKit 27.2 smoke | Same bounded production smoke passed; not physical Safari certification |
| Firefox | Not qualified: cached browser availability probe could not launch |
| Recovery | Native graphics loss/restore preserves the paused run; native pointer recapture and save protection checks pass |

Evidence:
- [Full verification and limitations](VERIFICATION.md)
- [Browser results](artifacts/testing/browser-results.json)
- [Isolated clean-install record](artifacts/testing/phase5/clean-install.json)
- [Asset/chunk audit and production engine smoke](artifacts/testing/phase5/release-check.json)
- [Restored graphics screenshot](artifacts/testing/phase5/context-restored.png)
- [WebKit production screenshot](artifacts/testing/phase5/webkit-production.png)
- [Asset provenance and licenses](asset-manifest.json)

The three movement-driven campaign unit routes use capture-free practice and
scripted navigation, not human fairness tests. Complex browser state setups are
declared development fixtures; production smoke is fixture-free. Neither counts
as a human campaign playthrough or proof that the game is frightening/enjoyable.

## Reproduce the gate

1. `npm test`
2. `npm run test:browser` — requires Chrome; uses this game's loopback dev port
   4332 and an owned strict production-preview port 4333. Do not repurpose an
   unrelated application's listener to make a test pass.
3. `npm run verify:clean` — makes and deletes an isolated temporary copy, so the
   active game's node_modules and preview are not removed.
4. `npm run build && npm run test:release` — checks the current built output and
   uses its own temporary loopback port for Chrome/WebKit smoke. Inspect the
   per-engine report: optional engine failures are not converted into passes.

For ordinary production preview, build then `npm run preview` on 4332; stop only
this game's dev process first. These commands do not deploy. Never publish the
workspace root or another app's files, credentials or databases.

## Save and recovery behavior

The current browser store is `dead-circuit.save.v2`. V1 preferences, valid
bindings/unlocks migrate without deleting `dead-circuit.save.v1`; old maze scores
are not compared against the new layouts. Mid-run continuation and cloud sync
are not supported. Reset progress and reset settings are separate actions.

Unreadable/future-version current-store values are not silently destroyed by a
preference change: before a successful replacement, exact original bytes go to
`dead-circuit.save.recovery`. An earlier distinct recovery snapshot is never
overwritten; the app instead reports session-only changes. Preserve/export that
raw value using the browser's storage inspector before any manual repair or
return to a compatible newer version. A recovery copy is evidence, not an
automatic converter for unknown data versions. Clearing browser/site storage
can still erase local progress and recovery data.

## Human release gates — still pending

- First-time human playthroughs: training comprehension, all three chapters,
  readable routes, opportunities to escape, blackout fairness and chapter time.
- Natural scare pacing and tension. Cosmetic events deliberately require scatter
  relief and distant threats; unsafe windows are skipped and permanent chase
  never gets optional scares. Do not infer event frequency from forced fixtures.
- Listen on headphones and speakers: score/ambience balance, cue identity,
  occlusion/direction, heartbeat comfort and reasonable physical volume.
  Digital RMS/normalization/compression are not acoustic-safety certification.
- Real Safari and Firefox, physical desktop/phone hardware, long sessions,
  sustained GPU/memory, screen-reader/keyboard menu review and human comfort.
  Touch gameplay remains unsupported; responsive menus are not touch controls.
- Explicit hosting/publication authorization and production-origin validation.
  Working-title/name clearance has not been performed.

Do not label the game publicly release-approved until these gates have evidence.
