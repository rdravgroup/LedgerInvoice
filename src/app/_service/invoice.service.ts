// src/app/_service/invoice.service.ts
// NEW service: approve, lock, sales return, and reports calls.
// Follows the same pattern as purchase.service.ts and master.service.ts.

import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

export interface SalesReturnItem {
  productId:   string;
  productName?: string;
  quantity:    number;
  rate:        number;
  gstRate:     number;
}

export interface SalesReturnRequest {
  invoiceNumber: string;
  companyId?:    string;
  returnType:    'credit' | 'refund';
  reason?:       string;
  remark?:       string;
  items:         SalesReturnItem[];
}

@Injectable({ providedIn: 'root' })
export class InvoiceService {

  private base = environment.apiUrl + 'Invoice/';

  constructor(private http: HttpClient) {}

  private handleError(err: any, op: string) {
    console.error(`[InvoiceService] ${op} failed:`, err);
    return throwError(() => err);
  }

  // ── Approve ────────────────────────────────────────────────────────────
  approveInvoice(invoiceNumber: string, companyId?: string): Observable<any> {
    const body: any = { invoiceNumber };
    if (companyId) body.companyId = companyId;
    return this.http.post(`${this.base}Approve`, body)
      .pipe(catchError(e => this.handleError(e, 'approveInvoice')));
  }

  // ── Lock ───────────────────────────────────────────────────────────────
  lockInvoice(invoiceNumber: string, reason: string, companyId?: string): Observable<any> {
    const body: any = { invoiceNumber, reason };
    if (companyId) body.companyId = companyId;
    return this.http.post(`${this.base}Lock`, body)
      .pipe(catchError(e => this.handleError(e, 'lockInvoice')));
  }

  // ── Unlock ─────────────────────────────────────────────────────────────
  unlockInvoice(invoiceNumber: string, companyId?: string): Observable<any> {
    const body: any = { invoiceNumber };
    if (companyId) body.companyId = companyId;
    return this.http.post(`${this.base}Unlock`, body)
      .pipe(catchError(e => this.handleError(e, 'unlockInvoice')));
  }

  // ── Create Sales Return ────────────────────────────────────────────────
  createReturn(req: SalesReturnRequest): Observable<any> {
    return this.http.post(`${this.base}Return/Create`, req)
      .pipe(catchError(e => this.handleError(e, 'createReturn')));
  }

  // ── Get invoice items (for return modal line population) ───────────────
  getInvoiceItems(invoiceNumber: string): Observable<any> {
    return this.http.get(
      `${environment.apiUrl}Invoice/InvoiceSalesItemController?invoiceno=${encodeURIComponent(invoiceNumber)}`
    ).pipe(catchError(e => this.handleError(e, 'getInvoiceItems')));
  }

  // ── Reports ────────────────────────────────────────────────────────────
  getSalesReport(params: {
    companyId?: string;
    customerId?: string;
    fromDate?: string;
    toDate?: string;
    reportType?: string;
  }): Observable<any> {
    let p = new HttpParams();
    if (params.companyId)  p = p.set('companyId',  params.companyId);
    if (params.customerId) p = p.set('customerId', params.customerId);
    if (params.fromDate)   p = p.set('fromDate',   params.fromDate);
    if (params.toDate)     p = p.set('toDate',     params.toDate);
    if (params.reportType) p = p.set('reportType', params.reportType);
    return this.http.get(`${this.base}Report`, { params: p })
      .pipe(catchError(e => this.handleError(e, 'getSalesReport')));
  }

  // ── CSV Export ─────────────────────────────────────────────────────────
  exportSalesCsv(params: {
    companyId?: string;
    customerId?: string;
    fromDate?: string;
    toDate?: string;
    reportType?: string;
  }): Observable<Blob> {
    let p = new HttpParams();
    if (params.companyId)  p = p.set('companyId',  params.companyId);
    if (params.customerId) p = p.set('customerId', params.customerId);
    if (params.fromDate)   p = p.set('fromDate',   params.fromDate);
    if (params.toDate)     p = p.set('toDate',     params.toDate);
    if (params.reportType) p = p.set('reportType', params.reportType);
    return this.http.get(`${this.base}Report/Export`, {
      params: p,
      responseType: 'blob'
    }).pipe(catchError(e => this.handleError(e, 'exportSalesCsv')));
  }
}
