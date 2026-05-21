type SemVer = [number, number, number]

function parse(v: string): SemVer {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(v.trim())
  if (!m) throw new Error(`Invalid semver: '${v}'`)
  return [parseInt(m[1]!, 10), parseInt(m[2]!, 10), parseInt(m[3]!, 10)]
}

function compare(a: SemVer, b: SemVer): number {
  for (let i = 0; i < 3; i++) {
    if (a[i]! > b[i]!) return 1
    if (a[i]! < b[i]!) return -1
  }
  return 0
}

export function isValidSemVer(v: string): boolean {
  try { parse(v); return true } catch { return false }
}

export function satisfiesRange(version: string, range: string): boolean {
  try {
    const v = parse(version)
    const r = range.trim()

    if (r.startsWith('>=')) return compare(v, parse(r.slice(2).trim())) >= 0
    if (r.startsWith('>'))  return compare(v, parse(r.slice(1).trim())) > 0
    if (r.startsWith('<=')) return compare(v, parse(r.slice(2).trim())) <= 0
    if (r.startsWith('<'))  return compare(v, parse(r.slice(1).trim())) < 0

    if (r.startsWith('^')) {
      const base = parse(r.slice(1).trim())
      return v[0] === base[0] && compare(v, base) >= 0
    }

    if (r.startsWith('~')) {
      const base = parse(r.slice(1).trim())
      return v[0] === base[0] && v[1] === base[1] && compare(v, base) >= 0
    }

    return compare(v, parse(r)) === 0
  } catch {
    return false
  }
}
