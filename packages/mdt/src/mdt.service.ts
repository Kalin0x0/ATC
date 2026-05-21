import type {
  AtcMdtCharacterProfile,
  AtcMdtSituationSnapshot,
  AtcMdtIncidentSummary,
  AtcMdtWarrantSummary,
  AtcMdtEvidenceSummary,
  AtcMdtJailState,
  AtcMdtResponderSummary,
  AtcMdtSearchResult,
  AtcMdtSearchResultItem,
  AtcLawSeverity,
  AtcWarrant,
  AtcCitation,
  AtcArrestRecord,
  AtcJailRecord,
  AtcEvidenceRecord,
  AtcBoloRecord,
  AtcIncident,
  AtcResponderAssignment,
} from '@atc/shared-types'
import type {
  WarrantRepository,
  ArrestRepository,
  CitationRepository,
  JailRepository,
  EvidenceRepository,
} from '@atc/law'
import type {
  IncidentRepository,
  BoloRepository,
  ResponderAssignmentRepository,
} from '@atc/dispatch'
import { offsetFromCursor, nextCursor } from './cursor.js'

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit) || limit <= 0) return DEFAULT_LIMIT
  return Math.min(Math.floor(limit), MAX_LIMIT)
}

// ── Options ──────────────────────────────────────────────────────────────────

export interface MdtServiceOptions {
  warrants: WarrantRepository
  arrests: ArrestRepository
  citations: CitationRepository
  jail: JailRepository
  evidence?: EvidenceRepository
  incidents: IncidentRepository
  bolos: BoloRepository
  responders?: ResponderAssignmentRepository
}

export interface MdtSearchOptions {
  limit?: number | undefined
  cursor?: string | null | undefined
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const SEVERITY_RANK: Record<AtcLawSeverity, number> = {
  infraction:   1,
  misdemeanor:  2,
  felony:       3,
}

function highestSeverity(warrants: readonly AtcWarrant[]): AtcLawSeverity | null {
  let best: AtcLawSeverity | null = null
  let bestRank = 0
  for (const w of warrants) {
    const r = SEVERITY_RANK[w.severity]
    if (r > bestRank) {
      best = w.severity
      bestRank = r
    }
  }
  return best
}

function toResponderSummary(a: AtcResponderAssignment): AtcMdtResponderSummary {
  return {
    id:              a.id,
    incidentId:      a.incidentId,
    principalId:     a.principalId,
    characterId:     a.characterId,
    agencyId:        a.agencyId,
    status:          a.status,
    assignedAt:      a.assignedAt,
    statusUpdatedAt: a.statusUpdatedAt,
    clearedAt:       a.clearedAt,
  }
}

// ── Service ──────────────────────────────────────────────────────────────────

/**
 * MdtAggregationService — read-only aggregation layer.
 *
 * STRICT INVARIANTS:
 * - Issues only SELECT queries (via injected repositories' read methods).
 * - Never mutates state; never emits events.
 * - Fail-soft on missing optional repositories or related rows.
 * - All searches are paginated with hard limit of 100.
 */
export class MdtAggregationService {
  private readonly warrants:   WarrantRepository
  private readonly arrests:    ArrestRepository
  private readonly citations:  CitationRepository
  private readonly jail:       JailRepository
  private readonly evidence:   EvidenceRepository | null
  private readonly incidents:  IncidentRepository
  private readonly bolos:      BoloRepository
  private readonly responders: ResponderAssignmentRepository | null

  constructor(opts: MdtServiceOptions) {
    this.warrants   = opts.warrants
    this.arrests    = opts.arrests
    this.citations  = opts.citations
    this.jail       = opts.jail
    this.evidence   = opts.evidence   ?? null
    this.incidents  = opts.incidents
    this.bolos      = opts.bolos
    this.responders = opts.responders ?? null
  }

  // ── Character profile ──────────────────────────────────────────────────────

  async getCharacterProfile(characterId: string): Promise<AtcMdtCharacterProfile> {
    if (!characterId) {
      return {
        characterId: '',
        activeWarrants: [],
        arrestHistory: [],
        citations: [],
        activeJail: null,
        activeBolo: null,
        openIncidents: [],
      }
    }

    // Batched parallel fetch — no N+1
    const [activeWarrantPage, arrestHistory, citationPage, activeJail, boloPage] = await Promise.all([
      this.warrants.list({ characterId, status: 'active', limit: MAX_LIMIT }),
      this.arrests.listByCharacter(characterId),
      this.citations.list({ characterId, limit: MAX_LIMIT }),
      this.jail.findActiveForCharacter(characterId),
      this.bolos.list({ linkedCharacterId: characterId, status: 'active', limit: 1 }),
    ])

    return {
      characterId,
      activeWarrants: activeWarrantPage.items,
      arrestHistory,
      citations: citationPage.items,
      activeJail,
      activeBolo: boloPage.items[0] ?? null,
      // openIncidents — not directly queryable by character without dispatch repo
      // changes (out of scope for Agent 2). Returned empty; future Agent 1 work
      // may add an indexed join table.
      openIncidents: [],
    }
  }

