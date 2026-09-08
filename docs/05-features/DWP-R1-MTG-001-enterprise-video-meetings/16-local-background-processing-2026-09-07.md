# U05/U12 local background blur — implementation and release boundaries

## User journey and ownership

The user selects background blur before joining, sees the processed preview, and
publishes that same kind of processed output in the meeting. This is a local
camera effect, not meeting intelligence, transcription, or remote video analysis.
There is no new database table or backend/tenant data contract. Preferences remain
browser-scoped under the existing device preference boundary.

`meeting-background-processor.ts` implements both native `start(MediaStreamTrack)`
and LiveKit `TrackProcessor<Video>` `init/restart/destroy`. Preview integration is
owned by the U05 agent; live publication integration is owned by root. The processor
does not mutate the shared shell, Gateway, provider contracts, or permissions.

## Cause and architecture decision

The earlier disabled blur option had neither a processor nor a locally hosted
model. A CSS/video-element-only filter would not affect actual publication.

The official [LiveKit processor source](https://github.com/livekit/track-processors-js)
provides SDK integration patterns, but its default background transformer can pass
through original frames during initialization. That is not the required failure
behavior. We use the SDK's processor contract and a dedicated fail-closed compositor.

The [MediaPipe web guide](https://developers.google.com/edge/mediapipe/solutions/vision/image_segmenter/web_js)
supports local model buffers and synchronous video segmentation. The pinned
[Selfie Segmenter model](https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter_landscape/float16/1/selfie_segmenter_landscape.tflite)
has one foreground-confidence channel, not multiclass IDs. A confidence threshold
of 0.85 preserves confidently segmented foreground and blurs uncertain pixels.

Native input → private video/segmentation → private background/foreground scratch
canvases → complete composed output canvas → derived MediaStreamTrack → preview
or LiveKit publication. Only the final canvas is captured. The output starts black;
`start/init/restart` succeed only after a valid first masked composition. A successful
SDK initialization therefore always exposes a derived `processedTrack`.

## Security and lifecycle contract

- No frames are fetched, uploaded, logged, persisted, analyzed by a service, or
  written into diagnostics. Scratch frames and masks exist in browser memory only.
- Model, WASM and loader URLs are fixed same-origin paths. All three are SHA-256
  checked before initialization. The central `fetchSameOriginStaticAsset` client
  omits credentials and rejects redirects, remote origins, query strings and fragments.
- Asset paths derive from the validated Vite `BASE_URL`: root deployment uses
  `/assets/meeting-background/...`; the independent Meeting product uses
  `/assets/dwp/meetings/assets/meeting-background/...`. Remote/protocol-relative,
  malformed, encoded, dot-segment and backslash base paths fail before network access.
- The JS bundle is lazy. Runtime assets are self-hosted under
  `public/assets/meeting-background/mediapipe-0.10.14/` (approximately 9.4 MiB total).
- Version 1.0.1 was rejected after a real browser observed an attempted Google
  telemetry request. It is not in package.json, yarn.lock or deployed assets.
  Version 0.10.14 has a pinned runtime bundle hash; actual network regression
  rejects any external request. Future version changes require a fresh review.
- Unsupported browser, missing/substituted assets, malformed masks, capture end,
  setup timeout and runtime processing failures stop derived output. There is no
  automatic raw fallback. Failure codes contain no browser exception text.
- Every start/restart/destroy increments or invalidates a generation. Late model
  creation is closed, old readiness is never delivered, pending start rejects
  `SUPERSEDED`, and the same instance can start again after destroy.
- `stopInputOnFailure: true` is mandatory for publication-owned capture because
  SDK capture setup does not stop a native input when processor init fails.
  Normal destroy retains caller ownership of the raw input; preview integration
  must stop its raw device session when processing fails or authority is revoked.
- Installing on an already-published track requires upstream pause before async
  processing, then resume only after success. Removing blur/returning to original
  requires explicit user selection. The root uses pre-publication SDK capture
  options, which await initialization before publish.

## License, supply chain and checksums

MediaPipe Tasks Vision 0.10.14 and the model are Apache-2.0; unmodified assets retain
LICENSE and NOTICE. The [official model card](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20MediaPipe%20Selfie%20Segmentation.pdf)
documents the model and its limitations.

| Artifact                              | SHA-256                                                          |
| ------------------------------------- | ---------------------------------------------------------------- |
| vision_bundle.mjs (installed package) | e77f281f9619150d937023c355bae170e9120e3b9e43f1e23a2a7bee07197669 |
| vision_wasm_nosimd_internal.js        | abe9b6fbeaf86fcb53a5edce3926c82ccb0619e18fed4d9d9ce561ee7f55e054 |
| vision_wasm_nosimd_internal.wasm      | 38b61feab2fd7934e05cbe9f68baa308978a5e3b7f85c1913bb8ae89b8ef8b97 |
| selfie-segmenter-landscape-v1.tflite  | 490e9ea734313e0de10fa0cd9e3c6133e36ea4db2b7a49bde9ef019f72796b8e |

`node scripts/sync-meeting-background-assets.mjs --check` verifies the package
version/runtime bundle and all deployed artifacts. The non-check command copies
only approved WASM/loader bytes from the installed package; it does not download
models or silently accept upgraded hashes. The new dependency preserves the
concurrent qrcode.react package/lock changes.

## Verification and explicit release limits

- Processor/assets/compositor unit tests exercise first-frame black gating,
  binary confidence output, integrity/unknown-asset rejection, device replacement,
  pending destroy, reconnect, timeout, input-ended and runtime failure cleanup.
- `e2e/video-meeting-background-processing.spec.ts` runs Chromium and mobile:
  explicit restrictive-CSP failure closure, corrupt model rejection, and real local model
  processing followed by a native WebRTC peer receiving the derived track. It
  asserts reduced high-frequency contrast and prohibits external requests.
- The initial implementation correctly failed closed because canonical CSP lacked
  WASM execution permission. The central owner subsequently added only
  `script-src 'wasm-unsafe-eval'`; no remote domain or broad `unsafe-eval` was added.
  The current positive browser test uses that actual canonical header without any
  test relaxation. A separate negative case removes the WASM token and confirms
  raw capture stops with no processed publication. Common CSP/Vite/server files
  are not edited by this owner.
- The actual independent production artifact also executes the pinned engine under
  the canonical artifact-server header. Its three namespaced asset responses were
  checked for HTTP 200, MIME and SHA-256; the compiled processor sent a distinct
  derived track over native local WebRTC with zero external requests. This closes
  the local artifact URL/CSP gate, not remote deployment or LiveKit infrastructure.
  WebKit without canvas filter support remains unsupported and must not silently
  send original video under a blur label.
- Segmentation runs locally on the main thread, capped at 20 fps and 1280×720
  output. Low-end-device latency, natural-person edge quality, broad browser
  support and actual deployed LiveKit infrastructure need integration testing.
  This is best-effort visual blur, not anonymization or a guarantee that every
  background detail is hidden. Do not advertise it as a privacy barrier.

### Recorded original owner checkpoint (superseded for CSP and asset namespace)

- Node24 `corepack yarn typecheck --incremental false`: PASS, zero errors.
- Three `meeting-background-*.test.ts` suites: **27/27 PASS**.
- Owner-scoped ESLint: **0 errors / 0 warnings**; Prettier and diff-check: PASS.
- Global source-size: PASS; approved background asset check: PASS.
- Desktop Chromium + mobile WebKit: **6/6 PASS**, with WebKit's unsupported
  branch verified explicitly, not counted as working blur.
- Repeatable E2E command: `E2E_BASE_URL=http://127.0.0.1:4481 E2E_REUSE_EXISTING_SERVER=true PLAYWRIGHT_OUTPUT_DIR=/tmp/meeting-background-runtime-0907-evidence corepack yarn playwright test e2e/video-meeting-background-processing.spec.ts --project=chromium --project=mobile --workers=1`.
- Each E2E persists a sanitized JSON evidence attachment: support/state, derived
  publication identity, synthetic contrast metric and external-request count.
  It does not persist camera images or device identifiers.

The central `eslint .` integration must exclude only the unmodified third-party
`public/assets/meeting-background/**` vendor assets; our own source/tests remain
linted. Vendor bytes are instead validated by the strict hash check. This owner
does not edit the common ESLint or CSP configuration.

### Independent product namespace and canonical-CSP checkpoint

- Background unit suites: **50/50 PASS**, including root/product BASE_URL,
  twenty malformed/remote/traversal base values, exact hash verification and
  processor lifecycle tests. The API-boundary checker passes through the central
  static-asset client without adding a feature-level network exception.
- `node scripts/build-product-app.mjs meetings`: production build and every
  product bundle budget PASS. The server command is
  `DWP_PRODUCT_ARTIFACT_PORT=4481 node scripts/serve-product-artifacts.mjs`.
- Actual namespaced responses: model 250,177 bytes (`application/octet-stream`),
  loader 209,735 bytes (`text/javascript`), WASM 9,294,247 bytes
  (`application/wasm`); all HTTP 200 and all approved hashes match.
- Compiled artifact `meeting-content-governance-GOqG2Bvy.js`, SHA-256
  `bc7bed5f4d1d7a5e2b46124b180ba34c3a04bd54fa91cbb5c5e2b2017f09dbc9`, was
  imported in Chromium under the actual artifact page's canonical CSP. Its
  inspected processor factory produced a distinct track and transmitted that
  track through a native peer connection. Remote decoded synthetic frame variance
  was 9,893.03 versus 16,256 for the unprocessed stripe input. External requests: 0.
  This diagnostic used synthetic canvas video; no camera frame was persisted.
- Evidence: `/tmp/meeting-background-baseurl-runtime-0907/product-artifact-proof.json`.
  Final canonical-positive / restrictive-negative / corrupted-model regression:
  **6/6 PASS**, Chromium and mobile WebKit, 19.6 seconds, without retries or
  baseline updates. WebKit tests verify unsupported-browser closure, not working blur.
  Browser regression command:
  `E2E_BASE_URL=http://127.0.0.1:4471 E2E_REUSE_EXISTING_SERVER=true PLAYWRIGHT_OUTPUT_DIR=/tmp/meeting-background-canonical-restrictive-0907 corepack yarn playwright test e2e/video-meeting-background-processing.spec.ts --project=chromium --project=mobile --workers=1 --update-snapshots=none`.
- Actual external recording, storage/KMS, STT/LLM, operational retention/deletion,
  production edge security headers and real remote LiveKit sessions remain separate
  operational NO-GO gates until their own evidence is supplied. Local blur does
  not imply those services are configured or working.
