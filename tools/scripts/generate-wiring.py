#!/usr/bin/env python3
"""Generate apps/api/src/wiring.ts.

AppContext declares 645 optional services; index.ts constructs 30 of them, so
nearly every route answers 503. The constructors are regular though — most take
the shared pool, the rest take other services and the event bus — so the wiring
can be derived from the built type declarations rather than written by hand.

Anything that cannot be resolved is reported rather than guessed at.
"""
import json
import pathlib
import re
import sys
from collections import defaultdict

# Repository root, two levels up from tools/scripts.
ROOT = pathlib.Path(__file__).resolve().parents[2]
PKGS = ROOT / 'packages'


# ── Catalogue every exported class and its constructor ────────────────────────

def strip_comments(txt: str) -> str:
    return re.sub(r'/\*\*.*?\*/', '', txt, flags=re.S)


def package_exports(pkg: pathlib.Path) -> tuple[set[str], dict[str, str]]:
    """Names reachable from a package's dist/index.d.ts, plus alias -> original.

    Aliases matter: @atc/mdt exports `MdtAggregationService as MdtService`, and
    AppContext asks for MdtService, which is not the name of any declaration.
    """
    index = pkg / 'dist' / 'index.d.ts'
    if not index.exists():
        return set(), {}
    seen, names, aliases = set(), set(), {}

    def walk(f: pathlib.Path):
        if f in seen or not f.exists():
            return
        seen.add(f)
        txt = strip_comments(f.read_text(errors='replace'))
        for m in re.finditer(r'export\s*\{([^}]*)\}', txt):
            for n in m.group(1).split(','):
                n = n.strip()
                if not n:
                    continue
                parts = [x.strip() for x in n.split(' as ')]
                orig = parts[0].replace('type ', '').strip()
                alias = parts[-1].replace('type ', '').strip()
                names.add(alias)
                if len(parts) > 1:
                    aliases[alias] = orig
        for m in re.finditer(r'export\s+declare\s+(?:class|function|const)\s+(\w+)', txt):
            names.add(m.group(1))
        for m in re.finditer(r"export\s+\*\s+from\s+'\./([^']+)'", txt):
            walk(f.parent / m.group(1).replace('.js', '.d.ts'))

    walk(index)
    return names, aliases


interfaces: dict[str, list[dict]] = {}
classes: dict[str, dict] = {}
# Two packages can export a class of the same name (cluster-runtime and
# world-orchestrator both have a RuntimeAllocationRepository, and they are not
# the same type). Candidates are kept per name so a dependency can be resolved
# against the consumer's own package first.
candidates: dict[str, list[dict]] = {}
for pkg in sorted(PKGS.iterdir()):
    dist = pkg / 'dist'
    if not dist.is_dir():
        continue
    exported, aliases = package_exports(pkg)
    # Aliases can also be declared in the file that owns the class rather than
    # in index.d.ts — @atc/mdt does exactly that with
    # `export { MdtAggregationService as MdtService }`.
    for _f in dist.rglob('*.d.ts'):
        for _m in re.finditer(r'export\s*\{([^}]*)\}\s*;', _f.read_text(errors='replace')):
            for _n in _m.group(1).split(','):
                _parts = [x.strip().replace('type ', '') for x in _n.split(' as ')]
                if len(_parts) > 1 and _parts[0] and _parts[-1]:
                    aliases.setdefault(_parts[-1], _parts[0])
    for dts in dist.rglob('*.d.ts'):
        txt = strip_comments(dts.read_text(errors='replace'))
        # Deps/options interfaces, so an object-taking constructor can be built.
        # Brace-balanced rather than [^{}]*: several of these have nested member
        # types, and a non-nesting match silently skips them.
        for m in re.finditer(r'interface (\w+)[^{]*\{', txt):
            depth, i = 0, m.end() - 1
            while i < len(txt):
                if txt[i] == '{':
                    depth += 1
                elif txt[i] == '}':
                    depth -= 1
                    if depth == 0:
                        break
                i += 1
            interfaces.setdefault(m.group(1), []).append(
                {'pkg': f'@atc/{pkg.name}', 'body': txt[m.end():i]})
        for m in re.finditer(r'declare class (\w+)[^{]*\{(.*?)\n\}', txt, re.S):
            name, body = m.group(1), m.group(2)
            if name not in exported and not any(o == name for o in aliases.values()):
                continue
            cm = re.search(r'constructor\((.*?)\);', body, re.S)
            raw = re.sub(r'\s+', ' ', cm.group(1).strip()) if cm else ''
            for exposed in {name} | {a for a, o in aliases.items() if o == name}:
                entry = {'pkg': f'@atc/{pkg.name}', 'params': raw, 'name': name}
                lst = candidates.setdefault(exposed, [])
                if not any(e['pkg'] == entry['pkg'] for e in lst):
                    lst.append(entry)
                classes.setdefault(exposed, entry)


# ── What AppContext wants ─────────────────────────────────────────────────────

