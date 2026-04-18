export interface QuickInvoiceItem {
  productId?: string;
  productName?: string;
  quantity: number;
  rate: number;
  total: number;
}

export interface QuickInvoice {
  quickInvoiceId?: string;
  customerId?: string;
  customerName: string;
  invoiceDate?: string;
  grandTotal: number;
  items: QuickInvoiceItem[];
  createdDate?: string;
  updatedDate?: string;
}

export interface QuickInvoiceApiResponse {
  success: boolean;
  message: string;
  data?: QuickInvoice;
  errors?: string[];
}
