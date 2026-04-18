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

  getAllInvoices(): Observable<QuickInvoice[]> {
    return this.http
      .get<QuickInvoiceApiResponse>(`${this.baseUrl}QuickInvoice/GetAll`)
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

  getInvoiceById(id: string): Observable<QuickInvoice> {
    return this.http
      .get<QuickInvoiceApiResponse>(`${this.baseUrl}QuickInvoice?id=${id}`)
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

  createInvoice(invoice: QuickInvoice): Observable<QuickInvoiceApiResponse> {
    return this.http
      .post<QuickInvoiceApiResponse>(`${this.baseUrl}QuickInvoice/Create`, invoice)
      .pipe(catchError(err => this.handleError(err)));
  }

  updateInvoice(invoice: QuickInvoice): Observable<QuickInvoiceApiResponse> {
    return this.http
      .put<QuickInvoiceApiResponse>(`${this.baseUrl}QuickInvoice/Update`, invoice)
      .pipe(catchError(err => this.handleError(err)));
  }

  deleteInvoice(id: string): Observable<QuickInvoiceApiResponse> {
  return this.http
    .delete<QuickInvoiceApiResponse>(`${this.baseUrl}QuickInvoice/${id}`)
    .pipe(catchError(err => this.handleError(err)));
}
}