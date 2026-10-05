import { Injectable } from '@angular/core';
import { formatNumber as angularFormatNumber } from '@angular/common';
import { combineLatest, of } from 'rxjs';
import { catchError, distinctUntilChanged, map, switchMap } from 'rxjs/operators';
import { AuthService } from './authentication.service';
import { CompanyService } from './company.service';
import { SelectedCompanyService } from './selected-company.service';

export type CompanyNumberFormat = 'en-IN' | 'en-US';

@Injectable({ providedIn: 'root' })
export class CompanyNumberFormatService {
  private activeCompanyId: string | null = null;
  private activeFormat: CompanyNumberFormat = 'en-IN';

  constructor(
    auth: AuthService,
    selectedCompany: SelectedCompanyService,
    companyService: CompanyService
  ) {
    combineLatest([auth.companyId$, selectedCompany.selectedCompanyId$]).pipe(
      map(([authenticatedCompanyId, selectedCompanyId]) => selectedCompanyId || authenticatedCompanyId),
      distinctUntilChanged(),
      switchMap(companyId => {
        this.activeCompanyId = companyId;
        this.activeFormat = 'en-IN';
        if (!companyId) return of({ companyId, format: 'en-IN' as CompanyNumberFormat });
        return companyService.getCompanyById(companyId).pipe(
          map(company => ({
            companyId,
            format: this.normalize(company?.currencyNumberFormat)
          })),
          catchError(error => {
            console.error(`Failed to load currency number format for company ${companyId}`, error);
            return of({ companyId, format: 'en-IN' as CompanyNumberFormat });
          })
        );
      })
    ).subscribe(({ companyId, format }) => {
      if (companyId === this.activeCompanyId) this.activeFormat = format;
    });
  }

  get locale(): CompanyNumberFormat {
    return this.activeFormat;
  }

  setCompanyFormat(companyId: string | undefined, format: string | undefined): void {
    if (companyId && companyId === this.activeCompanyId) {
      this.activeFormat = this.normalize(format);
    }
  }

  format(value: number | null | undefined, digitsInfo = '1.2-2'): string {
    const numericValue = value == null || !Number.isFinite(Number(value)) ? 0 : Number(value);
    return angularFormatNumber(numericValue, this.locale, digitsInfo);
  }

  private normalize(value: string | undefined): CompanyNumberFormat {
    return value?.toLowerCase() === 'en-us' ? 'en-US' : 'en-IN';
  }
}
