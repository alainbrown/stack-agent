export function replaceTokens(
  content: string,
  values: Record<string, string>,
): string {
  let result = content
  for (const [key, value] of Object.entries(values)) {
    result = result.replaceAll(`__${key}__`, value)
  }
  return result
}

export function findUnresolvedTokens(content: string): string[] {
  const matches = content.match(/__[A-Z][A-Z0-9_]*__/g)
  if (!matches) return []
  return [...new Set(matches)]
}
