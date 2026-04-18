import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './authentication.service';
import { catchError, tap, throwError } from 'rxjs';
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
        logger.logApiError(req.method, req.url, error.status, error);
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
            // Token expired or invalid - logout user
            logger.warn('TOKEN_INTERCEPTOR', 'Unauthorized (401) - Token invalid or expired', {
              endpoint: req.url
            });
            // Don't logout if this is a refresh request itself (avoid double logout)
            if (!req.url.includes('GenerateRefreshToken')) {
              authService.logout();
            }
            // Rethrow original HttpErrorResponse so caller can read status
            return throwError(() => error);

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
    'resetpasswordwithotp',             // Reset password with OTP
    // Note: removed 'GenerateRefreshToken' from public endpoints so the
    // Authorization header is included. Some backends require the bearer
    // token to validate refresh requests.
    'userregistration',                 // Legacy registration endpoint
  ];

  return publicEndpoints.some(endpoint => request.url.includes(endpoint));
}
