import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import type {
  VoucherResponse, ValidateVoucherResponse, ApplyVoucherResponse,
  ActivationCheckResponse, PaymentConfigResponse
} from '../_model/voucher.model';

export type { VoucherResponse, ValidateVoucherResponse, ApplyVoucherResponse,
         ActivationCheckResponse, PaymentConfigResponse };

@Injectable({ providedIn: 'root' })
export class VoucherService {
  private base = `${environment.apiUrl}Voucher/`;

  constructor(private http: HttpClient) {}

  getConfig(): Observable<PaymentConfigResponse> {
    return this.http.get<any>(`${this.base}config`).pipe(
      map(r => r?.data), catchError(e => throwError(() => e)));
  }

  updateConfig(key: string, value: string): Observable<PaymentConfigResponse> {
    return this.http.post<any>(`${this.base}config`, { configKey: key, configValue: value }).pipe(
      map(r => r?.data), catchError(e => throwError(() => e)));
  }

  listVouchers(includeDisabled = false): Observable<VoucherResponse[]> {
    return this.http.get<any>(`${this.base}list?includeDisabled=${includeDisabled}`).pipe(
      map(r => r?.data ?? []), catchError(e => throwError(() => e)));
  }

  getVoucher(id: number): Observable<VoucherResponse> {
    return this.http.get<any>(`${this.base}${id}`).pipe(
      map(r => r?.data), catchError(e => throwError(() => e)));
  }

  createVoucher(payload: any): Observable<VoucherResponse> {
    return this.http.post<any>(`${this.base}create`, payload).pipe(
      map(r => r?.data), catchError(e => throwError(() => e)));
  }

  updateVoucher(payload: any): Observable<VoucherResponse> {
    return this.http.put<any>(`${this.base}update`, payload).pipe(
      map(r => r?.data), catchError(e => throwError(() => e)));
  }

  deleteVoucher(id: number): Observable<any> {
    return this.http.delete<any>(`${this.base}${id}`).pipe(
      catchError(e => throwError(() => e)));
  }

  getActivationMode(companyId: string): Observable<ActivationCheckResponse> {
    return this.http.get<any>(`${this.base}activation-mode/${encodeURIComponent(companyId)}`).pipe(
      map(r => r?.data), catchError(e => throwError(() => e)));
  }

  validateVoucher(code: string, companyId: string, planName = 'annual'): Observable<ValidateVoucherResponse> {
    return this.http.post<any>(`${this.base}validate`,
      { voucherCode: code, companyId, planName }).pipe(
      map(r => r?.data), catchError(e => throwError(() => e)));
  }

  applyVoucher(code: string, companyId: string, planName = 'annual', paymentId?: number): Observable<ApplyVoucherResponse> {
    return this.http.post<any>(`${this.base}apply`,
      { voucherCode: code, companyId, planName, paymentId }).pipe(
      map(r => r?.data), catchError(e => throwError(() => e)));
  }
}
