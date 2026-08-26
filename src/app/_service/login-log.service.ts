import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface LoginLogRecord {
  logId: number;
  userId: string;
  email: string;
  companyId: string;
  userRole?: string;
  authMethod: string;
  loginTime: string;
  logoutTime?: string;
  sessionDuration?: number;
  loginIpAddress: string;
  userAgent?: string;
  status: string;
  deviceInfo?: string;
  remarks?: string;
  createdAt: string;
}

export interface LoginStats {
  totalLogins: number;
  uniqueUsers: number;
  activeSessions: number;
  averageSessionDuration: number;
  loginsByAuthMethod: Record<string, number>;
  loginsByCompany: Record<string, number>;
}

interface LoginLogResponse<T> {
  result: string;
  data: T;
  count?: number;
  errorMessage?: string;
}

@Injectable({ providedIn: 'root' })
export class LoginLogService {
  private readonly baseUrl = `${environment.apiUrl}LoginLog/`;

  constructor(private http: HttpClient) {}

  getMyHistory(days: number): Observable<LoginLogResponse<LoginLogRecord[]>> {
    return this.http.get<LoginLogResponse<LoginLogRecord[]>>(`${this.baseUrl}myhistory`, { params: this.daysParams(days) });
  }

  getCompanyHistory(days: number, companyId?: string): Observable<LoginLogResponse<LoginLogRecord[]>> {
    let params = this.daysParams(days);
    if (companyId) params = params.set('companyId', companyId);
    return this.http.get<LoginLogResponse<LoginLogRecord[]>>(`${this.baseUrl}company`, { params });
  }

  getCompanyStats(days: number, companyId?: string): Observable<LoginLogResponse<LoginStats>> {
    let params = this.daysParams(days);
    if (companyId) params = params.set('companyId', companyId);
    return this.http.get<LoginLogResponse<LoginStats>>(`${this.baseUrl}company-stats`, { params });
  }

  getGlobalStats(days: number): Observable<LoginLogResponse<LoginStats>> {
    return this.http.get<LoginLogResponse<LoginStats>>(`${this.baseUrl}stats`, { params: this.daysParams(days) });
  }

  getActiveSessions(): Observable<LoginLogResponse<LoginLogRecord[]>> {
    return this.http.get<LoginLogResponse<LoginLogRecord[]>>(`${this.baseUrl}active-sessions`);
  }

  private daysParams(days: number): HttpParams {
    return new HttpParams().set('days', String(Math.max(1, Math.min(365, days))));
  }
}
