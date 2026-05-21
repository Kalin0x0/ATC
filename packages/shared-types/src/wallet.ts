export type AtcCurrencyCode = string
export type AtcWalletStatus = 'active' | 'frozen' | 'closed'
export type AtcMoneyAccount = 'cash' | 'bank'
export type AtcTransactionType = 'credit' | 'debit' | 'transfer'
export type AtcTransactionSource = 'system' | 'admin' | 'api' | 'gameplay'

export interface AtcWallet {
  id: string
  characterId: string
  currency: AtcCurrencyCode
  cashBalance: number
  bankBalance: number
  status: AtcWalletStatus
  createdAt: Date
  updatedAt: Date
}

export interface AtcWalletTransaction {
  id: string
  walletId: string
  characterId: string
  type: AtcTransactionType
  account: AtcMoneyAccount
  amount: number
  balanceAfter: number
  currency: AtcCurrencyCode
  reason: string
  source: AtcTransactionSource
  idempotencyKey: string
  metadata: Record<string, unknown> | null
  createdAt: Date
}

export interface AtcWalletBalanceResponse {
  characterId: string
  currency: AtcCurrencyCode
  cashBalance: number
  bankBalance: number
  status: AtcWalletStatus
}

export interface AtcWalletCreditRequest {
  account: AtcMoneyAccount
  amount: number
  currency?: AtcCurrencyCode
  reason: string
  source: AtcTransactionSource
  idempotencyKey: string
  metadata?: Record<string, unknown>
}

export interface AtcWalletDebitRequest {
  account: AtcMoneyAccount
  amount: number
  currency?: AtcCurrencyCode
  reason: string
  source: AtcTransactionSource
  idempotencyKey: string
  metadata?: Record<string, unknown>
}

export interface AtcWalletTransferRequest {
  fromAccount: AtcMoneyAccount
  toAccount: AtcMoneyAccount
  amount: number
  currency?: AtcCurrencyCode
  reason: string
  idempotencyKey: string
  metadata?: Record<string, unknown>
}

export interface AtcWalletMutationResponse {
  transactionId: string
  walletId: string
  characterId: string
  currency: AtcCurrencyCode
  cashBalance: number
  bankBalance: number
  amount: number
  type: AtcTransactionType
  account: AtcMoneyAccount
  idempotent: boolean
}

export interface AtcWalletTransactionListResponse {
  transactions: AtcWalletTransaction[]
  total: number
}
