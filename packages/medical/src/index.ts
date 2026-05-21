export { MedicalService } from './medical.service.js'
export type { MedicalServiceDeps, MedicalVitalsBridge } from './medical.service.js'

export { AtcMedicalSDK } from './sdk.js'

export { InjuryRepository } from './injury.repository.js'
export type { RecordInjuryParams, ListInjuriesParams, InjuryPage } from './injury.repository.js'

export { TraumaRepository } from './trauma.repository.js'
export type { UpdateTraumaParams } from './trauma.repository.js'

export { TreatmentRepository } from './treatment.repository.js'
export type { ApplyTreatmentParams } from './treatment.repository.js'

export { MedicalReportRepository } from './medical-report.repository.js'
export type { CreateMedicalReportParams, ListMedicalReportsParams, MedicalReportPage } from './medical-report.repository.js'

export { HospitalRepository } from './hospital.repository.js'
export type { AdmitToHospitalParams, UpdateHospitalStatusParams } from './hospital.repository.js'

export type { MedicalPool } from './pool.js'

export {
  MedicalError,
  MedicalValidationError,
  InjuryNotFoundError,
  TraumaNotFoundError,
  TraumaImmutableError,
  PatientDeceasedError,
  PatientAlreadyAliveError,
  MedicalReportNotFoundError,
  MedicalReportClosedError,
  HospitalRecordNotFoundError,
  HospitalAlreadyAdmittedError,
  HospitalImmutableError,
} from './errors.js'
