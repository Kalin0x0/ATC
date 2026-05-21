import { monotonicFactory } from 'ulidx'

const monotonic = monotonicFactory()

export function generateId(): string {
  return monotonic()
}
