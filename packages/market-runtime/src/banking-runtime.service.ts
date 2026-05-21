import type { AtcEventBus } from '@atc/events'
import type { MarketPool } from './pool.js'
import type { BankAccountRepository } from './bank-account.repository.js'
import type { BankTransactionRepository } from './bank-transaction.repository.js'
import type { FinancialFlagRepository } from './financial-flag.repository.js'
import type { AtcBankAccount, AtcBankAccountType } from './bank-account.repository.js'
import { BankAccountFrozenError, BankAccountNotFoundError } from './errors.js'

export class BankingRuntimeService {
  constructor(
    private readonly accountRepo: BankAccountRepository,
    private readonly transactionRepo: BankTransactionRepository,
    private readonly flagRepo: FinancialFlagRepository,
    private readonly pool: MarketPool,
    private readonly eventBus: AtcEventBus,
  ) {}

  async ensureAccount(
    principalId: string,
    accountType: AtcBankAccountType = 'personal',
  ): Promise<AtcBankAccount> {
    return this.accountRepo.create(principalId, accountType)
  }

  async getBalance(
    principalId: string,
    accountType: AtcBankAccountType = 'personal',
  ): Promise<bigint> {
    return this.accountRepo.getBalance(principalId, accountType)
  }

  async transfer(
    fromPrincipalId: string,
    toPrincipalId: string,
    amount: bigint,
    idempotencyKey: string,
    description?: string | null | undefined,
    metadata?: Record<string, unknown> | null | undefined,
  ): Promise<string> {
    if (amount <= 0n) {
      throw new Error('Transfer amount must be positive')
    }

    const [fromAccount, toAccount] = await Promise.all([
      this.accountRepo.findByPrincipal(fromPrincipalId, 'personal'),
      this.accountRepo.findByPrincipal(toPrincipalId, 'personal'),
    ])

    if (!fromAccount) throw new BankAccountNotFoundError(fromPrincipalId)
    if (!toAccount) throw new BankAccountNotFoundError(toPrincipalId)

    if (fromAccount.isFrozen) throw new BankAccountFrozenError(fromPrincipalId)
    if (toAccount.isFrozen) throw new BankAccountFrozenError(toPrincipalId)

    const conn = await this.pool.getConnection()
    let transactionId: string
    try {
      await conn.beginTransaction()

      const lowerIdFirst: [string, string] =
        fromAccount.id < toAccount.id
          ? [fromAccount.id, toAccount.id]
          : [toAccount.id, fromAccount.id]

      await conn.execute(
        'SELECT id FROM atc_bank_accounts WHERE id = ? FOR UPDATE',
        [lowerIdFirst[0]],
      )
      await conn.execute(
        'SELECT id FROM atc_bank_accounts WHERE id = ? FOR UPDATE',
        [lowerIdFirst[1]],
      )

      await this.accountRepo.debitBalance(fromAccount.id, amount, conn)
      await this.accountRepo.creditBalance(toAccount.id, amount, conn)

      const tx = await this.transactionRepo.record(
        {
          fromAccountId: fromAccount.id,
          toAccountId: toAccount.id,
          transactionType: 'transfer',
          amount,
          idempotencyKey,
          description: description ?? null,
          metadata: metadata ?? null,
        },
        conn,
      )
      transactionId = tx.id

      await this.transactionRepo.complete(transactionId, conn)

      await conn.commit()
    } catch (err) {
      try {
        await conn.rollback()
      } catch {
      }
      throw err
    } finally {
      conn.release()
    }

    if (amount > 500000n) {
      await this.flagRepo
        .flag({
          principalId: fromPrincipalId,
          flagType: 'suspicious_transfer',
          severity: 'high',
          description: `Large transfer of ${amount} cents to ${toPrincipalId}`,
          amountInvolved: amount,
          transactionId,
        })
        .catch(() => undefined)
    }

    this.eventBus
      .emit('atc:market:bank:transfer:completed', {
        transactionId,
        fromPrincipalId,
        toPrincipalId,
        amount: amount.toString(),
      })
      .catch(() => undefined)

    return transactionId
  }

  async freeze(
    principalId: string,
    frozenByPrincipalId: string,
    reason: string,
  ): Promise<void> {
    const account = await this.accountRepo.findByPrincipal(principalId, 'personal')
    if (!account) throw new BankAccountNotFoundError(principalId)
    await this.accountRepo.freeze(account.id, frozenByPrincipalId, reason)
  }

  async unfreeze(principalId: string): Promise<void> {
    const account = await this.accountRepo.findByPrincipal(principalId, 'personal')
    if (!account) throw new BankAccountNotFoundError(principalId)
    await this.accountRepo.unfreeze(account.id)
  }
}
