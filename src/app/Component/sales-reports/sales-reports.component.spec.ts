import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MatPaginator } from '@angular/material/paginator';
import { of } from 'rxjs';
import { AuthService } from '../../_service/authentication.service';
import { InvoiceService } from '../../_service/invoice.service';
import { MasterService } from '../../_service/master.service';
import { SelectedCompanyService } from '../../_service/selected-company.service';
import { ToastrService } from 'ngx-toastr';
import { SalesReportsComponent } from './sales-reports.component';

describe('SalesReportsComponent', () => {
  let fixture: ComponentFixture<SalesReportsComponent>;
  let component: SalesReportsComponent;
  let invoiceService: jasmine.SpyObj<InvoiceService>;

  beforeEach(async () => {
    invoiceService = jasmine.createSpyObj<InvoiceService>('InvoiceService', ['getSalesReport']);
    invoiceService.getSalesReport.and.returnValue(of({ result: 'pass', data: [] }));

    await TestBed.configureTestingModule({
      imports: [SalesReportsComponent],
      providers: [
        { provide: InvoiceService, useValue: invoiceService },
        { provide: AuthService, useValue: { getCompanyId: () => 'COMP00001' } },
        { provide: SelectedCompanyService, useValue: { selectedCompanyId$: of('COMP00001'), getSelectedCompanyId: () => 'COMP00001' } },
        { provide: MasterService, useValue: { GetCustomer: () => of([]) } },
        { provide: ToastrService, useValue: { error: jasmine.createSpy('error'), success: jasmine.createSpy('success') } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SalesReportsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('defaults to the current assessment year', () => {
    const today = new Date();
    const startYear = today.getMonth() < 3 ? today.getFullYear() - 1 : today.getFullYear();

    expect(component.filterForm.value.fromDate).toEqual(new Date(startYear, 3, 1));
    expect(component.filterForm.value.toDate).toEqual(new Date(startYear + 1, 2, 31));
  });

  it('defaults pagination to 500 and provides the requested page sizes', () => {
    expect(component.pageSizeOptions).toEqual([10, 20, 50, 100, 200, 500, 1000]);
    component.dataSource.data = [{}];
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.directive(MatPaginator)).componentInstance.pageSize).toBe(500);
  });

  it('sends the selected dates when running a report', () => {
    component.filterForm.patchValue({
      fromDate: new Date(2025, 3, 1),
      toDate: new Date(2026, 2, 31)
    });

    component.runReport();

    expect(invoiceService.getSalesReport).toHaveBeenCalledWith(jasmine.objectContaining({
      fromDate: '2025-04-01',
      toDate: '2026-03-31',
      companyId: 'COMP00001'
    }));
  });

  it('rejects a reversed date range without loading report data', () => {
    invoiceService.getSalesReport.calls.reset();
    component.filterForm.patchValue({
      fromDate: new Date(2026, 2, 31),
      toDate: new Date(2025, 3, 1)
    });

    component.runReport();

    expect(invoiceService.getSalesReport).not.toHaveBeenCalled();
    expect(component.dateRangeError).toBe('From Date must be on or before To Date.');
  });
});
