export function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ offset }), 'utf8').toString('base64url')
}

export function decodeCursor(cursor: string | null | undefined): number {
  if (!cursor) return 0
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as { offset?: unknown }
    if (
      typeof parsed.offset === 'number' &&
      Number.isInteger(parsed.offset) &&
      parsed.offset >= 0 &&
      parsed.offset <= 10_000
    ) return parsed.offset
    return 0
  } catch { return 0 }
}

export function nextCursor(currentOffset: number, returned: number, total: number): string | null {
  const next = currentOffset + returned
  return next >= total ? null : encodeCursor(next)
}
