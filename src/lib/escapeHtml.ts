/**
 * Escape a string for interpolation into HTML.
 *
 * ECharts renders `tooltip.formatter` return values via innerHTML, so any
 * user-controlled name (budget, spending type, tag, currency) must be escaped
 * before it goes into a formatter string.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
