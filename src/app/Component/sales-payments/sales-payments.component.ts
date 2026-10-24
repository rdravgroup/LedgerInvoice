import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MaterialModule } from '../../material.module';
import { AuthService } from '../../_service/authentication.service';
import { SelectedCompanyService } from '../../_service/selected-company.service';
import { MasterService } from '../../_service/master.service';
import { LedgerService } from '../../_service/ledger.service';
import { PaymentDialogComponent } from '../ledger/payment-dialog/payment-dialog.component';

@Component({
  selector: 'app-sales-payments',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, ReactiveFormsModule],
  templateUrl: './sales-payments.component.html',
  styleUrls: ['./sales-payments.component.css']
})
export class SalesPaymentsComponent implements OnInit, OnDestroy {
  payments: any[] = [];
  customers: any[] = [];
  filteredCustomers: any[] = [];
  customerSearch = new FormControl('', { nonNullable: true });
  selectedCustomer: any = null;
  paymentCustomerSearch = new FormControl<any>('', { nonNullable: true });
  selectedPaymentCustomer: any = null;
  readonly allCustomersOption = { all: true, name: 'All customers' };
  loading = false;
  saving = false;
  search = '';
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly ledger: LedgerService,
    private readonly master: MasterService,
    private readonly auth: AuthService,
    private readonly company: SelectedCompanyService,
    private readonly dialog: MatDialog,
    private readonly toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.company.selectedCompanyId$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.selectedCustomer = null;
      this.customerSearch.setValue('');
      this.clearPaymentCustomerFilter();
      this.loadCustomers();
      this.loadPayments();
    });
  }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  private cid(): string { return this.company.getSelectedCompanyId() || this.auth.getCompanyId() || ''; }

  private loadCustomers(): void {
    this.master.GetCustomer(this.cid()).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res: any) => {
        const rows = Array.isArray(res) ? res : res?.data ?? res?.Data ?? [];
        this.customers = (Array.isArray(rows) ? rows : []).sort((a: any, b: any) =>
          String(a.name || a.customer_company || '').localeCompare(String(b.name || b.customer_company || '')));
        this.filteredCustomers = this.customers;
      },
      error: () => this.toastr.error('Could not load customers.')
    });
  }

  onCustomerSearch(): void {
    const q = this.customerSearch.value.trim().toLocaleLowerCase();
    const selectedName = this.selectedCustomer
      ? String(this.selectedCustomer.name || this.selectedCustomer.customer_company || this.selectedCustomer.uniqueKeyID).toLocaleLowerCase()
      : '';
    if (this.selectedCustomer && q !== selectedName) this.selectedCustomer = null;
    this.filteredCustomers = this.customers.filter(customer =>
      `${customer.name || ''} ${customer.customer_company || ''} ${customer.uniqueKeyID || ''} ${customer.email || ''} ${customer.phone || ''}`
        .toLocaleLowerCase().includes(q));
  }

  chooseCustomer(customer: any): void {
    this.selectedCustomer = customer;
    this.customerSearch.setValue(customer.name || customer.customer_company || customer.uniqueKeyID);
  }

  get filteredPaymentCustomers(): any[] {
    const value = this.paymentCustomerSearch.value;
    const query = typeof value === 'string' ? value.trim().toLocaleLowerCase() : '';
    if (!query || query === 'all customers') return this.customers;
    return this.customers.filter(customer =>
      `${customer.name || ''} ${customer.customer_company || ''} ${customer.uniqueKeyID || ''} ${customer.email || ''} ${customer.phone || ''} ${customer.mobileNo || ''}`
        .toLocaleLowerCase().includes(query));
  }

  displayPaymentCustomer(value: any): string {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return value.all ? value.name : value.name || value.customer_company || value.uniqueKeyID || '';
  }

  onPaymentCustomerSearch(): void {
    if (typeof this.paymentCustomerSearch.value === 'string') this.selectedPaymentCustomer = null;
  }

  selectPaymentCustomer(customer: any): void {
    this.selectedPaymentCustomer = customer?.all ? null : customer;
    this.paymentCustomerSearch.setValue(customer || '');
  }

  clearPaymentCustomerFilter(): void {
    this.selectedPaymentCustomer = null;
    this.paymentCustomerSearch.setValue(this.allCustomersOption);
  }

  private paymentMatchesSelectedCustomer(payment: any): boolean {
    if (!this.selectedPaymentCustomer) return true;

    const selectedId = String(this.selectedPaymentCustomer.uniqueKeyID || '').trim().toLocaleLowerCase();
    const paymentId = String(
      payment.customerId ?? payment.customerID ?? payment.CustomerId ?? payment.cuID ?? payment.cuId ?? ''
    ).trim().toLocaleLowerCase();
    if (selectedId && paymentId) return selectedId === paymentId;

    const selectedName = String(
      this.selectedPaymentCustomer.name || this.selectedPaymentCustomer.customer_company || ''
    ).trim().toLocaleLowerCase();
    const paymentName = String(payment.customerName || payment.cuName || payment.customer || '').trim().toLocaleLowerCase();
    return !!selectedName && !!paymentName && selectedName === paymentName;
  }

  get visiblePayments(): any[] {
    const q = this.search.trim().toLocaleLowerCase();
    return this.payments.filter(row => this.paymentMatchesSelectedCustomer(row) && (!q ||
      `${row.paymentNumber || ''} ${row.customerName || row.cuName || ''} ${row.customerId || row.customerID || ''} ${row.paymentMethod || ''} ${row.status || ''} ${row.transactionId || ''} ${row.chequeNumber || ''} ${row.notes || ''}`
        .toLocaleLowerCase().includes(q)));
  }

  loadPayments(): void {
    if (!this.cid()) { this.payments = []; return; }
    this.loading = true;
    this.ledger.getPaymentsByCompanyId().pipe(takeUntil(this.destroy$)).subscribe({
      next: (res: any) => {
        const rows = Array.isArray(res) ? res : res?.data ?? res?.Data ?? [];
        this.payments = (Array.isArray(rows) ? rows : []).filter((row: any) => row.isActive !== false)
          .sort((a: any, b: any) => new Date(b.receiptDate || 0).getTime() - new Date(a.receiptDate || 0).getTime());
        this.loading = false;
      },
      error: () => { this.loading = false; this.toastr.error('Could not load sales payments.'); }
    });
  }

  openRecordPayment(): void {
    if (!this.selectedCustomer?.uniqueKeyID) {
      this.toastr.warning('Select a customer before recording a receipt.');
      return;
    }
    this.dialog.open(PaymentDialogComponent, {
      width: '560px', maxWidth: '96vw', maxHeight: '90vh',
      data: {
        customerId: this.selectedCustomer.uniqueKeyID,
        customerName: this.selectedCustomer.name || this.selectedCustomer.customer_company,
        companyId: this.cid()
      }
    }).afterClosed().pipe(takeUntil(this.destroy$)).subscribe((result: any) => {
      if (result?.ok) {
        this.toastr.success('Sales receipt recorded.');
        this.selectedCustomer = null;
        this.customerSearch.setValue('');
        this.loadPayments();
      } else if (result?.error) this.toastr.error(result.error);
    });
  }

  amount(value: unknown): string {
    return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0));
  }
}
