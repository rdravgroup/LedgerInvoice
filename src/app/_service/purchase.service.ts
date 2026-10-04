import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  Vendor,
  VendorList,
  PurchaseLedgerEntry,
  PurchaseOrder,
  PurchaseInvoice,
  PurchasePayment,
  PurchaseReturn,
  PurchaseRegisterRow,
  VendorOutstanding,
  StockSummary
} from '../_model/purchase.model';

export interface ApiResponse<T = any> {
  result: string;
  errorMessage: string;
  data: T;
}

export interface PurchasePaymentAllocation {
  piNumber: string;
  amount: number;
}

export interface PurchaseReportEmailRequest {
  companyId: string;
  reportName: string;
  pdfBase64: string;
}

export interface PurchaseReportEmailResponse {
  result: string;
  message?: string;
  errorMessage?: string;
}

@Injectable({ providedIn: 'root' })
export class PurchaseService {
  private base = environment.apiUrl + 'Purchase/';

  constructor(private http: HttpClient) {}

  // ── Vendor ───────────────────────────────────────────────────────────────
  getVendors(companyId: string, filter?: string, activeOnly = true): Observable<ApiResponse<VendorList[]>> {
    let params = new HttpParams()
      .set('companyId', companyId)
      .set('activeOnly', String(activeOnly));
    if (filter) params = params.set('filter', filter);
    return this.http.get<ApiResponse<VendorList[]>>(this.base + 'vendors', { params });
  }

  getVendorById(vendorId: string, companyId: string): Observable<ApiResponse<Vendor>> {
    return this.http.get<ApiResponse<Vendor>>(
      `${this.base}vendors/${encodeURIComponent(vendorId)}`,
      { params: new HttpParams().set('companyId', companyId) }
    );
  }

