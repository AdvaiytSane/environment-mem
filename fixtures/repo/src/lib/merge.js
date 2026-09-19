export function mergeDeep(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const sourceValue = source[key];
    const targetValue = result[key];
    const bothObjects =
      sourceValue &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue);
    result[key] = bothObjects ? mergeDeep(targetValue, sourceValue) : sourceValue;
  }
  return result;
}
