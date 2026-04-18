export interface CategoryDTO {
  name: string | null;
  updateDate: string | null;
  createIp: string | null;
  updateIp: string | null;
  uniqueKeyId: string | null;
  isActive: boolean | null;
}

export interface MeasurementDto {
  uniqueKeyID: string | null;
  name: string | null;
  updateDate: string | null;
  createIp: string | null;
  updateIp: string | null;
  isActive: boolean | null;
}

export interface ProductDTO {
  uniqueKeyID: string | null;
  productName: string | null;
  measurement: string | null;
  hsnSacNumber: string | null;
  categoryCode: string | null;
  totalGstRate: number | null;
  cgstRate: number | null;
  scgstRate: number | null;
  rateWithoutTax: number | null;
  rateWithTax: number | null;
  createIp: string | null;
  updateIp: string | null;
  remark: string | null;
  isActive: boolean | null;
}

export interface InvoiceCreateDTO {
  invoiceNumber?: string | null;
  invoiceYear: string | null;
  displayInvNumber: string | null;
  invoiceDate: string;
  companyId: string | null;
  customerId: string | null;
  destination: string | null;
  dispatchedThrough: string | null;
  deliveryNote: string | null;
  remark: string | null;
  totalAmount: number | null;
  grandTotalAmount: number | null;
  cgstRate: number | null;
  sgstRate: number | null;
  cgstAmount: number | null;
  sgstAmount: number | null;
  totalGstAmount: number | null;
  createBy: string | null;
  updateBy: string | null;
  createDate: string | null;
  updateDate: string | null;
  createIp: string | null;
  updateIp: string | null;
  products: InvoiceItemCreateDTO[] | null;
}

export interface InvoiceItemCreateDTO {
  invoiceNumber: string | null;
  invoiceYear: string | null;
  productId: string | null;
  productName: string | null;
  quantity: number | null;
  rateWithoutTax: number | null;
  rateWithTax: number | null;
  amount: number | null;
  createBy: string | null;
  updateBy: string | null;
  createDate: string | null;
  updateDate: string | null;
  createIp: string | null;
  updateIp: string | null;
}

export interface InvoiceFlatDto {
  coName: string | null;
  coAddr: string | null;
  coGST: string | null;
  cntryCode: string | null;
  cntryName: string | null;
  stCode: string | null;
  stName: string | null;
  accNum: string | null;
  ifsc: string | null;
  accAddr: string | null;
  coEmail: string | null;
  coMob: string | null;
  coAltMob: string | null;
  coStatus: string | null;
  cuName: string | null;
  cuEmail: string | null;
  cuPhone: string | null;
  cuStatus: boolean;
  cuAddr: string | null;
  cuCntryCode: string | null;
  cuCntryName: string | null;
  cuStCode: string | null;
  cuStName: string | null;
  cuMob: string | null;
  cuAltMob: string | null;
  invYear: string | null;
  invNum: string | null;
  invDate: string | null;
  coID: string | null;
  cuID: string | null;
  dest: string | null;
  dispThrough: string | null;
  delNote: string | null;
  remark: string | null;
  totalAmt: number | null;
}

export interface SalesProductDTO {
  recId: number;
  invoiceNumber: string | null;
  productId: string | null;
  productName: string | null;
  quantity: number | null;
  rateWithTax: number | null;
  amount: number | null;
  createDate: string | null;
  updateDate: string | null;
  createIp: string | null;
  updateIp: string | null;
  updateBy: string | null;
  createBy: string | null;
  measurement: string | null;
  hsnSacNumber: string | null;
  categoryCode: string | null;
  categoryName: string | null;
  totalGstRate: number | null;
  cgstRate: number | null;
  scgstRate: number | null;
}