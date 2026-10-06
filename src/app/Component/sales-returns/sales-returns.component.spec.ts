import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MatPaginator } from '@angular/material/paginator';
import { of } from 'rxjs';
import { AuthService } from '../../_service/authentication.service';
import { InvoiceService } from '../../_service/invoice.service';
import { MasterService } from '../../_service/master.service';
import { SelectedCompanyService } from '../../_service/selected-company.service';
import { ToastrService } from 'ngx-toastr';
import { SalesReturnsComponent } from './sales-returns.component';

describe('SalesReturnsComponent', () => {
  let fixture: ComponentFixture<SalesReturnsComponent>;
  let component: SalesReturnsComponent;
  let invoiceService: jasmine.SpyObj<InvoiceService>;

  beforeEach(async () => {
    invoiceService = jasmine.createSpyObj<InvoiceService>('InvoiceService', ['getSalesReport', 'exportSalesCsv']);
    invoiceService.getSalesReport.and.returnValue(of({ data: [] }));
    invoiceService.exportSalesCsv.and.returnValue(of(new Blob()));

    await TestBed.configureTestingModule({
      imports: [SalesReturnsComponent],
      providers: [
        { provide: InvoiceService, useValue: invoiceService },
        { provide: AuthService, useValue: { getCompanyId: () => 'COMP00001' } },
        { provide: SelectedCompanyService, useValue: { selectedCompanyId$: of('COMP00001'), getSelectedCompanyId: () => 'COMP00001' } },
        { provide: MasterService, useValue: { GetCustomer: () => of([]) } },
        { provide: ToastrService, useValue: { error: jasmine.createSpy('error') } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SalesReturnsComponent);
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

  it('requests returns for the selected date range and customer', () => {
    component.filterForm.patchValue({
      fromDate: new Date(2025, 3, 1),
      toDate: new Date(2026, 2, 31),
      customerId: 'CUST001'
    });

    component.runReport();

    expect(invoiceService.getSalesReport).toHaveBeenCalledWith(jasmine.objectContaining({
      companyId: 'COMP00001',
      customerId: 'CUST001',
      fromDate: '2025-04-01',
      toDate: '2026-03-31',
      reportType: 'returns'
    }));
  });

  it('rejects reversed dates without requesting data', () => {
    invoiceService.getSalesReport.calls.reset();
    component.filterForm.patchValue({
      fromDate: new Date(2026, 2, 31),
      toDate: new Date(2025, 3, 1)
    });

    component.runReport();

    expect(invoiceService.getSalesReport).not.toHaveBeenCalled();
    expect(component.dateRangeError).toBe('From Date must be on or before To Date.');
  });

  it('filters the customer selector by name and contact details', () => {
    component.customers = [
      { uniqueKeyID: 'CUST001', name: 'Northwind Retail', phone: '555-0100' },
      { uniqueKeyID: 'CUST002', name: 'Contoso' }
    ];
    component.customerSearch.setValue('555-0100');
    component.onCustomerSearchInput();

    expect(component.filteredCustomers.map(customer => customer.uniqueKeyID)).toEqual(['CUST001']);
  });

  it('formats report amounts with Indian digit grouping', () => {
    expect(component.formatAmount(1234567.89)).toBe('12,34,567.89');
  });
});
