import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './authentication.service';
import { catchError, switchMap, tap, throwError } from 'rxjs';
import { LoggerService } from './logger.service';

/**
 * Token Interceptor Function
 * Automatically adds JWT token to all API requests
 * Handles token refresh on 401 errors
 * Skips token insertion for auth-related endpoints
 */
export const tokenInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const logger = inject(LoggerService);
  const router = inject(Router);
  
  // Allow callers to explicitly skip adding Authorization header by setting
  // a custom header `X-Skip-Auth: true` on the request. This is useful when
  // the refresh endpoint expects only the refresh token in the body and not
  // an Authorization header.
  const skipAuthHeader = req.headers?.get('X-Skip-Auth') === 'true';
  if (skipAuthHeader) {
    // Remove the header so it is not forwarded to the server
    req = req.clone({ headers: req.headers.delete('X-Skip-Auth') });
    logger.debug('TOKEN_INTERCEPTOR', 'Skipping Authorization header for request', { endpoint: req.url });

    logger.logApiRequest(req.method, req.url);
    return next(req).pipe(
      tap(response => {
        if (response.type === 4) { // 4 = HttpResponse
          logger.logApiResponse(req.method, req.url, response.status, response.body);
        }
      }),
      catchError(error => {
        return throwError(() => error);
      })
    );
  }

  // Skip token insertion for public endpoints
  if (shouldSkipTokenInsertion(req)) {
    logger.logApiRequest(req.method, req.url);
    return next(req).pipe(
      tap(response => {
        if (response.type === 4) { // 4 = HttpResponse
          logger.logApiResponse(req.method, req.url, response.status, response.body);
        }
      }),
      catchError(error => {
        logger.logApiError(req.method, req.url, error.status, error);
        return throwError(() => error);
      })
    );
  }

  // Get JWT token from localStorage
  const token = authService.getToken();

  // Add Authorization header if token exists
  if (token) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    logger.debug('TOKEN_INTERCEPTOR', 'Authorization header added', {
      endpoint: req.url,
      hasToken: !!token
    });
  } else {
    logger.warn('TOKEN_INTERCEPTOR', 'No token found for protected endpoint', {
      endpoint: req.url
    });
  }

  // Log the request
  logger.logApiRequest(req.method, req.url);

  return next(req).pipe(
    tap(response => {
      if (response.type === 4) { // 4 = HttpResponse
        logger.logApiResponse(req.method, req.url, response.status, response.body);
        // Reset inactivity timer on successful API response
        // This keeps user logged in as long as they're actively using the app
        authService.resetInactivityTimer();
      }
    }),
    catchError((error: any) => {
      logger.logApiError(req.method, req.url, error.status, error);

      if (error instanceof HttpErrorResponse) {
        switch (error.status) {
          case 400:
            // Bad request - could be invalid refresh token format or other client error
            logger.warn('TOKEN_INTERCEPTOR', 'Bad Request (400)', {
              endpoint: req.url,
              errorMessage: error.error?.message
            });
            // For refresh token endpoint, 400 means refresh token is invalid
            // Do not convert the HttpErrorResponse into a generic Error here —
            // rethrow the original error so downstream handlers can inspect
            // `error.status` and `error.error`.
            return throwError(() => error);

          case 401:
            {
              const requestToken = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') || '';
              const currentToken = authService.getToken();
              const requestMatchesCurrentSession = !!requestToken && !!currentToken && requestToken === currentToken;
              if (!requestMatchesCurrentSession) {
                logger.warn('TOKEN_INTERCEPTOR', 'Ignoring 401 from a request that does not belong to the current session', {
                  endpoint: req.url,
                  requestHadBearerToken: !!requestToken,
                  currentSessionActive: !!currentToken
                });
                return throwError(() => error);
              }

              logger.warn('TOKEN_INTERCEPTOR', 'Unauthorized (401) for current session token', {
                endpoint: req.url
              });
              if (isRefreshRequest(req.url)) return throwError(() => error);

              // Refresh once for the expired request, then replay it with the new JWT.
              return authService.refreshToken().pipe(
                switchMap(response => {
                  const retryRequest = req.clone({
                    setHeaders: { Authorization: `Bearer ${response.token}` }
                  });
                  return next(retryRequest).pipe(catchError(retryError => {
                    if (retryError instanceof HttpErrorResponse && retryError.status === 401) {
                      authService.logout(false, 'token-expired');
                      router.navigateByUrl('/login');
                    }
                    return throwError(() => retryError);
                  }));
                }),
                catchError(refreshError => {
                  if (refreshError?.status === 400 || refreshError?.status === 401 || !authService.getAuthStatus()) {
                    if (authService.getAuthStatus()) authService.logout(false, 'token-expired');
                    router.navigateByUrl('/login');
                  }
                  return throwError(() => error);
                })
              );
            }

          case 403:
            // Forbidden - user doesn't have permission
            logger.warn('TOKEN_INTERCEPTOR', 'Forbidden (403) - Insufficient permissions', {
              endpoint: req.url
            });
            return throwError(() => error);

          case 0:
            // Network error - unclear error
            logger.error('TOKEN_INTERCEPTOR', 'Network Error (status 0)', {
              endpoint: req.url,
              errorMessage: error.error?.message || error.message
            });
            // Don't logout on network errors, let the service handle retries
            return throwError(() => error);

          default:
            // Other errors - log but don't logout automatically
            if (error.status >= 500) {
              logger.error('TOKEN_INTERCEPTOR', 'Server Error', {
                status: error.status,
                endpoint: req.url
              });
            }
            return throwError(() => error);
        }
      }
      return throwError(() => error);
    })
  );
};

/**
 * Determine if token should be skipped for this request
 * Public endpoints don't require authentication
 */
function shouldSkipTokenInsertion(request: any): boolean {
  const publicEndpoints = [
    'GenerateToken',                    // Password login (legacy)
    'loginwithpassword',                // Password login (current endpoint)
    'initialregistration',              // Email registration
    'requestloginotp',                  // Request login OTP
    'verifyloginotp',                   // Verify login OTP
    'confirmregisteration',             // Confirm registration
    'resendregistrationotp',            // Resend registration OTP
    'requestforgotpasswordotp',         // Request forgot password OTP
    'resetpasswordwithotp',             // Reset password with OTP    'GetBycode',                        // Login helper endpoint used before token storage
    'Getbycode',                        // Same endpoint variant
    'GetbycodeDetailed',                // User detail endpoint used during login
    // GenerateRefreshToken is authenticated through the explicit refresh payload;
    // AuthService marks it with X-Skip-Auth so an expired bearer token is not sent.
    'userregistration',                 // Legacy registration endpoint
  ];

  return publicEndpoints.some(endpoint => request.url.includes(endpoint));
}

function isRefreshRequest(url: string): boolean {
  return /\/Authorize\/GenerateRefreshToken(?:[/?]|$)/i.test(url);
}


