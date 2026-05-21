export type AtcBankAccountType = 'personal' | 'business' | 'government' | 'escrow'

export type AtcBankTransactionType =
  | 'transfer'
  | 'deposit'
  | 'withdrawal'
  | 'tax'
  | 'refund'
  | 'auction_payment'
  | 'marketplace_payment'
  | 'escrow_in'
  | 'escrow_out'

export type AtcBankTransactionStatus = 'pending' | 'completed' | 'failed' | 'reversed'

export type AtcMarketListingStatus = 'active' | 'sold' | 'cancelled' | 'expired'

export type AtcAuctionStatus = 'active' | 'completed' | 'cancelled' | 'no_sale'

export type AtcTaxType = 'income' | 'property' | 'transaction' | 'import' | 'fine'

export type AtcTaxStatus = 'pending' | 'collected' | 'waived' | 'disputed'

export type AtcFinancialFlagType =
  | 'suspicious_transfer'
  | 'velocity_breach'
  | 'structuring'
  | 'large_withdrawal'
  | 'unusual_pattern'
  | 'manual_review'

export type AtcFinancialFlagSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface AtcBankAccount {
  id: string
  principalId: string
  accountType: AtcBankAccountType
  balance: bigint
  isFrozen: boolean
  frozenAt: Date | null
  frozenByPrincipalId: string | null
  freezeReason: string | null
  createdAt: Date
  updatedAt: Date
}

export interface AtcBankTransaction {
  id: string
  fromAccountId: string | null
  toAccountId: string | null
  transactionType: AtcBankTransactionType
  amount: bigint
  idempotencyKey: string
  description: string | null
  metadata: Record<string, unknown> | null
  status: AtcBankTransactionStatus
  completedAt: Date | null
  failedAt: Date | null
  createdAt: Date
}

export interface AtcMarketListing {
  id: string
  sellerPrincipalId: string
  itemName: string
  itemCategory: string | null
  quantity: number
  pricePerUnit: bigint
  totalPrice: bigint
  description: string | null
  status: AtcMarketListingStatus
  listingNonce: string
  buyerPrincipalId: string | null
  soldAt: Date | null
  expiresAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface AtcMarketAuction {
  id: string
  sellerPrincipalId: string
  itemName: string
  itemCategory: string | null
  quantity: number
  startingBid: bigint
  minimumBidIncrement: bigint
  currentBid: bigint
  currentBidderPrincipalId: string | null
  reservePrice: bigint | null
  status: AtcAuctionStatus
  auctionNonce: string
  endsAt: Date
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface AtcTaxRecord {
  id: string
  principalId: string
  taxType: AtcTaxType
  amount: bigint
  sourceTransactionId: string | null
  periodLabel: string | null
  status: AtcTaxStatus
  collectedAt: Date | null
  createdAt: Date
}

export interface AtcFinancialFlag {
  id: string
  principalId: string
  flagType: AtcFinancialFlagType
  severity: AtcFinancialFlagSeverity
  amountInvolved: bigint | null
  transactionId: string | null
  description: string
  isResolved: boolean
  resolvedAt: Date | null
  resolvedByPrincipalId: string | null
  createdAt: Date
}

export const ATC_MARKET_EVENTS = {
  BANK_TRANSFER_COMPLETED:  'atc:market:bank:transfer:completed',
  ACCOUNT_FROZEN:           'atc:market:bank:account:frozen',
  ACCOUNT_UNFROZEN:         'atc:market:bank:account:unfrozen',
  LISTING_CREATED:          'atc:market:listing:created',
  LISTING_SOLD:             'atc:market:listing:sold',
  LISTING_CANCELLED:        'atc:market:listing:cancelled',
  AUCTION_CREATED:          'atc:market:auction:created',
  AUCTION_COMPLETED:        'atc:market:auction:completed',
  AUCTION_CANCELLED:        'atc:market:auction:cancelled',
  TAX_COLLECTED:            'atc:market:tax:collected',
  FINANCIAL_FLAG_RAISED:    'atc:market:fraud:flag:raised',
} as const

export type AtcMarketEventName = typeof ATC_MARKET_EVENTS[keyof typeof ATC_MARKET_EVENTS]
