import { Component, OnInit, OnDestroy, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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


@Component({
  selector: 'app-outstanding-ar',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule],
  templateUrl: './outstanding-ar.component.html',
  styleUrls: ['./outstanding-ar.component.css']
})
export class OutstandingARComponent implements OnInit, OnDestroy, AfterViewInit {
  // Data properties
  displayedColumns: string[] = ['customerName', 'totalInvoiced', 'totalPaid', 'balance', 'daysOutstanding', 'lastPaymentDate', 'status', 'actions'];
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
  filterSearchName: string = '';
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

  constructor(
    private ledgerService: LedgerService,
    private dialog: MatDialog,
    private authService: AuthService,
    private toastr: ToastrService
  ) {
    this.companyId = this.authService.getCompanyId() || '';
  }

  ngOnInit(): void {
    this.loadOutstandingCustomers();
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
    if (this.filterSearchName) filters.customerName = this.filterSearchName;
    if (this.filterShowOnlyOverdue) filters.showOnlyOverdue = true;
    if (this.filterNeverPaid) filters.neverPaid = true;
    if (this.filterIncludeFullyPaid) filters.includeFullyPaid = true;
    if (this.filterMinOutstanding != null) filters.minOutstanding = this.filterMinOutstanding;
    if (this.filterMaxOutstanding != null) filters.maxOutstanding = this.filterMaxOutstanding;
    if (this.filterMinDaysOverdue > 0) filters.minDaysOverdue = this.filterMinDaysOverdue;
    if (this.filterMinLastPaymentDays != null) filters.minLastPaymentDays = this.filterMinLastPaymentDays;
    if (this.filterAgeingBucket) filters.ageingBucket = this.filterAgeingBucket;
    
    // Only add sortBy if it's not the default
    if (this.filterSortBy !== 'outstanding') filters.sortBy = this.filterSortBy;

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
    this.currentPage = 1; // Reset to first page when applying filters
    this.loadOutstandingCustomers();
    this.toastr.success('Filters applied', 'Success');
  }

  /**
   * Reset all filters to default values
   */
  resetFilters(): void {
    this.filterSearchName = '';
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
  getCalculatedBalance(totalInvoiced: number, totalPaid: number): number {
    return totalInvoiced - totalPaid;
  }

  /**
   * Get CSS class for balance display (green if overpaid, red if owed)
   */
  getBalanceStatusCss(totalInvoiced: number, totalPaid: number): string {
    const balance = this.getCalculatedBalance(totalInvoiced, totalPaid);
    if (balance < 0) return 'balance-overpaid';    // Green for overpaid
    if (balance === 0) return 'balance-settled';    // Blue/neutral for settled
    return 'balance-outstanding';                   // Red for owed
  }

  /**
   * Get label for balance status
   */
  getBalanceStatusLabel(totalInvoiced: number, totalPaid: number): string {
    const balance = this.getCalculatedBalance(totalInvoiced, totalPaid);
    if (balance < 0) return 'OverPaid (अतिरिक्त भुगतान)';
    if (balance === 0) return 'Settled';
    return 'Outstanding';
  }

  /**
   * View customer details
   */
  viewCustomer(customerId: string | undefined): void {
    if (!customerId) return;
    this.toastr.info(`Opening details for customer: ${customerId}`);
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
          const customer = response.data || response;
          
          if (customer && customer.customerId) {
            const dialogRef = this.dialog.open(CustomerDetailsDialogComponent, {
              width: '1000px',
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
      width: '900px',
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
    this.toastr.info(`Sending reminder to ${customerName}...`, 'Reminder');
    // TODO: Implement send reminder functionality
  }

  /**
   * Prompt user for payment amount and optional invoice, then record the payment
   */
  openPaymentPrompt(element: customerOutstanding | undefined): void {
    if (!element || !element.customerId) return;

    const dialogRef = this.dialog.open(PaymentDialogComponent, {
      width: '420px',
      data: { customerId: element.customerId, customerName: element.customerName, companyId: this.companyId }
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
