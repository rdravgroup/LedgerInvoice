import { CanActivateFn, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { UserService } from '../_service/user.service';
import { AuthService } from '../_service/authentication.service';
import { inject } from '@angular/core';
import { map, switchMap, of, catchError } from 'rxjs';

export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const toastr = inject(ToastrService);
  const service = inject(UserService);
  const authService = inject(AuthService);

  let menuname = '';

  if (route.url.length > 0) {
    menuname = route.url[0].path;
    // Map editinvoice to createinvoice for permission check
    if (menuname === 'editinvoice') {
      menuname = 'createinvoice';
    }
  }

  const isAuth = authService.getAuthStatus();
  const username = authService.getUsername();
  const userRole = authService.getUserRole();

  // Debug logs to help trace authorization problems when navigation fails
  try {
    console.log('AUTH_GUARD: isAuth=', isAuth, 'username=', username, 'userRole=', userRole, 'initialMenuname=', menuname);
  } catch { }

  if (!isAuth || !username || !userRole) {
    toastr.warning('Unauthorized access');
    router.navigateByUrl('/login');
    return false;
  }

  // If no menu name specified, allow access
  if (!menuname) {
    return true;
  }

  // Personal user actions that don't require menu permissions
  const personalRoutes = ['resetpassword', 'updatepassword', 'profile', 'userprofile', 'quick-invoice', 'ai-chat'];
  if (personalRoutes.includes(menuname)) {
    return true;
  }

  // Derive the full path (without query) to try exact menucode matches like "purchase/vendors".
  const fullPath = (state && state.url) ? state.url.split('?')[0].replace(/^\//, '').replace(/\/$/, '') : menuname;

  // Many DB menucodes use '-' between segments (e.g. 'purchase-orders').
  // Try DB-style code first (replace '/' with '-') then fall back to route-style and finally to first segment.
  const dbCode = fullPath ? fullPath.replace(/\//g, '-') : fullPath;

  return service.getMenuPermission(userRole, dbCode).pipe(
    switchMap((item: any) => {
      try { console.log('AUTH_GUARD: permission check for dbCode=', dbCode, 'response=', item); } catch { }
      if (item && item.haveview) return of(true);

      // Try route-style menucode (e.g. 'purchase/vendors') next
      return service.getMenuPermission(userRole, fullPath).pipe(
        switchMap((item2: any) => {
          try { console.log('AUTH_GUARD: permission check for fullPath=', fullPath, 'response=', item2); } catch { }
          if (item2 && item2.haveview) return of(true);

          // Fallback: use the first path segment (e.g. 'purchase' for 'purchase/vendors')
          const firstSegment = (fullPath || '').split('/')[0] || menuname || '';
          const fallbackSegment = firstSegment.startsWith('editinvoice') ? 'createinvoice' : firstSegment;
          return service.getMenuPermission(userRole, fallbackSegment).pipe(
            map((item3: any) => {
              try { console.log('AUTH_GUARD: fallback permission check for', fallbackSegment, 'response=', item3); } catch { }
              if (item3 && item3.haveview) return true;
              toastr.warning('Unauthorized access');
              router.navigateByUrl('/');
              return false;
            }),
            catchError(() => {
              toastr.warning('Unauthorized access');
              router.navigateByUrl('/');
              return of(false);
            })
          );
        }),
        catchError(() => {
          // If fullPath check errored, still attempt the first-segment fallback
          const firstSegment = (fullPath || '').split('/')[0] || menuname || '';
          const fallbackSegment = firstSegment.startsWith('editinvoice') ? 'createinvoice' : firstSegment;
          return service.getMenuPermission(userRole, fallbackSegment).pipe(
            map((item3: any) => {
              try { console.log('AUTH_GUARD: fallback permission check for', fallbackSegment, 'response=', item3); } catch { }
              if (item3 && item3.haveview) return true;
              toastr.warning('Unauthorized access');
              router.navigateByUrl('/');
              return false;
            }),
            catchError(() => {
              toastr.warning('Unauthorized access');
              router.navigateByUrl('/');
              return of(false);
            })
          );
        })
      );
    }),
    catchError(() => {
      toastr.warning('Unauthorized access');
      router.navigateByUrl('/login');
      return of(false);
    })
  );
};

