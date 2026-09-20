/** Metadata roles are enforced by the extended Memorable CLI, not by an adapter ranker. */
export type MetadataRole = 'filter' | 'semantic' | 'context' | 'private';
export type MetadataDefinition = Record<string, { use: MetadataRole | MetadataRole[] }>;
export interface MemoryStoreRequest { id: string; trace: unknown; metadata: Record<string, unknown> }
export interface MemoryRecallRequest { query: string; metadata: Record<string, unknown>; limit?: number }
export interface EmbeddingStatus { status: 'ready' | 'off' | 'unavailable' | 'not_needed'; model: string | null; dimensions: number }
export interface MemoryReceipt { id: string; procedureId: string; status: 'stored'; storage: 'local'; duplicate: boolean; schema: string; embedding: EmbeddingStatus }
export interface MemoryMatch { id: string; procedureId: string; score: number; similarity: number; matchReasons: string[]; procedure: { summary: string }; trace: unknown; metadata: Record<string, unknown>; context: Record<string, unknown> }
export interface MemoryRecallResult { matches: MemoryMatch[]; eligible: number; schema: string; embedding: EmbeddingStatus }
export interface MetadataClient {
  store(request: MemoryStoreRequest, call?: { signal?: AbortSignal }): Promise<MemoryReceipt>;
  recall(request: MemoryRecallRequest, call?: { signal?: AbortSignal }): Promise<MemoryRecallResult>;
}
export function metadataClient(
  config: { metadata: MetadataDefinition; embedding?: 'required' | 'optional' | 'off' },
  run: (operation: 'store' | 'recall', args: string[], input: string, call: { signal?: AbortSignal }) => Promise<{ stdout: string }>,
): MetadataClient {
  // Snapshot definitions so changing a caller object midway through a run
  // cannot change which fields are eligible for embedding or injection.
  const snapshot = JSON.parse(JSON.stringify(config));
  async function invoke(operation: 'store' | 'recall', request: unknown, call: { signal?: AbortSignal } = {}) {
    const input = JSON.stringify({ config: snapshot, request });
    if (Buffer.byteLength(input) > 2_000_000) throw new RangeError('memory request exceeds 2 MB');
    const out = await run(operation, ['memory', operation, '-'], input, call);
    let body: any;
    try { body = JSON.parse(out.stdout); } catch { throw new Error('Memorable CLI does not support the metadata JSON protocol; use the compatible CLI build'); }
    if (body.schema !== 'memorable.memory.v1' || body.operation !== operation || !body.result || body.error) throw new Error('incompatible Memorable metadata response');
    if (operation === 'store' && (body.result.status !== 'stored' || body.result.storage !== 'local')) throw new Error('missing local storage receipt');
    if (operation === 'recall' && !Array.isArray(body.result.matches)) throw new Error('missing recall matches');
    return body.result;
  }
  return { store: (request, call) => invoke('store', request, call), recall: (request, call) => invoke('recall', request, call) };
}
