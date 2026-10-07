import { Component, Injectable, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE, NativeDateAdapter } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { jsPDF } from 'jspdf';
import { forkJoin, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MaterialModule } from '../../../material.module';
import { LedgerService } from '../../../_service/ledger.service';
import { CustomerService } from '../../../_service/customer.service';
import { AuthService } from '../../../_service/authentication.service';
import { SelectedCompanyService } from '../../../_service/selected-company.service';
import { CustomerDetailsDialogComponent } from '../customer-details-dialog/customer-details-dialog.component';
import { ToastrService } from 'ngx-toastr';
import { ageDistribution, customerOutstanding, ledgerSummary } from '../../../_model/ledger.model';
import { customer } from '../../../_model/customer.model';

const LEDGER_DATE_FORMATS = {
  parse: { dateInput: { day: '2-digit', month: '2-digit', year: 'numeric' } },
  display: {
    dateInput: { day: '2-digit', month: '2-digit', year: 'numeric' },
    monthYearLabel: { month: 'short', year: 'numeric' },
    dateA11yLabel: { day: 'numeric', month: 'long', year: 'numeric' },
    monthYearA11yLabel: { month: 'long', year: 'numeric' }
  }
};

@Injectable()
class LedgerDateAdapter extends NativeDateAdapter {
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
    const parsed = new Date(year, month, day);
    return parsed.getFullYear() === year && parsed.getMonth() === month && parsed.getDate() === day
      ? parsed
      : null;
  }
}

interface LedgerRow {
  ledgerId: number;
  referenceType: string;
  referenceNumber: string;
  transactionDate: string;
  debit: number;
  credit: number;
  balance: number;
  description: string;
  daysOverdue: number;
  ageingBucket: string;
}

interface PaymentTrend {
  key: string;
  label: string;
  amount: number;
}

interface LedgerAlert {
  type: 'overdue' | 'low-payment' | 'pending';
  title: string;
  detail: string;
  amount: number;
  customerId?: string;
}

@Component({
  selector: 'app-ledger-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule],
  providers: [
    { provide: DateAdapter, useClass: LedgerDateAdapter },
    { provide: MAT_DATE_LOCALE, useValue: 'en-GB' },
    { provide: MAT_DATE_FORMATS, useValue: LEDGER_DATE_FORMATS }
  ],
  templateUrl: './ledger-dashboard.component.html',
  styleUrls: ['./ledger-dashboard.component.css']
})
export class LedgerDashboardComponent implements OnInit, OnDestroy {
  companySummary: ledgerSummary | null = null;
  ageDistribution: ageDistribution | null = null;
  companyId = '';
  selectedCustomer: customerOutstanding | null = null;
  selectedCustomerId = '';
  customerOptions: customer[] = [];
  customerSearch = '';
  filteredCustomerOptions: customer[] = [];
  customerListLoading = false;
  customerListError: string | null = null;
  selectedCustomerSummary: ledgerSummary | null = null;
  selectedCustomerAgeDistribution: ageDistribution | null = null;
  activeAlert: LedgerAlert | null = null;
  statementRows: LedgerRow[] = [];
  filteredStatementRows: LedgerRow[] = [];
  paymentTrends: PaymentTrend[] = [];
  notificationItems: LedgerAlert[] = [];
  private companyNotificationItems: LedgerAlert[] = [];

  summaryLoading = true;
  ageingLoading = true;
  customerLoading = false;
  statementLoading = false;
  notificationLoading = true;
  error: string | null = null;
  ageingError: string | null = null;
  statementError: string | null = null;
  notificationError: string | null = null;
  tableSearch = '';
  assessmentYear = '';
  fromDate: Date;
  toDate: Date;
  appliedFromDate: Date;
  appliedToDate: Date;
  dateFilterApplied = false;
  pageIndex = 0;
  pageSize = 500;
  totalRecords = 0;
  sortState: { active: string; direction: 'asc' | 'desc' | '' } = { active: 'date', direction: 'desc' };
  readonly pageSizeOptions = [100, 250, 500, 1000];
  readonly displayedColumns = ['serialNumber', 'customer', 'invoice', 'date', 'debit', 'credit', 'outstanding', 'status', 'actions'];

  readonly ageingBuckets = [
    { key: 'bucket_0_30', label: '0–30 days', color: '#16845b', className: 'age-0' },
    { key: 'bucket_30_60', label: '31–60 days', color: '#c47b08', className: 'age-30' },
    { key: 'bucket_60_90', label: '61–90 days', color: '#e26818', className: 'age-60' },
    { key: 'bucket_90_plus', label: '90+ days', color: '#c43d4b', className: 'age-90' }
  ] as const;
  readonly assessmentYears: { value: string; label: string; start: Date; end: Date }[];

