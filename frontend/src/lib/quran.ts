export const TOTAL_PARTS = 480

/** Global part index (1..480) -> hizb/part, or null for 481 (Quran completed) and invalid values. */
export function indexToPosition(index: number): { hizb: number; part: number } | null {
  if (!Number.isInteger(index) || index < 1 || index > TOTAL_PARTS) return null
  return { hizb: Math.floor((index - 1) / 8) + 1, part: ((index - 1) % 8) + 1 }
}