ctx_src = (ROOT / 'apps/api/src/context.ts').read_text()
iface = ctx_src[ctx_src.index('export interface AppContext'):]
declared = re.findall(r'^\s{2}([a-zA-Z][A-Za-z0-9_]*)\?:\s*([A-Za-z0-9_]+)', iface, re.M)

# Which package each type name in AppContext comes from. Same-named classes live
# in more than one package (InjuryRepository is in both @atc/medical and
# @atc/combat-runtime, and they are different types), so the context's own
# imports decide which one a field means.
field_pkg: dict[str, str] = {}
# context.ts also renames on import — `AccountRepository as
# FinancialAccountRepository` from @atc/ledger — so the field's written type is
# not the name of any declaration. The original is what has to be resolved.
field_alias: dict[str, str] = {}
for m in re.finditer(r"import type \{([^}]*)\} from '(@atc/[^']+)'", ctx_src, re.S):
    for n in m.group(1).split(','):
        parts = [x.strip() for x in n.split(' as ') if x.strip()]
        if not parts:
            continue
        field_pkg.setdefault(parts[-1], m.group(2))
        if len(parts) > 1:
            field_alias[parts[-1]] = parts[0]

idx_src = (ROOT / 'apps/api/src/index.ts').read_text()
already = set(re.findall(r'^\s{4}([a-zA-Z][A-Za-z0-9_]*)[,:]',
                         idx_src[idx_src.index('const ctx = {'):], re.M))


# ── Resolve constructor arguments ─────────────────────────────────────────────

def split_params(raw: str) -> list[tuple[str, str]]:
    """(name, type) per parameter, tolerating generics and object literals."""
    out, depth, cur = [], 0, ''
    for ch in raw:
        if ch in '<([{':
            depth += 1
        elif ch in '>)]}':
            depth -= 1
        if ch == ',' and depth == 0:
            out.append(cur)
            cur = ''
            continue
        cur += ch
    if cur.strip():
        out.append(cur)
    parsed = []
    for p in out:
        p = p.strip()
        if not p:
            continue
        name, _, typ = p.partition(':')
        parsed.append((name.strip().rstrip('?'), typ.strip()))
    return parsed


def is_optional(param: str, typ: str) -> bool:
    return param.endswith('?') or '| undefined' in typ or 'undefined |' in typ


POOL_RE = re.compile(r'(Pool|DbPool)$')

instances: dict[str, str] = {}     # class name -> variable name
order: list[tuple[str, str, list[str]]] = []   # (var, class, args)
unresolved: dict[str, str] = {}    # class -> reason
building: set[str] = set()


def var_for(cls: str) -> str:
    v = cls[0].lower() + cls[1:]
    return '_' + v


def pick(cls: str, prefer_pkg: str | None) -> dict | None:
    lst = candidates.get(cls)
    if not lst:
        return None
    if prefer_pkg:
        for e in lst:
            if e['pkg'] == prefer_pkg:
                return e
    return lst[0]


def resolve(cls: str, depth: int = 0, prefer_pkg: str | None = None) -> str | None:
    """Ensure an instance of cls exists; return its variable name."""
    info = pick(cls, prefer_pkg)
    if info is None:
        unresolved[cls] = 'not exported by any built package'
        return None
    key = f"{info['pkg']}#{cls}"
    if key in instances:
        return instances[key]
    if key in unresolved or key in building or depth > 6:
        return None

    building.add(key)

    def arg_for(base: str, pname: str, ptype: str) -> str | None:
        """An expression for one constructor parameter, or None if unresolvable."""
        if POOL_RE.search(base):
            return 'pool'
        if base == 'AtcEventBus':
            return 'eventBus'
        if 'EventBus' in base or re.match(r'^\{\s*emit\b', base):
            return 'runtimeEventBus'
        if 'Redis' in base:
            return 'redis'
        if base == 'AtcTelemetryService':
            return 'telemetry'
        if base in candidates:
            return resolve(base, depth + 1, info['pkg'])
        # A deps/options object: build it from the interface members.
        if base in interfaces:
            cand = next((e for e in interfaces[base] if e['pkg'] == info['pkg']), interfaces[base][0])
            parts: list[str] = []
            members, _d, cur = [], 0, ''
            for ch in cand['body']:
                if ch in '{(<': _d += 1
                elif ch in '})>': _d -= 1
                if ch == ';' and _d == 0:
                    members.append(cur); cur = ''; continue
                cur += ch
            if cur.strip(): members.append(cur)
            for line in members:
                line = line.strip()
                if not line or ':' not in line:
                    continue
                mname, _, mtype = line.partition(':')
                mname = mname.strip()
                optional = mname.endswith('?')
                mname = mname.rstrip('?')
                mbase = re.sub(r'\s*\|\s*undefined', '', mtype).strip()
                sub = arg_for(mbase, mname, mtype)
                if sub is None:
                    if optional:
                        continue
                    if '| undefined' in mtype:
                        # Required member whose type admits undefined. Under
                        # exactOptionalPropertyTypes the key must still be
                        # present, so it is written explicitly.
                        parts.append(f'{mname}: undefined')
                        continue
                    return None
                parts.append(f'{mname}: {sub}')
            return '{ ' + ', '.join(parts) + ' }'
        if base.startswith('{') and 'telemetry?' in base:
            return '{ telemetry }'
        return None

    args: list[str] = []
    for pname, ptype in split_params(info['params']):
        base = re.sub(r'\s*\|\s*undefined', '', ptype).strip()
        expr = arg_for(base, pname, ptype)
        if expr is not None:
            args.append(expr)
        elif is_optional(pname, ptype):
            break     # trailing optional we cannot supply — stop here
        else:
            building.discard(key)
            unresolved[key] = f'parameter {pname}: {base}'
            return None

    building.discard(key)
    # Same-named classes from different packages need distinct variables and
    # distinct import aliases.
    suffix = '' if len(candidates[cls]) == 1 else '_' + info['pkg'].split('/')[-1].replace('-', '_')
    v = var_for(cls) + suffix
    instances[key] = v
    order.append((v, cls, args, info['pkg'], suffix))
    return v


