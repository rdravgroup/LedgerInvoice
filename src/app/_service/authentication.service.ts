// Removed duplicate loginWithPassword() definition outside the class
import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, finalize, map, shareReplay, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { LoginResponse, UserCredentials, VerifyLoginOtp, CreatePassword, UserDetailed } from '../_model/user.model';
import { UserService } from './user.service';
import { LoggerService } from './logger.service';
// CHANGE: inject SelectedCompanyService so logout can clear stored company
import { SelectedCompanyService } from './selected-company.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private baseUrl = environment.apiUrl;
  private isAuthenticated = signal(false);
  public isAuthenticated$ = this.isAuthenticated.asReadonly(); // Expose as readonly signal
  private refreshTokenTimeout: any;
  private refreshInFlight: Observable<LoginResponse> | null = null;
  private inactivityTimeout: any;
  private userEmail = new BehaviorSubject<string>('');
  private userRoleSubject = new BehaviorSubject<string | null>(localStorage.getItem('userrole') || null);
  public userRole$ = this.userRoleSubject.asObservable();
  private companyIdSubject = new BehaviorSubject<string | null>(localStorage.getItem('companyid') || null);
  public companyId$ = this.companyIdSubject.asObservable();
  public userEmail$ = this.userEmail.asObservable();

  // Session timeout settings (configurable)
  private readonly TOKEN_REFRESH_EARLY_MS = 30 * 1000;
  private readonly INACTIVITY_TIMEOUT_MINUTES = 30;
  private inactivityTimer: any;
  private readonly activityHandler = () => this.resetInactivityTimer();

  // Session expiry warning subject
  private sessionExpiryWarning = new BehaviorSubject<{ willExpionIn: number } | null>(null);
  public sessionExpiryWarning$ = this.sessionExpiryWarning.asObservable();

  constructor(
    private http: HttpClient,
    private userService: UserService,
    private logger: LoggerService,
    // CHANGE: added SelectedCompanyService
    private selectedCompanyService: SelectedCompanyService
  ) {
    this.checkAuthStatus();
    this.installActivityListeners();
  }

  private installActivityListeners(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const events = ['click', 'keydown', 'mousemove', 'touchstart', 'scroll'];
    events.forEach(eventName => window.addEventListener(eventName, this.activityHandler, { passive: true }));
  }

  /**
   * Get username from localStorage
   */
  getUsername(): string | null {
    return localStorage.getItem('username');
  }

  getUserEmail(): string {
    return this.userEmail.getValue();
  }

  setUserEmail(email: string): void {
    this.userEmail.next(email);
  }

  getUserRole(): string | null {
    const v = this.userRoleSubject.getValue();
    return v ?? localStorage.getItem('userrole');
  }

  getCompanyId(): string | null {
    const v = this.companyIdSubject.getValue();
    return v ?? localStorage.getItem('companyid');
  }

  getAuthStatus(): boolean {
    return this.isAuthenticated();
  }

  private checkAuthStatus(): void {
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    if (!token || !username) {
      this.isAuthenticated.set(false);
      return;
    }
    if (this.isTokenExpired(token)) {
      if (localStorage.getItem('refreshToken')) {
        this.restoreAuthenticatedState();
        this.refreshToken().subscribe({ error: error => this.handleRefreshFailure(error) });
      } else {
        console.warn('AUTH_SERVICE: Token is expired and no refresh token is available');
        this.clearLocalSession();
      }
      return;
    }
    this.restoreAuthenticatedState();
    this.scheduleTokenRefresh();
  }

  private restoreAuthenticatedState(): void {
    this.isAuthenticated.set(true);
    this.userRoleSubject.next(localStorage.getItem('userrole') || null);
    this.companyIdSubject.next(localStorage.getItem('companyid') || null);
    this.resetInactivityTimer();
  }

  private isTokenExpired(token: string): boolean {
    try {
      const parts = token.split('.');
      if (parts.length < 2) return true;
      const payload = parts[1];
      const json = decodeURIComponent(
        Array.prototype.map.call(
          atob(payload.replace(/-/g, '+').replace(/_/g, '/')),
          function(c: any) { return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2); }
        ).join('')
      );
      const obj = JSON.parse(json);
      if (!obj.exp) return true;
      return Date.now() >= (obj.exp * 1000);
    } catch (ex) {
      console.error('AUTH_SERVICE: Failed to check token expiration', ex);
      return true;
    }
  }

  /**
   * Store user login details and credentials
   */
  login(response: LoginResponse, username?: string): void {
    console.log('AUTH_SERVICE: Login response received', {
      hasAccessToken: !!response?.token,
      hasRefreshToken: !!response?.refreshToken
    });
    console.log('AUTH_SERVICE: response.userRole =', response.userRole);

    // CHANGE: Clear any stale company selection from the previous session BEFORE setting new auth state.
    // This prevents company context leaking to a different user on the same browser/device.
    this.selectedCompanyService.clear();

    localStorage.setItem('token', response.token);
    // Ensure we never pass undefined to localStorage
    if (response.refreshToken) {
      localStorage.setItem('refreshToken', response.refreshToken);
    } else {
      localStorage.removeItem('refreshToken');
    }
    localStorage.setItem('username', username || '');

    // Determine role: prefer explicit response.userRole, otherwise decode from JWT
    let role = response.userRole;
    if (!role && response.token) {
      role = this.extractRoleFromToken(response.token) || '';
    }
    localStorage.setItem('userrole', role || '');
    this.userRoleSubject.next(role || null);

    // Extract and store company ID from token
    if (response.token) {
      const companyId = this.extractCompanyIdFromToken(response.token);
      if (companyId) {
        localStorage.setItem('companyid', companyId);
        this.companyIdSubject.next(companyId);
        console.log('AUTH_SERVICE: Company ID stored:', companyId);
      }
    }

    console.log('AUTH_SERVICE: After setItem - userrole:', this.getUserRole());

    this.isAuthenticated.set(true);

    // Refresh shortly before the JWT expiry, even when the user is idle.
    this.scheduleTokenRefresh();
    this.startInactivityTimer();
  }


  clearLocalSession(resetCompany = true): void {
    if (resetCompany) {
      this.selectedCompanyService.clear();
    }
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('username');
    localStorage.removeItem('userrole');
    localStorage.removeItem('companyid');
    localStorage.removeItem('logoutReason');
    this.isAuthenticated.set(false);
    this.userEmail.next('');
    this.userRoleSubject.next(null);
    this.companyIdSubject.next(null);
    this.sessionExpiryWarning.next(null);
  }

  /**
   * Refresh user details from server and update local storage and subjects.
   * Returns observable of the detailed user object.
   */
  refreshUserDetails(username?: string) {
    const user = username || this.getUsername() || '';
    if (!user) {
      return throwError(() => new Error('No username available to refresh user details'));
    }
    return this.userService.getUserByCodeDetailed(user).pipe(
      tap((ud: UserDetailed) => {
        if (!ud) return;
        try {
          if (ud.role) { localStorage.setItem('userrole', ud.role); this.userRoleSubject.next(ud.role); }
          const cid = (ud.companyId as string) || null;
          if (cid) { localStorage.setItem('companyid', cid); this.companyIdSubject.next(cid); }
        } catch (ex) {
          console.error('AUTH_SERVICE: Failed to refresh user details', ex);
        }
      })
    );
  }

  private extractRoleFromToken(token: string): string | null {
    try {
      const parts = token.split('.');
      if (parts.length < 2) return null;
      const json = decodeURIComponent(Array.prototype.map.call(
        atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')),
        function(c: any) { return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2); }
      ).join(''));
      const obj = JSON.parse(json);
      if (obj.role) return obj.role;
      if (obj.userRole) return obj.userRole;
      const roleKey = Object.keys(obj).find(k => k.toLowerCase().includes('role'));
      return roleKey ? obj[roleKey] : null;
    } catch { return null; }
  }

  private extractCompanyIdFromToken(token: string): string | null {
    try {
      const parts = token.split('.');
      if (parts.length < 2) return null;
      const json = decodeURIComponent(Array.prototype.map.call(
        atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')),
        function(c: any) { return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2); }
      ).join(''));
      const obj = JSON.parse(json);
      return obj.CompanyId || obj.companyId || obj.company || null;
    } catch { return null; }
  }

  verifyOtpLogin(email: string, otp: string): Observable<LoginResponse> {
    const data: VerifyLoginOtp = { email, otptext: otp };
    return this.userService.verifyLoginOtp(data).pipe(
      tap(response => { if (response?.token) this.login(response, email); }),
      catchError(error => throwError(() => new Error('Failed to verify OTP')))
    );
  }

  requestLoginOtp(email: string): Observable<any> {
    return this.userService.requestLoginOtp({ email }).pipe(
      tap(() => this.setUserEmail(email)),
      catchError(() => throwError(() => new Error('Failed to request OTP')))
    );
  }

  createPassword(newPassword: string, confirmPassword: string): Observable<any> {
    return this.userService.createPassword({ newPassword, confirmPassword } as CreatePassword).pipe(
      catchError(() => throwError(() => new Error('Failed to create password')))
    );
  }

  requestForgotPasswordOtp(email: string): Observable<any> {
    return this.userService.requestForgotPasswordOtp({ email }).pipe(
      tap(() => this.setUserEmail(email)),
      catchError(() => throwError(() => new Error('Failed to request OTP')))
    );
  }

  resetPasswordWithOtp(data: { email: string; otp: string; newPassword: string; confirmPassword: string }): Observable<any> {
    return this.userService.resetPasswordWithOtp(data).pipe(
      catchError(() => throwError(() => new Error('Failed to reset password')))
    );
  }

  /**
   * CHANGE: logout() now calls selectedCompanyService.clear() FIRST.
   * This prevents the selected company from persisting to the next user session on the same browser.
   * All other logout logic is unchanged.
   */
  logout(revokeServerSession = true, reason: string = 'manual'): void {
    console.log('AUTH_SERVICE: Logging out user...', { reason });
    localStorage.setItem('logoutReason', reason);

    if (revokeServerSession) {
      this.http.post(`${this.baseUrl}Authorize/logout`, { reason, source: 'client' }, { withCredentials: true }).subscribe({ error: () => {} });
    }

    // CHANGE: clear company selection so next login starts fresh
    this.selectedCompanyService.clear();

    // Clear all storage
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('username');
    localStorage.removeItem('userrole');
    localStorage.removeItem('companyid');
    this.isAuthenticated.set(false);
    this.userEmail.next('');
    this.userRoleSubject.next(null);
    this.companyIdSubject.next(null);
    this.sessionExpiryWarning.next(null);

    // Clear all timers
    if (this.refreshTokenTimeout) {
      clearTimeout(this.refreshTokenTimeout);
      this.refreshTokenTimeout = null;
    }

    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }

    console.log('AUTH_SERVICE: User logged out successfully');
  }

  /**
   * Refresh the authentication token
   * Enhanced with better error handling and logging
   */
  refreshToken(): Observable<LoginResponse> {
    if (this.refreshInFlight) return this.refreshInFlight;

    const refreshToken = localStorage.getItem('refreshToken');
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userrole');
    const username = this.getUsername();

    console.log('AUTH_SERVICE: Starting token refresh...');
    console.log('AUTH_SERVICE: Has refresh token:', !!refreshToken);
    console.log('AUTH_SERVICE: Has access token:', !!token);
    console.log('AUTH_SERVICE: Has user role:', !!userRole);
    console.log('AUTH_SERVICE: Username:', username);

    if (!refreshToken) {
      console.error('AUTH_SERVICE: No refresh token available in localStorage');
      this.logout(false, 'token-expired');
      return throwError(() => new Error('No refresh token available'));
    }

    if (!username) {
      console.error('AUTH_SERVICE: No username available');
      this.logout(false, 'token-expired');
      return throwError(() => new Error('No username available'));
    }

    const url = `${this.baseUrl}Authorize/GenerateRefreshToken`;

    const request = this.http.post<LoginResponse>(url, { token, refreshToken }, {
      headers: new HttpHeaders({ 'X-Skip-Auth': 'true' }),
      withCredentials: true
    }).pipe(
      map(response => {
        if (!response?.token) throw new Error('Token refresh response did not contain an access token');
        return response;
      }),
      tap(response => {
        localStorage.setItem('token', response.token);
        if (response.refreshToken) localStorage.setItem('refreshToken', response.refreshToken);
        this.restoreAuthenticatedState();
        this.scheduleTokenRefresh();
      }),
      catchError(error => {
        if (error?.status === 400 || error?.status === 401) this.logout(false, 'token-expired');
        return throwError(() => error);
      }),
      finalize(() => { this.refreshInFlight = null; }),
      shareReplay({ bufferSize: 1, refCount: false })
    );
    this.refreshInFlight = request;
    return request;
  }

  private scheduleTokenRefresh(): void {
    if (this.refreshTokenTimeout) clearTimeout(this.refreshTokenTimeout);
    const token = localStorage.getItem('token');
    const expiresAt = token ? this.getTokenExpiry(token) : null;
    if (!token || !localStorage.getItem('refreshToken') || !expiresAt) return;
    const delay = Math.max(0, expiresAt - Date.now() - this.TOKEN_REFRESH_EARLY_MS);
    this.refreshTokenTimeout = setTimeout(() => {
      this.refreshToken().subscribe({
        next: () => { this.resetInactivityTimer(); this.scheduleTokenRefresh(); },
        error: err => this.handleRefreshFailure(err)
      });
    }, delay);
  }

  private getTokenExpiry(token: string): number | null {
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
    } catch { return null; }
  }

  private handleRefreshFailure(error: any): void {
    if (error?.status === 400 || error?.status === 401) {
      this.logout(false, 'token-expired');
      return;
    }
    // A temporary network or server failure must not end a valid refresh session.
    if (localStorage.getItem('refreshToken')) {
      if (this.refreshTokenTimeout) clearTimeout(this.refreshTokenTimeout);
      this.refreshTokenTimeout = setTimeout(() => {
        this.refreshToken().subscribe({ error: retryError => this.handleRefreshFailure(retryError) });
      }, 10000);
    }
  }

  private startInactivityTimer(): void { this.resetInactivityTimer(); }

  resetInactivityTimer(): void {
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);

    const timeoutMs = this.INACTIVITY_TIMEOUT_MINUTES * 60 * 1000;

    if (!this.isAuthenticated() || timeoutMs <= 0) {
      this.inactivityTimer = null;
      return;
    }

    this.inactivityTimer = setTimeout(() => {
      if (this.isAuthenticated()) {
        console.warn('AUTH_SERVICE: Inactivity timeout — logging out');
        this.logout(false, 'inactivity');
      }
    }, timeoutMs);
  }

  getInactivityTimeoutMinutes(): number {
    return this.INACTIVITY_TIMEOUT_MINUTES;
  }
  getTokenRefreshIntervalMinutes(): number { return Math.max(0, (this.getTokenExpiry(localStorage.getItem('token') || '') || Date.now()) - Date.now() - this.TOKEN_REFRESH_EARLY_MS) / 60000; }
  isTokenValid(): boolean { return !!localStorage.getItem('token'); }
  getToken(): string | null { return localStorage.getItem('token'); }
}


