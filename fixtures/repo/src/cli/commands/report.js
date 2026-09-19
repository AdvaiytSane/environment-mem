import { REPORTS } from './report/index.js';

export function run(args) {
  const [name, ...rest] = args._;
  const report = REPORTS[name];
  if (!report) {
    console.error('Unknown report: ' + (name ?? '(none)'));
    console.error('Available reports: ' + Object.keys(REPORTS).join(', '));
    process.exitCode = 1;
    return;
  }
  report.run({ ...args, _: rest });
}
