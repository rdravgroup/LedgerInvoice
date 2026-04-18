import { CanActivateFn, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { inject } from '@angular/core';
import { AuthService } from '../_service/authentication.service';

export const superAdminGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const toastr = inject(ToastrService);

  const authService = inject(AuthService);
  const userRole = authService.getUserRole();
  const username = authService.getUsername();

  // Check if user is logged in
  if (!username || !userRole) {
    toastr.warning('Please login to access this resource');
    router.navigateByUrl('/login');
    return false;
  }

  // Check if user is super_admin
  if (userRole.toLowerCase() === 'super_admin' || userRole.toLowerCase() === 'superadmin') {
    return true;
  }

  // User is not super_admin
  toastr.error('You do not have permission to access this resource. Only Super Admin users can access this page.', 'Access Denied');
  router.navigateByUrl('/');
  return false;
};
