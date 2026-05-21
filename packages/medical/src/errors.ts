export class MedicalError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MedicalError'
  }
}

export class MedicalValidationError extends MedicalError {
  constructor(message: string) {
    super(message)
    this.name = 'MedicalValidationError'
  }
}

export class InjuryNotFoundError extends MedicalError {
  constructor(id: string) {
    super(`Injury record not found: ${id}`)
    this.name = 'InjuryNotFoundError'
  }
}

export class TraumaNotFoundError extends MedicalError {
  constructor(characterId: string) {
    super(`No trauma record for character: ${characterId}`)
    this.name = 'TraumaNotFoundError'
  }
}

export class TraumaImmutableError extends MedicalError {
  constructor(characterId: string, currentState: string, targetState: string) {
    super(`Cannot transition trauma for ${characterId} from '${currentState}' to '${targetState}'`)
    this.name = 'TraumaImmutableError'
  }
}

export class PatientDeceasedError extends MedicalError {
  constructor(characterId: string) {
    super(`Patient ${characterId} is deceased — requires ems.revive capability to proceed`)
    this.name = 'PatientDeceasedError'
  }
}

export class PatientAlreadyAliveError extends MedicalError {
  constructor(characterId: string, state: string) {
    super(`Patient ${characterId} is not deceased (current state: ${state}) — revive not applicable`)
    this.name = 'PatientAlreadyAliveError'
  }
}

export class MedicalReportNotFoundError extends MedicalError {
  constructor(id: string) {
    super(`Medical report not found: ${id}`)
    this.name = 'MedicalReportNotFoundError'
  }
}

export class MedicalReportClosedError extends MedicalError {
  constructor(id: string) {
    super(`Medical report ${id} is already closed and immutable`)
    this.name = 'MedicalReportClosedError'
  }
}

export class HospitalRecordNotFoundError extends MedicalError {
  constructor(id: string) {
    super(`Hospital record not found: ${id}`)
    this.name = 'HospitalRecordNotFoundError'
  }
}

export class HospitalAlreadyAdmittedError extends MedicalError {
  constructor(characterId: string) {
    super(`Character ${characterId} is already admitted to hospital`)
    this.name = 'HospitalAlreadyAdmittedError'
  }
}

export class HospitalImmutableError extends MedicalError {
  constructor(id: string, status: string) {
    super(`Hospital record ${id} cannot transition — current status: ${status}`)
    this.name = 'HospitalImmutableError'
  }
}
