/** Generate comparison data by shifting data array back by `offset` positions */
export function generateComparisonData(
  data: Record<string, unknown>[],
  dataKeys: string[],
  offset?: number,
): Record<string, unknown>[] {
  const shift = offset ?? Math.floor(data.length / 2);
  return data.map((d, i) => {
    const prev = data[i - shift];
    const entry = { ...d };
    for (const key of dataKeys) {
      entry[`prev_${key}`] = prev ? Number(prev[key]) || 0 : null;
    }
    return entry;
  });
}
