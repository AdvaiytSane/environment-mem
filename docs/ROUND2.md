# Round 2 changes (apply after round 1 finishes; hooks run src/ live)

1. trace.ts: add 'Skill' to SKIP.
2. trace.ts: shell reclassification. In toSteps, when cls is execute:
   - `cat|head|tail|less|sed -n` with file args: cls read, target = first file arg (relative).
   - `grep|rg|find|ls|tree|wc`: cls search, target = pattern or dir.
   Keep the command string on the step so "run:" still shows it.
3. skills.ts: description = "Use when the task looks like: <title>. Touches <files_written>. Verify with <postconditions[0]>."
4. eval: rerun endpoint-2 in all arms with the fixed prompt (delete its rows, workdirs and store entries first).
5. report: add "recall hit rate" (full-arm runs where a procedure was injected) from headstart.log.

# Round 3 (after round 2 finishes; critic-2 findings)

1. extract.ts tokenize: strip trailing `.,:;` from tokens so the shared prompt suffix ("repository.", "stop.", "questions.") hits the stopword list. Confirmed live: every task shared 3 junk tokens.
2. Pass rate: endpoint-2 fixed in round 2; if it still fails everywhere, drop it from the pass metric or fix the hidden test.
3. Report: done. Uncached vs cache-read rows, 95% intervals on the fleet rows, cost is the paid number.
4. Devin runner: rerun only when quota is back; round 1 Devin full arm is n=12 skewed to flag-shape tasks, not for a slide.
5. Repeats: 3 per cell on cold/doc/full if time allows; n=18 per arm gives ± about the size of the effect.
