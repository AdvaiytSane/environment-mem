import { createMemorable, type StoreRequest } from '../src/sdk/index.ts';

// Connection only. Place these calls in your own task-start/task-end hooks.
// Run memorable login and memorable enable once before sending real work.
const memory = createMemorable({ cwd: process.cwd() });

export async function beforeTask(task: string): Promise<string> {
  const result = await memory.recall({ query: task });
  // This is the CLI's candidate listing/plan. It is not an original trace.
  // Call recall({ procedureId: aSelectedSlug }) to read a listed procedure.
  return result.stdout;
}

export async function afterTask(trace: StoreRequest) {
  // The caller joins calls/results and decides when a task actually ends.
  // Omit result when it was not observed. Never synthesize ok:true.
  return memory.store(trace);
}
