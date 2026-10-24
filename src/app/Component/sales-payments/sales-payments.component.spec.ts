import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { of } from 'rxjs';
import { AuthService } from '../../_service/authentication.service';
import { LedgerService } from '../../_service/ledger.service';
import { MasterService } from '../../_service/master.service';
import { SelectedCompanyService } from '../../_service/selected-company.service';
import { SalesPaymentsComponent } from './sales-payments.component';

describe('SalesPaymentsComponent', () => {
  let fixture: ComponentFixture<SalesPaymentsComponent>;
  let component: SalesPaymentsComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SalesPaymentsComponent],
      providers: [
        { provide: LedgerService, useValue: { getPaymentsByCompanyId: () => of({ data: [] }) } },
        {
          provide: MasterService,
          useValue: {
            GetCustomer: () => of([
              { uniqueKeyID: 'CUST001', name: 'Northwind Retail', phone: '555-0100' },
              { uniqueKeyID: 'CUST002', name: 'Contoso' }
            ])
          }
        },
        { provide: AuthService, useValue: { getCompanyId: () => 'COMP001' } },
        {
          provide: SelectedCompanyService,
          useValue: { selectedCompanyId$: of('COMP001'), getSelectedCompanyId: () => 'COMP001' }
        },
        { provide: MatDialog, useValue: { open: jasmine.createSpy('open') } },
        { provide: ToastrService, useValue: { error: jasmine.createSpy('error'), success: jasmine.createSpy('success') } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SalesPaymentsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('filters receipt history by the selected customer ID', () => {
    component.payments = [
      { paymentId: 1, customerId: 'CUST001', customerName: 'Northwind Retail', paymentNumber: 'REC-1' },
      { paymentId: 2, customerId: 'CUST002', customerName: 'Contoso', paymentNumber: 'REC-2' }
    ];
    component.selectPaymentCustomer(component.customers.find(customer => customer.uniqueKeyID === 'CUST001'));

    expect(component.visiblePayments.map(payment => payment.paymentId)).toEqual([1]);
  });

  it('matches the selected customer by name when a receipt has no customer ID', () => {
    component.payments = [
      { paymentId: 1, customerName: 'Northwind Retail', paymentNumber: 'REC-1' },
      { paymentId: 2, customerName: 'Contoso', paymentNumber: 'REC-2' }
    ];
    component.selectPaymentCustomer(component.customers.find(customer => customer.uniqueKeyID === 'CUST001'));

    expect(component.visiblePayments.map(payment => payment.paymentId)).toEqual([1]);
  });

  it('combines selected customer and receipt text filters', () => {
    component.payments = [
      { paymentId: 1, customerId: 'CUST001', customerName: 'Northwind Retail', paymentNumber: 'REC-1' },
      { paymentId: 2, customerId: 'CUST001', customerName: 'Northwind Retail', paymentNumber: 'REC-2' },
      { paymentId: 3, customerId: 'CUST002', customerName: 'Contoso', paymentNumber: 'REC-1' }
    ];
    component.selectPaymentCustomer(component.customers.find(customer => customer.uniqueKeyID === 'CUST001'));
    component.search = 'REC-2';

    expect(component.visiblePayments.map(payment => payment.paymentId)).toEqual([2]);
  });

  it('clears the selected customer filter to show all receipts', () => {
    component.payments = [
      { paymentId: 1, customerId: 'CUST001' },
      { paymentId: 2, customerId: 'CUST002' }
    ];
    component.selectPaymentCustomer(component.customers.find(customer => customer.uniqueKeyID === 'CUST001'));

    component.clearPaymentCustomerFilter();

    expect(component.selectedPaymentCustomer).toBeNull();
    expect(component.visiblePayments.length).toBe(2);
  });

  it('filters customer choices by contact information', () => {
    component.paymentCustomerSearch.setValue('555-0100');

    expect(component.filteredPaymentCustomers.map(customer => customer.uniqueKeyID)).toEqual(['CUST001']);
  });
});
