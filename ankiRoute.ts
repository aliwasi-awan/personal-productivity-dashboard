import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

const loopback = (address = '') => address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';

async function dueCount(deck1: string, deck2: string): Promise<number> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const counts = await Promise.all([deck1, deck2].map(async deck => {
      const response = await fetch('http://127.0.0.1:8765', {
        method: 'POST',
        redirect: 'error',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'findCards', version: 6, params: { query: `deck:"${deck}" -deck:"${deck}::*" is:due` } }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`AnkiConnect returned HTTP ${response.status}.`);
      const payload: unknown = await response.json();
      if (!payload || typeof payload !== 'object' || !('error' in payload) || !('result' in payload)) throw new Error('AnkiConnect returned an invalid response.');
      const result = payload as { error: unknown; result: unknown };
      if (result.error !== null || !Array.isArray(result.result) || result.result.some(id => !Number.isSafeInteger(id))) throw new Error('AnkiConnect could not return a valid due-card list.');
      return result.result.length;
    }));
    return counts.reduce((sum, count) => sum + count, 0);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('Anki Desktop did not respond. Open Anki with AnkiConnect enabled, then refresh again.');
    if (error instanceof TypeError) throw new Error('Cannot reach Anki Desktop. Open Anki with AnkiConnect enabled and allow local connections.');
    throw error;
  } finally { clearTimeout(timeout); }
}

function write(res: ServerResponse, status: number, body: object) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function handle(req: IncomingMessage, res: ServerResponse, next: (error?: Error) => void, decks: [string, string]) {
  if (req.url !== '/api/anki/due-count') return next();
  if (!loopback(req.socket.remoteAddress || '')) return write(res, 403, { error: 'Anki refresh is available only from this computer.' });
  if (req.method !== 'POST') return write(res, 405, { error: 'Use POST to refresh the local Anki count.' });
  const host = req.headers.host || '';
  if (!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host)) return write(res, 403, { error: 'Anki refresh is available only from this computer.' });
  const origin = req.headers.origin;
  if (origin && origin !== `http://${host}`) return write(res, 403, { error: 'Anki refresh accepts requests only from the local dashboard.' });
  let body = '';
  req.on('data', chunk => { body += String(chunk); if (body.length > 1000) { write(res, 413, { error: 'Request is too large.' }); req.destroy(); } });
  req.on('end', () => {
    if (res.writableEnded) return;
    if (body && body !== '{}') return write(res, 400, { error: 'This route accepts an empty request only.' });
    if (!decks.every(deck => /^[\p{L}\p{N} .-]{1,100}$/u.test(deck)) || decks[0] === decks[1]) return write(res, 503, { error: 'Set two distinct local Anki deck names in ANKI_REVIEW_DECK_1 and ANKI_REVIEW_DECK_2.' });
    void dueCount(decks[0], decks[1]).then(count => write(res, 200, { count })).catch(error => write(res, 502, { error: error instanceof Error ? error.message : 'Anki refresh failed.' }));
  });
}

export function ankiRoute(decks: [string, string]): Plugin {
  return {
    name: 'local-anki-due-count',
    configureServer(server) { server.middlewares.use((req, res, next) => handle(req, res, next, decks)); },
    configurePreviewServer(server) { server.middlewares.use((req, res, next) => handle(req, res, next, decks)); },
  };
}
