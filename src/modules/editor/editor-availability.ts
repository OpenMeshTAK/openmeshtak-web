/** Marker choices hidden at the owner's request: ATAK creates standalone waypoints as spot markers,
 * and Joker is pending ATAK/iTAK acceptance. Converters and imported data stay intact; this only
 * gates editor choices.
 */
export function editorCotTypeAvailable(cotType: string | null): boolean {
  return cotType === null || (!["b-m-p-w", "b-m-p-c"].includes(cotType) && !cotType.startsWith("a-j-"));
}
