import { registerLocaleData } from '@angular/common';
import localeEnIn from '@angular/common/locales/en-IN';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthService } from '../_service/authentication.service';
import { CompanyService } from '../_service/company.service';
import { CompanyNumberFormatService } from '../_service/company-number-format.service';
import { SelectedCompanyService } from '../_service/selected-company.service';
import { CompanyNumberPipe } from './company-number.pipe';

describe('CompanyNumberPipe', () => {
  let numberFormat: CompanyNumberFormatService;
  let pipe: CompanyNumberPipe;

  beforeEach(() => {
    registerLocaleData(localeEnIn);
    TestBed.configureTestingModule({
      providers: [
        CompanyNumberFormatService,
        { provide: AuthService, useValue: { companyId$: of('COMP00001') } },
        { provide: SelectedCompanyService, useValue: { selectedCompanyId$: of(null) } },
        {
          provide: CompanyService,
          useValue: { getCompanyById: () => of({ currencyNumberFormat: 'en-IN' }) }
        }
      ]
    });

    numberFormat = TestBed.inject(CompanyNumberFormatService);
    pipe = new CompanyNumberPipe(numberFormat);
  });

  it('uses Indian grouping by default', () => {
    expect(pipe.transform(1460586.94)).toBe('14,60,586.94');
  });

  it('uses International grouping when selected', () => {
    numberFormat.setCompanyFormat('COMP00001', 'en-US');

    expect(pipe.transform(1460586.94)).toBe('1,460,586.94');
  });
});
