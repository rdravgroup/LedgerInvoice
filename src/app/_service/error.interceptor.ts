import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { inject } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { catchError, throwError } from 'rxjs';
import { LoggerService } from './logger.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const toastr = inject(ToastrService);
  const logger = inject(LoggerService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let errorMessage = 'An unexpected error occurred';

      // Log the API error
      logger.logApiError(req.method, req.url, error.status, error);

      if (error.error instanceof ErrorEvent) {
        // Client-side error
        errorMessage = error.error.message;
        logger.error('ERROR_INTERCEPTOR', 'Client-side error', {
          message: errorMessage,
          event: error.error
        });
      } else {
        // Server-side error or network error
        switch (error.status) {
          case 0:
            // Network error (CORS, connection refused, etc.)
            errorMessage = 'Network error: Unable to connect to the server. Please check if the API is running and accessible.';
            logger.error('ERROR_INTERCEPTOR', 'Network error', {
              url: req.url,
              method: req.method
            });
            break;
          case 400:
            errorMessage = error.error?.message || 'Bad request. Please check your input.';
            logger.warn('ERROR_INTERCEPTOR', 'Bad request (400)', {
              url: req.url,
              message: errorMessage,
              body: req.body
            });
            break;
          case 401:
            errorMessage = 'Unauthorized. Please login again.';
            logger.warn('ERROR_INTERCEPTOR', 'Unauthorized (401)', {
              url: req.url
            });
            // Clear authentication data
            localStorage.removeItem('token');
            localStorage.removeItem('username');
            localStorage.removeItem('userrole');
            // Redirect to login
            router.navigateByUrl('/login');
            break;
          case 403:
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

      toastr.error(errorMessage);
      
      return throwError(() => new Error(errorMessage));
    })
  );
};
