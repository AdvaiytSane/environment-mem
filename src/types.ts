export type Cls = 'read' | 'search' | 'write' | 'execute' | 'other';

export interface TraceEvent {
  ts: number;
  event: 'prompt' | 'tool' | 'stop' | 'start' | 'recall';
  /** recall: the hosted procedures handed on this prompt, for recalled_from at extract time. */
  ids?: string[];
  session_id: string;
  cwd: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  ok?: boolean;
  response_head?: string;
  prompt?: string;
}

export interface Step {
  seq: number;
  cls: Cls;
  action: string;
  command?: string;
  target?: string;
  repeat?: number;
}

export interface Procedure {
  id: string;
  session_id: string;
  task_id?: string;
  repo: string;
  harness?: string;
  created_at: string;
  title: string;
  prompt: string;
  steps: Step[];
  preconditions: string[];
  postconditions: string[];
  files_written: string[];
  files_read: string[];
  commands: string[];
  discovery_calls: number;
  total_calls: number;
  search_text: string;
}

export interface Recalled {
  procedure: Procedure;
  score: number;
}
