export interface Vendor {
  vendorId?: string;
  companyId: string;
  vendorName: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  address?: string;
  city?: string;
  stateName?: string;
  stateCode?: string;
  countryName?: string;
  pincode?: string;
  gstin?: string;
  pan?: string;
  paymentTermsDays: number;
  bankName?: string;
  bankAccountNo?: string;
  bankIfsc?: string;
  openingBalance: number;
  creditLimit: number;
  rating: number;
  isActive: boolean;
  notes?: string;
  outstandingBalance?: number;
  lastTransactionDate?: string;
}

export interface VendorList {
  vendorId: string;
  companyId: string;
  vendorName: string;
  contactPerson?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  gstin?: string;
  city?: string;
  stateName?: string;
  rating: number;
  isActive: boolean;
  outstandingBalance: number;
  creditLimit: number;
}

export interface PurchaseOrderLine {
  productId: string;
  productName: string;
  hsnSac: string;
  measurement: string;
  orderedQty: number;
  receivedQty: number;
  rate: number;
  discountPct: number;
  discountAmt: number;
  taxableAmount: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
  remark: string;
}

export interface PurchaseOrder {
  poNumber?: string;
  companyId?: string;
  vendorId?: string;
  vendorName?: string;
  poDate?: string;
  expectedDate?: string;
  referenceNo?: string;
  deliveryAddress?: string;
  paymentTerms?: string;
  shippingTerms?: string;
  freightCharges: number;
  otherCharges: number;
  discountAmount: number;
  remark?: string;
  items: PurchaseOrderLine[];
  subtotal: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalGstAmount: number;
  grandTotal: number;
  status?: string;
  createDate?: string;
  approvedBy?: string;
}

export interface PurchaseInvoiceLine {
  productId: string;
  productName: string;
  hsnSac: string;
  measurement: string;
  quantity: number;
  rate: number;
  discountPct: number;
  discountAmt: number;
  taxableAmount: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
  remark: string;
}

export interface PurchaseInvoice {
  piNumber?: string;
  companyId?: string;
  vendorId?: string;
  vendorName?: string;
  vendorInvoiceNo?: string;
  poNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  supplyPlace?: string;
  freightCharges: number;
  otherCharges: number;
  discountAmount: number;
  remark?: string;
  items: PurchaseInvoiceLine[];
  subtotal: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalGstAmount: number;
  roundOff: number;
  grandTotal: number;
  amountInWords?: string;
  paidAmount: number;
  outstandingAmount: number;
  status?: string;
  payments?: PurchasePayment[];
}

export interface PurchasePayment {
  paymentId?: number;
  paymentNo?: string;
  companyId?: string;
  vendorId?: string;
  piNumber?: string;
  paymentDate?: string;
  paymentMode?: string;
  paymentType?: string;
  amount?: number;
  tdsDeducted?: number;
  netPaid?: number;
  bankRef?: string | null;
  chequeNo?: string | null;
  chequeDate?: string | null;
  bankName?: string | null;
  notes?: string;
  isReconciled?: boolean;
}

export interface PurchaseReturnItem {
  productId: string;
  productName: string;
  quantity: number;
  rate: number;
  taxableAmount: number;
  gstRate: number;
  gstAmount: number;
  totalAmount: number;
}

export interface PurchaseReturn {
  returnNo?: string;
  companyId?: string;
  vendorId?: string;
  piNumber?: string;
  returnDate?: string;
  reason?: string;
  remark?: string;
  items: PurchaseReturnItem[];
  subtotal: number;
  totalGstAmount: number;
  grandTotal: number;
  status?: string;
}

export interface PurchaseRegisterRow {
  piNumber: string;
  invoiceDate: string;
  vendorName: string;
  subtotal: number;
  totalGstAmount: number;
  grandTotal: number;
  paidAmount: number;
  outstandingAmount: number;
  status: string;
}

export interface VendorOutstanding {
  vendorId: string;
  vendorName: string;
  gstin?: string;
  totalPurchased: number;
  totalPaid: number;
  outstandingAmount: number;
  overdueAmount: number;
  overdueInvoices: number;
  oldestDueDate?: string;
}

export interface PurchaseLedgerEntry {
  ledgerId: number;
  vendorId: string;
  referenceType: string;
  referenceNumber: string;
  referenceDate: string;
  debitAmount: number;
  creditAmount: number;
  outstandingAmount: number;
  dueDate?: string;
  description?: string;
  isOverdue?: boolean;
  daysOverdue?: number;
}

export interface StockSummary {
  productId: string;
  productName?: string;
  stockQty: number;
  minStockQty: number;
  reorderLevel: number;
  lastPurchaseRate?: number;
  lastPurchaseDate?: string;
  isBelowReorder: boolean;
  isOutOfStock: boolean;
}

export const GST_RATES = [0, 5, 12, 18, 28];
export const PO_STATUSES = ['draft', 'submitted', 'approved', 'partially_received', 'received', 'cancelled'];
export const PI_STATUSES = ['pending', 'partial', 'paid', 'cancelled'];
export const PAYMENT_MODES = ['cash', 'cheque', 'bank_transfer', 'neft', 'rtgs', 'upi'];
export const PAYMENT_TYPES = ['regular', 'advance', 'adjustment'];
