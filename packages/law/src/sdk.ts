import type { LawEnforcementService } from './law-enforcement.service.js'
import type { AgencyRepository } from './agency.repository.js'
import type { WarrantRepository } from './warrant.repository.js'
import type { CitationRepository } from './citation.repository.js'
import type { ArrestRepository } from './arrest.repository.js'
import type { JailRepository } from './jail.repository.js'
import type { EvidenceRepository } from './evidence.repository.js'
import type { LegalCaseRepository } from './legal-case.repository.js'

export interface AtcLawSDKOptions {
  service: LawEnforcementService
  agencyRepo: AgencyRepository
  warrantRepo: WarrantRepository
  citationRepo: CitationRepository
  arrestRepo: ArrestRepository
  jailRepo: JailRepository
  evidenceRepo: EvidenceRepository
  caseRepo: LegalCaseRepository
}

export class AtcLawSDK {
  readonly service: LawEnforcementService
  readonly agencies: AgencyRepository
  readonly warrants: WarrantRepository
  readonly citations: CitationRepository
  readonly arrests: ArrestRepository
  readonly jail: JailRepository
  readonly evidence: EvidenceRepository
  readonly cases: LegalCaseRepository

  constructor(opts: AtcLawSDKOptions) {
    this.service   = opts.service
    this.agencies  = opts.agencyRepo
    this.warrants  = opts.warrantRepo
    this.citations = opts.citationRepo
    this.arrests   = opts.arrestRepo
    this.jail      = opts.jailRepo
    this.evidence  = opts.evidenceRepo
    this.cases     = opts.caseRepo
  }
}
