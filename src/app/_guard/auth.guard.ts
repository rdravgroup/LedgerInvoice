import { CanActivateFn, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { UserService } from '../_service/user.service';
import { AuthService } from '../_service/authentication.service';
import { inject } from '@angular/core';
import { map } from 'rxjs';

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
  const personalRoutes = ['resetpassword', 'updatepassword', 'profile', 'userprofile', 'quick-invoice'];
  if (personalRoutes.includes(menuname)) {
    return true;
  }

  // Return Observable that resolves to boolean
  return service.getMenuPermission(userRole, menuname).pipe(
    map((item) => {
      if (item.haveview) {
        return true;
      } else {
        toastr.warning('Unauthorized access');
        router.navigateByUrl('/');
        return false;
      }
    })
  );
};
