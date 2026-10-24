import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ToastrModule } from 'ngx-toastr';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { HomeComponent } from './home.component';
import { DashboardSummary } from '../../_service/dashboard.service';

describe('HomeComponent', () => {
  let component: HomeComponent;
  let fixture: ComponentFixture<HomeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HomeComponent,
        HttpClientTestingModule,
        RouterTestingModule,
        ToastrModule.forRoot(),
        BrowserAnimationsModule
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should route each business performance metric to its matching page', () => {
    component.summary = {
      fromDate: '',
      toDate: '',
      totalAR: 0,
      totalPaid: 0,
      overdueAmount: 0,
      activeCustomers: 0,
      invoiceCount: 0,
      purchaseCount: 0,
      orderCount: 0,
      totalSales: 0,
      totalSalesReturns: 0,
      salesRefunds: 0,
      netSales: 0,
      totalPurchases: 0,
      totalPurchaseReturns: 0,
      purchaseRefunds: 0
    } satisfies DashboardSummary;

    const routes = Object.fromEntries(
      component.kpiMetrics.map(metric => [metric.label, metric.route])
    );

    expect(routes).toEqual({
      'Total A/R': '/ledger-outstanding-ar',
      'Total Payment Received': '/ledger-dashboard',
      Overdue: '/ledger-outstanding-ar',
      'Active Customers': '/customer',
      'Invoice Count': '/listinvoice',
      'Total Sales': '/listinvoice',
      'Total Purchases': '/purchase/invoices',
      'Sales Refunds': '/sales-returns',
      'Purchase Refunds': '/purchase/returns',
      'Current Stock Value': '/purchase/reports',
      'Total Earnings (Net Sales)': '/sales-reports'
    });
  });
});
