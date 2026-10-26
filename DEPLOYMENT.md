# DEAD CIRCUIT — GitHub and Vercel deployment

The user explicitly requested GitHub push and Vercel hosting on 26 October 2026.

- **Live game:** https://dead-circuit-softtech10.vercel.app
- **Private GitHub repo:** https://github.com/Dheeraj-Baghel/dead-circuit
- **Production branch:** `main`, connected to Vercel's GitHub integration;
  subsequent pushes deploy automatically.
- **Vercel project:** `dead-circuit-softtech10`, existing `softtech10` Hobby scope
  (personal/non-commercial use and free-tier quotas apply).
- No backend, account, secrets, environment variables, paid upgrade or add-on.

## Build and packaging

[vercel.json](vercel.json) selects Vite, `npm ci`, `npm run build`, and `dist/`.
Node is pinned to 24.x in the Vercel project and package engines. The build performs
strict TypeScript checking and Vite bundling. Security headers include nosniff,
DENY framing, strict-origin referrer policy, and disabled camera/microphone/geolocation.
Vercel serves HTTPS with HSTS.

Git excludes dependencies, build output, local env/link credentials, raw asset
downloads (`asset-inbox/`) and the 118 MB of local test captures (`artifacts/`).
Those evidence folders are retained on disk, not deleted. Runtime assets and their
notices in `public/`, source, tests, manifests and docs are committed. Existing
screenshot links in the docs are therefore workspace-local evidence, not GitHub assets.

The duplicate root `pacman_animated.glb` is retained in Git for provenance but is
excluded from deployment; the exact runtime copy in `public/assets/player/` ships.
Commits use the authenticated GitHub account's noreply address.

## First live failure and repair

The first Git-triggered build was Ready, but the hosted production checks failed:
the animated player URL returned 404, causing the intentional missing-model screen.
An unanchored `pacman_animated.glb` rule in `.vercelignore` matched both the root
duplicate and the nested runtime copy. This was our packaging mistake, not a model
or renderer bug. The rule was anchored as `/pacman_animated.glb`, committed and
redeployed. The repaired build serves the 1,107,616-byte runtime GLB correctly.

The corrected application commit is `b16da6b`; deployment was observed reaching
Ready at `dead-circuit-softtech10-mdprioo0k-softtech10.vercel.app` before final docs.
No gameplay, asset bytes, animation, renderer or audio code changed for hosting.

## Verification

Fresh local gates:
- Isolated `npm ci`, **173/173 unit tests**, strict types and production build pass.
- Zero audit vulnerabilities in the clean install and actual Vercel Linux install.
- Existing release asset audit and bounded fixture-free native Chrome/Playwright
  WebKit production smoke pass locally. WebKit automation is not real Safari.

Anonymous hosted checks (no Vercel login or bypass token):
- **6/6 Chrome production workflows pass:** supplied-model game start, actual W
  movement and collection, pointer capture, pause/menu; reduced motion and persisted
  mute with focus trapping and a clean axe scan; explicit no-WebGL fallback;
  native audio activation after Play and suspension on pause; real low-resolution
  rendering with the minimap on the left; map settings/ring/hunter legend and J turning.
- **28 public assets are byte-exact**, including models, materials, audio and notices;
  **10 JS/CSS chunks** are byte-exact and contain no DEV fixture namespace.
- Security headers checked, and **7 private/unknown URLs return 404**, including
  `.env.local`, Vercel credentials, raw downloads and source/dependency URLs.
- Local hosted results/captures: [browser report](artifacts/testing/live/browser-results.json),
  [HTTP report](artifacts/testing/live/http-results.json),
  [gameplay screenshot](artifacts/testing/live/production-gameplay.png).

The earlier full 71 browser workflows use DEV-only fixtures and were **not rerun**
as part of this deployment. Hosted mode intentionally selects only production tests
and starts no local servers. There is no fixture API in the public build.

## Rechecking and updating

From this folder, run `npm run verify:clean` before pushing app changes. Then:

```sh
DC_DEPLOYMENT_URL=https://dead-circuit-softtech10.vercel.app npm run test:browser
DC_DEPLOYMENT_URL=https://dead-circuit-softtech10.vercel.app node tests/live-assets.mjs
```

The asset check needs a matching local production build (`npm run build`) to compare
bundle hashes. Commit and push `main` to deploy. Preferences/progress stay in each
browser and origin; localhost saves are not automatically transferred to the live site.

## Rights and remaining gates

The user-supplied Luall_Studio Pacman animated model is credited under CC BY 4.0
with author/source/licence/change notes in the published licences. Scenery/effects
are CC0; library MIT notices remain. The creator's model licence does **not** establish
underlying Pac-Man franchise/trademark or public-use clearance. Hosting is user-authorized,
not a claim of rights clearance or creator endorsement.

Human fairness/scare/sound approval, sustained performance, physical devices,
real Safari/Firefox and manual assistive-technology checks remain unverified.
No other workspace app or hosting project was changed.