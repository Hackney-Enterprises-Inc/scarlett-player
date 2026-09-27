---
"@scarlett-player/hls": patch
---

Fix the HLS provider's `quality:change` payload: `quality` is now the level id (`level-<index>`, or `'auto'` when no level is known), the form core emits for a manual selection and the `qualities` state uses, instead of the display label (`'720p'`). Analytics matches the event against `qualities[].id`, so before this fix automatic hls.js level switches were counted in `qualityChanges` but never reached `bitrateHistory`, `avgBitrate` or `maxBitrate` and sent no `qualityChange` beacon. The label is still available on the `currentQuality` state. (SCAR-HLS-3)