fields: list[tuple[str, str]] = []      # (ctx field, variable)
skipped: list[tuple[str, str, str]] = []
for field, typ in declared:
    if field in already:
        continue
    v = resolve(field_alias.get(typ, typ), 0, field_pkg.get(typ))
    if v is None:
        skipped.append((field, typ, next((r for k, r in unresolved.items() if k.endswith('#' + typ) or k == typ), 'unknown')))
    else:
        fields.append((field, v))

# ── Emit ──────────────────────────────────────────────────────────────────────

by_pkg: dict[str, set[tuple[str, str]]] = defaultdict(set)
for _v, _cls, _args, _pkg, _sfx in order:
    by_pkg[_pkg].add((_cls, _cls + _sfx if _sfx else _cls))

lines: list[str] = []
w = lines.append
w("// GENERATED — do not edit by hand.")
w("//")
w("// AppContext declares one optional field per runtime service, and index.ts used")
w("// to construct thirty of them. Every route begins with a `if (!ctx.thing) return")
w("// 503` guard, so the rest of the API answered 503 for services that existed and")
w("// were merely never built.")
w("//")
w("// The constructors are regular enough to derive rather than transcribe: most")
w("// take the shared connection pool, the rest take other services and the event")
w("// bus. This file is generated from the built type declarations by")
w("// tools/scripts/generate-wiring.py; run that after adding or changing a")
w("// service, and read the list of skipped ones it prints.")
w("//")
w("// Construction is side-effect free — no constructor in these packages opens a")
w("// connection or starts a timer — so building them all at startup costs a few")
w("// hundred object allocations and nothing else.")
w('')
w("import type { DbPool } from '@atc/db'")
w("import type { RedisClient } from '@atc/cache'")
w("import type { AtcEventBus } from '@atc/events'")
w("import type { AtcTelemetryService } from '@atc/telemetry'")
for pkg in sorted(by_pkg):
    names = sorted(by_pkg[pkg])
    w("import {")
    for orig, alias in names:
        w(f"  {orig}," if orig == alias else f"  {orig} as {alias},")
    w(f"}} from '{pkg}'")
w('')
w("export interface RuntimeServiceDeps {")
w("  pool: DbPool")
w("  redis: RedisClient")
w("  eventBus: AtcEventBus")
w("  telemetry: AtcTelemetryService")
w("}")
w('')
w("/**")
w(" * Construct every runtime service and return them keyed by their AppContext")
w(" * field name, ready to spread into the context object.")
w(" */")
w("export function buildRuntimeServices(deps: RuntimeServiceDeps) {")
w("  const { pool, redis, eventBus, telemetry } = deps")
w('')
w("  // Every runtime package declares its own event-bus shape rather than")
w("  // importing the real one, and all of them are `emit(event, payload):")
w("  // Promise<void>` while AtcEventBus.emit resolves to an AtcEventEmitResult.")
w("  // Promise<AtcEventEmitResult> is not assignable to Promise<void>, so the")
w("  // real bus cannot be handed over directly even though it does everything")
w("  // asked of it. This forwards and drops the result.")
w("  const runtimeEventBus = {")
w("    emit: async (event: string, payload: unknown): Promise<void> => {")
w("      await eventBus.emit(event as Parameters<AtcEventBus['emit']>[0], payload)")
w("    },")
w("  }")
w('')
for v, cls, args, pkg, sfx in order:
    w(f"  const {v} = new {cls + sfx}({', '.join(args)})")
w('')
w("  return {")
for field, v in sorted(fields):
    w(f"    {field}: {v},")
w("  }")
w("}")
w('')

out = ROOT / 'apps/api/src/wiring.ts'
out.write_text('\n'.join(lines))

print(f"{len(order)} Services konstruiert, {len(fields)} AppContext-Felder belegt")
print(f"{len(skipped)} uebersprungen")
if '--json' in sys.argv:
    json.dump([{'field': f, 'type': t, 'reason': r} for f, t, r in skipped],
              sys.stdout, indent=1)
for f, t, r in skipped:
    print(f"  {f:38} {t:34} {r}")
