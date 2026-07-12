import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../_service/authentication.service';
import { SelectedCompanyService } from '../_service/selected-company.service';

/**
 * Route guard for tenant-scoped pages.
 *
 * For super_admin: if no company is selected, navigation is blocked and the user
 * is shown a toast via the toolbar (the toolbar auto-opens the company dropdown
 * if only one company exists). The user is NOT redirected to a separate page —
 * we stay on the current page with a graceful failure because there is no
 * dedicated /select-company route in this app.
 *
 * For all other roles: the guard is a transparent pass-through.
 *
 * Usage in app.routes.ts:
 *   canActivate: [authGuard, superAdminCompanyGuard]
 */
export const superAdminCompanyGuard: CanActivateFn = (route, state) => {
  const auth            = inject(AuthService);
  const selectedCompany = inject(SelectedCompanyService);
  const router          = inject(Router);

  const role       = (auth.getUserRole() || '').toLowerCase();
  const isSuperAdmin = role === 'super_admin' || role === 'superadmin';

  // Non-super-admin users always use their own fixed company — allow through
  if (!isSuperAdmin) return true;

  const companyId = selectedCompany.getSelectedCompanyId();
  if (companyId) return true;

  // super_admin has no company selected: redirect to home with a query param
  // so the appmenu component can detect and open the company selector.
  // We do NOT redirect to a separate page because no such route exists.
  console.warn('[superAdminCompanyGuard] super_admin tried to access tenant page without selecting a company.');
  router.navigate(['/'], { queryParams: { selectCompany: 'true' } });
  return false;
};
