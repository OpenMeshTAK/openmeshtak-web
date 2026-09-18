/**
 * Meshtastic position precision keeps the top N bits of each coordinate. Each step halves the
 * area, starting at roughly 23.3 km for 10 bits; 32 bits send the exact position and 0 none.
 */
const TEN_BIT_METRES = 23_300;

function approximateArea(bits: number): string {
  const metres = TEN_BIT_METRES / 2 ** (bits - 10);
  return metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${String(Math.round(metres))} m`;
}

export const positionPrecisionOptions: Array<{ value: number; title: string }> = [
  { value: 0, title: "Do not share positions" },
  ...Array.from({ length: 10 }, (_, index) => {
    const bits = 10 + index;
    return { value: bits, title: `Approximate, about ${approximateArea(bits)}` };
  }),
  { value: 32, title: "Exact position" },
];

export function positionPrecisionLabel(value: number): string {
  return positionPrecisionOptions.find((option) => option.value === value)?.title ?? `${String(value)} bits`;
}
