import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'
import { requireCapability } from '../middleware/authorization.js'
import {
  createFinancialAccountSchema,
  updateFinancialAccountSchema,
  transferSchema,
  commitJournalSchema,
  reverseJournalSchema,
  createOrganizationSchema,
  addMemberSchema,
  issueInvoiceSchema,
  payInvoiceSchema,
  listJournalsQuerySchema,
  listAccountsQuerySchema,
  listInvoicesQuerySchema,
} from '@atc/operations'
import {
  LedgerError,
  LedgerImbalanceError,
  LedgerInsufficientFundsError,
  LedgerAccountFrozenError,
  LedgerAccountNotFoundError,
  LedgerJournalNotFoundError,
  LedgerReversalError,
  LedgerValidationError,
  LedgerCurrencyMismatchError,
} from '@atc/ledger'
import { ATC_ECONOMY_EVENTS } from '@atc/shared-types'

function ledgerErrorToResponse(err: LedgerError): { status: number; error: string; message: string } {
  if (err instanceof LedgerValidationError) {
    return { status: 400, error: 'LedgerValidation', message: err.message }
  }
  if (err instanceof LedgerImbalanceError) {
    return { status: 400, error: 'LedgerImbalance', message: err.message }
  }
  if (err instanceof LedgerCurrencyMismatchError) {
    return { status: 400, error: 'CurrencyMismatch', message: err.message }
  }
  if (err instanceof LedgerInsufficientFundsError) {
    return { status: 422, error: 'InsufficientFunds', message: err.message }
  }
  if (err instanceof LedgerAccountFrozenError) {
    return { status: 422, error: 'AccountFrozen', message: err.message }
  }
  if (err instanceof LedgerAccountNotFoundError) {
    return { status: 404, error: 'AccountNotFound', message: err.message }
  }
  if (err instanceof LedgerJournalNotFoundError) {
    return { status: 404, error: 'JournalNotFound', message: err.message }
  }
  if (err instanceof LedgerReversalError) {
    return { status: 422, error: 'ReversalError', message: err.message }
  }
  return { status: 500, error: 'LedgerError', message: err.message }
}