  createVendor(dto: Vendor): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(this.base + 'vendors', dto);
  }

  updateVendor(dto: Vendor): Observable<ApiResponse> {
    return this.http.put<ApiResponse>(this.base + 'vendors', dto);
  }

  deleteVendor(vendorId: string, companyId: string): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(
      `${this.base}vendors/${encodeURIComponent(vendorId)}`,
      { params: new HttpParams().set('companyId', companyId) }
    );
  }

  getVendorLedger(vendorId: string, companyId: string): Observable<ApiResponse<PurchaseLedgerEntry[]>> {
    return this.http.get<ApiResponse<PurchaseLedgerEntry[]>>(
      `${this.base}vendors/${encodeURIComponent(vendorId)}/ledger`,
      { params: new HttpParams().set('companyId', companyId) }
    );
  }

  // ── Purchase Orders ────────────────────────────────────────────────────
  getOrders(companyId: string, status?: string): Observable<ApiResponse<PurchaseOrder[]>> {
    let params = new HttpParams().set('companyId', companyId);
    if (status) params = params.set('status', status);
    return this.http.get<ApiResponse<PurchaseOrder[]>>(`${this.base}orders`, { params });
  }

  saveOrder(dto: PurchaseOrder, companyId: string): Observable<ApiResponse> {
    const params = new HttpParams().set('companyId', companyId);
    return this.http.post<ApiResponse>(`${this.base}orders`, dto, { params });
  }

  approveOrder(poNumber: string): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.base}orders/${encodeURIComponent(poNumber)}/approve`, {});
  }

  cancelOrder(poNumber: string): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.base}orders/${encodeURIComponent(poNumber)}/cancel`, {});
  }

  // ── Purchase Invoices ─────────────────────────────────────────────────
  getInvoices(companyId: string, status?: string, vendorId?: string): Observable<ApiResponse<PurchaseInvoice[]>> {
    let params = new HttpParams().set('companyId', companyId);
    if (status) params = params.set('status', status);
    if (vendorId) params = params.set('vendorId', vendorId);
    return this.http.get<ApiResponse<PurchaseInvoice[]>>(`${this.base}invoices`, { params });
  }

  getInvoiceById(piNumber: string, companyId: string): Observable<ApiResponse<PurchaseInvoice>> {
    const params = new HttpParams().set('companyId', companyId);
    return this.http.get<ApiResponse<PurchaseInvoice>>(
      `${this.base}invoices/${encodeURIComponent(piNumber)}`,
      { params }
    );
  }

  saveInvoice(dto: PurchaseInvoice, companyId: string): Observable<ApiResponse> {
    const params = new HttpParams().set('companyId', companyId);
    return this.http.post<ApiResponse>(`${this.base}invoices`, dto, { params });
  }

  updateInvoice(dto: PurchaseInvoice): Observable<ApiResponse> {
    return this.http.put<ApiResponse>(`${this.base}invoices`, dto);
  }

  cancelInvoice(piNumber: string): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.base}invoices/${encodeURIComponent(piNumber)}/cancel`, {});
  }

  // ── Purchase Payments ────────────────────────────────────────────────
  getPayments(companyId: string): Observable<ApiResponse<PurchasePayment[]>> {
    const params = new HttpParams().set('companyId', companyId);
    return this.http.get<ApiResponse<PurchasePayment[]>>(`${this.base}payments`, { params });
  }

  recordPayment(dto: PurchasePayment, companyId: string): Observable<ApiResponse> {
    const params = new HttpParams().set('companyId', companyId);
    return this.http.post<ApiResponse>(`${this.base}payments`, dto, { params });
  }

  allocateAdvancePayment(
    paymentId: number,
    companyId: string,
    allocations: PurchasePaymentAllocation[]
  ): Observable<ApiResponse> {
    const params = new HttpParams().set('companyId', companyId);
    return this.http.post<ApiResponse>(
      `${this.base}payments/${encodeURIComponent(String(paymentId))}/allocations`,
      { allocations },
      { params }
    );
  }

  deletePayment(paymentId: number, companyId: string): Observable<ApiResponse> {
    const params = new HttpParams().set('companyId', companyId);
    return this.http.delete<ApiResponse>(
      `${this.base}payments/${encodeURIComponent(String(paymentId))}`,
      { params }
    );
  }

  // ── Purchase Returns ─────────────────────────────────────────────────
  getReturns(companyId: string): Observable<ApiResponse<PurchaseReturn[]>> {
    const params = new HttpParams().set('companyId', companyId);
    return this.http.get<ApiResponse<PurchaseReturn[]>>(`${this.base}returns`, { params });
  }

  saveReturn(dto: PurchaseReturn, companyId: string): Observable<ApiResponse> {
    const params = new HttpParams().set('companyId', companyId);
    return this.http.post<ApiResponse>(`${this.base}returns`, dto, { params });
  }

  approveReturn(returnNo: string, companyId: string): Observable<ApiResponse> {
    const params = new HttpParams().set('companyId', companyId);
    return this.http.post<ApiResponse>(`${this.base}returns/${encodeURIComponent(returnNo)}/approve`, {}, { params });
  }

  deletePendingReturn(returnNo: string, companyId: string): Observable<ApiResponse> {
    const params = new HttpParams().set('companyId', companyId);
    return this.http.delete<ApiResponse>(`${this.base}returns/${encodeURIComponent(returnNo)}`, { params });
  }

  cancelApprovedReturn(returnNo: string, companyId: string): Observable<ApiResponse> {
    const params = new HttpParams().set('companyId', companyId);
    return this.http.post<ApiResponse>(
      `${this.base}returns/${encodeURIComponent(returnNo)}/cancel`,
      {},
      { params }
    );
  }

  // ── Reports ──────────────────────────────────────────────────────────
  getPurchaseRegister(companyId: string, from: string, to: string): Observable<ApiResponse<PurchaseRegisterRow[]>> {
    const params = new HttpParams({ fromObject: { companyId, from, to } });
    return this.http.get<ApiResponse<PurchaseRegisterRow[]>>(`${this.base}reports/purchase-register`, { params });
  }

  getVendorOutstanding(companyId: string): Observable<ApiResponse<VendorOutstanding[]>> {
    const params = new HttpParams().set('companyId', companyId);
    return this.http.get<ApiResponse<VendorOutstanding[]>>(`${this.base}reports/vendor-outstanding`, { params });
  }

  getStockSummary(companyId: string): Observable<ApiResponse<StockSummary[]>> {
    const params = new HttpParams().set('companyId', companyId);
    return this.http.get<ApiResponse<StockSummary[]>>(`${this.base}reports/stock-summary`, { params });
  }

  emailPurchaseReport(request: PurchaseReportEmailRequest): Observable<PurchaseReportEmailResponse> {
    return this.http.post<PurchaseReportEmailResponse>(`${this.base}reports/email`, request);
  }
}
