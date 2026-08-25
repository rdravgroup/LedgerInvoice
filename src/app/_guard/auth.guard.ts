import { CanActivateFn, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { UserService } from '../_service/user.service';
import { AuthService } from '../_service/authentication.service';
import { inject } from '@angular/core';
import { map, switchMap, of, catchError } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { AuthPinDialogComponent } from '../Component/auth-pin-dialog/auth-pin-dialog.component';

export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const toastr = inject(ToastrService);
  const service = inject(UserService);
  const authService = inject(AuthService);
  const dialog = inject(MatDialog);

  let menuname = '';

  if (route.url.length > 0) {
    menuname = route.url[0].path;
    if (menuname === 'editinvoice') {
      menuname = 'createinvoice';
    }
  }

  const checkMenuAccess = () => {
    if (!menuname) {
      return of(true);
    }

    const personalRoutes = ['resetpassword', 'updatepassword', 'profile', 'userprofile', 'quick-invoice', 'ai-chat'];
    if (personalRoutes.includes(menuname)) {
      return of(true);
    }

    const userRole = authService.getUserRole() || '';
    const fullPath = (state && state.url) ? state.url.split('?')[0].replace(/^\//, '').replace(/\/$/, '') : menuname;
    const dbCode = fullPath ? fullPath.replace(/\//g, '-') : fullPath;

    return service.getMenuPermission(userRole, dbCode).pipe(
      switchMap((item: any) => {
        if (item && item.haveview) return of(true);

        return service.getMenuPermission(userRole, fullPath).pipe(
          switchMap((item2: any) => {
            if (item2 && item2.haveview) return of(true);

            const firstSegment = (fullPath || '').split('/')[0] || menuname || '';
            const fallbackSegment = firstSegment.startsWith('editinvoice') ? 'createinvoice' : firstSegment;
            return service.getMenuPermission(userRole, fallbackSegment).pipe(
              map((item3: any) => {
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
            const firstSegment = (fullPath || '').split('/')[0] || menuname || '';
            const fallbackSegment = firstSegment.startsWith('editinvoice') ? 'createinvoice' : firstSegment;
            return service.getMenuPermission(userRole, fallbackSegment).pipe(
              map((item3: any) => {
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

  const isAuth = authService.getAuthStatus();
  const username = authService.getUsername();
  const userRole = authService.getUserRole();

  if (isAuth && username && userRole) {
    return checkMenuAccess();
  }

  return authService.checkRememberedSession().pipe(
    switchMap(session => {
      if (!session?.rememberedSession || !session.pinRequired) {
        toastr.warning('Unauthorized access');
        router.navigateByUrl('/login');
        return of(false);
      }

      const dialogRef = dialog.open(AuthPinDialogComponent, {
        disableClose: true,
        panelClass: 'auth-pin-dialog-panel',
        data: { mode: 'validate', username: session.username }
      });

      return dialogRef.afterClosed().pipe(
        switchMap(result => {
          if (!result?.pin) {
            router.navigateByUrl('/login');
            return of(false);
          }

          return authService.validateRememberedPin(result.pin).pipe(
            switchMap(() => checkMenuAccess()),
            catchError(error => {
              toastr.error(error?.error?.errorMessage || 'PIN validation failed. Please login with password.', 'Access PIN');
              router.navigateByUrl('/login');
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
