# Local meeting background processing

MediaPipe Tasks Vision 0.10.14 and Selfie Segmenter Landscape (float16, version 1)
are distributed under Apache License 2.0. See LICENSE in this directory.

Upstream: https://github.com/google-ai-edge/mediapipe
Model: https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter_landscape/float16/1/selfie_segmenter_landscape.tflite
Model card: https://storage.googleapis.com/mediapipe-assets/Model%20Card%20MediaPipe%20Selfie%20Segmentation.pdf

The model is unmodified. WASM/loader files are unmodified copies from the pinned
@mediapipe/tasks-vision package. Run `node scripts/sync-meeting-background-assets.mjs --check`
to verify the three artifacts against their approved SHA-256 values.

Runtime loads only these self-hosted assets. No frames are uploaded to MediaPipe,
Google, LiveKit intelligence services, or another inference provider. The derived
blurred video is sent only through the user's existing meeting publication.
Segmentation is best-effort, not an anonymization or security guarantee.