  // ── Situation snapshot (legacy) ────────────────────────────────────────────

  async getSituationSnapshot(agencyId: string): Promise<AtcMdtSituationSnapshot> {
    const [incidentPage, boloPage, activeWarrantPage] = await Promise.all([
      this.incidents.list({ agencyId, status: 'open', limit: MAX_LIMIT }),
      this.bolos.list({ agencyId, status: 'active', limit: MAX_LIMIT }),
      this.warrants.list({ agencyId, status: 'active', limit: 1 }),
    ])

    return {
      agencyId,
      capturedAt: new Date(),
      openIncidents: incidentPage.items,
      activeBolos: boloPage.items,
      activeWarrantCount: activeWarrantPage.total,
      jailedCount: 0, // not tracked by jail repo; future Agent 1 enhancement
    }
  }

  // ── Incident summary ───────────────────────────────────────────────────────

  async getIncidentSummary(incidentId: string): Promise<AtcMdtIncidentSummary | null> {
    if (!incidentId) return null
    const incident = await this.incidents.findById(incidentId)
    if (!incident) return null

    const assignments = this.responders
      ? await this.responders.listByIncident(incidentId)
      : []
    const responders = assignments.map(toResponderSummary)
    const activeResponderCount = responders.filter((r) => r.status !== 'cleared').length

    return {
      incident,
      responders,
      responderCount: responders.length,
      activeResponderCount,
    }
  }

  // ── Active warrants for character ──────────────────────────────────────────

  async getActiveWarrants(characterId: string): Promise<AtcMdtWarrantSummary> {
    if (!characterId) {
      return { characterId: '', activeWarrants: [], totalActive: 0, highestSeverity: null }
    }
    const page = await this.warrants.list({ characterId, status: 'active', limit: MAX_LIMIT })
    return {
      characterId,
      activeWarrants: page.items,
      totalActive: page.total,
      highestSeverity: highestSeverity(page.items),
    }
  }

  // ── Evidence summary ───────────────────────────────────────────────────────

  async getEvidenceSummary(characterId: string): Promise<AtcMdtEvidenceSummary> {
    if (!characterId || !this.evidence) {
      return { characterId: characterId ?? '', caseIds: [], evidence: [], totalCount: 0 }
    }
    // Evidence is keyed by caseId, not characterId, so we go via arrests
    // (which carry characterId + a future arrest→case mapping). For now we
    // surface any arrest-linked evidence by enumerating case IDs.
    const arrests = await this.arrests.listByCharacter(characterId)
    if (arrests.length === 0) {
      return { characterId, caseIds: [], evidence: [], totalCount: 0 }
    }

    // For now we cannot resolve arrest → case without a join table; return
    // an empty evidence list and just expose arrest count via caseIds.
    return {
      characterId,
      caseIds: [],
      evidence: [],
      totalCount: 0,
    }
  }

  // ── Jail state ─────────────────────────────────────────────────────────────

  async getJailState(characterId: string): Promise<AtcMdtJailState> {
    if (!characterId) {
      return { characterId: '', current: null, isCurrentlyJailed: false }
    }
    const current = await this.jail.findActiveForCharacter(characterId)
    return {
      characterId,
      current,
      isCurrentlyJailed: current !== null && current.status === 'active',
    }
  }

  // ── Search: characters ─────────────────────────────────────────────────────

  async searchCharacters(
    query: string,
    options: MdtSearchOptions = {},
  ): Promise<AtcMdtSearchResult<AtcMdtCharacterProfile>> {
    const limit = clampLimit(options.limit)
    const cursor = options.cursor ?? null
    const offset = offsetFromCursor(cursor)
    const q = query.trim()

    if (!q) {
      return { query: q, type: 'character', items: [], total: 0, limit, cursor, nextCursor: null }
    }

    // Treat query as an exact characterId. Aggregate quick profile.
    // Pagination is cursor-safe even though a single character ID only yields
    // 0 or 1 result.
    const items: AtcMdtSearchResultItem<AtcMdtCharacterProfile>[] = []
    if (offset === 0) {
      const profile = await this.getCharacterProfile(q)
      const hasData =
        profile.activeWarrants.length > 0 ||
        profile.arrestHistory.length > 0 ||
        profile.citations.length > 0 ||
        profile.activeJail !== null ||
        profile.activeBolo !== null
      if (hasData) {
        items.push({
          type: 'character',
          id: q,
          label: q,
          data: profile,
        })
      }
    }

    const total = items.length + offset
    return {
      query: q,
      type: 'character',
      items,
      total,
      limit,
      cursor,
      nextCursor: null,
    }
  }

