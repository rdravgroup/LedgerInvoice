import { Injectable, inject } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from './authentication.service';
import { BehaviorSubject, interval, Subscription } from 'rxjs';

/**
 * Session Timeout Service
 * Handles session expiry warnings and auto-logout notifications
 * Monitors inactivity and alerts user before session expires
 */
@Injectable({
  providedIn: 'root'
})
export class SessionTimeoutService {
  private authService = inject(AuthService);
  private toastr = inject(ToastrService);
  
  private sessionWarningShown$ = new BehaviorSubject<boolean>(false);
  public sessionWarningShown = this.sessionWarningShown$.asObservable();
  
  private inactivityWarningTimer: any;
  private sessionCheckInterval: Subscription | null = null;
  
  // Warning threshold: Show warning 2 minutes before inactivity logout
  private readonly WARNING_MINUTES_BEFORE_LOGOUT = 2;

  constructor() {
    this.startSessionMonitoring();
  }

  /**
   * Start monitoring session expiry and show warnings
   */
  private startSessionMonitoring(): void {
    // Check every 30 seconds if we should show warning
    this.sessionCheckInterval = interval(30000).subscribe(() => {
      this.checkAndWarnAboutExpiry();
    });
  }

  /**
   * Check if session is about to expire and show warning
   */
  private checkAndWarnAboutExpiry(): void {
    // This would need integration with a timer to track actual inactivity
    // For now, we use the auth service's configuration
    const inactivityMinutes = this.authService.getInactivityTimeoutMinutes();
    
    // You can enhance this with actual time tracking if needed
    // For example, using localStorage to track last activity time
  }

  /**
   * Show session expiry warning
   */
  showSessionExpiryWarning(minutesRemaining: number): void {
    if (this.sessionWarningShown$.value) {
      return; // Only show once
    }

    this.sessionWarningShown$.next(true);
    
    const message = minutesRemaining > 1 
      ? `Your session will expire in ${minutesRemaining} minutes due to inactivity. Please save your work.`
      : 'Your session is about to expire!';

    this.toastr.warning(message, 'Session Expiring', {
      timeOut: minutesRemaining > 1 ? 10000 : 5000,
      progressBar: true,
      closeButton: true,
      extendedTimeOut: 5000
    });
  }

  /**
   * Show session expired message
   */
  showSessionExpiredMessage(): void {
    this.resetWarningFlag();
    this.toastr.error(
      'Your session has expired due to inactivity. Please login again.',
      'Session Expired',
      {
        timeOut: 0,
        closeButton: true
      }
    );
  }

  /**
   * Reset warning flag
   */
  resetWarningFlag(): void {
    this.sessionWarningShown$.next(false);
  }

  /**
   * Get session configuration info
   */
  getSessionInfo(): {
    inactivityTimeoutMinutes: number;
    tokenRefreshIntervalMinutes: number;
    warningBeforeLogoutMinutes: number;
  } {
    return {
      inactivityTimeoutMinutes: this.authService.getInactivityTimeoutMinutes(),
      tokenRefreshIntervalMinutes: this.authService.getTokenRefreshIntervalMinutes(),
      warningBeforeLogoutMinutes: this.WARNING_MINUTES_BEFORE_LOGOUT
    };
  }

  /**
   * Cleanup on destroy
   */
  destroy(): void {
    if (this.sessionCheckInterval) {
      this.sessionCheckInterval.unsubscribe();
    }
    if (this.inactivityWarningTimer) {
      clearTimeout(this.inactivityWarningTimer);
    }
  }
}