export async function economyRoutes(
  fastify: FastifyInstance,
  opts: { ctx: AppContext },
) {
  const { ctx } = opts

  // ── Financial Accounts ───────────────────────────────────────────────────────

  fastify.post('/api/v1/economy/accounts', {
    preHandler: requireCapability(ctx, 'economy.write'),
  }, async (req, reply) => {
    if (!ctx.financialAccounts) {
      return reply.code(503).send({ error: 'Economy not configured' })
    }
    const result = createFinancialAccountSchema.safeParse(req.body)
    if (!result.success) {
      return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    }
    const account = await ctx.financialAccounts.create(result.data)
    return reply.code(201).send(account)
  })

  fastify.get('/api/v1/economy/accounts', {
    preHandler: requireCapability(ctx, 'economy.read'),
  }, async (req, reply) => {
    if (!ctx.financialAccounts) {
      return reply.code(503).send({ error: 'Economy not configured' })
    }
    const result = listAccountsQuerySchema.safeParse(req.query)
    if (!result.success) {
      return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    }
    const page = await ctx.financialAccounts.list(result.data)
    return reply.code(200).send(page)
  })

  fastify.get('/api/v1/economy/accounts/:id', {
    preHandler: requireCapability(ctx, 'economy.read'),
  }, async (req, reply) => {
    if (!ctx.financialAccounts) {
      return reply.code(503).send({ error: 'Economy not configured' })
    }
    const { id } = req.params as { id: string }
    const account = await ctx.financialAccounts.findById(id)
    if (!account) return reply.code(404).send({ error: 'Account not found' })
    return reply.code(200).send(account)
  })

  fastify.patch('/api/v1/economy/accounts/:id', {
    preHandler: requireCapability(ctx, 'economy.write'),
  }, async (req, reply) => {
    if (!ctx.financialAccounts) {
      return reply.code(503).send({ error: 'Economy not configured' })
    }
    const { id } = req.params as { id: string }
    const result = updateFinancialAccountSchema.safeParse(req.body)
    if (!result.success) {
      return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    }
    const account = await ctx.financialAccounts.updateStatus(id, result.data.status)
    if (!account) return reply.code(404).send({ error: 'Account not found' })
    if (result.data.status === 'frozen') {
      void ctx.eventBus.emit(ATC_ECONOMY_EVENTS.ACCOUNT_FROZEN, { accountId: id })
    }
    return reply.code(200).send(account)
  })

  // ── Transfers & Journals ─────────────────────────────────────────────────────

  fastify.post('/api/v1/economy/transfer', {
    preHandler: requireCapability(ctx, 'economy.write'),
  }, async (req, reply) => {
    if (!ctx.ledger) {
      return reply.code(503).send({ error: 'Economy not configured' })
    }
    const result = transferSchema.safeParse(req.body)
    if (!result.success) {
      return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    }
    try {
      const journal = await ctx.ledger.transfer(result.data)
      void ctx.eventBus.emit(ATC_ECONOMY_EVENTS.TRANSFER_COMPLETED, {
        journalId: journal.id,
        fromAccountId: result.data.fromAccountId,
        toAccountId: result.data.toAccountId,
        amount: result.data.amount,
        currency: result.data.currency,
      })
      return reply.code(201).send(journal)
    } catch (err) {
      if (err instanceof LedgerError) {
        const r = ledgerErrorToResponse(err)
        return reply.code(r.status).send({ error: r.error, message: r.message })
      }
      throw err
    }
  })

  fastify.post('/api/v1/economy/journals', {
    preHandler: requireCapability(ctx, 'economy.write'),
  }, async (req, reply) => {
    if (!ctx.ledger) {
      return reply.code(503).send({ error: 'Economy not configured' })
    }
    const result = commitJournalSchema.safeParse(req.body)
    if (!result.success) {
      return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    }
    try {
      const journal = await ctx.ledger.commit(result.data)
      return reply.code(201).send(journal)
    } catch (err) {
      if (err instanceof LedgerError) {
        const r = ledgerErrorToResponse(err)
        return reply.code(r.status).send({ error: r.error, message: r.message })
      }
      throw err
    }
  })

  fastify.get('/api/v1/economy/journals', {
    preHandler: requireCapability(ctx, 'economy.read'),
  }, async (req, reply) => {
    if (!ctx.ledger) {
      return reply.code(503).send({ error: 'Economy not configured' })
    }
    const result = listJournalsQuerySchema.safeParse(req.query)
    if (!result.success) {
      return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    }
    const page = await ctx.ledger.listJournals(result.data)
    return reply.code(200).send(page)
  })

  fastify.get('/api/v1/economy/journals/:id', {
    preHandler: requireCapability(ctx, 'economy.read'),
  }, async (req, reply) => {
    if (!ctx.ledger) {
      return reply.code(503).send({ error: 'Economy not configured' })
    }
    const { id } = req.params as { id: string }
    const journal = await ctx.ledger.getJournal(id)
    if (!journal) return reply.code(404).send({ error: 'Journal not found' })
    return reply.code(200).send(journal)
  })

  fastify.post('/api/v1/economy/journals/:id/reverse', {
    preHandler: requireCapability(ctx, 'economy.write'),
  }, async (req, reply) => {
    if (!ctx.ledger) {
      return reply.code(503).send({ error: 'Economy not configured' })
    }
    const { id } = req.params as { id: string }
    const result = reverseJournalSchema.safeParse(req.body)
    if (!result.success) {
      return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    }
    try {
      const reversal = await ctx.ledger.reverse(id, result.data.idempotencyKey)
      return reply.code(201).send(reversal)
    } catch (err) {
      if (err instanceof LedgerError) {
        const r = ledgerErrorToResponse(err)
        return reply.code(r.status).send({ error: r.error, message: r.message })
      }
      throw err
    }
  })

  // ── Organizations ────────────────────────────────────────────────────────────

  fastify.post('/api/v1/economy/organizations', {
    preHandler: requireCapability(ctx, 'organization.manage'),
  }, async (req, reply) => {
    if (!ctx.organizations) {
      return reply.code(503).send({ error: 'Economy not configured' })
    }
    const result = createOrganizationSchema.safeParse(req.body)
    if (!result.success) {
      return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    }
    const org = await ctx.organizations.create(result.data)
    void ctx.eventBus.emit(ATC_ECONOMY_EVENTS.ORGANIZATION_CREATED, { organizationId: org.id, name: org.name })
    return reply.code(201).send(org)
  })

  fastify.get('/api/v1/economy/organizations/:id', {
    preHandler: requireCapability(ctx, 'economy.read'),
  }, async (req, reply) => {
    if (!ctx.organizations) {
      return reply.code(503).send({ error: 'Economy not configured' })
    }
    const { id } = req.params as { id: string }
    const org = await ctx.organizations.findById(id)
    if (!org) return reply.code(404).send({ error: 'Organization not found' })
    return reply.code(200).send(org)
  })

  fastify.post('/api/v1/economy/organizations/:id/members', {
    preHandler: requireCapability(ctx, 'organization.manage'),
  }, async (req, reply) => {
    if (!ctx.members) {
      return reply.code(503).send({ error: 'Economy not configured' })
    }
    const { id } = req.params as { id: string }
    const result = addMemberSchema.safeParse(req.body)
    if (!result.success) {
      return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    }
    const addParams: import('@atc/organization').AddMemberParams = {
      organizationId: id,
      characterId: result.data.characterId,
      role: result.data.role,
    }
    if (result.data.expiresAt !== undefined) addParams.expiresAt = new Date(result.data.expiresAt)
    const member = await ctx.members.add(addParams)
    return reply.code(201).send(member)
  })

  fastify.delete('/api/v1/economy/organizations/:id/members/:characterId', {
    preHandler: requireCapability(ctx, 'organization.manage'),
  }, async (req, reply) => {
    if (!ctx.members) {
      return reply.code(503).send({ error: 'Economy not configured' })
    }
    const { id, characterId } = req.params as { id: string; characterId: string }
    const removed = await ctx.members.remove(id, characterId)
    if (!removed) return reply.code(404).send({ error: 'Member not found' })
    return reply.code(204).send()
  })

  // ── Invoices ─────────────────────────────────────────────────────────────────

  fastify.post('/api/v1/economy/invoices', {
    preHandler: requireCapability(ctx, 'invoice.issue'),
  }, async (req, reply) => {
    if (!ctx.invoices) {
      return reply.code(503).send({ error: 'Economy not configured' })
    }
    const result = issueInvoiceSchema.safeParse(req.body)
    if (!result.success) {
      return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    }
    const dueAt = result.data.dueAt ? new Date(result.data.dueAt) : undefined
    const invoice = await ctx.invoices.create({ ...result.data, dueAt })
    void ctx.eventBus.emit(ATC_ECONOMY_EVENTS.INVOICE_ISSUED, {
      invoiceId: invoice.id,
      issuerId: invoice.issuerId,
      recipientId: invoice.recipientId,
      amount: invoice.amount,
      currency: invoice.currency,
    })
    return reply.code(201).send(invoice)
  })

  fastify.get('/api/v1/economy/invoices', {
    preHandler: requireCapability(ctx, 'economy.read'),
  }, async (req, reply) => {
    if (!ctx.invoices) {
      return reply.code(503).send({ error: 'Economy not configured' })
    }
    const result = listInvoicesQuerySchema.safeParse(req.query)
    if (!result.success) {
      return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    }
    const page = await ctx.invoices.list(result.data)
    return reply.code(200).send(page)
  })

  fastify.post('/api/v1/economy/invoices/:id/pay', {
    preHandler: requireCapability(ctx, 'invoice.pay'),
  }, async (req, reply) => {
    if (!ctx.invoices || !ctx.ledger) {
      return reply.code(503).send({ error: 'Economy not configured' })
    }
    const { id } = req.params as { id: string }
    const result = payInvoiceSchema.safeParse(req.body)
    if (!result.success) {
      return reply.code(400).send({ error: 'Validation error', issues: result.error.issues })
    }

    const invoice = await ctx.invoices.findById(id)
    if (!invoice) return reply.code(404).send({ error: 'Invoice not found' })
    if (invoice.status !== 'issued') {
      return reply.code(409).send({ error: 'InvoiceNotPayable', message: `Invoice status is '${invoice.status}'` })
    }

    // Canonical idempotency key — prevents race condition where two concurrent
    // requests with different caller-provided keys could both succeed.
    const idempotencyKey = `invoice-payment:${id}`

    try {
      const journal = await ctx.ledger.transfer({
        fromAccountId: result.data.fromAccountId,
        toAccountId: result.data.toAccountId,
        amount: invoice.amount,
        currency: invoice.currency,
        idempotencyKey,
        description: `Payment for invoice ${id}`,
        source: 'api',
        referenceId: id,
        referenceType: 'invoice',
      })

      const paid = await ctx.invoices.markPaid(id, journal.id)
      if (!paid) {
        // Invoice was paid concurrently between our status check and markPaid
        return reply.code(409).send({ error: 'InvoiceAlreadyPaid', message: 'Invoice was already paid' })
      }

      void ctx.eventBus.emit(ATC_ECONOMY_EVENTS.INVOICE_PAID, {
        invoiceId: id,
        journalId: journal.id,
        amount: invoice.amount,
        currency: invoice.currency,
      })

      return reply.code(200).send({ invoice: paid, journal })
    } catch (err) {
      if (err instanceof LedgerError) {
        const r = ledgerErrorToResponse(err)
        return reply.code(r.status).send({ error: r.error, message: r.message })
      }
      throw err
    }
  })
}
