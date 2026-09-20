export type Run = {
  task: string; shape: string; arm: string; repeat: number; runner: string; model: string;
  input_tokens: number; cache_read: number; output_tokens: number; context_tokens: number;
  turns: number; tool_calls: number; discovery_calls: number; duration_s: number;
  pass: boolean; injected_chars: number; session_id: string;
};
export type Recording = { recordedAt: string; source: string; sourceCommit: string; backend: string; runs: Run[] };
export type BrowserRecording = {
  complete: boolean; storage: string;
  runs: {id: string; model_steps: number; captured_actions: number; agent_actions: string[];
    observation: {url: string; quotes: number}; independently_verified: boolean;
    recall_ids: string[]; context_bytes: number; reference_in_actual_model_messages: boolean;
    receipt: {procedureId: string; status: string; storage: string; embedding: {model: string; dimensions: number}};
  }[];
  hard_filter_checks: Record<string, {matches: number; eligible: number; embedding: string}>;
};
export type Connection = {
  schema: string; repo: {name: string}; target: string | null;
  frameworks: {id: string; label: string}[];
  seams: {kind: string; file?: string; line?: number; status: string; detail: string}[];
  metadata: Record<string, {use: string | string[]}>;
  status: Record<string, boolean | null>;
  limitations: string[]; nextSteps: string[]; handoff: string;
};
export const sourceRoot = 'https://github.com/AdvaiytSane/environment-mem';
export const setupPrompt = (target: string, repo: string) => `Connect ${target === 'coding-agent' ? 'my coding assistant working in' : 'the agent application in'} ${repo.trim() || 'this repository'} to Memorable.

Use the Memorable Connect skill and the existing store()/recall() SDK from environment-mem (main). Start with the installed CLI's connect inspection. Check its supported protocol and the companion CLI version before editing.

Identify capture, completed tool results, task completion, and context injection in the actual code. Generate a small reviewable adapter and metadata definition, preserving existing callbacks and hooks. Use filter fields for project and compatibility; semantic fields for task/procedure; context for verification. Keep secrets out of traces and embeddings.

Run a real task, read its storage receipt, then start a fresh task and observe recalled context in the model input. Include failed and unknown outcomes. Report changed files, supported versions, capture omissions, storage location, retrieved IDs and actual verification. Do not label package installation or an example trace as a verified integration.`;

const short = (v: unknown, max = 1500) => typeof v === 'string' ? v.slice(0, max) : '';
export function parseConnection(raw: string): Connection {
  if (raw.length > 1_000_000) throw new Error('Choose a connection report smaller than 1 MB.');
  const v = JSON.parse(raw);
  if (!v || v.schema !== 'memorable.connect.v1' || !v.repo || !Array.isArray(v.seams)) {
    throw new Error('This is not a Memorable Connect report. Export one with connect --json.');
  }
  // Deliberately project display-only fields. Repo paths, source contents, credentials,
  // and unknown keys are never retained or uploaded by the inspector.
  const status: Record<string, boolean | null> = {};
  for (const k of ['installed','captured','stored','retrieved','contextDelivered']) status[k] = v.status?.[k] === true ? true : null;
  const metadata: Connection['metadata'] = {};
  for (const [key, field] of Object.entries(v.metadata ?? {}).slice(0, 50)) {
    const use = (field as {use?: unknown})?.use;
    const values = Array.isArray(use) ? use : [use];
    const roles = values.filter((x): x is string => ['filter','semantic','context','private'].includes(x as string));
    if (roles.length) metadata[short(key, 80)] = {use: roles};
  }
  return {schema: v.schema, repo: {name: short(v.repo.name, 120)}, target: short(v.target, 40) || null,
    frameworks: (Array.isArray(v.frameworks) ? v.frameworks : []).slice(0, 12).map((x: {id: unknown; label: unknown}) => ({id: short(x.id, 80), label: short(x.label, 120)})),
    seams: v.seams.slice(0, 30).map((s: Record<string, unknown>) => ({kind: short(s.kind, 40), file: short(s.file, 240),
      line: typeof s.line === 'number' && Number.isSafeInteger(s.line) ? s.line : undefined, status: short(s.status, 80), detail: short(s.detail)})),
    metadata, status, limitations: (Array.isArray(v.limitations) ? v.limitations : []).slice(0, 12).map((s: unknown) => short(s)),
    nextSteps: (Array.isArray(v.nextSteps) ? v.nextSteps : []).slice(0, 12).map((s: unknown) => short(s)), handoff: short(v.handoff, 12000)};
}

export function comparison(recording: Recording, selection: string) {
  const selected = recording.runs.filter(r => selection === 'all' || r.task === selection);
  const pairs = selected.filter(r => r.arm === 'cold').flatMap(cold => {
    const warm = selected.find(r => r.arm === 'full' && r.task === cold.task && r.repeat === cold.repeat);
    return warm ? [{cold, warm}] : [];
  });
  const mean = (side: 'cold' | 'warm', key: keyof Run) => pairs.length ? pairs.reduce((sum,p) => sum + Number(p[side][key]),0)/pairs.length : 0;
  const delta = (key: keyof Run) => mean('cold', key) ? (mean('cold',key)-mean('warm',key))/mean('cold',key)*100 : null;
  const passed = (side: 'cold'|'warm') => pairs.filter(p => p[side].pass).length;
  const docs = selected.filter(r=>r.arm==='doc');
  const docMean=(key:keyof Run)=>docs.length?docs.reduce((sum,r)=>sum+Number(r[key]),0)/docs.length:0;
  return {pairs, mean, delta, passed,docMean};
}
