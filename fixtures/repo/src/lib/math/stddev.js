import { average } from './average.js';

export function stddev(numbers) {
  if (numbers.length === 0) return 0;
  const mean = average(numbers);
  const variance = average(numbers.map((n) => (n - mean) ** 2));
  return Math.sqrt(variance);
}
