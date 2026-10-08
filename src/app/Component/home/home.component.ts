import { Component, OnInit, OnDestroy, Injectable } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE, NativeDateAdapter } from '@angular/material/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, interval } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MaterialModule } from '../../material.module';
import { UserService } from '../../_service/user.service';
import { AuthService } from '../../_service/authentication.service';
import { SelectedCompanyService } from '../../_service/selected-company.service';
import { Company } from '../../_model/company.model';
import { CompanyNumberFormatService } from '../../_service/company-number-format.service';
import { CustomerService } from '../../_service/customer.service';
import { customer } from '../../_model/customer.model';
import {
  DashboardAlert,
  DashboardAnalytics,
  DashboardService,
  DashboardStockSummary,
  DashboardSummary,
  DashboardTransaction
} from '../../_service/dashboard.service';

const DASHBOARD_DATE_FORMATS = {
  parse: { dateInput: { day: '2-digit', month: '2-digit', year: 'numeric' } },
  display: {
    dateInput: { day: '2-digit', month: '2-digit', year: 'numeric' },
    monthYearLabel: { month: 'short', year: 'numeric' },
    dateA11yLabel: { day: 'numeric', month: 'long', year: 'numeric' },
    monthYearA11yLabel: { month: 'long', year: 'numeric' }
  }
};

@Injectable()
class DashboardDateAdapter extends NativeDateAdapter {
  override format(date: Date, _displayFormat: unknown): string {
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  }

