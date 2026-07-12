import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { QuickInvoice, QuickInvoiceApiResponse } from '../_model/quick-invoice.model';

@Injectable({
  providedIn: 'root'
})
export class QuickInvoiceService {
  private baseUrl = environment.apiUrl.endsWith('/')
    ? environment.apiUrl
    : environment.apiUrl + '/';

  constructor(private http: HttpClient) {}

  private handleError(error: any): Observable<never> {
    console.error('API Error:', error);
    const message =
      error?.message ||
      error?.error?.message ||
      'An unexpected error occurred';
    return throwError(() => new Error(message));
  }

  getAllInvoices(companyId?: string): Observable<QuickInvoice[]> {
    let url = `${this.baseUrl}QuickInvoice/GetAll`;
    if (companyId) url += '?companyId=' + encodeURIComponent(companyId);
    return this.http
      .get<QuickInvoiceApiResponse>(url)
      .pipe(
        map(res => {
          if (Array.isArray(res?.data)) {
            return res.data;
          }
          if (Array.isArray(res)) {
            return res;
          }
          return [];
        }),
        catchError(err => this.handleError(err))
      );
  }

  getInvoiceById(id: string, companyId?: string): Observable<QuickInvoice> {
    let url = `${this.baseUrl}QuickInvoice?id=${encodeURIComponent(id)}`;
    if (companyId) url += '&companyId=' + encodeURIComponent(companyId);
    return this.http
      .get<QuickInvoiceApiResponse>(url)
      .pipe(
        map(res => {
          if (res?.data) {
            return res.data;
          }
          throw new Error('Invoice not found');
        }),
        catchError(err => this.handleError(err))
      );
  }

  createInvoice(invoice: QuickInvoice, companyId?: string): Observable<QuickInvoiceApiResponse> {
    let url = `${this.baseUrl}QuickInvoice/Create`;
    if (companyId) url += '?companyId=' + encodeURIComponent(companyId);
    return this.http
      .post<QuickInvoiceApiResponse>(url, invoice)
      .pipe(catchError(err => this.handleError(err)));
  }

  updateInvoice(invoice: QuickInvoice, companyId?: string): Observable<QuickInvoiceApiResponse> {
    let url = `${this.baseUrl}QuickInvoice/Update`;
    if (companyId) url += '?companyId=' + encodeURIComponent(companyId);
    return this.http
      .put<QuickInvoiceApiResponse>(url, invoice)
      .pipe(catchError(err => this.handleError(err)));
  }

  deleteInvoice(id: string, companyId?: string): Observable<QuickInvoiceApiResponse> {
    let url = `${this.baseUrl}QuickInvoice/${encodeURIComponent(id)}`;
    if (companyId) url += '?companyId=' + encodeURIComponent(companyId);
    return this.http
      .delete<QuickInvoiceApiResponse>(url)
      .pipe(catchError(err => this.handleError(err)));
  }
}