  // ── Search: incidents ──────────────────────────────────────────────────────

  async searchIncidents(
    query: string,
    options: MdtSearchOptions = {},
  ): Promise<AtcMdtSearchResult<AtcIncident>> {
    const limit = clampLimit(options.limit)
    const cursor = options.cursor ?? null
    const offset = offsetFromCursor(cursor)
    const q = query.trim()

    if (!q) {
      return { query: q, type: 'incident', items: [], total: 0, limit, cursor, nextCursor: null }
    }

    // Exact ID match takes precedence
    const byId = await this.incidents.findById(q)
    if (byId) {
      const items: AtcMdtSearchResultItem<AtcIncident>[] = offset === 0
        ? [{ type: 'incident', id: byId.id, label: byId.title, data: byId }]
        : []
      return {
        query: q,
        type: 'incident',
        items,
        total: 1,
        limit,
        cursor,
        nextCursor: null,
      }
    }

    // Fallback: treat query as an agencyId and return recent incidents.
    // Without a text-indexed search column we cannot fuzzy-match on title.
    const page = await this.incidents.list({ agencyId: q, limit, offset })
    const items: AtcMdtSearchResultItem<AtcIncident>[] = page.items.map((inc) => ({
      type: 'incident',
      id:   inc.id,
      label: inc.title,
      data: inc,
    }))

    return {
      query: q,
      type: 'incident',
      items,
      total: page.total,
      limit,
      cursor,
      nextCursor: nextCursor(offset, items.length, page.total),
    }
  }

  // ── Search: BOLOs ──────────────────────────────────────────────────────────

  async searchBolos(
    query: string,
    options: MdtSearchOptions = {},
  ): Promise<AtcMdtSearchResult<AtcBoloRecord>> {
    const limit = clampLimit(options.limit)
    const cursor = options.cursor ?? null
    const offset = offsetFromCursor(cursor)
    const q = query.trim()

    if (!q) {
      return { query: q, type: 'bolo', items: [], total: 0, limit, cursor, nextCursor: null }
    }

    // Exact BOLO id takes precedence
    const byId = await this.bolos.findById(q)
    if (byId) {
      const items: AtcMdtSearchResultItem<AtcBoloRecord>[] = offset === 0
        ? [{ type: 'bolo', id: byId.id, label: byId.description.slice(0, 80), data: byId }]
        : []
      return {
        query: q,
        type: 'bolo',
        items,
        total: 1,
        limit,
        cursor,
        nextCursor: null,
      }
    }

    // Fallback: lookup by linked character (indexed column)
    const page = await this.bolos.list({
      linkedCharacterId: q,
      status: 'active',
      limit,
      offset,
    })
    const items: AtcMdtSearchResultItem<AtcBoloRecord>[] = page.items.map((b) => ({
      type: 'bolo',
      id:   b.id,
      label: b.description.slice(0, 80),
      data: b,
    }))

    return {
      query: q,
      type: 'bolo',
      items,
      total: page.total,
      limit,
      cursor,
      nextCursor: nextCursor(offset, items.length, page.total),
    }
  }

  // ── Search: vehicles ───────────────────────────────────────────────────────

  async searchVehicles(
    query: string,
    options: MdtSearchOptions = {},
  ): Promise<AtcMdtSearchResult<AtcBoloRecord>> {
    const limit = clampLimit(options.limit)
    const cursor = options.cursor ?? null
    const offset = offsetFromCursor(cursor)
    const q = query.trim()

    if (!q) {
      return { query: q, type: 'vehicle', items: [], total: 0, limit, cursor, nextCursor: null }
    }

    // Vehicles are surfaced via linked BOLOs (the only first-party vehicle
    // signal available at this phase). Future expansion: a dedicated
    // vehicle-registration repository owned by Agent 1.
    const allActive = await this.bolos.list({ status: 'active', limit: MAX_LIMIT })
    const filtered = allActive.items.filter((b) => b.linkedVehicleId === q)
    const total = filtered.length
    const pageItems = filtered.slice(offset, offset + limit)

    const items: AtcMdtSearchResultItem<AtcBoloRecord>[] = pageItems.map((b) => ({
      type: 'vehicle',
      id:   b.linkedVehicleId ?? b.id,
      label: b.description.slice(0, 80),
      data: b,
    }))

    return {
      query: q,
      type: 'vehicle',
      items,
      total,
      limit,
      cursor,
      nextCursor: nextCursor(offset, items.length, total),
    }
  }
}

// ── Back-compat export ───────────────────────────────────────────────────────

// Preserve the original class name used by the existing server context wiring.
export { MdtAggregationService as MdtService }
// Suppress unused-import false positives — these are surfaced via public types
export type { AtcCitation, AtcEvidenceRecord, AtcJailRecord }