  private readonly destroy$ = new Subject<void>();
  private isSuperRole = false;
  private allCustomerRows: LedgerRow[] = [];
  private selectedCustomerDetail: any = null;
  private requestVersion = 0;
  private selectedCustomerRequestVersion = 0;

  constructor(
    private readonly ledgerService: LedgerService,
    private readonly customerService: CustomerService,
    private readonly authService: AuthService,
    private readonly toastr: ToastrService,
    private readonly selectedCompanyService: SelectedCompanyService,
    private readonly dialog: MatDialog
  ) {
    const today = new Date();
    const currentAssessmentYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
    this.assessmentYears = Array.from({ length: 10 }, (_, index) => {
      const year = currentAssessmentYear - index;
      return {
        value: String(year),
        label: `${year}/${year + 1}`,
        start: new Date(year, 3, 1),
        end: new Date(year + 1, 2, 31)
      };
    });
    this.assessmentYear = this.assessmentYears[0].value;
    this.fromDate = this.assessmentYears[0].start;
    this.toDate = this.assessmentYears[0].end;
    this.appliedFromDate = this.fromDate;
    this.appliedToDate = this.toDate;
  }

  ngOnInit(): void {
    const role = (this.authService.getUserRole() || '').toLowerCase().replace(/[\s-]/g, '_');
    this.isSuperRole = ['super_admin', 'superadmin', 'super_duper_admin', 'superduper'].includes(role);
    this.selectedCompanyService.selectedCompanyId$.pipe(takeUntil(this.destroy$)).subscribe(selectedId => {
      this.companyId = this.isSuperRole
        ? selectedId || ''
        : this.authService.getCompanyId() || '';
      this.loadDashboardData();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadDashboardData(): void {
    const requestVersion = ++this.requestVersion;
    this.companySummary = null;
    this.ageDistribution = null;
    this.summaryLoading = true;
    this.ageingLoading = true;
    this.notificationLoading = true;
    this.error = null;
    this.ageingError = null;
    this.notificationError = null;
    this.customerListError = null;
    this.customerLoading = false;
    this.statementLoading = false;
    this.selectedCustomer = null;
    this.selectedCustomerRequestVersion++;
    this.selectedCustomerId = '';
    this.selectedCustomerSummary = null;
    this.selectedCustomerAgeDistribution = null;
    this.selectedCustomerDetail = null;
    this.activeAlert = null;
    this.customerOptions = [];
    this.filteredCustomerOptions = [];
    this.customerListLoading = true;
    this.statementRows = [];
    this.filteredStatementRows = [];
    this.paymentTrends = [];
    this.notificationItems = [];
    this.companyNotificationItems = [];
    this.allCustomerRows = [];

    if (!this.companyId) {
      this.summaryLoading = false;
      this.ageingLoading = false;
      this.notificationLoading = false;
      this.customerListLoading = false;
      this.error = 'Select a company from the application toolbar to view its ledger.';
      return;
    }

    this.customerService.Getall(this.companyId).pipe(takeUntil(this.destroy$)).subscribe({
      next: customers => {
        if (requestVersion !== this.requestVersion) return;
        this.customerOptions = (customers || [])
          .filter(item => !!item.uniqueKeyID && !!item.name)
          .sort((left, right) => left.name.localeCompare(right.name));
        this.filteredCustomerOptions = this.customerOptions;
        this.customerListLoading = false;
      },
      error: error => {
        if (requestVersion !== this.requestVersion) return;
        console.error('Company customer list failed', error);
        this.customerListError = error.message || 'Could not load this company’s customer list.';
        this.customerListLoading = false;
      }
    });

    this.ledgerService.getCompanySummary(this.companyId).pipe(takeUntil(this.destroy$)).subscribe({
      next: response => {
        if (requestVersion !== this.requestVersion) return;
        if (response.result === 'pass' && response.data) {
          this.companySummary = response.data as ledgerSummary;
          this.refreshNotifications();
        } else {
          this.error = response.errorMessage || 'Could not load the receivables summary.';
        }
        this.summaryLoading = false;
      },
      error: error => {
        if (requestVersion !== this.requestVersion) return;
        console.error('Customer ledger summary failed', error);
        this.error = error.message || 'Could not load the receivables summary.';
        this.summaryLoading = false;
      }
    });

    this.ledgerService.getAgeDistribution(this.companyId).pipe(takeUntil(this.destroy$)).subscribe({
      next: response => {
        if (requestVersion !== this.requestVersion) return;
        if (response.result === 'pass' && response.data) {
          this.ageDistribution = response.data as ageDistribution;
        } else {
          this.ageingError = response.errorMessage || 'Could not load ageing analysis.';
        }
        this.ageingLoading = false;
      },
      error: error => {
        if (requestVersion !== this.requestVersion) return;
        console.error('Customer ledger ageing report failed', error);
        this.ageingError = error.message || 'Could not load ageing analysis.';
        this.ageingLoading = false;
      }
    });

    this.loadOverdueCustomers();
  }

  refreshDashboard(): void {
    this.loadDashboardData();
    this.toastr.info('Ledger dashboard refreshed.', 'Refresh');
  }

  onCustomerSearch(value: string): void {
    this.customerSearch = value;
    const query = value.trim().toLocaleLowerCase();
    this.filteredCustomerOptions = this.customerOptions.filter(option =>
      option.name.toLocaleLowerCase().includes(query) ||
      option.uniqueKeyID.toLocaleLowerCase().includes(query)
    );
  }

  onCustomerDropdownOpened(opened: boolean): void {
    if (!opened) return;
    this.customerSearch = '';
    this.filteredCustomerOptions = this.customerOptions;
  }

  selectCustomerById(customerId: string): void {
    if (!customerId) {
      this.clearCustomer();
      return;
    }
    this.selectedCustomerId = customerId || '';
    const customerRequestVersion = ++this.selectedCustomerRequestVersion;
    this.activeAlert = null;
    this.selectedCustomerSummary = null;
    this.selectedCustomerAgeDistribution = null;
    this.selectedCustomerDetail = null;
    this.statementError = null;
    this.notificationItems = [];
    this.notificationLoading = true;
    this.notificationError = null;
    this.statementRows = [];
    this.filteredStatementRows = [];
    this.allCustomerRows = [];
    this.paymentTrends = [];
    this.pageIndex = 0;
    this.totalRecords = 0;
    this.tableSearch = '';

    const customerOption = this.customerOptions.find(option => option.uniqueKeyID === customerId);
    if (!customerOption) {
      this.selectedCustomer = null;
      return;
    }

    this.selectedCustomer = {
      customerId: customerOption.uniqueKeyID,
      customerName: customerOption.name,
      totalInvoiced: 0,
      totalPaid: 0,
      balance: 0,
      daysOutstanding: 0,
      lastPaymentDate: null
    };
    this.customerSearch = customerOption.name;
    this.loadCustomerLedgerDetail(customerOption.uniqueKeyID, customerRequestVersion);
  }

  selectCustomer(customerItem: customerOutstanding): void {
    this.selectCustomerById(customerItem.customerId);
  }

  clearCustomer(): void {
    this.selectedCustomerRequestVersion++;
    this.selectedCustomerId = '';
    this.selectedCustomer = null;
    this.customerSearch = '';
    this.filteredCustomerOptions = this.customerOptions;
    this.selectedCustomerSummary = null;
    this.selectedCustomerAgeDistribution = null;
    this.selectedCustomerDetail = null;
    this.activeAlert = null;
    this.statementRows = [];
    this.filteredStatementRows = [];
    this.allCustomerRows = [];
    this.paymentTrends = [];
    this.statementError = null;
    this.totalRecords = 0;
    this.pageIndex = 0;
    this.customerLoading = false;
    this.statementLoading = false;
    this.notificationLoading = false;
    this.notificationError = null;
    this.showCurrentAlerts();
  }

  private setSelectedCustomerDetail(detail: any): void {
    if (!this.selectedCustomer) return;
    this.selectedCustomerDetail = detail;

    const transactions = Array.isArray(detail?.transactions) ? detail.transactions : [];
    this.allCustomerRows = transactions.map((row: any, index: number) => this.mapLedgerRow(row, index));
    this.statementRows = this.allCustomerRows;
    this.filterStatementRows();
    this.updateSelectedCustomerMetrics();
  }

  private averageOverdueDays(transactions: any[]): number {
    const invoiceDays = transactions
      .filter(row => String(row.referenceType ?? row.type ?? '').toLowerCase() === 'invoice')
      .map(row => Number(row.daysOverdue ?? 0))
      .filter(days => Number.isFinite(days));
    return invoiceDays.length
      ? invoiceDays.reduce((sum, days) => sum + days, 0) / invoiceDays.length
      : 0;
  }

  private updateSelectedCustomerMetrics(): void {
    if (!this.selectedCustomer || !this.selectedCustomerDetail) return;
    const rowsInPeriod = this.allCustomerRows.filter(row => this.isWithinAppliedRange(row.transactionDate));
    const invoices = rowsInPeriod.filter(row => row.referenceType.toLowerCase() === 'invoice');
    const payments = rowsInPeriod.filter(row => ['payment', 'receipt'].includes(row.referenceType.toLowerCase()));
    const totalInvoiced = invoices.reduce((sum, row) => sum + row.debit, 0);
    const totalPaid = payments.reduce((sum, row) => sum + row.credit, 0);
    const latestAsOfDate = this.allCustomerRows
      .filter(row => {
        const date = this.parseLedgerDate(row.transactionDate);
        return Number.isFinite(date.getTime()) && date <= this.endOfDay(this.appliedToDate);
      })
      .reduce<LedgerRow | null>((latest, row) => {
        if (!latest || this.parseLedgerDate(row.transactionDate) > this.parseLedgerDate(latest.transactionDate)) return row;
        return latest;
      }, null);
    const balance = Math.max(0, latestAsOfDate?.balance ?? 0);
    const buckets = [0, 0, 0, 0];

    for (const invoice of invoices) {
      const bucketIndex = invoice.daysOverdue <= 30 ? 0
        : invoice.daysOverdue <= 60 ? 1
          : invoice.daysOverdue <= 90 ? 2 : 3;
      buckets[bucketIndex] += Math.max(0, invoice.debit);
    }

    const bucketTotal = buckets.reduce((sum, amount) => sum + amount, 0) || 1;
    const bucket = (index: number) => ({
      days: this.ageingBuckets[index].label,
      amount: buckets[index],
      percentage: buckets[index] / bucketTotal * 100
    });
    this.selectedCustomerAgeDistribution = {
      bucket_0_30: bucket(0),
      bucket_30_60: bucket(1),
      bucket_60_90: bucket(2),
      bucket_90_plus: bucket(3)
    };
    const totalDue = Math.min(balance, buckets[1] + buckets[2] + buckets[3]);
    const daysOutstanding = this.averageOverdueDays(
      invoices.map(row => ({ referenceType: 'invoice', daysOverdue: row.daysOverdue }))
    );
    this.selectedCustomerSummary = {
      totalAR: balance,
      totalPaid,
      totalDue,
      daysOutstanding,
      collectionRate: totalInvoiced > 0 ? totalPaid / totalInvoiced : 0,
      largestCustomer: this.selectedCustomer.customerName,
      currency: this.companySummary?.currency || 'INR'
    };
    this.selectedCustomer = {
      ...this.selectedCustomer,
      totalInvoiced,
      totalPaid,
      balance,
      daysOutstanding
    };
    this.buildPaymentTrends(rowsInPeriod);
    this.buildCustomerAlerts();
  }

  private isWithinAppliedRange(dateValue: string): boolean {
    const date = this.parseLedgerDate(dateValue);
    return Number.isFinite(date.getTime()) &&
      date >= this.startOfDay(this.appliedFromDate) &&
      date <= this.endOfDay(this.appliedToDate);
  }

  onAssessmentYearChange(year: string): void {
    const range = this.assessmentYears.find(option => option.value === year);
    if (range) {
      this.fromDate = range.start;
      this.toDate = range.end;
    }
  }

  applyDateRange(): void {
    if (!this.fromDate || !this.toDate || this.fromDate > this.toDate) {
      this.toastr.warning('From Date must be on or before To Date.', 'Invalid date range');
      return;
    }
    this.assessmentYear = '';
    this.appliedFromDate = this.startOfDay(this.fromDate);
    this.appliedToDate = this.endOfDay(this.toDate);
    this.dateFilterApplied = true;
    if (this.selectedCustomer) {
      this.activeAlert = null;
      this.filterStatementRows();
      this.updateSelectedCustomerMetrics();
      this.toastr.success(
        `${this.formatDate(this.appliedFromDate)} – ${this.formatDate(this.appliedToDate)} applied to ${this.selectedCustomer.customerName}.`,
        'Ledger refreshed'
      );
    } else {
      this.toastr.info(
        'Select a customer to filter its ledger, charts, and KPIs. Company-wide summary and ageing remain all-time totals.',
        'Select a customer'
      );
    }
  }

  get appliedDateRangeLabel(): string {
    return `${this.formatDate(this.appliedFromDate)} – ${this.formatDate(this.appliedToDate)}`;
  }

  onTableSearch(value: string): void {
    this.tableSearch = value.trim().toLowerCase();
    this.filterStatementRows();
  }

  onSortChange(sort: { active: string; direction: 'asc' | 'desc' | '' }): void {
    this.sortState = sort;
    this.sortStatementRows();
  }

  onStatementPage(event: { pageIndex: number; pageSize: number }): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
  }

  loadSelectedStatement(): void {
    if (this.selectedCustomer) {
      const customerRequestVersion = ++this.selectedCustomerRequestVersion;
      this.loadCustomerLedgerDetail(this.selectedCustomer.customerId, customerRequestVersion);
    }
  }

  get dashboardSummary(): ledgerSummary | null {
    return this.selectedCustomer ? this.selectedCustomerSummary : this.companySummary;
  }

  get dashboardAgeDistribution(): ageDistribution | null {
    return this.selectedCustomer ? this.selectedCustomerAgeDistribution : this.ageDistribution;
  }

  get visibleStatementRows(): LedgerRow[] {
    const start = this.pageIndex * this.pageSize;
    return this.filteredStatementRows.slice(start, start + this.pageSize);
  }

  trackByLedgerId(_index: number, row: LedgerRow): number {
    return row.ledgerId;
  }

  get highestOutstandingCustomer(): string {
    return this.dashboardSummary?.largestCustomer || '—';
  }

  get ageingTotal(): number {
    const distribution = this.dashboardAgeDistribution;
    if (!distribution) return 0;
    return this.ageingBuckets.reduce((sum, bucket) => sum + distribution[bucket.key].amount, 0);
  }

  get ageingPieStyle(): string {
    const distribution = this.dashboardAgeDistribution;
    if (!distribution || this.ageingTotal <= 0) return 'conic-gradient(#e5eaf0 0deg 360deg)';
    let offset = 0;
    const parts = this.ageingBuckets.map(bucket => {
      const amount = distribution[bucket.key].amount;
      const start = offset;
      offset += amount / this.ageingTotal * 360;
      return `${bucket.color} ${start}deg ${offset}deg`;
    });
    return `conic-gradient(${parts.join(', ')})`;
  }

  getPaymentTrendPoints(): string {
    if (this.paymentTrends.length < 1) return '';
    const maxAmount = Math.max(...this.paymentTrends.map(item => item.amount), 1);
    const span = Math.max(this.paymentTrends.length - 1, 1);
    return this.paymentTrends.map((item, index) => {
      const x = 20 + (index / span) * 560;
      const y = 174 - (item.amount / maxAmount) * 145;
      return `${x},${y}`;
    }).join(' ');
  }

  get paymentTrendMax(): number {
    return Math.max(...this.paymentTrends.map(item => item.amount), 1);
  }

  get paymentTrendTotal(): number {
    return this.paymentTrends.reduce((sum, item) => sum + item.amount, 0);
  }

  getPaymentPointY(amount: number): number {
    return 174 - (amount / this.paymentTrendMax) * 145;
  }

  formatCurrency(value: number | null | undefined): string {
    const amount = Number(value);
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number.isFinite(amount) ? amount : 0);
  }

  formatCompactCurrency(value: number | null | undefined): string {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return '₹0.00';
    const absolute = Math.abs(amount);
    const compactUnits = [
      { threshold: 10_000_000, divisor: 10_000_000, suffix: 'Cr' },
      { threshold: 100_000, divisor: 100_000, suffix: 'L' },
      { threshold: 1_000, divisor: 1_000, suffix: 'K' }
    ];
    const unit = compactUnits.find(item => absolute >= item.threshold);
    return unit
      ? `₹${(amount / unit.divisor).toFixed(unit.suffix === 'Cr' && absolute >= 10_000_000_000 ? 0 : 1)}${unit.suffix}`
      : this.formatCurrency(amount);
  }

  compactTooltip(value: number | null | undefined): string {
    return this.formatCurrency(value);
  }

  getAgeingPercentage(bucketKey: typeof this.ageingBuckets[number]['key']): number {
    const distribution = this.dashboardAgeDistribution;
    if (!distribution || this.ageingTotal <= 0) return 0;
    return Math.max(0, Math.min(100, distribution[bucketKey].amount / this.ageingTotal * 100));
  }

  getAgeingAmount(bucketKey: typeof this.ageingBuckets[number]['key']): number {
    return this.dashboardAgeDistribution?.[bucketKey].amount ?? 0;
  }

  getTransactionStatus(row: LedgerRow): string {
    if (row.daysOverdue > 0) return `Overdue ${row.daysOverdue} days`;
    if (row.referenceType.toLowerCase() === 'payment') return 'Payment';
    if (row.balance <= 0) return 'Settled';
    return 'Current';
  }

  getTransactionStatusClass(row: LedgerRow): string {
    if (row.daysOverdue > 0) return 'status-overdue';
    if (row.referenceType.toLowerCase() === 'payment') return 'status-payment';
    return row.balance <= 0 ? 'status-settled' : 'status-current';
  }

  openCustomerLedger(): void {
    if (!this.selectedCustomer) return;
    if (this.selectedCustomerDetail) {
      this.showCustomerLedgerDialog(this.selectedCustomerDetail);
      return;
    }
    this.ledgerService.getCustomerLedger(this.selectedCustomer.customerId).pipe(takeUntil(this.destroy$)).subscribe({
      next: response => this.showCustomerLedgerDialog(response.data || response),
      error: error => {
        console.error('Customer ledger detail failed', error);
        this.toastr.error('Could not open this customer ledger.', 'Ledger');
      }
    });
  }

  private showCustomerLedgerDialog(customerData: any): void {
    if (!customerData?.customerId) {
      this.toastr.error('Customer ledger details are unavailable.', 'Ledger');
      return;
    }
    this.dialog.open(CustomerDetailsDialogComponent, {
      width: 'min(1000px, 96vw)',
      maxWidth: '96vw',
      data: { customer: customerData }
    });
  }

  downloadStatement(): void {
    if (!this.selectedCustomer) return;
    const customerName = this.selectedCustomer.customerName;
    try {
      const pdfWindow = window.open('', '_blank');
      const pdf = this.createStatementPdf();
      const objectUrl = URL.createObjectURL(pdf);
      const filename = `Statement_${this.safeFileName(customerName)}_${this.dateStamp()}.pdf`;

      if (pdfWindow && !pdfWindow.closed) {
        pdfWindow.document.title = filename;
        pdfWindow.location.href = objectUrl;
        this.toastr.success('Customer statement opened in a new tab.', 'Statement');
      } else {
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = filename;
        anchor.style.display = 'none';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        this.toastr.success('Customer statement downloaded.', 'Statement');
      }

      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 120_000);
    } catch (error) {
      console.error('Customer statement PDF generation failed', error);
      this.toastr.error('Could not generate the customer statement PDF.', 'Statement');
    }
  }

