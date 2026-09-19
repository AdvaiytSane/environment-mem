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
const policies = new Set(['authentication', 'messages', 'uploads', 'downloads', 'purchases', 'payments', 'destructive']);
const stepFields = new Set(['id', 'seq', 'op', 'target', 'precondition', 'postcondition', 'policy_class', 'approval_required', 'evidence']);
function hasBindings(value, depth = 0) {
  if (depth > 16) return true;
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, child]) => ['value', 'literal', 'value_binding', 'compiled_for'].includes(key) || hasBindings(child, depth + 1));
}
function validSteps(steps) {
  const ids = new Set();
  let previous = -1;
  return steps.every(step => {
    if (!object(step) || Object.keys(step).some(key => !stepFields.has(key)) ||
        typeof step.id !== 'string' || !step.id || step.id.length > 160 || ids.has(step.id) ||
        !count(step.seq) || step.seq <= previous || typeof step.op !== 'string' ||
        !(step.target === null || object(step.target)) || !object(step.precondition) || !object(step.postcondition) ||
        !(step.policy_class === null || policies.has(step.policy_class)) || typeof step.approval_required !== 'boolean' ||
        !object(step.evidence) || ![step.evidence.runs, step.evidence.ok, step.evidence.fail].every(count) ||
        typeof step.evidence.score !== 'number' || !Number.isFinite(step.evidence.score) ||
        step.evidence.score < 0 || step.evidence.score > 1) return false;
    ids.add(step.id);
    previous = step.seq;
    return true;
  });
}

export function createAdapter(config = {}) {
  const origins = config.allowedOrigins;
  if (!Array.isArray(origins) || !origins.length || origins.some(origin => {
    try { return new URL(origin).origin !== origin || !/^https?:/.test(origin); } catch { return true; }
  })) fail('invalid_config', 'allowedOrigins must explicitly list origins');

  async function post(operation, request, { signal }) {
    if (config.offline === true) fail('offline', 'request retained locally; no HTTP request was made');
    if (!object(request)) fail('invalid_request');
    if (operation === 'recall') {
      if (request.mode != null && request.mode !== 'context') {
        fail('invalid_request', 'this add-on supports advisory context, not replay');
      }
      request = { ...request, mode: 'context' };
    }
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
    } else {
      if (!['complete', 'partial', 'no_match'].includes(result.decision)) {
        fail('invalid_response', 'missing resolve decision');
      }
      if (result.mode !== 'context') {
        fail('context_unsupported', 'server did not acknowledge advisory context mode');
      }
      if (result.program != null || (result.decision === 'no_match' && result.context != null)) {
        fail('invalid_response', 'unexpected executable program or unmatched context');
      }
      if (result.decision !== 'no_match' && (!object(result.context) ||
          result.context.kind !== 'workflow_reference' || result.context.executable !== false ||
          !Array.isArray(result.context.steps) || !result.context.steps.length || result.context.steps.length > 50)) {
        fail('invalid_response', 'missing bounded workflow reference');
      }
      if (result.context && (hasBindings(result.context) || !validSteps(result.context.steps))) {
        fail('invalid_response', 'invalid advisory step metadata');
      }
    }
    return result;
  }
  return {
    store: (request, context) => post('store', request, context),
    recall: (request, context) => post('recall', request, context),
  };
}
