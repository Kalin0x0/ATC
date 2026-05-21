// Phase 27 — Entity Registry & Cross-Reference Graph (READ MODEL)
//
// These types describe the unified entity directory and relationship graph.
// All data shapes are READ-ONLY projections; writers belong to other systems.

// ── Entity types ──────────────────────────────────────────────────────────────

export type AtcEntityType =
  | 'character'
  | 'vehicle'
  | 'incident'
  | 'warrant'
  | 'arrest'
  | 'citation'
  | 'bolo'
  | 'evidence'
  | 'organization'
  | 'account'

export const ATC_ENTITY_TYPES: readonly AtcEntityType[] = [
  'character', 'vehicle', 'incident', 'warrant', 'arrest',
  'citation', 'bolo', 'evidence', 'organization', 'account',
] as const

export type AtcEntityVisibility = 'public' | 'internal' | 'restricted'

// ── Alias kinds ───────────────────────────────────────────────────────────────

export type AtcEntityAliasKind =
  | 'name'
  | 'nickname'
  | 'phone'
  | 'plate'
  | 'email'
  | 'external_id'
  | 'badge'
  | 'vin'
  | 'tag'

// ── Relationship kinds ────────────────────────────────────────────────────────

export type AtcRelationshipKind =
  // character ↔ ...
  | 'character_involved_in_incident'
  | 'character_subject_of_warrant'
  | 'character_subject_of_arrest'
  | 'character_subject_of_citation'
  | 'character_member_of_organization'
  | 'character_associated_with_character'
  // incident ↔ ...
  | 'incident_links_evidence'
  | 'incident_links_arrest'
  | 'incident_links_citation'
  // vehicle ↔ ...
  | 'vehicle_linked_to_bolo'
  | 'vehicle_owned_by_character'
  // arrest ↔ evidence
  | 'arrest_links_evidence'
  // case ↔ citation
  | 'case_links_citation'

// ── Core projections ──────────────────────────────────────────────────────────

export interface AtcEntityReference {
  /** Canonical UUID/ULID for the entity within the registry. */
  id: string
  /** External business id from the source system (e.g. characterId). */
  externalId: string
  /** Entity classification. */
  type: AtcEntityType
}

export interface AtcEntityAlias {
  id: string
  entityId: string
  kind: AtcEntityAliasKind
  value: string
  sourceSystem: string
  createdBy: string | null
  createdAt: Date
}

export interface AtcEntityNode extends AtcEntityReference {
  displayName: string | null
  sourceSystem: string
  visibility: AtcEntityVisibility
  metadata: Record<string, unknown> | null
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
  aliases: AtcEntityAlias[]
}

export interface AtcRelationshipEdge {
  id: string
  from: AtcEntityReference
  to: AtcEntityReference
  relationship: AtcRelationshipKind
  weight: number
  sourceSystem: string
  attribution: string | null
  metadata: Record<string, unknown> | null
  observedAt: Date
  endedAt: Date | null
  isActive: boolean
}

// ── Cross-reference projection ────────────────────────────────────────────────

/**
 * A cross-reference is a denormalised pairing of an entity with another entity
 * that links to it via any edge. Used by the MDT subject-graph endpoint.
 */
export interface AtcCrossReference {
  source: AtcEntityReference
  target: AtcEntityReference
  relationship: AtcRelationshipKind
  edgeId: string
  observedAt: Date
  endedAt: Date | null
}

// ── Subject graph aggregation ─────────────────────────────────────────────────

export interface AtcEntityNeighbor {
  entity: AtcEntityNode
  edge: AtcRelationshipEdge
  direction: 'outbound' | 'inbound'
  depth: number
}

export interface AtcEntityRelationshipPage {
  entityId: string
  outbound: AtcRelationshipEdge[]
  inbound: AtcRelationshipEdge[]
  total: number
  limit: number
  cursor: string | null
  nextCursor: string | null
}

export interface AtcEntityRelatedGraph {
  rootId: string
  depth: number
  nodes: AtcEntityNode[]
  edges: AtcRelationshipEdge[]
  /** Cycle markers — entity IDs revisited during traversal. */
  cyclesDetected: string[]
  truncated: boolean
}

export interface AtcEntityHistoryEntry {
  at: Date
  kind: 'created' | 'alias_added' | 'relationship_added' | 'relationship_ended'
  detail: string
  edgeId: string | null
  aliasId: string | null
}

export interface AtcEntityHistoryPage {
  entityId: string
  entries: AtcEntityHistoryEntry[]
  total: number
  limit: number
  cursor: string | null
  nextCursor: string | null
}

// ── Search results ────────────────────────────────────────────────────────────

export interface AtcEntitySearchHit {
  entity: AtcEntityNode
  /** Score in [0, 1] — higher is closer match. */
  score: number
  /** Which alias or field produced the match. */
  matchedOn: 'id' | 'external_id' | 'display_name' | 'alias'
  matchedValue: string
}

export interface AtcEntitySearchResult {
  query: string
  types: AtcEntityType[]
  hits: AtcEntitySearchHit[]
  total: number
  limit: number
  cursor: string | null
  nextCursor: string | null
}