  private createStatementPdf(): Blob {
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 14;
    const columns = [
      { title: '#', x: margin, width: 10, align: 'right' as const },
      { title: 'Date', x: margin + 12, width: 24, align: 'left' as const },
      { title: 'Type', x: margin + 39, width: 27, align: 'left' as const },
      { title: 'Reference', x: margin + 69, width: 55, align: 'left' as const },
      { title: 'Debit (INR)', x: margin + 127, width: 32, align: 'right' as const },
      { title: 'Credit (INR)', x: margin + 162, width: 32, align: 'right' as const },
      { title: 'Balance (INR)', x: margin + 197, width: 36, align: 'right' as const },
      { title: 'Status', x: margin + 236, width: 30, align: 'left' as const }
    ];
    let y = 15;

    const drawHeading = (): void => {
      pdf.setFillColor(31, 78, 143);
      pdf.rect(0, 0, pageWidth, 37, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(17);
      pdf.text('Customer Statement', margin, 15);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.text(this.selectedCustomer?.customerName || 'Customer', margin, 23);
      pdf.text(`Customer ID: ${this.selectedCustomer?.customerId || '-'}`, margin, 30);
      pdf.text(`Period: ${this.appliedDateRangeLabel}`, pageWidth - margin, 23, { align: 'right' });
      pdf.text(`Generated: ${this.formatDate(new Date())}`, pageWidth - margin, 30, { align: 'right' });

      pdf.setTextColor(38, 53, 75);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      y = 47;
      pdf.setFillColor(239, 243, 249);
      pdf.roundedRect(margin, y - 6, pageWidth - margin * 2, 15, 2, 2, 'F');
      pdf.text(`Invoiced: ${this.formatPdfAmount(this.selectedCustomer?.totalInvoiced || 0)}`, margin + 4, y);
      pdf.text(`Paid: ${this.formatPdfAmount(this.selectedCustomer?.totalPaid || 0)}`, margin + 89, y);
      pdf.text(`Outstanding: ${this.formatPdfAmount(this.selectedCustomer?.balance || 0)}`, margin + 174, y);

      y += 19;
      pdf.setFillColor(31, 78, 143);
      pdf.rect(margin, y - 6, pageWidth - margin * 2, 9, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(8);
      columns.forEach(column => {
        pdf.text(column.title, column.x, y, { align: column.align });
      });
      y += 9;
    };

    drawHeading();
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    this.filteredStatementRows.forEach((row, index) => {
      if (y > pageHeight - 15) {
        pdf.addPage();
        drawHeading();
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
      }
      if (index % 2 === 1) {
        pdf.setFillColor(247, 249, 252);
        pdf.rect(margin, y - 5, pageWidth - margin * 2, 8, 'F');
      }
      pdf.setTextColor(38, 53, 75);
      const values = [
        String(index + 1),
        this.formatDate(this.parseLedgerDate(row.transactionDate)),
        row.referenceType,
        `${row.referenceNumber}${row.description ? ` - ${row.description}` : ''}`,
        this.formatPdfAmount(row.debit),
        this.formatPdfAmount(row.credit),
        this.formatPdfAmount(row.balance),
        this.getTransactionStatus(row)
      ];
      columns.forEach((column, columnIndex) => {
        const text = pdf.splitTextToSize(values[columnIndex], column.width);
        pdf.text(text[0] || '', column.x, y, { align: column.align });
      });
      y += 8;
    });

    return pdf.output('blob');
  }

  private formatPdfAmount(value: number): string {
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number.isFinite(value) ? value : 0);
  }

  private formatDate(date: Date): string {
    if (!Number.isFinite(date.getTime())) return '—';
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  }

  private parseLedgerDate(value: string): Date {
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (dateOnly) {
      return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
    }
    return new Date(value);
  }

  selectAlert(alert: LedgerAlert): void {
    this.activeAlert = alert;
    if (alert.customerId && alert.customerId !== this.selectedCustomerId &&
        this.customerOptions.some(option => option.uniqueKeyID === alert.customerId)) {
      this.selectCustomerById(alert.customerId);
      this.activeAlert = alert;
    }
  }

  viewAlertLedger(alert: LedgerAlert): void {
    if (!alert.customerId) return;
    this.selectAlert(alert);
    window.setTimeout(() => {
      document.querySelector('.ledger-table-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  getPercentage(value: number | undefined): string {
    const numeric = Number(value);
    return `${Number.isFinite(numeric) ? Math.round(numeric) : 0}%`;
  }

  private loadCustomerLedgerDetail(customerId: string, customerRequestVersion: number): void {
    this.statementLoading = true;
    this.customerLoading = true;
    this.statementError = null;
    this.ledgerService.getCustomerLedger(customerId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: response => {
          if (this.selectedCustomerId !== customerId || customerRequestVersion !== this.selectedCustomerRequestVersion) return;
          const detail = response?.data || response;
          if (!detail?.customerId) {
            this.statementError = response?.errorMessage || 'Customer ledger details are unavailable.';
            this.statementLoading = false;
            this.customerLoading = false;
            this.notificationError = this.statementError;
            this.notificationLoading = false;
            return;
          }
          this.setSelectedCustomerDetail(detail);
          this.statementLoading = false;
          this.customerLoading = false;
        },
        error: error => {
          if (this.selectedCustomerId !== customerId || customerRequestVersion !== this.selectedCustomerRequestVersion) return;
          console.error('Customer ledger detail request failed', error);
          this.statementError = error.message || 'Could not load this customer ledger.';
          this.statementLoading = false;
          this.customerLoading = false;
          this.notificationError = 'Could not load alerts for this customer.';
          this.notificationLoading = false;
        }
      });
  }

  private loadOverdueCustomers(): void {
    const requestVersion = this.requestVersion;
    forkJoin({
      overdue: this.ledgerService.getCustomersOutstanding(this.companyId, 1, 20, {
        showOnlyOverdue: true,
        sortBy: 'highestOutstanding'
      }),
      outstanding: this.ledgerService.getCustomersOutstanding(this.companyId, 1, 20, {
        sortBy: 'highestOutstanding'
      })
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: response => {
        if (requestVersion !== this.requestVersion) return;
        const overdueCustomers = Array.isArray(response.overdue.data)
          ? response.overdue.data as customerOutstanding[]
          : [];
        const customers = Array.isArray(response.outstanding.data)
          ? response.outstanding.data as customerOutstanding[]
          : [];
        const overdueIds = new Set(overdueCustomers.map(customer => customer.customerId));
        const overdue = overdueCustomers.slice(0, 5).map(customer => ({
          type: 'overdue' as const,
          title: 'Overdue customer balance',
          detail: customer.customerName,
          amount: customer.balance,
          customerId: customer.customerId
        }));
        const pending = customers
          .filter(customer => customer.balance > 0 && !overdueIds.has(customer.customerId))
          .slice(0, 3)
          .map(customer => ({
            type: 'pending' as const,
            title: 'Customer payment pending',
            detail: customer.customerName,
            amount: customer.balance,
            customerId: customer.customerId
          }));
        const lowPayments = customers
          .filter(customer => customer.totalInvoiced > 0 && customer.totalPaid / customer.totalInvoiced < 0.25)
          .slice(0, 5)
          .map(customer => ({
            type: 'low-payment' as const,
            title: 'Low collection rate',
            detail: customer.customerName,
            amount: customer.balance,
            customerId: customer.customerId
          }));
        this.companyNotificationItems = [...overdue, ...pending, ...lowPayments].slice(0, 8);
        this.showCurrentAlerts();
        if (!this.selectedCustomer) this.notificationLoading = false;
      },
      error: error => {
        if (requestVersion !== this.requestVersion) return;
        console.error('Ledger notifications failed', error);
        if (!this.selectedCustomer) {
          this.notificationError = 'Could not load overdue and collection alerts.';
          this.notificationLoading = false;
        }
      }
    });
  }

  private refreshNotifications(): void {
    if (!this.companySummary) return;
    const summary = this.companySummary;
    const overdueTotal = Number(summary.totalDue) || 0;
    if (overdueTotal > 0 && !this.companyNotificationItems.some(item => item.title === 'Overdue receivables')) {
      this.companyNotificationItems.unshift({
        type: 'overdue',
        title: 'Overdue receivables',
        detail: 'Total overdue customer balance',
        amount: overdueTotal
      });
      this.companyNotificationItems = this.companyNotificationItems.slice(0, 8);
    }
    this.showCurrentAlerts();
  }

  private showCurrentAlerts(): void {
    this.notificationItems = this.selectedCustomer
      ? this.notificationItems.filter(item => item.customerId === this.selectedCustomer?.customerId)
      : [...this.companyNotificationItems];
  }

  private buildCustomerAlerts(): void {
    const summary = this.selectedCustomerSummary;
    const customerSummary = this.selectedCustomer;
    if (!summary || !customerSummary) return;
    const customerId = this.selectedCustomer?.customerId;
    const customerName = this.selectedCustomer?.customerName || customerId || 'Selected customer';
    const alerts: LedgerAlert[] = [];
    if (summary.totalDue > 0) {
      alerts.push({
        type: 'overdue',
        title: 'Overdue balance',
        detail: customerName,
        amount: summary.totalDue,
        customerId
      });
    }
    if (summary.totalAR > 0) {
      alerts.push({
        type: 'pending',
        title: 'Payment pending',
        detail: customerName,
        amount: summary.totalAR,
        customerId
      });
    }
    if (customerSummary.totalInvoiced > 0 && customerSummary.totalPaid / customerSummary.totalInvoiced < 0.25) {
      alerts.push({
        type: 'low-payment',
        title: 'Low collection rate',
        detail: `${customerName} · ${this.getPercentage(customerSummary.totalPaid / customerSummary.totalInvoiced * 100)} collected`,
        amount: summary.totalAR,
        customerId
      });
    }
    this.notificationItems = alerts;
    this.notificationLoading = false;
    this.notificationError = null;
  }

  private buildPaymentTrends(rows: LedgerRow[]): void {
    const grouped = new Map<string, number>();
    for (const row of rows) {
      if (row.credit <= 0 || !['payment', 'receipt'].includes(row.referenceType.toLowerCase())) continue;
      const date = this.parseLedgerDate(row.transactionDate);
      if (!this.isWithinAppliedRange(row.transactionDate)) continue;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      grouped.set(key, (grouped.get(key) || 0) + row.credit);
    }
    this.paymentTrends = [...grouped.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(-12)
      .map(([key, amount]) => {
        const [year, month] = key.split('-');
        return { key, label: new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }), amount };
      });
  }

  private filterStatementRows(): void {
    const search = this.tableSearch;
    this.filteredStatementRows = this.statementRows.filter(row => {
      const inDateRange = this.isWithinAppliedRange(row.transactionDate);
      const matches = !search || `${row.referenceType} ${row.referenceNumber} ${row.description}`.toLowerCase().includes(search);
      return inDateRange && matches;
    });
    this.sortStatementRows();
    this.totalRecords = this.filteredStatementRows.length;
    this.pageIndex = Math.min(this.pageIndex, Math.max(0, Math.ceil(this.totalRecords / this.pageSize) - 1));
  }

  private sortStatementRows(): void {
    const { active, direction } = this.sortState;
    if (!direction) return;
    const multiplier = direction === 'asc' ? 1 : -1;
    const valueFor = (row: LedgerRow): string | number => {
      switch (active) {
        case 'date': return this.parseLedgerDate(row.transactionDate).getTime();
        case 'debit': return row.debit;
        case 'credit': return row.credit;
        case 'outstanding': return row.balance;
        case 'invoice': return row.referenceNumber.toLowerCase();
        default: return row.transactionDate;
      }
    };
    this.filteredStatementRows = [...this.filteredStatementRows].sort((left, right) => {
      const leftValue = valueFor(left);
      const rightValue = valueFor(right);
      return (leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0) * multiplier;
    });
  }

  private mapLedgerRow(row: any, index: number): LedgerRow {
    return {
      ledgerId: Number(row.ledgerId ?? row.id ?? index),
      referenceType: String(row.referenceType ?? row.type ?? 'Transaction'),
      referenceNumber: String(row.referenceNumber ?? row.invoiceNumber ?? '—'),
      transactionDate: String(row.transactionDate ?? row.date ?? ''),
      debit: Number(row.debit ?? row.amount ?? 0),
      credit: Number(row.credit ?? 0),
      balance: Number(row.balance ?? row.outstanding ?? 0),
      description: String(row.description ?? ''),
      daysOverdue: Number(row.daysOverdue ?? 0),
      ageingBucket: String(row.ageingBucket ?? '')
    };
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private endOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  }

  private safeFileName(value: string): string {
    return value.trim().replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').replace(/\s+/g, '_') || 'Customer';
  }

  private dateStamp(): string {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  }
}
