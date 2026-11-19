# FMHY for Nuvio

This folder contains a Nuvio provider bridge for the existing FMHY streaming backend.

## Install in Nuvio

Add this repository manifest under **Settings → Content & Discovery → Plugins** (not Addons):

`https://raw.githubusercontent.com/StuartVk/fmhywebstremio/main/nuvio/manifest.json`

Then refresh the repository and enable **FMHY Validated Streams**.

Nuvio plugin support is available only in compatible sideloaded/debug builds; store-distributed builds may omit plugins. See the [Nuvio plugin guide](https://nuvio-wiki.duckdns.org/integrations/plugins).

## Playback architecture

- Nuvio calls the provider's `getStreams(tmdbId, mediaType, season, episode)`.
- The provider requests the matching movie or episode from the deployed FMHY backend.
- The backend performs source discovery, extraction, protocol validation, and signed HLS/DASH relay where needed.
- The bridge returns only HTTP(S) stream URLs and forwards request headers required by a stream.

The bridge does not scrape FMHY directory links directly and does not turn directory entries into playable sources. Only streams returned by the backend's runtime-eligible sources are exposed.

## Playback verification

A provider returning a stream object is not the same as a successful playback session. Verify inside Nuvio using the Plugin Tester or a compatible debug build:

1. Test a movie and a TV episode with known TMDB IDs.
2. Confirm the provider returns at least one stream.
3. Start playback and test seeking, audio, and subtitles where available.
4. Repeat with a second source if the first stream fails.

The repository's CI can verify code and manifest structure, but it cannot prove playback on your device or network. The deployed backend must also be awake and healthy.

## Existing addon option

The backend is also a Stremio-compatible addon and can be installed directly in Nuvio's **Addons** section using its own manifest URL. Nuvio's documentation recommends addons for this integration style; the bridge is provided when you specifically want it listed as a plugin.
