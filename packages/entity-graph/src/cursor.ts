/**
 * Opaque cursor encoding for entity-graph pagination. Mirrors the cursor
 * format used by `@atc/mdt`. Cursors are deliberately opaque and decode
 * defensively (out-of-range values yield null).
 */

export interface CursorPayload {
  offset: number
}

const MAX_OFFSET = 10_000

export function encodeCursor(payload: CursorPayload): string {
  const json = JSON.stringify(payload)
  return Buffer.from(json, 'utf8').toString('base64url')
}

export function decodeCursor(cursor: string | null | undefined): CursorPayload | null {
  if (!cursor) return null
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf8')
    const parsed = JSON.parse(json) as unknown
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'offset' in parsed &&
      typeof (parsed as { offset: unknown }).offset === 'number' &&
      Number.isInteger((parsed as { offset: number }).offset) &&
      (parsed as { offset: number }).offset >= 0 &&
      (parsed as { offset: number }).offset <= MAX_OFFSET
    ) {
      return { offset: (parsed as { offset: number }).offset }
    }
    return null
  } catch {
    return null
  }
}

export function offsetFromCursor(cursor: string | null | undefined): number {
  return decodeCursor(cursor)?.offset ?? 0
}

export function nextCursor(currentOffset: number, returned: number, total: number): string | null {
  const next = currentOffset + returned
  if (next >= total) return null
  return encodeCursor({ offset: next })
}
