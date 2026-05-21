import type { AtcRegistryManifest } from '@atc/shared-types'
import {
  PluginDependencyCycleError,
  PluginMissingDependencyError,
  PluginVersionMismatchError,
} from './errors.js'
import { satisfiesRange } from './semver.js'

export interface ResolvedDependencyOrder {
  order: string[]
}

export function resolveDependencies(manifests: AtcRegistryManifest[]): ResolvedDependencyOrder {
  const byId = new Map<string, AtcRegistryManifest>()
  for (const m of manifests) byId.set(m.id, m)

  // Validate all declared dependencies exist and satisfy version ranges
  for (const m of manifests) {
    for (const dep of m.dependencies ?? []) {
      const found = byId.get(dep.id)
      if (!found) {
        throw new PluginMissingDependencyError(m.id, dep.id)
      }
      if (!satisfiesRange(found.version, dep.version)) {
        throw new PluginVersionMismatchError(m.id, dep.id, dep.version, found.version)
      }
    }
  }

  // Kahn's algorithm — produces stable topological order
  // inDegree[id] = number of dependencies plugin 'id' still needs loaded
  const inDegree = new Map<string, number>()
  // dependents[id] = list of plugins that depend on 'id'
  const dependents = new Map<string, string[]>()

  for (const m of manifests) {
    inDegree.set(m.id, m.dependencies?.length ?? 0)
    if (!dependents.has(m.id)) dependents.set(m.id, [])
    for (const dep of m.dependencies ?? []) {
      const list = dependents.get(dep.id) ?? []
      list.push(m.id)
      dependents.set(dep.id, list)
    }
  }

  const queue = manifests
    .filter((m) => (inDegree.get(m.id) ?? 0) === 0)
    .map((m) => m.id)
    .sort()  // stable sort for determinism

  const order: string[] = []

  while (queue.length > 0) {
    const id = queue.shift()!
    order.push(id)
    const deps = (dependents.get(id) ?? []).sort()
    for (const depId of deps) {
      const deg = (inDegree.get(depId) ?? 1) - 1
      inDegree.set(depId, deg)
      if (deg === 0) queue.push(depId)
    }
  }

  if (order.length !== manifests.length) {
    // Cycle exists — find one cycle via DFS for diagnostics
    const visited = new Set<string>()
    const stack = new Set<string>()
    const cycleFound: string[] = []

    function dfs(id: string, path: string[]): boolean {
      visited.add(id)
      stack.add(id)
      for (const dep of byId.get(id)?.dependencies?.map((d) => d.id) ?? []) {
        if (!visited.has(dep)) {
          if (dfs(dep, [...path, dep])) return true
        } else if (stack.has(dep)) {
          const cycleStart = path.indexOf(dep)
          cycleFound.push(...path.slice(cycleStart >= 0 ? cycleStart : 0), dep)
          return true
        }
      }
      stack.delete(id)
      return false
    }

    for (const m of manifests) {
      if (!visited.has(m.id)) {
        if (dfs(m.id, [m.id])) break
      }
    }

    throw new PluginDependencyCycleError(cycleFound.length > 0 ? cycleFound : ['unknown'])
  }

  return { order }
}
