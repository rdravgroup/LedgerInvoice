import { ApplicationConfig, APP_INITIALIZER } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideToastr } from 'ngx-toastr';
import { tokenInterceptor } from './_service/token.interceptor';
import { errorInterceptor } from './_service/error.interceptor';
import { loadingInterceptor } from './_service/loading.interceptor';
import { AuthService } from './_service/authentication.service';

/**
 * Initialize authentication state on app startup
 * This ensures that if user was logged in, they stay logged in after page refresh
 */
function initializeAuth(authService: AuthService) {
  return () => {
    // The AuthService constructor already calls checkAuthStatus()
    // This just ensures it's called during app initialization
    return Promise.resolve();
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideAnimationsAsync(),
    provideHttpClient(withInterceptors([loadingInterceptor, tokenInterceptor, errorInterceptor])),
    provideToastr({ closeButton: true }),
    {
      provide: APP_INITIALIZER,
      useFactory: initializeAuth,
      deps: [AuthService],
      multi: true
    }
  ]
};