  override parse(value: unknown): Date | null {
    if (typeof value !== 'string') return super.parse(value, '');
    const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return null;
    const day = Number(match[1]);
    const month = Number(match[2]) - 1;
    const year = Number(match[3]);
    const date = new Date(year, month, day);
    return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day
      ? date
      : null;
  }
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, MaterialModule, RouterLink, FormsModule],
  providers: [
    { provide: DateAdapter, useClass: DashboardDateAdapter },
    { provide: MAT_DATE_LOCALE, useValue: 'en-GB' },
    { provide: MAT_DATE_FORMATS, useValue: DASHBOARD_DATE_FORMATS }
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  company?: Company;
  companyId = '';
  summary?: DashboardSummary;
  analytics?: DashboardAnalytics;
  stock?: DashboardStockSummary;
  transactions: DashboardTransaction[] = [];
  alerts: DashboardAlert[] = [];
  customerOptions: customer[] = [];
  customerSearchText = '';
  filteredCustomerOptions: customer[] = [];
  selectedCustomerId = '';
  customerLoading = false;
  customerError = '';
  fromDate: Date;
  toDate: Date;
  selectedMonth = '';
  readonly months = [
    { value: '1', label: 'January' }, { value: '2', label: 'February' },
    { value: '3', label: 'March' }, { value: '4', label: 'April' },
    { value: '5', label: 'May' }, { value: '6', label: 'June' },
    { value: '7', label: 'July' }, { value: '8', label: 'August' },
    { value: '9', label: 'September' }, { value: '10', label: 'October' },
    { value: '11', label: 'November' }, { value: '12', label: 'December' }
  ];
  summaryLoading = true;
  analyticsLoading = true;
  stockLoading = true;
  transactionsLoading = true;
  alertsLoading = true;
  summaryError = '';
  analyticsError = '';
  stockError = '';
  transactionsError = '';
  alertsError = '';
  readonly transactionColumns = ['date', 'type', 'reference', 'party', 'amount', 'status'];
  activeTransactionTab: 'sales' | 'purchases' | 'refunds' | 'ledger' = 'sales';
  readonly transactionTabs = [
    { id: 'sales' as const, label: 'Sales', icon: 'point_of_sale', route: '/listinvoice' },
    { id: 'purchases' as const, label: 'Purchases', icon: 'shopping_bag', route: '/purchase/invoices' },
    { id: 'refunds' as const, label: 'Refunds', icon: 'currency_exchange', route: '/sales-returns' },
    { id: 'ledger' as const, label: 'Ledger', icon: 'account_balance', route: '/ledger-dashboard' }
  ];

  constructor(
    private readonly userSvc: UserService,
    private authService: AuthService,
    private readonly selectedCompanyService: SelectedCompanyService,
    private readonly dashboardService: DashboardService,
    private readonly customerService: CustomerService,
    readonly numberFormat: CompanyNumberFormatService,
    private readonly router: Router
  ) {
    const today = new Date();
    const startYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
    this.fromDate = new Date(startYear, 3, 1);
    this.toDate = new Date(startYear + 1, 2, 31);
  }

  ngOnInit(): void {
    this.selectedCompanyService.selectedCompanyId$.pipe(takeUntil(this.destroy$)).subscribe((cid) => {
      this.companyId = cid || this.authService.getCompanyId() || '';
      if (!this.companyId) {
        this.summaryLoading = false;
        this.analyticsLoading = false;
        this.stockLoading = false;
        this.transactionsLoading = false;
        this.alertsLoading = false;
        this.summaryError = 'Select a company to view dashboard statistics.';
        this.analyticsError = this.summaryError;
        this.stockError = this.summaryError;
        this.transactionsError = this.summaryError;
        this.alertsError = this.summaryError;
        this.summary = undefined;
        this.analytics = undefined;
        this.stock = undefined;
        this.transactions = [];
        this.alerts = [];
        this.customerOptions = [];
        this.filteredCustomerOptions = [];
        this.selectedCustomerId = '';
        this.customerError = '';
        this.company = undefined;
        return;
      }
      this.selectedCustomerId = '';
      this.customerSearchText = '';
      this.loadCustomers();
      this.loadCompany();
      this.loadSummary();
      this.loadAnalytics();
      this.loadStock();
      this.loadTransactions();
      this.loadAlerts();
    });

    interval(5 * 60 * 1000).pipe(takeUntil(this.destroy$)).subscribe(() => this.loadAlerts());
  }

  private loadCustomers(): void {
    if (!this.companyId) return;
    this.customerLoading = true;
    this.customerError = '';
    this.customerOptions = [];
    this.customerService.Getall(this.companyId).pipe(takeUntil(this.destroy$)).subscribe({
      next: customers => {
        this.customerOptions = (customers || []).filter(item =>
          !item.companyId || item.companyId === this.companyId
        ).sort((left, right) => left.name.localeCompare(right.name));
        this.filteredCustomerOptions = this.customerOptions;
        this.customerLoading = false;
      },
      error: error => {
        console.error('Dashboard customer list failed', error);
        this.customerError = 'Customer list could not be loaded.';
        this.customerLoading = false;
      }
    });
  }

  onCustomerSearch(value: string): void {
    this.customerSearchText = value;
    const query = value.trim().toLocaleLowerCase();
    this.filteredCustomerOptions = this.customerOptions.filter(item =>
      item.name.toLocaleLowerCase().includes(query) ||
      item.uniqueKeyID.toLocaleLowerCase().includes(query) ||
      (item.customer_company || '').toLocaleLowerCase().includes(query)
    );
  }

  onCustomerDropdownOpened(opened: boolean): void {
    if (!opened) return;
    this.customerSearchText = '';
    this.filteredCustomerOptions = this.customerOptions;
  }

  get activeCustomerCount(): number {
    if (this.selectedCustomerId) {
      return this.customerOptions.some(item => item.uniqueKeyID === this.selectedCustomerId && this.isActiveCustomer(item)) ? 1 : 0;
    }
    return Math.max(
      Number(this.summary?.activeCustomers) || 0,
      this.customerOptions.filter(item => this.isActiveCustomer(item)).length
    );
  }

  private isActiveCustomer(item: customer): boolean {
    const activeValue: unknown = item.isActive;
    return activeValue === true || activeValue === 1 ||
      ['true', '1', 'y', 'yes', 'active'].includes(String(activeValue).toLowerCase()) ||
      String(item.statusname || '').toLowerCase() === 'active';
  }

  get selectedCustomerName(): string {
    return this.customerOptions.find(item => item.uniqueKeyID === this.selectedCustomerId)?.name || '';
  }

  onCustomerChange(): void {
    this.customerSearchText = this.selectedCustomerName;
    this.loadSummary();
    this.loadAnalytics();
    this.loadTransactions();
  }

  get visibleTransactions(): DashboardTransaction[] {
    return this.transactions.filter(row => {
      const type = row.type.toLowerCase();
      switch (this.activeTransactionTab) {
        case 'sales': return type === 'sales';
        case 'purchases': return type === 'purchase';
        case 'refunds': return type.includes('refund');
        case 'ledger': return type.includes('ledger');
      }
    });
  }

  get activeTransactionRoute(): string {
    return this.transactionTabs.find(tab => tab.id === this.activeTransactionTab)?.route || '/listinvoice';
  }

  selectTransactionTab(tab: 'sales' | 'purchases' | 'refunds' | 'ledger'): void {
    this.activeTransactionTab = tab;
  }

  private loadCompany(): void {
    if (!this.companyId) {
      this.company = undefined;
      return;
    }
    this.userSvc.getCompanyById(this.companyId).pipe(takeUntil(this.destroy$)).subscribe({
      next: company => this.company = company,
      error: error => {
        console.error('Dashboard company details failed', error);
        this.company = undefined;
      }
    });
  }

  applyFilters(): void {
    if (!this.fromDate || !this.toDate || this.fromDate > this.toDate) {
      this.summaryError = 'Choose a valid date range. From Date must be on or before To Date.';
      this.transactionsError = this.summaryError;
      return;
    }
    this.loadSummary();
    this.loadAnalytics();
    this.loadTransactions();
  }

  onMonthChange(): void {
    if (!this.selectedMonth) return;
    const fiscalYear = this.fromDate.getMonth() >= 3
      ? this.fromDate.getFullYear()
      : this.fromDate.getFullYear() - 1;
    const month = Number(this.selectedMonth) - 1;
    const year = month >= 3 ? fiscalYear : fiscalYear + 1;
    this.fromDate = new Date(year, month, 1);
    this.toDate = new Date(year, month + 1, 0);
  }

  private loadSummary(): void {
    if (!this.companyId) return;
    this.summaryLoading = true;
    this.summaryError = '';
    this.summary = undefined;
    this.dashboardService.getSummary(
      this.companyId, this.toApiDate(this.fromDate), this.toApiDate(this.toDate), this.selectedCustomerId
    ).pipe(takeUntil(this.destroy$)).subscribe({
      next: summary => {
        this.summary = summary;
        this.summaryLoading = false;
      },
      error: error => {
        console.error('Dashboard summary failed', error);
        this.summaryError = 'Dashboard statistics could not be loaded.';
        this.summaryLoading = false;
      }
    });
  }

  private loadTransactions(): void {
    if (!this.companyId) return;
    this.transactionsLoading = true;
    this.transactionsError = '';
    this.transactions = [];
    this.dashboardService.getTransactions(
      this.companyId, this.toApiDate(this.fromDate), this.toApiDate(this.toDate), this.selectedCustomerId
    ).pipe(takeUntil(this.destroy$)).subscribe({
      next: rows => {
        this.transactions = rows;
        this.transactionsLoading = false;
      },
      error: error => {
        console.error('Dashboard transactions failed', error);
        this.transactionsError = 'Recent transactions could not be loaded.';
        this.transactionsLoading = false;
      }
    });
  }

  private loadAnalytics(): void {
    if (!this.companyId) return;
    this.analyticsLoading = true;
    this.analyticsError = '';
    this.analytics = undefined;
    this.dashboardService.getAnalytics(
      this.companyId, this.toApiDate(this.fromDate), this.toApiDate(this.toDate), this.selectedCustomerId
    ).pipe(takeUntil(this.destroy$)).subscribe({
      next: analytics => {
        this.analytics = analytics;
        this.analyticsLoading = false;
      },
      error: error => {
        console.error('Dashboard analytics failed', error);
        this.analyticsError = 'Charts and product distribution could not be loaded.';
        this.analyticsLoading = false;
      }
    });
  }

  private loadStock(): void {
    if (!this.companyId) return;
    this.stockLoading = true;
    this.stockError = '';
    this.stock = undefined;
    this.dashboardService.getStockSummary(this.companyId).pipe(takeUntil(this.destroy$)).subscribe({
      next: stock => {
        this.stock = stock;
        this.stockLoading = false;
      },
      error: error => {
        console.error('Dashboard stock summary failed', error);
        this.stockError = 'Stock summary could not be loaded.';
        this.stockLoading = false;
      }
    });
  }

  private loadAlerts(): void {
    if (!this.companyId) return;
    this.alertsLoading = true;
    this.alertsError = '';
    this.alerts = [];
    this.dashboardService.getAlerts(this.companyId).pipe(takeUntil(this.destroy$)).subscribe({
      next: alerts => {
        this.alerts = alerts;
        this.alertsLoading = false;
      },
      error: error => {
        console.error('Dashboard alerts failed', error);
        this.alertsError = 'Notifications could not be loaded.';
        this.alertsLoading = false;
      }
    });
  }

  retryStock(): void {
    this.loadStock();
  }

  retryCustomers(): void {
    this.loadCustomers();
  }

  get filterQueryParams(): { fromDate: string; toDate: string } {
    return { fromDate: this.toApiDate(this.fromDate), toDate: this.toApiDate(this.toDate) };
  }

  get salesLinePoints(): string {
    return this.makeLinePoints((row) => row.sales);
  }

  get purchaseLinePoints(): string {
    return this.makeLinePoints((row) => row.purchases);
  }

  get assessmentYearRows(): { assessmentYear: number; sales: number; purchases: number; max: number }[] {
    return (this.analytics?.assessmentTrends ?? []).map(row => ({
      ...row,
      max: Math.max(row.sales, row.purchases, 1)
    }));
  }

  get topProductRows(): NonNullable<DashboardAnalytics['topProducts']> {
    return this.analytics?.topProducts ?? [];
  }

  topProductWidth(amount: number): number {
    const max = Math.max(...this.topProductRows.map(item => item.salesAmount), 1);
    return Math.max(amount === 0 ? 0 : 3, amount / max * 100);
  }

  navigate(route: string): void {
    this.router.navigate([route], { queryParams: this.filterQueryParams });
  }

  formatAmount(value: number | null | undefined): string {
    return `₹${this.numberFormat.format(value)}`;
  }

  formatCompactAmount(value: number | null | undefined): string {
    const amount = Number(value) || 0;
    const absolute = Math.abs(amount);
    if (absolute >= 100000000000) return `₹${(amount / 100000000000).toFixed(1)}K Cr`;
    if (absolute >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`;
    if (absolute >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
    if (absolute >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
    return this.formatAmount(amount);
  }

  get kpiMetrics(): { label: string; value: number; kind: 'amount' | 'count'; tone: string; tooltip: string }[] {
    const summary = this.summary;
    if (!summary) return [];
    return [
      { label: 'Total A/R', value: summary.totalAR, kind: 'amount', tone: 'receivables', tooltip: 'Current customer receivables' },
      { label: 'Total Paid', value: summary.totalPaid, kind: 'amount', tone: 'paid', tooltip: 'Payments received in the selected period' },
      { label: 'Overdue', value: summary.overdueAmount, kind: 'amount', tone: 'overdue', tooltip: 'Receivables in overdue aging buckets' },
      { label: 'Active Customers', value: this.activeCustomerCount, kind: 'count', tone: 'customers', tooltip: 'Active customers in the selected company' },
      { label: 'Invoice Count', value: summary.invoiceCount, kind: 'count', tone: 'invoices', tooltip: 'Invoices issued in the selected date range' },
      { label: 'Total Sales', value: summary.totalSales, kind: 'amount', tone: 'sales', tooltip: 'Sales invoice totals for the selected period' },
      { label: 'Total Purchases', value: summary.totalPurchases, kind: 'amount', tone: 'purchases', tooltip: 'Company-wide purchases for the selected period' },
      { label: 'Sales Refunds', value: summary.salesRefunds, kind: 'amount', tone: 'refunds', tooltip: 'Sales refunds recorded during the selected period' },
      { label: 'Purchase Refunds', value: summary.purchaseRefunds, kind: 'amount', tone: 'refunds', tooltip: 'Company-wide purchase refunds during the selected period' },
      { label: 'Current Stock Value', value: this.stock?.currentStockValue ?? 0, kind: 'amount', tone: 'stock', tooltip: 'Current stock value using latest available purchase cost' },
      { label: 'Total Earnings (Net Sales)', value: summary.netSales, kind: 'amount', tone: 'earnings', tooltip: 'Net sales after sales returns; not a profit calculation' }
    ];
  }

  metricDisplayValue(metric: { label: string; value: number; kind: 'amount' | 'count' }): string {
    if (metric.label === 'Active Customers' && this.customerLoading) return '…';
    if (metric.label === 'Current Stock Value' && this.stockLoading) return '…';
    if (metric.kind === 'amount') return this.formatCompactAmount(metric.value);
    return this.numberFormat.format(metric.value, '1.0-0');
  }

  metricWidth(metric: { value: number; kind: 'amount' | 'count' }): number {
    const peers = this.kpiMetrics.filter(item => item.kind === metric.kind);
    const maximum = Math.max(...peers.map(item => Math.abs(item.value)), 1);
    return Math.max(metric.value === 0 ? 0 : 4, Math.min(100, Math.abs(metric.value) / maximum * 100));
  }

  private makeLinePoints(value: (row: DashboardAnalytics['monthlyTrends'][number]) => number): string {
    const rows = this.analytics?.monthlyTrends ?? [];
    if (!rows.length) return '';
    const max = Math.max(...rows.map(value), 1);
    const divisor = Math.max(rows.length - 1, 1);
    return rows.map((row, index) => {
      const x = 12 + (index / divisor) * 576;
      const y = 184 - (value(row) / max) * 160;
      return `${x},${y}`;
    }).join(' ');
  }

  private toApiDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}