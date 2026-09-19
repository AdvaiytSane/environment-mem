// Optional browser transport. The main CLI knows only createAdapter/store/recall.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

function fail(code, detail = '') {
  const error = new Error(detail ? `${code}: ${detail}` : code);
  error.code = code;
  throw error;
}
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const count = value => Number.isSafeInteger(value) && value >= 0;

export function createAdapter(config = {}) {
  const origins = config.allowedOrigins;
  if (!Array.isArray(origins) || !origins.length || origins.some(origin => {
    try { return new URL(origin).origin !== origin || !/^https?:/.test(origin); } catch { return true; }
  })) fail('invalid_config', 'allowedOrigins must explicitly list origins');

  async function post(operation, request, { signal }) {
    if (config.offline === true) fail('offline', 'request retained locally; no HTTP request was made');
    if (!object(request)) fail('invalid_request');
    const origin = operation === 'store' ? request.run?.origin : request.origin;
    if (!origins.includes(origin)) fail('origin_not_allowed');
    const observedOrigins = operation === 'store'
      ? (Array.isArray(request.events) ? request.events : []).flatMap(event =>
        [event?.origin, event?.before?.origin, event?.after?.origin, event?.frame_origin])
      : [request.state?.origin, ...(Array.isArray(request.recent_states) ? request.recent_states.map(state => state?.origin) : [])];
    if (observedOrigins.some(value => value != null && !origins.includes(value))) fail('origin_not_allowed');
    if (operation === 'store' && (!Array.isArray(request.events) || request.events.length > 1000)) {
      fail('invalid_request', 'send at most 1000 events per batch');
    }
    let file = {};
    try { file = JSON.parse(readFileSync(join(process.env.MEMORABLE_HOME || homedir(), '.memorable', 'config.json'), 'utf8')); }
    catch { /* A fully environment-configured client does not need this file. */ }
    const apiKey = process.env.MEMORABLE_API_KEY || file.api_key;
    const endpoint = config.apiUrl || process.env.MEMORABLE_API_URL || file.api_url;
    if (typeof apiKey !== 'string' || !apiKey || typeof endpoint !== 'string') fail('credentials_missing');
    let base;
    try { base = new URL(endpoint); } catch { fail('invalid_endpoint'); }
    if (base.username || base.password || base.search || base.hash ||
        (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['127.0.0.1', '[::1]', 'localhost'].includes(base.hostname)))) {
      fail('invalid_endpoint', 'HTTPS is required except for explicit loopback testing');
    }
    const url = new URL(`/v1/browser/${operation === 'store' ? 'ingest' : 'resolve'}`, base);
    let response;
    try {
      response = await fetch(url, {
        method: 'POST', redirect: 'error', signal,
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json',
          'x-memorable-client': 'headstart-browser-use/0.1.0' },
        body: JSON.stringify(request),
      });
    } catch { fail(signal.aborted ? 'request_aborted' : 'network_error'); }
    let size = 0;
    const parts = [];
    try {
      for await (const part of response.body ?? []) {
        size += part.length;
        if (size > 1_900_000) fail('response_too_large');
        parts.push(Buffer.from(part));
      }
    } catch (error) {
      if (error.code === 'response_too_large') throw error;
      fail(signal.aborted ? 'request_aborted' : 'network_error');
    }
    let result;
    try { result = JSON.parse(Buffer.concat(parts).toString('utf8')); } catch { fail('invalid_response', `HTTP ${response.status}`); }
    if (!response.ok) {
      const code = typeof result?.error === 'string' && /^[a-z_]{1,80}$/.test(result.error) ? result.error : 'service_error';
      const scope = typeof result?.required_scope === 'string' && /^[a-z_:]{1,80}$/.test(result.required_scope)
        ? `; requires ${result.required_scope}` : '';
      fail(code, `HTTP ${response.status}${scope}`);
    }
    if (!object(result)) fail('invalid_response');
    if (operation === 'store') {
      if (![result.accepted, result.duplicates, result.rejected].every(count)) fail('invalid_receipt');
      if (result.rejected !== 0 || result.run_state === 'truncated' ||
          result.accepted + result.duplicates !== request.events.length ||
          (request.final === true && result.run_state !== 'final')) {
        // Keep the outbox. A finalized partial run needs inspection, not blind retry.
        fail('partial_ingest', 'server did not acknowledge the complete submitted batch');
      }
    } else if (!['complete', 'partial', 'no_match'].includes(result.decision)) {
      fail('invalid_response', 'missing resolve decision');
    }
    return result;
  }
  return {
    store: (request, context) => post('store', request, context),
    recall: (request, context) => post('recall', request, context),
  };
}
