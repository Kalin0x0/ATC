// ── Pool ──────────────────────────────────────────────────────────────────────
export type { LawPool } from './pool.js'

// ── Errors ────────────────────────────────────────────────────────────────────
export {
  LawError,
  LawValidationError,
  LawMisconfiguredError,
  AgencyNotFoundError,
  AgencySlugConflictError,
  WarrantNotFoundError,
  WarrantImmutableError,
  CitationNotFoundError,
  CitationAlreadyPaidError,
  CitationImmutableError,
  ArrestNotFoundError,
  JailRecordNotFoundError,
  JailAlreadyActiveError,
  EvidenceNotFoundError,
  LegalCaseNotFoundError,
} from './errors.js'

// ── Repositories ──────────────────────────────────────────────────────────────
export { AgencyRepository } from './agency.repository.js'
export type { CreateAgencyParams, ListAgenciesParams, AgencyPage } from './agency.repository.js'

export { WarrantRepository } from './warrant.repository.js'
export type {
  CreateWarrantParams,
  ListWarrantsParams,
  WarrantPage,
} from './warrant.repository.js'

export { CitationRepository } from './citation.repository.js'
export type {
  CreateCitationParams,
  ListCitationsParams,
  CitationPage,
} from './citation.repository.js'

export { ArrestRepository } from './arrest.repository.js'
export type {
  CreateArrestParams,
  ListArrestsParams,
  ArrestPage,
} from './arrest.repository.js'

export { JailRepository } from './jail.repository.js'
export type { EnterJailParams } from './jail.repository.js'

export { EvidenceRepository } from './evidence.repository.js'
export type {
  CollectEvidenceParams,
  ListEvidenceParams,
  EvidencePage,
} from './evidence.repository.js'

export { LegalCaseRepository } from './legal-case.repository.js'
export type {
  CreateLegalCaseParams,
  ListLegalCasesParams,
  LegalCasePage,
} from './legal-case.repository.js'

// ── Service ───────────────────────────────────────────────────────────────────
export { LawEnforcementService } from './law-enforcement.service.js'
export type {
  PayCitationParams,
  LawEnforcementServiceOptions,
} from './law-enforcement.service.js'

// ── SDK ───────────────────────────────────────────────────────────────────────
export { AtcLawSDK } from './sdk.js'
export type { AtcLawSDKOptions } from './sdk.js'
