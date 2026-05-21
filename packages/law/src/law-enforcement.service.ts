import type {
  AtcAgency,
  AtcWarrant,
  AtcCitation,
  AtcArrestRecord,
  AtcJailRecord,
  AtcEvidenceRecord,
  AtcLegalCase,
  ATC_LAW_EVENTS,
} from '@atc/shared-types'
import { ATC_LAW_EVENTS as LAW_EVENTS } from '@atc/shared-types'
import type { AtcTelemetryService } from '@atc/telemetry'
import type { AtcEventBus } from '@atc/events'
import type { LedgerService } from '@atc/ledger'
import type { AgencyRepository, CreateAgencyParams } from './agency.repository.js'
import type { WarrantRepository, CreateWarrantParams } from './warrant.repository.js'
import type { CitationRepository, CreateCitationParams } from './citation.repository.js'
import type { ArrestRepository, CreateArrestParams } from './arrest.repository.js'
import type { JailRepository, EnterJailParams } from './jail.repository.js'
import type { EvidenceRepository, CollectEvidenceParams } from './evidence.repository.js'
import type { LegalCaseRepository, CreateLegalCaseParams } from './legal-case.repository.js'
import { CitationNotFoundError, CitationAlreadyPaidError, CitationImmutableError } from './errors.js'

export interface PayCitationParams {
  citationId: string
  fromAccountId: string
  toAccountId: string
}

export interface LawEnforcementServiceOptions {
  agencies: AgencyRepository
  warrants: WarrantRepository
  citations: CitationRepository
  arrests: ArrestRepository
  jail: JailRepository
  evidence: EvidenceRepository
  cases: LegalCaseRepository
  ledger?: LedgerService | undefined
  eventBus?: AtcEventBus | undefined
  telemetry?: AtcTelemetryService | undefined
}

export class LawEnforcementService {
  private readonly agencies: AgencyRepository
  private readonly warrants: WarrantRepository
  private readonly citations: CitationRepository
  private readonly arrests: ArrestRepository
  private readonly jail: JailRepository
  private readonly evidence: EvidenceRepository
  private readonly cases: LegalCaseRepository
  private readonly ledger: LedgerService | undefined
  private readonly eventBus: AtcEventBus | undefined
  private readonly telemetry: AtcTelemetryService | undefined

  constructor(opts: LawEnforcementServiceOptions) {
    this.agencies  = opts.agencies
    this.warrants  = opts.warrants
    this.citations = opts.citations
    this.arrests   = opts.arrests
    this.jail      = opts.jail
    this.evidence  = opts.evidence
    this.cases     = opts.cases
    this.ledger    = opts.ledger
    this.eventBus  = opts.eventBus
    this.telemetry = opts.telemetry
  }

  // ── Agencies ─────────────────────────────────────────────────────────────────

  async createAgency(params: CreateAgencyParams): Promise<AtcAgency> {
    return this.agencies.create(params)
  }

  // ── Warrants ─────────────────────────────────────────────────────────────────

  async issueWarrant(params: CreateWarrantParams): Promise<AtcWarrant> {
    const warrant = await this.warrants.create(params)
    this.eventBus?.emit(LAW_EVENTS.WARRANT_CREATED, { warrant })
    this.telemetry?.increment('law.warrants_issued_total')
    return warrant
  }

  async executeWarrant(id: string): Promise<AtcWarrant> {
    const warrant = await this.warrants.executeWarrant(id)
    this.eventBus?.emit(LAW_EVENTS.WARRANT_EXECUTED, { warrant })
    this.telemetry?.increment('law.warrants_executed_total')
    return warrant
  }

  async expireWarrant(id: string): Promise<AtcWarrant> {
    const warrant = await this.warrants.expireWarrant(id)
    this.eventBus?.emit(LAW_EVENTS.WARRANT_EXPIRED, { warrant })
    return warrant
  }

  async revokeWarrant(id: string, reason: string): Promise<AtcWarrant> {
    const warrant = await this.warrants.revokeWarrant(id, reason)
    this.eventBus?.emit(LAW_EVENTS.WARRANT_REVOKED, { warrant })
    return warrant
  }

