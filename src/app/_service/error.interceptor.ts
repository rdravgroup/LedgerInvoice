import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { inject } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { catchError, throwError } from 'rxjs';
import { LoggerService } from './logger.service';
import { environment } from '../../environments/environment';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const toastr = inject(ToastrService);
  const logger = inject(LoggerService);
  const isPasswordLoginEndpoint = /\/User\/loginwithpassword(?:[/?]|$)/i.test(req.url);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const currentUrl = router.url || '';
      const authRoutes = ['/login', '/oauth-login', '/confirmotp', '/register', '/resetpassword', '/forgetpassword'];
      const onAuthRoute = authRoutes.some(r => currentUrl.startsWith(r));

      logger.logApiError(req.method, req.url, error.status, error);

      // Login failures are expected authentication responses; preserve the HTTP body/status
      // for the login form and do not clear a possibly valid existing session here.
      if (isPasswordLoginEndpoint) {
        return throwError(() => error);
      }

      if (error.status === 401) {
        const requestToken = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') || '';
        const currentToken = localStorage.getItem('token') || '';
        if (currentToken && (!requestToken || requestToken !== currentToken)) {
          logger.logAuthEvent('Ignoring stale or uncredentialed 401; a newer local session exists', {
            method: req.method,
            url: req.url,
            currentUrl,
            requestHadBearerToken: !!requestToken,
            requestMatchesCurrentSession: false
          });
          reportClientAuth401(
            req.url,
            currentUrl,
            error,
            'ignore-stale-401',
            !!req.headers.get('Authorization')
          );
          return throwError(() => error);
        }
      }

      let errorMessage = 'An unexpected error occurred';

      if (error.error instanceof ErrorEvent) {
        errorMessage = error.error.message;
        logger.error('ERROR_INTERCEPTOR', 'Client-side error', {
          message: errorMessage,
          event: error.error
        });
      } else {
        switch (error.status) {
          case 0:
            errorMessage = 'Network error: Unable to connect to the server. Please check if the API is running and accessible.';
            logger.error('ERROR_INTERCEPTOR', 'Network error', {
              url: req.url,
              method: req.method
            });
            break;
          case 400:
            errorMessage = error.error?.message || error.error?.errorMessage || 'Bad request. Please check your input.';
            logger.warn('ERROR_INTERCEPTOR', 'Bad request (400)', {
              url: req.url,
              message: errorMessage,
              body: req.body
            });
            break;
          case 401:
            const responseCode = error.error?.code || error.error?.Code || '';
            const sessionReplaced = responseCode === 'SINGLE_DEVICE_SESSION_REPLACED';
            const redirectDecision = onAuthRoute
              ? 'preserve-auth-route-for-caller'
              : sessionReplaced
                ? 'login-session-replaced'
                : 'login';
            logger.logAuthEvent('Protected API returned 401', {
              method: req.method,
              url: req.url,
              currentUrl,
              responseCode: responseCode || 'none',
              responseMessage: error.error?.message || error.error?.errorMessage || error.error?.ErrorMessage || 'none',
              hadAccessToken: !!localStorage.getItem('token'),
              redirectDecision
            });
            reportClientAuth401(req.url, currentUrl, error, redirectDecision, !!req.headers.get('Authorization'));

            errorMessage = sessionReplaced
              ? 'You were logged out because this account was opened on another device.'
              : 'Unauthorized. Please login again.';
            logger.warn('ERROR_INTERCEPTOR', 'Unauthorized (401)', { url: req.url });
            localStorage.removeItem('token');
            localStorage.removeItem('username');
            localStorage.removeItem('userrole');
            if (!onAuthRoute) {
              router.navigateByUrl('/login');
            }
            break;
          case 402:
            errorMessage = error.error?.message || error.error?.errorMessage || 'Payment required. Please complete subscription.';
            logger.warn('ERROR_INTERCEPTOR', 'Payment required (402)', {
              url: req.url,
              message: errorMessage
            });
            break;
          case 403:
            {
              const body = error.error;
              const msg = typeof body === 'string' ? body : (body?.message || body?.errorMessage || '');
              const isSubscription = typeof msg === 'string' && msg.toLowerCase().includes('subscription');
              if (isSubscription) {
                logger.warn('ERROR_INTERCEPTOR', 'Forbidden (403) - Subscription expired', { url: req.url });
                return throwError(() => error);
              }
            }

            errorMessage = 'Access forbidden. You do not have permission to access this resource.';
            logger.warn('ERROR_INTERCEPTOR', 'Forbidden (403)', {
              url: req.url
            });
            router.navigateByUrl('/');
            break;
          case 404:
            errorMessage = 'Resource not found.';
            logger.warn('ERROR_INTERCEPTOR', 'Not found (404)', {
              url: req.url
            });
            break;
          case 500:
            errorMessage = 'Server error. Please try again later.';
            logger.error('ERROR_INTERCEPTOR', 'Server error (500)', {
              url: req.url,
              response: error.error
            });
            break;
          case 503:
            errorMessage = 'Service unavailable. Please try again later.';
            logger.error('ERROR_INTERCEPTOR', 'Service unavailable (503)', {
              url: req.url
            });
            break;
          default:
            errorMessage = error.error?.message || `Error Code: ${error.status}\nMessage: ${error.message}`;
            logger.error('ERROR_INTERCEPTOR', `Unknown error (${error.status})`, {
              url: req.url,
              status: error.status,
              message: errorMessage
            });
        }
      }

      if (!(error?.status === 401 && onAuthRoute) && error?.status !== 402) {
        toastr.error(errorMessage);
      }

      if (error?.status === 402) {
        return throwError(() => error);
      }

      if (error?.status === 401) {
        return throwError(() => error);
      }

      return throwError(() => new Error(errorMessage));
    })
  );
};

function reportClientAuth401(
  requestUrl: string,
  currentUrl: string,
  error: HttpErrorResponse,
  redirectDecision: string,
  hadBearerToken: boolean
): void {
  if (typeof fetch === 'undefined') return;
  try {
    const requestPath = new URL(requestUrl, window.location.origin).pathname;
    const payload = {
      status: error.status,
      requestPath,
      currentRoute: (currentUrl || '/').split('?')[0],
      responseCode: error.error?.code || error.error?.Code || '',
      hadBearerToken,
      redirectDecision
    };
    void fetch(`${environment.apiUrl}Authorize/client-auth-diagnostic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'omit',
      keepalive: true
    }).catch(() => {});
  } catch {
    // Diagnostics must never interfere with the original failed request.
  }
}
