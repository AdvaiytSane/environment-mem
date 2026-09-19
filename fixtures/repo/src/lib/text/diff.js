export function lineDiff(a, b) {
  const linesA = a.split('\n');
  const linesB = b.split('\n');
  const added = linesB.filter((line) => !linesA.includes(line));
  const removed = linesA.filter((line) => !linesB.includes(line));
  return { added, removed };
}
