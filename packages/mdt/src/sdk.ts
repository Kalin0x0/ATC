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
import type {
  AtcMdtCharacterProfile,
  AtcMdtIncidentSummary,
  AtcMdtWarrantSummary,
  AtcMdtEvidenceSummary,
  AtcMdtJailState,
  AtcMdtSearchResult,
  AtcBoloRecord,
  AtcIncident,
} from '@atc/shared-types'
import { MdtAggregationService } from './mdt.service.js'
import type { MdtSearchOptions } from './mdt.service.js'

export interface AtcMdtSDKOptions {
  warrants: WarrantRepository
  arrests: ArrestRepository
  citations: CitationRepository
  jail: JailRepository
  evidence?: EvidenceRepository
  incidents: IncidentRepository
  bolos: BoloRepository
  responders?: ResponderAssignmentRepository
}

/**
 * AtcMdtSDK — convenience wrapper around the MDT aggregation service.
 *
 * The SDK is read-only and provides ergonomic access to the underlying
 * aggregation methods. It MUST NOT expose any mutation surface.
 */
export class AtcMdtSDK {
  readonly service: MdtAggregationService

  constructor(opts: AtcMdtSDKOptions) {
    this.service = new MdtAggregationService(opts)
  }

  getCharacterProfile(characterId: string): Promise<AtcMdtCharacterProfile> {
    return this.service.getCharacterProfile(characterId)
  }

  getIncident(incidentId: string): Promise<AtcMdtIncidentSummary | null> {
    return this.service.getIncidentSummary(incidentId)
  }

  getActiveWarrants(characterId: string): Promise<AtcMdtWarrantSummary> {
    return this.service.getActiveWarrants(characterId)
  }

  getEvidenceSummary(characterId: string): Promise<AtcMdtEvidenceSummary> {
    return this.service.getEvidenceSummary(characterId)
  }

  getJailState(characterId: string): Promise<AtcMdtJailState> {
    return this.service.getJailState(characterId)
  }

  searchCharacters(
    query: string,
    options: MdtSearchOptions = {},
  ): Promise<AtcMdtSearchResult<AtcMdtCharacterProfile>> {
    return this.service.searchCharacters(query, options)
  }

  searchIncidents(
    query: string,
    options: MdtSearchOptions = {},
  ): Promise<AtcMdtSearchResult<AtcIncident>> {
    return this.service.searchIncidents(query, options)
  }

  searchBolos(
    query: string,
    options: MdtSearchOptions = {},
  ): Promise<AtcMdtSearchResult<AtcBoloRecord>> {
    return this.service.searchBolos(query, options)
  }

  searchVehicles(
    query: string,
    options: MdtSearchOptions = {},
  ): Promise<AtcMdtSearchResult<AtcBoloRecord>> {
    return this.service.searchVehicles(query, options)
  }
}
