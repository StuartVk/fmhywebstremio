/* global fetch, module, console */

/*
 * FMHY bridge provider for Nuvio.
 *
 * This provider adapts the existing Stremio-compatible FMHY backend response
 * into Nuvio's getStreams() format. The backend remains responsible for
 * discovery, extraction, protocol inspection, and signed HLS/DASH relaying.
 *
 * Nuvio runs this file locally in its plugin JavaScript runtime. Keep it
 * dependency-free and avoid Node.js APIs.
 */

var FMHY_BACKEND = 'https://fmhywebstremio-m0os.onrender.com';

function getStreams(tmdbId, mediaType, season, episode) {
  var type = mediaType === 'tv' || mediaType === 'series' ? 'series' : 'movie';
  var id = 'tmdb:' + String(tmdbId || '').trim();

  if (!tmdbId || !/^\d+$/.test(String(tmdbId))) {
    return Promise.resolve([]);
  }

  if (type === 'series') {
    var seasonNumber = Number(season);
    var episodeNumber = Number(episode);
    if (!Number.isInteger(seasonNumber) || seasonNumber < 1 ||
        !Number.isInteger(episodeNumber) || episodeNumber < 1) {
      return Promise.resolve([]);
    }
    id += ':' + seasonNumber + ':' + episodeNumber;
  }

  var endpoint = FMHY_BACKEND + '/stream/' + type + '/' + encodeURIComponent(id) + '.json';

  return fetch(endpoint, {
    method: 'GET',
    headers: { Accept: 'application/json' }
  })
    .then(function (response) {
      if (!response || !response.ok) {
        throw new Error('FMHY backend returned HTTP ' + (response ? response.status : 'unknown'));
      }
      return response.json();
    })
    .then(function (payload) {
      var input = payload && Array.isArray(payload.streams) ? payload.streams : [];
      var seen = {};
      var output = [];

      input.forEach(function (stream) {
        if (!stream || typeof stream.url !== 'string') return;
        if (!/^https?:\/\//i.test(stream.url)) return;
        if (seen[stream.url]) return;
        seen[stream.url] = true;

        var proxyHeaders = stream.behaviorHints &&
          stream.behaviorHints.proxyHeaders &&
          stream.behaviorHints.proxyHeaders.request;
        var headers = stream.headers || proxyHeaders;
        var label = [stream.name, stream.title].filter(function (value) {
          return typeof value === 'string' && value.trim();
        }).join(' | ');

        var result = {
          name: 'FMHY',
          title: label || 'Validated stream',
          url: stream.url
        };

        var quality = label.match(/\b(4K|2160p|1440p|1080p|720p|480p|360p)\b/i);
        if (quality) result.quality = quality[1];

        if (headers && typeof headers === 'object' && !Array.isArray(headers)) {
          result.headers = headers;
        }

        output.push(result);
      });

      return output;
    })
    .catch(function (error) {
      console.log('[FMHY] Stream lookup failed: ' + (error && error.message ? error.message : String(error)));
      return [];
    });
}

module.exports = { getStreams };