  // ── Citations ─────────────────────────────────────────────────────────────────

  async issueCitation(params: CreateCitationParams): Promise<AtcCitation> {
    const citation = await this.citations.create(params)
    this.eventBus?.emit(LAW_EVENTS.CITATION_ISSUED, { citation })
    this.telemetry?.increment('law.citations_issued_total')
    return citation
  }

  async payCitation(params: PayCitationParams): Promise<AtcCitation> {
    if (!this.ledger) {
      throw new Error('LedgerService not configured — cannot process citation payment')
    }

    const citation = await this.citations.findById(params.citationId)
    if (!citation) throw new CitationNotFoundError(params.citationId)
    if (citation.status === 'paid') throw new CitationAlreadyPaidError(params.citationId)
    if (citation.status !== 'unpaid') throw new CitationImmutableError(params.citationId, citation.status)

    const journal = await this.ledger.transfer({
      fromAccountId:  params.fromAccountId,
      toAccountId:    params.toAccountId,
      amount:         citation.amount,
      currency:       citation.currency,
      idempotencyKey: `citation:pay:${params.citationId}`,
      description:    `Citation fine payment: ${citation.reason}`,
      source:         'gameplay',
      referenceId:    params.citationId,
      referenceType:  'citation',
    })

    const paidAt = journal.committedAt ?? new Date()
    const updated = await this.citations.markPaid(params.citationId, journal.id, paidAt)
    this.eventBus?.emit(LAW_EVENTS.CITATION_PAID, { citation: updated, journalId: journal.id })
    this.telemetry?.increment('law.citations_paid_total')
    return updated
  }

  // ── Arrests ───────────────────────────────────────────────────────────────────

  async recordArrest(params: CreateArrestParams): Promise<AtcArrestRecord> {
    const record = await this.arrests.create(params)
    this.eventBus?.emit(LAW_EVENTS.ARREST_RECORDED, { arrest: record })
    this.telemetry?.increment('law.arrests_recorded_total')
    return record
  }

  // ── Jail ──────────────────────────────────────────────────────────────────────

  async enterJail(params: EnterJailParams): Promise<AtcJailRecord> {
    const record = await this.jail.enter(params)
    this.eventBus?.emit(LAW_EVENTS.JAIL_ENTERED, { jail: record })
    this.telemetry?.increment('law.jail_entries_total')
    return record
  }

  async releaseFromJail(jailRecordId: string, releasedByPrincipalId: string): Promise<AtcJailRecord> {
    const record = await this.jail.release(jailRecordId, releasedByPrincipalId)
    this.eventBus?.emit(LAW_EVENTS.JAIL_RELEASED, { jail: record })
    this.telemetry?.increment('law.jail_releases_total')
    return record
  }

  async getActiveJail(characterId: string): Promise<AtcJailRecord | null> {
    return this.jail.findActiveForCharacter(characterId)
  }

  // ── Evidence ──────────────────────────────────────────────────────────────────

  async collectEvidence(params: CollectEvidenceParams): Promise<AtcEvidenceRecord> {
    const record = await this.evidence.collect(params)
    this.eventBus?.emit(LAW_EVENTS.EVIDENCE_COLLECTED, { evidence: record })
    this.telemetry?.increment('law.evidence_collected_total')
    return record
  }

  async transferEvidenceCustody(
    evidenceId: string,
    toPrincipalId: string,
    notes?: string | null,
  ): Promise<AtcEvidenceRecord> {
    return this.evidence.transferCustody(evidenceId, toPrincipalId, notes)
  }

  // ── Legal Cases ───────────────────────────────────────────────────────────────

  async createCase(params: CreateLegalCaseParams): Promise<AtcLegalCase> {
    const legalCase = await this.cases.create(params)
    this.eventBus?.emit(LAW_EVENTS.CASE_CREATED, { case: legalCase })
    this.telemetry?.increment('law.cases_created_total')
    return legalCase
  }

  async closeCase(id: string): Promise<AtcLegalCase> {
    return this.cases.close(id)
  }

  async archiveCase(id: string): Promise<AtcLegalCase> {
    return this.cases.archive(id)
  }
}
