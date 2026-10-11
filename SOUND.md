# Sound

Monarch uses Spotify Premium for music. The original Ocean's Eleven, Twelve and Thirteen albums are available in the Sound panel. Music is independent of hand playback and continues between application routes. An album cover, title, artist and Spotify attribution accompany playback. There is no YouTube video and no local music upload flow.

The default Spotify application is registered as Monarch with a public client identifier in `src/audio/spotify.ts`. To use your own Spotify developer application, enter its Client ID under Connection in the Sound panel and register the redirect URI below. Its approved redirect is `http://127.0.0.1:4317/spotify-callback`. The browser uses Authorization Code with PKCE. No client secret is used or embedded. The state and verifier expire after ten minutes; the callback removes the code from the address bar before loading the SDK. Access and refresh tokens stay in session storage, are never logged, and are cleared by Disconnect Spotify. A new browser session may require reconnecting.

Select Monarch to play in the browser. If protected audio is unavailable, open Spotify and select that device under Play through. The device list is explicit; the app does not silently transfer playback from another device. Remote playback status is polled only while the tab is visible. Requests are limited to Spotify's playback endpoints, and authentication refreshes are coalesced.

Account authorization and all three soundtrack presets were checked on 3 October 2026. The embedded browser returned playback errors during extended testing, so the final configuration uses an external Spotify player with controls in Monarch. The chosen device is saved across reloads. Playback state is reconciled every four seconds while visible and on returning to the tab, keeping the displayed track and position current.

Card slides, folds, chip impacts, page cuts, selection clicks and answer feedback are original procedural sounds in `src/audio/synthesis.ts`. They use cached buffers, small level variations and gain ramps. The effects start after a browser gesture, drop cues while suspended, cancel scheduled voices on mute/menu/background, and do not replay skipped actions. Music and effects levels are separate. There are no hover loops, loading loops or result jingles.

Reference documentation:
- https://developer.spotify.com/documentation/web-playback-sdk
- https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow
- https://developer.spotify.com/documentation/web-api/concepts/redirect_uri
- https://developer.spotify.com/policy

Verification covers malformed/expired OAuth state, Spotify URL parsing, concurrent token refresh, empty playback responses, API failures, sound headroom at 44.1/48 kHz, mute, queued-card cancellation and scrubbing. Full suite: 143 tests.
