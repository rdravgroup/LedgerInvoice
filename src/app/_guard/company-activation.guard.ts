import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { CompanyService } from '../_service/company.service';
import { MasterService } from '../_service/master.service';
import { AuthService } from '../_service/authentication.service';
import { SelectedCompanyService } from '../_service/selected-company.service';
import { normalizeSubscriptionStatus } from '../_service/api-response-utils';
import { of, catchError, map, switchMap } from 'rxjs';

export const companyActivationGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const toastr = inject(ToastrService);
  const companyService = inject(CompanyService);
  const masterService = inject(MasterService);
  const authService = inject(AuthService);
  const selectedCompanyService = inject(SelectedCompanyService);

  const companyId = selectedCompanyService.getSelectedCompanyId() || authService.getCompanyId();
  if (!companyId) {
    return true;
  }

  const inactiveRedirect = router.createUrlTree(['/company']);
  const warnAndRedirect = () => {
    toastr.warning('Your selected company is inactive. Activate it from Company page.');
    return inactiveRedirect;
  };

  return companyService.getCompanyById(companyId).pipe(
    switchMap((company: any) => {
      const status = (company?.status ?? '').toString().trim().toLowerCase();
      if (status !== 'active') {
        return of(warnAndRedirect());
      }

      return masterService.GetSubscriptionStatus(companyId).pipe(
        map((resp: any) => {
          const subscriptionState = normalizeSubscriptionStatus(resp);
          if (!subscriptionState.hasSubscription || !subscriptionState.isActive) {
            return warnAndRedirect();
          }
          return true;
        }),
        catchError(() => of(true))
      );
    }),
    catchError(() => of(true))
  );
};
