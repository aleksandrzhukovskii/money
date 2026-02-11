/**
 * Safely evaluate a basic arithmetic expression (+ - *).
 * Supports both . and , as decimal separators.
 * Returns NaN if the expression is invalid.
 *
 * Grammar (with precedence):
 *   expr   = term (('+' | '-') term)*
 *   term   = factor ('*' factor)*
 *   factor = '-'? number
 *   number = [0-9]+([.,][0-9]+)?
 */
export function evalExpression(input: string): number {
  const s = input.replace(/\s/g, '')
  let pos = 0

  function peek(): string {
    return s[pos] ?? ''
  }

  function consume(): string {
    return s[pos++]!
  }

  function parseNumber(): number {
    const start = pos
    // optional leading minus (only for unary at start or after operator — handled by factor)
    if (peek() === '-') consume()
    if (!/[0-9]/.test(peek())) return NaN
    while (/[0-9]/.test(peek())) consume()
    if (peek() === '.' || peek() === ',') {
      consume()
      if (!/[0-9]/.test(peek())) return NaN
      while (/[0-9]/.test(peek())) consume()
    }
    return parseFloat(s.slice(start, pos).replace(',', '.'))
  }

  function parseFactor(): number {
    if (peek() === '-') {
      consume()
      return -parseFactor()
    }
    return parseNumber()
  }

  function parseTerm(): number {
    let left = parseFactor()
    while (peek() === '*') {
      consume()
      left *= parseFactor()
    }
    return left
  }

  function parseExpr(): number {
    let left = parseTerm()
    while (peek() === '+' || peek() === '-') {
      const op = consume()
      const right = parseTerm()
      left = op === '+' ? left + right : left - right
    }
    return left
  }

  const result = parseExpr()
  // Ensure we consumed the entire input
  if (pos !== s.length) return NaN
  return result
}

/** Returns true if the string contains an arithmetic operator, meaning it's an expression (not a plain number) */
export function isExpression(input: string): boolean {
  const s = input.replace(/\s/g, '')
  // Must contain at least one operator (+, -, *) that isn't a leading minus
  // Remove leading minus, then check for operators
  const withoutLeadingMinus = s.replace(/^-/, '')
  return /[+\-*]/.test(withoutLeadingMinus)
}
