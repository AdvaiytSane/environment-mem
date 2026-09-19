import { monthRange } from '../../../lib/dates.js';

export function run(args) {
  const [year, month] = args._;
  const dates = monthRange(Number(year), Number(month));
  console.log(dates.length);
  for (const date of dates) {
    console.log(date);
  }
}
