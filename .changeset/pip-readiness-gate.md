---
'@scarlett-player/ui': minor
'@scarlett-player/native': patch
---

Picture-in-Picture readiness gate: the PiP button is disabled until media metadata is loaded (entering PiP earlier rejects with InvalidStateError), every PiP call is caught so a failure can never surface as an unhandled rejection, Safari's presentation-mode path gets the same gate, and the button swaps to the exit icon while in PiP. The native provider now tracks PiP events so the pip state stays accurate on that path. Keyboard play and fullscreen shortcuts no longer leak promise rejections, and the error overlay has specific copy for append, buffer-full, and invalid-playlist failures.
