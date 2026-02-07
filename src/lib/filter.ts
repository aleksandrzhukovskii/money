export function matchesFilter(name: string, filter: string): boolean {
  if (!filter.trim()) return true
  const terms = filter.split(/[|,]/).map(t => t.trim().toLowerCase()).filter(Boolean)
  const lower = name.toLowerCase()
  return terms.some(term => lower.includes(term))
}
