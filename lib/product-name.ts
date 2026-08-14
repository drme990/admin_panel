/**
 * Product name formatting utility.
 *
 * Product names can contain "design-only" text wrapped in `[[]]` markers.
 * Example: "حلوى للأطفال [[تجربة]]"
 *
 * In the admin panel and customer-facing apps (manasik, ghadaq),
 * only the `[[]]` markers are removed, keeping the inner text visible:
 * "حلوى للأطفال [[تجربة]]" → "حلوى للأطفال تجربة"
 *
 * The design app handles this separately — it strips the `[[]]` markers
 * AND the inner text entirely, since that text should never appear on
 * the rendered design output.
 */

/**
 * Remove `[[]]` markers but keep the inner text.
 *
 * "حلوى [[تجربة]] كبيرة" → "حلوى تجربة كبيرة"
 * "No markers here" → "No markers here"
 * "" → ""
 */
export function stripDesignMarkers(text: string | undefined | null): string {
  if (!text) return '';
  return text.replace(/\[\[([^\]]*)\]\]/g, '$1').trim();
}
