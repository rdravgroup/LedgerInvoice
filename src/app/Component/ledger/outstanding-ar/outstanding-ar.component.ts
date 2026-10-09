import { Component, Injectable, OnInit, OnDestroy, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE, NativeDateAdapter } from '@angular/material/core';
import { MasterService } from '../../../_service/master.service';
import { MaterialModule } from '../../../material.module';
import { LedgerService } from '../../../_service/ledger.service';
import { MatDialog } from '@angular/material/dialog';
import { PaymentDialogComponent } from '../payment-dialog/payment-dialog.component';
import { PaymentDetailsDialogComponent } from '../payment-details-dialog/payment-details-dialog.component';
import { CustomerDetailsDialogComponent } from '../customer-details-dialog/customer-details-dialog.component';
import { AuthService } from '../../../_service/authentication.service';
import { ToastrService } from 'ngx-toastr';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { customerOutstanding, paymentEntryRequest, ledgerApiResponse } from '../../../_model/ledger.model';
import { SelectedCompanyService } from '../../../_service/selected-company.service';

const AR_DATE_FORMATS = {
  parse: { dateInput: { day: '2-digit', month: '2-digit', year: 'numeric' } },
  display: { dateInput: { day: '2-digit', month: '2-digit', year: 'numeric' }, monthYearLabel: { month: 'short', year: 'numeric' }, dateA11yLabel: { day: 'numeric', month: 'long', year: 'numeric' }, monthYearA11yLabel: { month: 'long', year: 'numeric' } }
};
@Injectable()
class ArDateAdapter extends NativeDateAdapter {
  override format(date: Date, _displayFormat: unknown): string { return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`; }
  override parse(value: unknown): Date | null {
    if (typeof value !== 'string') return null;
    const m = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return null;
    const day = Number(m[1]), month = Number(m[2]) - 1, year = Number(m[3]);
    const date = new Date(year, month, day);
    return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day ? date : null;
  }
}


@Component({
  selector: 'app-outstanding-ar',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, MaterialModule],
  providers: [{ provide: MAT_DATE_LOCALE, useValue: 'en-GB' }, { provide: DateAdapter, useClass: ArDateAdapter }, { provide: MAT_DATE_FORMATS, useValue: AR_DATE_FORMATS }],
  templateUrl: './outstanding-ar.component.html',
  styleUrls: ['./outstanding-ar.component.css']
})
export class OutstandingARComponent implements OnInit, OnDestroy, AfterViewInit {
  // Data properties
  displayedColumns: string[] = ['serialNumber', 'customerName', 'totalInvoiced', 'totalPaid', 'balance', 'daysOutstanding', 'lastPaymentDate', 'status', 'actions'];
  dataSource = new MatTableDataSource<customerOutstanding>();

  // UI properties
  loading = true;
  error: string | null = null;
  companyId: string = '';
  currentPage = 1;
  pageSize = 10;
  totalRecords = 0;
  showFilters = false;  // Toggle filter panel visibility

  // Filter properties
  customerSearch = new FormControl('', { nonNullable: true });
  customers: any[] = [];
  selectedCustomerId = '';
  readonly allCustomersOption = { uniqueKeyID: '', name: 'All Customers' };
  customerListLoading = false;
  customerListError = '';
  filterFromDate: Date | null = this.getFinancialYearStart();
  filterToDate: Date | null = this.getFinancialYearEnd();
  dateFilterError = '';
  filterShowOnlyOverdue: boolean = false;
  filterNeverPaid: boolean = false;
  filterIncludeFullyPaid: boolean = false;
  filterMinOutstanding: number | null = null;
  filterMaxOutstanding: number | null = null;
  filterMinDaysOverdue: number = 0;
  filterMinLastPaymentDays: number | null = null;
  filterAgeingBucket: string = '';
  filterSortBy: string = 'outstanding';
  
  // Sort options
  sortOptions = [
    { label: 'Outstanding Amount', value: 'outstanding' },
    { label: 'Days Overdue', value: 'daysOverdue' },
    { label: 'Customer Name', value: 'name' },
    { label: 'Last Payment Date', value: 'lastPaymentDate' },
    { label: 'Highest Outstanding', value: 'highestOutstanding' }
  ];
  
  // Ageing bucket options
  ageingBucketOptions = [
    { label: 'All', value: '' },
    { label: '0-30 Days', value: '0-30' },
    { label: '31-60 Days', value: '31-60' },
    { label: '61-90 Days', value: '61-90' },
    { label: '90+ Days', value: '90+' }
  ];

  // ViewChild references
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  // Lifecycle
  private destroy$ = new Subject<void>();
  private firstCompanySub = true;
  sendingReminderCustomerIds = new Set<string>();

  get printableCustomers(): customerOutstanding[] {
    const filteredCustomers = this.dataSource.filteredData;
    return this.dataSource.sort
      ? this.dataSource.sortData(filteredCustomers, this.dataSource.sort)
      : filteredCustomers;
  }

  constructor(
    private ledgerService: LedgerService,
    private dialog: MatDialog,
    private authService: AuthService,
    private toastr: ToastrService,
    private selectedCompanyService: SelectedCompanyService,
    private masterService: MasterService
  ) {
    this.companyId = this.authService.getCompanyId() || '';
  }

  ngOnInit(): void {
    // react to selected company changes (single subscription drives initial + subsequent reloads)
    this.selectedCompanyService.selectedCompanyId$.pipe(takeUntil(this.destroy$)).subscribe((cid: string | null) => {
      const newCompanyId = cid || this.authService.getCompanyId() || '';
      const prev = this.companyId;
      this.companyId = newCompanyId;
      // Skip toast on first subscription emission (initial load)
      if (!this.firstCompanySub && prev !== newCompanyId) {
        this.toastr.info('Company changed — reloading outstanding list', 'Company');
      }
      this.firstCompanySub = false;
      this.selectedCustomerId = '';
      this.customerSearch.setValue('', { emitEvent: false });
      this.loadCustomers();
      this.loadOutstandingCustomers();
    });
  }

  ngAfterViewInit(): void {
    // Only setup paginator/sort if they exist (may be undefined if loading is true)
    if (this.paginator) {
      this.dataSource.paginator = this.paginator;
      // Server-side pagination: listen to paginator events
      this.paginator.page.pipe(takeUntil(this.destroy$)).subscribe(() => {
        this.currentPage = this.paginator.pageIndex + 1;
        this.pageSize = this.paginator.pageSize;
        this.loadOutstandingCustomers();
      });
    }
    
    if (this.sort) {
      this.dataSource.sort = this.sort;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load outstanding customers from API
   */
  loadOutstandingCustomers(): void {
    this.loading = true;
    this.error = null;

    // Build filters object - only include non-default/meaningful filter values
    const filters: any = {};
    
    // Only add filters if they have meaningful values (not defaults)
    if (this.selectedCustomerId) filters.customerId = this.selectedCustomerId;
    const fromDate = this.toApiDate(this.filterFromDate);
    const toDate = this.toApiDate(this.filterToDate);
    if (fromDate) filters.fromDate = fromDate;
    if (toDate) filters.toDate = toDate;
    filters.sortBy = this.filterSortBy || 'outstanding';

    // Pass filters only if any are set, otherwise pass undefined (no filters)
    const hasFilters = Object.keys(filters).length > 0;
    
    this.ledgerService.getCustomersOutstanding(this.companyId, this.currentPage, this.pageSize, hasFilters ? filters : undefined)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.debug('[Outstanding AR] API response:', response);
          if (response.result === 'pass' && response.data) {
            const customers = Array.isArray(response.data) ? response.data : [response.data];
            console.debug('[Outstanding AR] Mapped customers before assigning to table:', customers);
            this.dataSource.data = customers as customerOutstanding[];
            // pagination metadata
            this.totalRecords = response.totalRecords ?? response.totalCount ?? customers.length;
            // Update paginator if available
            if (this.paginator) {
              try { this.paginator.length = this.totalRecords; } catch { /* ignore */ }
              this.paginator.pageIndex = (response.currentPage ? (response.currentPage - 1) : (this.currentPage - 1));
            }
          } else {
            this.error = response.errorMessage || 'Failed to load outstanding customers';
            this.toastr.error('Failed to load data', 'Error');
          }
          this.loading = false;
        },
        error: (err) => {
          this.error = 'Error: ' + err.message;
          this.toastr.error('Failed to load outstanding customers', 'Error');
          this.loading = false;
        }
      });
  }

  /**
   * Apply filters and reload data
   */
  applyFilters(): void {
    this.dateFilterError = '';
    const fromDate = this.toApiDate(this.filterFromDate);
    const toDate = this.toApiDate(this.filterToDate);
    if (!fromDate || !toDate) this.dateFilterError = 'Select both dates.';
    else if (fromDate > toDate) this.dateFilterError = 'From date must be on or before To date.';
    if (this.dateFilterError) return;
    this.currentPage = 1; // Reset to first page when applying filters
    this.loadOutstandingCustomers();
  }

  private getFinancialYearStart(): Date { const today = new Date(); const year = today.getMonth() < 3 ? today.getFullYear() - 1 : today.getFullYear(); return new Date(year, 3, 1); }
  private getFinancialYearEnd(): Date { const start = this.getFinancialYearStart(); return new Date(start.getFullYear() + 1, 2, 31); }
  private toApiDate(value: Date | null): string | null { if (!value || Number.isNaN(value.getTime())) return null; return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`; }
  get filteredCustomers(): any[] {
    const query = this.customerSearch.value.trim().toLocaleLowerCase();
    if (!query || query === 'all customers') return this.customers;
    return this.customers.filter(customer => [customer.name, customer.customer_company, customer.uniqueKeyID, customer.email, customer.emailId, customer.phone, customer.mobileNo].some(value => String(value || '').toLocaleLowerCase().includes(query)));
  }
  displayCustomer(value: any): string {
    if (typeof value === 'string') return value;
    if (value === this.allCustomersOption || !value?.uniqueKeyID) return 'All Customers';
    return value?.name || value?.customer_company || '';
  }
  onCustomerSearchInput(): void {
    this.selectedCustomerId = '';
  }
  selectCustomer(customer: any): void {
    this.selectedCustomerId = customer?.uniqueKeyID || '';
    this.customerSearch.setValue(this.selectedCustomerId ? this.displayCustomer(customer) : 'All Customers', { emitEvent: false });
  }
  loadCustomers(): void {
    if (!this.companyId) {
      this.customers = [];
      this.customerListLoading = false;
      this.customerListError = '';
      return;
    }
    this.customerListLoading = true;
    this.customerListError = '';
    this.customers = [];
    this.masterService.GetCustomer(this.companyId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response: any) => {
        const rows = Array.isArray(response) ? response : response?.data ?? response?.Data ?? response?.items ?? response?.Items ?? [];
        this.customers = (Array.isArray(rows) ? rows : []).sort((left: any, right: any) =>
          String(left?.name || left?.customer_company || '').localeCompare(
            String(right?.name || right?.customer_company || ''),
            undefined,
            { sensitivity: 'base', numeric: true }
          )
        );
        this.customerListLoading = false;
      },
      error: error => {
        console.error('Outstanding A/R customer lookup failed', error);
        this.customerListError = 'Customer list could not be loaded.';
        this.customerListLoading = false;
      }
    });
  }

  resetFilters(): void {
    this.customerSearch.setValue('');
    this.selectedCustomerId = '';
    this.filterFromDate = this.getFinancialYearStart();
    this.filterToDate = this.getFinancialYearEnd();
    this.dateFilterError = '';
    this.filterShowOnlyOverdue = false;
    this.filterNeverPaid = false;
    this.filterIncludeFullyPaid = false;
    this.filterMinOutstanding = null;
    this.filterMaxOutstanding = null;
    this.filterMinDaysOverdue = 0;
    this.filterMinLastPaymentDays = null;
    this.filterAgeingBucket = '';
    this.filterSortBy = 'outstanding';
    this.currentPage = 1;
    this.loadOutstandingCustomers();
    this.toastr.success('Filters reset', 'Success');
  }

  /**
   * Toggle filter panel visibility
   */
  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  /**
   * Refresh data (clear filters and reload)
   */
  refreshData(): void {
    this.resetFilters();
  }

  /**
   * Apply filter to table (for local search in dataSource)
   * Note: This is for client-side filtering. Server-side filtering uses applyFilters()
   */
  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  /**
   * Format currency
   */
  formatCurrency(value: number | undefined): string {
    if (!value) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  /**
   * Format date
   */
  formatDate(dateString: string | null | undefined): string {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-IN');
    } catch {
      return dateString;
    }
  }

  getOutstandingBreakdown(element: customerOutstanding): string {
    const invoiced = Number(element.totalInvoiced || 0);
    const paid = Number(element.totalPaid || 0);
    const returns = Number(element.totalReturns || 0);
    const refunds = Number(element.totalRefunds || 0);
    return `Calculation: ${this.formatCurrency(invoiced)} invoiced − ${this.formatCurrency(paid)} received − ${this.formatCurrency(returns)} returns + ${this.formatCurrency(refunds)} refunds = ${this.formatCurrency(this.getCalculatedBalance(invoiced, paid, returns, refunds))}. ${element.openInvoiceCount || 0} invoice(s) remain open.`;
  }

  getPaidBreakdown(element: customerOutstanding): string {
    return `${this.formatCurrency(element.totalPaid)} received across ${element.paymentCount || 0} recorded payment(s). Use View Payments to inspect receipts.`;
  }

  /**
   * Get CSS class for days outstanding status
   */
  getStatusCss(daysOutstanding: number | undefined): string {
    if (!daysOutstanding) return 'status-ok';
    if (daysOutstanding <= 30) return 'status-ok';
    if (daysOutstanding <= 60) return 'status-warning';
    if (daysOutstanding <= 90) return 'status-alert';
    return 'status-danger';
  }

  /**
   * Get status label
   */
  getStatusLabel(daysOutstanding: number | undefined): string {
    if (!daysOutstanding) return 'Current';
    if (daysOutstanding <= 30) return 'Due Soon';
    if (daysOutstanding <= 60) return 'Overdue';
    if (daysOutstanding <= 90) return 'Heavily Overdue';
    return 'Severely Overdue';
  }

  /**
   * Check if customer is overpaid (Total Paid > Total Invoiced)
   * Returns calculated balance as: Total Invoiced - Total Paid
   * If negative, customer has overpaid
   */
  getCalculatedBalance(totalInvoiced: number, totalPaid: number, totalReturns = 0, totalRefunds = 0): number {
    return totalInvoiced - totalPaid - totalReturns + totalRefunds;
  }

  /**
   * Get CSS class for balance display (green if overpaid, red if owed)
   */
  getBalanceStatusCss(totalInvoiced: number, totalPaid: number, totalReturns = 0, totalRefunds = 0): string {
    const balance = this.getCalculatedBalance(totalInvoiced, totalPaid, totalReturns, totalRefunds);
    if (balance < 0) return 'balance-overpaid';    // Green for overpaid
    if (balance === 0) return 'balance-settled';    // Blue/neutral for settled
    return 'balance-outstanding';                   // Red for owed
  }

  /**
   * Get label for balance status
   */
  getBalanceStatusLabel(totalInvoiced: number, totalPaid: number, totalReturns = 0, totalRefunds = 0): string {
    const balance = this.getCalculatedBalance(totalInvoiced, totalPaid, totalReturns, totalRefunds);
    if (balance < 0) return 'OverPaid (अतिरिक्त भुगतान)';
    if (balance === 0) return 'Settled';
    return 'Outstanding';
  }

  /**
   * View customer details
   */
  viewCustomer(customerId: string | undefined): void {
    if (!customerId) return;
    this.openCustomerDetailModal(customerId);
  }

  /**
   * Open customer detail modal showing ledger information
   */
  openCustomerDetailModal(customerId: string): void {
    this.ledgerService.getCustomerLedger(customerId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          // Handle direct object response (not wrapped in APIResponse)
          const customer = response?.data ?? response?.Data ?? response;
          
          if (customer && customer.customerId) {
            const dialogRef = this.dialog.open(CustomerDetailsDialogComponent, {
              width: 'min(1080px, calc(100vw - 32px))',
              maxWidth: '1080px',
              maxHeight: '90vh',
              panelClass: 'customer-details-dialog-panel',
              autoFocus: false,
              data: { customer }
            });

            dialogRef.afterClosed().pipe(takeUntil(this.destroy$)).subscribe(() => {
              // Dialog closed, no action needed
            });
          } else {
            this.toastr.error('Failed to load customer details', 'Error');
          }
        },
        error: (err) => {
          this.toastr.error('Error loading customer details: ' + err.message, 'Error');
        }
      });
  }

  /**
   * View payments for a customer - opens modal with payment history
   */
  viewPayments(customerId: string | undefined, customerName: string | undefined): void {
    if (!customerId) return;

    const dialogRef = this.dialog.open(PaymentDetailsDialogComponent, {
      width: 'min(1100px, calc(100vw - 32px))',
      maxWidth: '1100px',
      maxHeight: '90vh',
      panelClass: 'payment-details-dialog-panel',
      autoFocus: false,
      data: { customerId, customerName: customerName || 'Customer' }
    });

    dialogRef.afterClosed().pipe(takeUntil(this.destroy$)).subscribe((result: any) => {
      // If payment was deleted, refresh outstanding data
      if (result?.ok && result?.paymentDeleted) {
        this.refreshData();
      }
    });
  }

  /**
   * Send reminder
   */
  sendReminder(customerId: string | undefined, customerName: string | undefined): void {
    if (!customerId) return;
    if (this.sendingReminderCustomerIds.has(customerId)) return;
    this.sendingReminderCustomerIds.add(customerId);
    this.ledgerService.sendOutstandingReminder(customerId).pipe(takeUntil(this.destroy$)).subscribe({
      next: response => {
        this.sendingReminderCustomerIds.delete(customerId);
        if (response.result === 'pass') this.toastr.success(`Reminder sent to ${customerName || 'customer'}.`, 'Reminder');
        else this.toastr.error(response.errorMessage || 'Reminder could not be sent.', 'Reminder');
      },
      error: error => {
        this.sendingReminderCustomerIds.delete(customerId);
        this.toastr.error(error?.error?.errorMessage || error?.message || 'Reminder could not be sent.', 'Reminder');
      }
    });
  }

  printOutstandingPdf(): void {
    document.body.classList.add('print-outstanding-ar');
    const cleanup = () => document.body.classList.remove('print-outstanding-ar');
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
    window.setTimeout(cleanup, 10000);
  }

  /**
   * Prompt user for payment amount and optional invoice, then record the payment
   */
  openPaymentPrompt(element: customerOutstanding | undefined): void {
    if (!element || !element.customerId) return;

    const dialogRef = this.dialog.open(PaymentDialogComponent, {
      width: '420px',
      data: { customerId: element.customerId, customerName: element.customerName, companyId: this.companyId, currentOutstanding: this.getCalculatedBalance(element.totalInvoiced, element.totalPaid, element.totalReturns, element.totalRefunds) }
    });

    dialogRef.afterClosed().pipe(takeUntil(this.destroy$)).subscribe((result: any) => {
      if (result?.ok) {
        this.toastr.success('Payment recorded successfully', 'Payment');
        this.refreshData();
      } else if (result?.error) {
        this.toastr.error(result.error || 'Failed to record payment', 'Payment');
      }
    });
  }



}
