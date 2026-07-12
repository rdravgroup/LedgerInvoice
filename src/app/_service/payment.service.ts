import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

// ── Interfaces ────────────────────────────────────────────────────────────────
export interface SubscriptionPlan {
  planId: string; name: string; amount: number; currency: string;
  durationDays: number; description: string; isRecommended: boolean;
}
export interface InitiatePaymentResponse {
  paymentId: string; gateway: string; gatewayOrderId: string;
  amount: number; currency: string; keyId: string;
  companyName: string; userEmail: string; userPhone: string;
  callbackUrl?: string; planName: string; durationDays: number;
  // Optional redirect info for redirect-based gateways (e.g. PayU)
  gatewayRedirectUrl?: string;
  gatewayFields?: { [key: string]: string };
  // When false, frontend should disable payment UI (admin disabled gateways)
  paymentEnabled?: boolean;
}
export interface VerifyPaymentPayload {
  internalPaymentId: string;
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  gatewaySignature?: string;
}
export interface VerifyPaymentResponse {
  success: boolean; message: string;
  companyId: string; companyStatus: string;
  accessExpiryDate?: string;
}
export interface PaymentStatusResponse {
  companyId: string; companyName: string;
  isPaymentDone: boolean; isActive: boolean;
  lastPaymentDate?: string; accessExpiryDate?: string;
  isExpired: boolean; daysRemaining: number;
  showPayButton: boolean; paymentButtonLabel?: string;
}
export interface RunExpiryJobResponse {
  remindersSent: number; companiesDeactivated: number;
  processedCompanies: string[]; message: string; executedAt: string;
}

export interface PaymentGateway {
  recId: number; gatewayName: string; displayName?: string; isEnabled: boolean;
}

export interface RenewSubscriptionRequest {
  companyId: string;
  planName?: string;
  gateway?: string;
  voucherCode?: string;
  paymentId?: number;
  notes?: string;
}

// ── Service ───────────────────────────────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class PaymentService {
  private base = `${environment.apiUrl}Payment/`;

  constructor(private http: HttpClient) {}

  /** GET /api/Payment/plans */
  getPlans(): Observable<SubscriptionPlan[]> {
    return this.http.get<any>(`${this.base}plans`).pipe(
      map(r => r?.data ?? []),
      catchError(e => throwError(() => e))
    );
  }

  /** GET /api/Payment/status/{companyId} */
  getPaymentStatus(companyId: string): Observable<PaymentStatusResponse> {
    return this.http.get<any>(
      `${this.base}status/${encodeURIComponent(companyId)}`
    ).pipe(
      map(r => r?.data),
      catchError(e => throwError(() => e))
    );
  }

  /** POST /api/Payment/initiate */
  initiatePayment(
    companyId: string,
    planName = 'annual',
    gateway = 'razorpay',
    voucherCode?: string
  ): Observable<InitiatePaymentResponse> {
    const payload: any = { companyId, planName, gateway };
    if (voucherCode) payload.voucherCode = voucherCode;
    return this.http.post<any>(`${this.base}initiate`, payload).pipe(
      map(r => r?.data),
      catchError(e => throwError(() => e))
    );
  }

  /** POST /api/Payment/verify */
  verifyPayment(payload: VerifyPaymentPayload): Observable<VerifyPaymentResponse> {
    return this.http.post<any>(`${this.base}verify`, payload).pipe(
      map(r => r?.data ?? r),
      catchError(e => throwError(() => e))
    );
  }

  /** POST /api/Payment/run-expiry-job */
  runExpiryJob(forceDeactivate = false): Observable<RunExpiryJobResponse> {
    return this.http.post<any>(
      `${this.base}run-expiry-job`, { forceDeactivate }
    ).pipe(
      map(r => r?.data),
      catchError(e => throwError(() => e))
    );
  }

  /** POST /api/Payment/renew */
  renewSubscription(req: RenewSubscriptionRequest): Observable<any> {
    return this.http.post<any>(`${this.base}renew`, req).pipe(
      map(r => r?.data),
      catchError(e => throwError(() => e))
    );
  }

  /** GET /api/Payment/gateways */
  getGateways(): Observable<PaymentGateway[]> {
    return this.http.get<any>(`${this.base}gateways`).pipe(
      map(r => r?.data ?? []),
      catchError(e => throwError(() => e))
    );
  }

  /** PUT /api/Payment/gateways/{id} */
  updateGateway(recId: number, isEnabled: boolean): Observable<PaymentGateway> {
    return this.http.put<any>(`${this.base}gateways/${recId}`, { isEnabled }).pipe(
      map(r => r?.data ?? r),
      catchError(e => throwError(() => e))
    );
  }
}
