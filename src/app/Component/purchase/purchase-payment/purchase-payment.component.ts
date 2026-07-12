// src/app/Component/purchase/purchase-payment/purchase-payment.component.ts
import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { ToastrService } from 'ngx-toastr';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { PurchaseService } from '../../../_service/purchase.service';
import { AuthService } from '../../../_service/authentication.service';
import { SelectedCompanyService } from '../../../_service/selected-company.service';
import { PurchasePayment, PurchaseInvoice, Vendor, PAYMENT_MODES, PAYMENT_TYPES } from '../../../_model/purchase.model';

@Component({
  selector: 'app-purchase-payment',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule],
  templateUrl: './purchase-payment.component.html',
  styleUrls: ['../purchase-shared.css', './purchase-payment.component.css']
})
export class PurchasePaymentComponent implements OnInit, OnDestroy {
  listColumns = ['paymentNo', 'paymentDate', 'vendorId', 'piNumber', 'paymentMode', 'amount', 'netPaid', 'action'];
  dataSource  = new MatTableDataSource<PurchasePayment>();
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort)      sort!: MatSort;

  loading  = false;
  showForm = false;
  isMobile = window.innerWidth < 768;

  payForm!:  FormGroup;
  vendors:   Vendor[]          = [];
  invoices:  PurchaseInvoice[] = [];

  /** FIX-BUG-3: Keep original full invoice list separate so vendor filtering is non-destructive */
  private allInvoices: PurchaseInvoice[] = [];

  payModes = PAYMENT_MODES;
  payTypes = PAYMENT_TYPES;

  private destroy$ = new Subject<void>();

  constructor(
    private svc:        PurchaseService,
    private fb:         FormBuilder,
    private toastr:     ToastrService,
    private auth:       AuthService,
    private selectedCo: SelectedCompanyService
  ) {
    window.addEventListener('resize', () => this.isMobile = window.innerWidth < 768);
  }

  ngOnInit(): void {
    this.buildForm();
    this.selectedCo.selectedCompanyId$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.loadList();
        this.loadVendors();
        this.loadInvoices();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort      = this.sort;
  }

  private cid = () => this.selectedCo.getSelectedCompanyId() || this.auth.getCompanyId() || '';

  buildForm(): void {
    const today = new Date().toISOString().split('T')[0];

    this.payForm = this.fb.group({
      companyId:   [this.cid()],
      vendorId:    ['', Validators.required],
      piNumber:    [''],
      paymentDate: [today, Validators.required],
      paymentMode: ['cash', Validators.required],
      paymentType: ['regular'],
      // FIX-BUG-4: null default so min(0.01) is not immediately violated; user must enter amount
      amount:      [null, [Validators.required, Validators.min(0.01)]],
      bankRef:     [''],
      chequeNo:    [''],
      // FIX-BUG-2: null not '' so JSON sends null (valid for DateTime?) instead of "" (throws 400)
      chequeDate:  [null],
      bankName:    [''],
      tdsDeducted: [0, Validators.min(0)],
      netPaid:     [{ value: 0, disabled: true }],
      notes:       ['']
    });

    this.payForm.get('amount')!.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.calcNet());
    this.payForm.get('tdsDeducted')!.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.calcNet());
  }

  calcNet(): void {
    const amt = +(this.payForm.get('amount')?.value || 0);
    const tds = +(this.payForm.get('tdsDeducted')?.value || 0);
    this.payForm.get('netPaid')?.setValue(Math.max(0, amt - tds), { emitEvent: false });
  }

  // FIX-BUG-3: filter at point of use from allInvoices; don't mutate this.invoices
  get filteredInvoices(): PurchaseInvoice[] {
    const vid = this.payForm.get('vendorId')?.value;
    if (!vid) return this.allInvoices;
    return this.allInvoices.filter(i => i.vendorId === vid);
  }

  /** Called when vendor dropdown changes — update invoice dropdown without destroying source */
  onVendorChange(vendorId: string): void {
    // Clear invoice selection when vendor changes
    this.payForm.patchValue({ piNumber: '' }, { emitEvent: false });
  }

  loadList(): void {
    this.loading = true;
    this.svc.getPayments(this.cid())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next:  (r: any) => { this.dataSource.data = r?.data || []; this.loading = false; },
        error: ()       => { this.toastr.error('Failed to load payments'); this.loading = false; }
      });
  }

  loadVendors(): void {
    this.svc.getVendors(this.cid())
      .pipe(takeUntil(this.destroy$))
      .subscribe({ next: (r: any) => this.vendors = r?.data || [] });
  }

  loadInvoices(): void {
    this.svc.getInvoices(this.cid())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (r: any) => {
          // FIX-BUG-3: store full list in allInvoices; filteredInvoices getter does the filtering
          this.allInvoices = (r?.data || []).filter(
            (i: any) => i.status === 'pending' || i.status === 'partial'
          );
          this.invoices = this.allInvoices;
        }
      });
  }

  applyFilter(e: Event): void {
    this.dataSource.filter = (e.target as HTMLInputElement).value.trim().toLowerCase();
  }

  openNew(): void {
    this.buildForm();
    // FIX-BUG-6: set companyId again after buildForm() in case cid() now resolves correctly
    this.payForm.get('companyId')!.setValue(this.cid());
    this.showForm = true;
  }

  close(): void {
    this.showForm = false;
  }

  getVendorName(id?: string): string {
    return this.vendors.find(v => v.vendorId === id)?.vendorName || id || '';
  }

  getOutstanding(piNumber: string): number {
    return this.allInvoices.find(i => i.piNumber === piNumber)?.outstandingAmount || 0;
  }

  onInvoiceSelect(piNumber: string): void {
    const inv = this.allInvoices.find(i => i.piNumber === piNumber);
    if (inv) {
      this.payForm.patchValue({ vendorId: inv.vendorId, amount: inv.outstandingAmount });
      this.calcNet();
    }
  }

  /** Check if mode needs cheque fields */
  get isCheque(): boolean {
    return this.payForm.get('paymentMode')?.value === 'cheque';
  }

  /** Check if mode needs bank/UTR reference fields */
  get needsBankRef(): boolean {
    const mode = this.payForm.get('paymentMode')?.value;
    return ['bank_transfer', 'neft', 'rtgs', 'upi'].includes(mode);
  }

  /** Label for ref field changes by mode */
  get bankRefLabel(): string {
    const mode = this.payForm.get('paymentMode')?.value;
    if (mode === 'upi') return 'UPI Transaction ID';
    if (mode === 'neft' || mode === 'rtgs') return 'UTR Number';
    return 'Transaction / Ref Number';
  }

  save(): void {
    // FIX-BUG-7: recalculate net just before submit
    this.calcNet();

    if (this.payForm.invalid) {
      this.payForm.markAllAsTouched();
      return;
    }

    const raw = this.payForm.getRawValue();

    // FIX-BUG-2: strip mode-irrelevant fields so backend never gets empty string for DateTime?
    // chequeDate: only send when mode is cheque AND a value was entered
    const dto: PurchasePayment = {
      ...raw,
      isReconciled: false,
      // Only include chequeDate when it has a real value
      chequeDate:  (this.isCheque && raw.chequeDate) ? raw.chequeDate : null,
      // Only include chequeNo / bankName / bankRef if relevant
      chequeNo:    this.isCheque      ? raw.chequeNo    : null,
      bankName:    this.needsBankRef  ? raw.bankName    : null,
      bankRef:     this.needsBankRef  ? raw.bankRef     : null,
      // FIX-BUG-6: always use current cid() so company is fresh
      companyId:   this.cid() || raw.companyId,
    };

    this.svc.recordPayment(dto, this.cid())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (r: any) => {
          if (r?.result === 'pass') {
            this.toastr.success(`Payment ${r.data?.paymentNo} recorded successfully`);
            this.showForm = false;
            this.loadList();
            this.loadInvoices(); // refresh outstanding amounts
          } else {
            this.toastr.error(r?.errorMessage || r?.message || 'Failed to record payment');
          }
        },
        error: (e: any) => this.toastr.error(e?.message || 'Failed to record payment')
      });
  }

  deletePayment(paymentId: number): void {
    if (!confirm('Delete this payment? Invoice outstanding will be restored.')) return;
    this.svc.deletePayment(paymentId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next:  () => { this.toastr.success('Payment deleted'); this.loadList(); this.loadInvoices(); },
        error: () => this.toastr.error('Delete failed')
      });
  }

  get totalPaid(): number {
    return this.dataSource.data.reduce((s, p) => s + (p.amount || 0), 0);
  }
}
