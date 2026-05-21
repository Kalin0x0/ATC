import type { AtcEventBus } from '@atc/events'
import type { FinancialFlagRepository } from './financial-flag.repository.js'
import type {
  AtcFinancialFlag,
  AtcFinancialFlagType,
  AtcFinancialFlagSeverity,
} from './financial-flag.repository.js'
import { FinancialFlagNotFoundError } from './errors.js'

export class FinancialFraudService {
  constructor(
    private readonly flagRepo: FinancialFlagRepository,
    private readonly eventBus: AtcEventBus,
  ) {}

  async flagTransaction(
    principalId: string,
    flagType: AtcFinancialFlagType,
    severity: AtcFinancialFlagSeverity,
    description: string,
    amountInvolved?: bigint | null | undefined,
    transactionId?: string | null | undefined,
  ): Promise<AtcFinancialFlag> {
    return this.flagRepo.flag({
      principalId,
      flagType,
      severity,
      description,
      amountInvolved: amountInvolved ?? null,
      transactionId: transactionId ?? null,
    })
  }

  async resolveFlag(
    flagId: string,
    resolvedByPrincipalId: string,
  ): Promise<void> {
    const flag = await this.flagRepo.findById(flagId)
    if (!flag) throw new FinancialFlagNotFoundError(flagId)
    await this.flagRepo.resolve(flagId, resolvedByPrincipalId)
  }

  async getOpenFlags(principalId: string): Promise<AtcFinancialFlag[]> {
    return this.flagRepo.listUnresolvedByPrincipal(principalId)
  }

  async autoCheckTransfer(
    principalId: string,
    amount: bigint,
    transactionId: string,
  ): Promise<void> {
    if (amount > 1_000_000n) {
      await this.flagRepo
        .flag({
          principalId,
          flagType: 'large_withdrawal',
          severity: 'high',
          description: `Large transfer of ${amount} cents detected`,
          amountInvolved: amount,
          transactionId,
        })
        .catch(() => undefined)
    }
  }
}
