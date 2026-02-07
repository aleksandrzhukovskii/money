/** Parse a numeric string, treating both comma and dot as decimal separator */
export function parseNumber(value: string): number {
  return parseFloat(value.replace(',', '.'))
}
