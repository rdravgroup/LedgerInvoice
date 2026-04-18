// ============================================
// CUSTOMER LEDGER - Data Models
// ============================================

/**
 * API Response wrapper
 */
export interface ledgerApiResponse {
  result: string;
  errorMessage: string | null;
  message?: string;
  data?: any;
  // Optional pagination / metadata fields returned by reporting endpoints
  currentPage?: number;
  pageNumber?: number;
  pageSize?: number;
  totalPages?: number;
  totalRecords?: number;
  totalCount?: number;
}

/**
 * Company-level AR Summary
 * Used on dashboard to show total AR, DSO, collection rate
 */
export interface ledgerSummary {
  totalAR: number;
  totalDue: number;
  totalPaid: number;
  daysOutstanding: number;
  collectionRate: number;
  largestCustomer: string;
  currency: string;
}

/**
 * Ageing bucket information
 */
export interface ageingBucket {
  days: string;
  amount: number;
  percentage: number;
}

/**
 * Ageing distribution by buckets
 * Shows breakdown of AR by age (0-30, 30-60, 60-90, 90+)
 */
export interface ageDistribution {
  bucket_0_30: ageingBucket;
  bucket_30_60: ageingBucket;
  bucket_60_90: ageingBucket;
  bucket_90_plus: ageingBucket;
}

/**
 * Customer with outstanding balance
 * Used in outstanding AR list
 */
export interface customerOutstanding {
  customerId: string;
  customerName: string;
  totalInvoiced: number;
  totalPaid: number;
  balance: number;
  daysOutstanding: number;
  lastPaymentDate: string | null;
}

/**
 * Advanced filter options for Outstanding A/R report
 */
export interface outstandingArFilters {
  // Amount filters
  includeFullyPaid?: boolean;      // Include customers with 0 outstanding
  minOutstanding?: number | null;   // Minimum outstanding amount
  maxOutstanding?: number | null;   // Maximum outstanding amount
  
  // Overdue filters
  showOnlyOverdue?: boolean;        // Only show customers with overdue amounts
  ageingBucket?: string | null;     // Filter by bucket: "0-30", "31-60", "61-90", "90+"
  minDaysOverdue?: number;          // Threshold for overdue calculation
  
  // Payment history filters
  neverPaid?: boolean;              // Only customers who never made a payment
  minLastPaymentDays?: number | null; // No payment for X days
  
  // Search filters
  customerName?: string | null;     // Search by customer name (partial match)
  customerCompany?: string | null;  // Search by company name (partial match)
  
  // Sorting & Pagination
  sortBy?: string;                  // "outstanding" | "daysOverdue" | "name" | "lastPaymentDate" | "highestOutstanding"
  pageNumber?: number;              // Page number
  pageSize?: number;                // Records per page
}

/**
 * Full customer ledger with transaction history
 */
export interface customerLedger {
  customerId: string;
  customerName: string;
  totalInvoiced: number;
  totalPaid: number;
  balance: number;
  daysOutstanding: number;
  transactions: ledgerTransaction[];
}

/**
 * Single ledger transaction (invoice, payment, adjustment)
 */
export interface ledgerTransaction {
  id: string;
  invoiceNumber: string;
  date: string;
  amount: number;
  type: 'invoice' | 'payment' | 'adjustment';
  description: string;
  status: 'outstanding' | 'paid' | 'partial';
}

/**
 * Ageing snapshot for historical trending
 */
export interface ageingSummary {
  date: string;
  bucket_0_30: number;
  bucket_30_60: number;
  bucket_60_90: number;
  bucket_90_plus: number;
}

/**
 * Dispute record
 */
export interface dispute {
  id: string;
  customerId: string;
  customerName: string;
  invoiceNumber: string;
  amount: number;
  reason: string;
  status: 'open' | 'in-progress' | 'resolved';
  createdDate: string;
  notes: string[];
}

/**
 * Payment entry request
 */
export interface paymentEntryRequest {
  customerId: string;
  invoiceNumber: string;
  amountPaid: number;
  paymentDate: string;
  paymentMethod: string;
  reference: string;
}

/**
 * Backend payment request shape expected by CustomerLedger API
 */
export interface backendPaymentRequest {
  customerId: string;
  paymentAmount: number;
  receiptDate: string;
  paymentMethod: string;
  notes?: string;
  chequeNumber?: string;
  chequeBank?: string;
  chequeBranch?: string;
  chequeDate?: string;
  transactionId?: string;
  transactionDate?: string;
}

/**
 * AR analysis and trends
 */
export interface arAnalysis {
  totalAR: number;
  totalPaid: number;
  collectionRate: number;
  averageDSO: number;
  trend: arTrend[];
}

export interface arTrend {
  month: string;
  ar: number;
  collected: number;
}

/**
 * Background maintenance job status
 */
export interface maintenanceStatus {
  lastAgeingUpdateTime: string;
  lastOutstandingRefreshTime: string;
  lastSnapshotCreationTime: string;
  ageingUpdateStatus: string;
  outstandingRefreshStatus: string;
  snapshotCreationStatus: string;
}
