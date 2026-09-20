// One map for every place a harness is named, and the one rule that reads a
// harness off a tool name. The page receives HARNESS_NAME in `hello`.
export const HARNESS_NAME: Record<string, string> = { claude: 'Claude Code', devin: 'Devin CLI', codex: 'Codex', cursor: 'Cursor' };

export function harnessOf(toolNames: Iterable<string>): string {
  const names = new Set(toolNames);
  if (names.has('exec') || names.has('edit') || names.has('read')) return 'devin';
  if (names.has('apply_patch') || names.has('shell')) return 'codex';
  if (names.has('Bash') || names.has('Edit') || names.has('Read') || names.has('Grep')) return 'claude';
  return 'unknown';
}
