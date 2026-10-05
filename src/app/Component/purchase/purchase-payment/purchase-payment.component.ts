// src/app/Component/purchase/purchase-payment/purchase-payment.component.ts
import { Component, OnInit, OnDestroy, ViewChild, HostListener, Injectable, TemplateRef, ViewContainerRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { Overlay, OverlayModule, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE, NativeDateAdapter } from '@angular/material/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { ToastrService } from 'ngx-toastr';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { PurchasePaymentAllocation, PurchaseService } from '../../../_service/purchase.service';
import { AuthService } from '../../../_service/authentication.service';
import { SelectedCompanyService } from '../../../_service/selected-company.service';
import { CompanyNumberPipe } from '../../../_pipe/company-number.pipe';
import { CompanyNumberFormatService } from '../../../_service/company-number-format.service';
import {
  PurchasePayment, PurchaseRefund, PurchaseRefundType, PurchaseInvoice, PurchaseReturn, Vendor,
  PAYMENT_MODES, PAYMENT_TYPES
} from '../../../_model/purchase.model';

const PAYMENT_DATE_FORMATS = {
  parse: { dateInput: { day: '2-digit', month: '2-digit', year: 'numeric' } },
  display: {
    dateInput: { day: '2-digit', month: '2-digit', year: 'numeric' },
    monthYearLabel: { month: 'short', year: 'numeric' },
    dateA11yLabel: { day: 'numeric', month: 'long', year: 'numeric' },
    monthYearA11yLabel: { month: 'long', year: 'numeric' }
  }
};

interface AdvanceInvoiceAllocationRow extends PurchaseInvoice {
  selected: boolean;
  allocationAmount: number;
}

@Injectable()
class PaymentDateAdapter extends NativeDateAdapter {
  override format(date: Date, _displayFormat: unknown): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${date.getFullYear()}`;
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
  selector: 'app-purchase-payment',
  standalone: true,
  imports: [CommonModule, MaterialModule, OverlayModule, ReactiveFormsModule, CompanyNumberPipe],
  templateUrl: './purchase-payment.component.html',
  styleUrls: ['../purchase-shared.css', './purchase-payment.component.css'],
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'en-GB' },
    { provide: DateAdapter, useClass: PaymentDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: PAYMENT_DATE_FORMATS }
  ]
})
export class PurchasePaymentComponent implements OnInit, OnDestroy {
  listColumns = ['paymentNo', 'paymentDate', 'vendorId', 'piNumber', 'paymentMode', 'amount', 'netPaid', 'action'];
  dataSource  = new MatTableDataSource<PurchasePayment>();
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort)      sort!: MatSort;
  @ViewChild('paymentModal') paymentModal!: TemplateRef<unknown>;
  @ViewChild('allocationModal') allocationModal!: TemplateRef<unknown>;

  loading  = false;
  invoicesLoading = false;
  saving = false;
  showForm = false;
  isMobile = window.innerWidth < 768;

  payForm!:  FormGroup;
  vendors:   Vendor[]          = [];
  invoices:  PurchaseInvoice[] = [];
  refunds: PurchaseRefund[] = [];
  debitNotes: PurchaseReturn[] = [];
  entryKind: 'payment' | 'refund' = 'payment';
  debitNotesLoading = false;

  /** FIX-BUG-3: Keep original full invoice list separate so vendor filtering is non-destructive */
  private allInvoices: PurchaseInvoice[] = [];

  payModes = PAYMENT_MODES;
  payTypes = PAYMENT_TYPES;

  private destroy$ = new Subject<void>();
  private modalOverlay?: OverlayRef;
  private allocationOverlay?: OverlayRef;
  private invoiceLoadRequest = 0;
  private debitNoteLoadRequest = 0;
  private allocationRequestId = 0;
  vendorSearch = '';
  invoiceSearch = '';
  allocationPayment?: PurchasePayment;
  allocationInvoices: AdvanceInvoiceAllocationRow[] = [];
  allocationLoading = false;
  allocationSaving = false;

  constructor(
    private svc:        PurchaseService,
    private fb:         FormBuilder,
    private toastr:     ToastrService,
    private auth:       AuthService,
    private selectedCo: SelectedCompanyService,
    private overlay: Overlay,
    private viewContainerRef: ViewContainerRef,
    private numberFormat: CompanyNumberFormatService
  ) {}

  @HostListener('window:resize')
  onResize(): void {
    this.isMobile = window.innerWidth < 768;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.allocationOverlay && !this.allocationSaving) {
      this.closeAdvanceAllocation();
    } else if (this.showForm && !this.saving) {
      this.close();
    }
  }

  ngOnInit(): void {
    this.buildForm();
    this.selectedCo.selectedCompanyId$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.loadList();
        this.loadRefunds();
        this.loadVendors();
        this.loadInvoices();
      });
  }

  ngOnDestroy(): void {
    this.modalOverlay?.dispose();
    this.allocationOverlay?.dispose();
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort      = this.sort;
  }

  private cid = () => this.selectedCo.getSelectedCompanyId() || this.auth.getCompanyId() || '';

  buildForm(): void {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    this.payForm = this.fb.group({
      companyId:   [this.cid()],
      vendorId:    ['', Validators.required],
      piNumber:    [null],
      refundType:  ['advance' as PurchaseRefundType],
      returnNo:    [null],
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
    const vendorId = this.payForm.get('vendorId')?.value as string;
    if (!vendorId) return [];

    const companyId = this.cid();
    const search = this.invoiceSearch.trim().toLowerCase();
    return this.allInvoices.filter(invoice => {
      const matchesCompany = !invoice.companyId || this.sameId(invoice.companyId, companyId);
      const matchesVendor = this.sameId(invoice.vendorId, vendorId);
      const searchFields = `${invoice.piNumber || ''} ${invoice.vendorName || ''} ${invoice.vendorId || ''} ${this.invoiceYear(invoice)}`;
      return matchesCompany && matchesVendor &&
        (!search || searchFields.toLowerCase().includes(search));
    });
  }

  get filteredVendors(): Vendor[] {
    const search = this.vendorSearch.trim().toLowerCase();
    return this.vendors.filter(v =>
      !search || `${v.vendorName || ''} ${v.vendorId || ''}`.toLowerCase().includes(search)
    );
  }

  onInvoiceDropdownChange(opened: boolean): void {
    if (opened) this.invoiceSearch = '';
  }

  onVendorDropdownChange(opened: boolean): void {
    if (opened) this.vendorSearch = '';
  }

  private asDateOnly(value: Date | string): string {
    if (typeof value === 'string') return value;
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private sameId(left?: string | null, right?: string | null): boolean {
    return !!left && !!right && left.trim().toLowerCase() === right.trim().toLowerCase();
  }

  private invoiceYear(invoice: PurchaseInvoice): string {
    if (!invoice.invoiceDate) return '';
    const yearPrefix = invoice.invoiceDate.match(/^(\d{4})/);
    if (yearPrefix) return yearPrefix[1];
    const parsed = new Date(invoice.invoiceDate);
    return Number.isNaN(parsed.getTime()) ? '' : String(parsed.getFullYear());
  }

  onVendorChange(vendorId: string): void {
    this.payForm.patchValue({ piNumber: null, returnNo: null, amount: null }, { emitEvent: false });
    this.calcNet();
    this.invoiceSearch = '';
    this.allInvoices = [];
    this.invoices = [];
    this.debitNotes = [];
    this.loadInvoices(vendorId);
    this.loadDebitNotes(vendorId);
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

  loadRefunds(): void {
    this.svc.getRefunds(this.cid()).pipe(takeUntil(this.destroy$)).subscribe({
      next: response => {
        if (response.result !== 'pass') {
          this.toastr.error(response.errorMessage || 'Failed to load vendor refunds');
          return;
        }
        this.refunds = response.data || [];
      },
      error: (error: any) => this.toastr.error(
        error?.error?.errorMessage || error?.message || 'Failed to load vendor refunds'
      )
    });
  }

  loadDebitNotes(vendorId: string): void {
    const requestId = ++this.debitNoteLoadRequest;
    if (!vendorId) {
      this.debitNotes = [];
      this.debitNotesLoading = false;
      return;
    }
    this.debitNotesLoading = true;
    this.svc.getReturns(this.cid()).pipe(takeUntil(this.destroy$)).subscribe({
      next: response => {
        if (requestId !== this.debitNoteLoadRequest) return;
        this.debitNotesLoading = false;
        if (response.result !== 'pass') {
          this.toastr.error(response.errorMessage || 'Failed to load purchase debit notes');
          return;
        }
        this.debitNotes = (response.data || []).filter(note =>
          this.sameId(note.vendorId, vendorId) && note.status?.toLowerCase() === 'approved'
        );
      },
      error: (error: any) => {
        if (requestId !== this.debitNoteLoadRequest) return;
        this.debitNotesLoading = false;
        this.toastr.error(error?.error?.errorMessage || error?.message || 'Failed to load purchase debit notes');
      }
    });
  }

  loadInvoices(vendorId?: string): void {
    const requestId = ++this.invoiceLoadRequest;
    const companyId = this.cid();
    const requestedVendorId = vendorId?.trim();
    if (!requestedVendorId || !companyId) {
      this.allInvoices = [];
      this.invoices = [];
      this.invoicesLoading = false;
      return;
    }

    this.invoicesLoading = true;
    this.svc.getInvoices(companyId, undefined, requestedVendorId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (r: any) => {
          if (requestId !== this.invoiceLoadRequest) return;
          this.allInvoices = (r?.data || []).filter((invoice: PurchaseInvoice) =>
            this.sameId(invoice.vendorId, requestedVendorId) &&
            (!invoice.companyId || this.sameId(invoice.companyId, companyId)) &&
            (invoice.status === 'pending' || invoice.status === 'partial')
          );
          this.invoices = this.allInvoices;
          this.invoicesLoading = false;
        },
        error: (e: any) => {
          if (requestId !== this.invoiceLoadRequest) return;
          this.invoicesLoading = false;
          this.toastr.error(e?.error?.errorMessage || e?.message || 'Failed to load vendor invoices');
        }
      });
  }

  applyFilter(e: Event): void {
    this.dataSource.filter = (e.target as HTMLInputElement).value.trim().toLowerCase();
  }

  openNew(): void {
    this.openEntryForm('payment');
  }

  openRefund(): void {
    this.openEntryForm('refund');
  }

  private openEntryForm(kind: 'payment' | 'refund'): void {
    if (this.modalOverlay?.hasAttached()) return;
    this.buildForm();
    this.entryKind = kind;
    // FIX-BUG-6: set companyId again after buildForm() in case cid() now resolves correctly
    this.payForm.get('companyId')!.setValue(this.cid());
    this.showForm = true;
    this.vendorSearch = '';
    this.invoiceSearch = '';
    this.modalOverlay = this.overlay.create({
      hasBackdrop: true,
      backdropClass: 'pp-overlay-backdrop',
      panelClass: 'pp-overlay-pane',
      width: 'min(760px, calc(100vw - 48px))',
      maxHeight: '92vh',
      positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
      scrollStrategy: this.overlay.scrollStrategies.block()
    });
    this.modalOverlay.backdropClick()
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.close());
    this.modalOverlay.attach(new TemplatePortal(this.paymentModal, this.viewContainerRef));
  }

  onRefundTypeChange(type: PurchaseRefundType): void {
    this.payForm.patchValue({ piNumber: null, returnNo: null }, { emitEvent: false });
    if (type === 'against_invoice') {
      this.payForm.get('piNumber')?.setValidators(Validators.required);
    } else {
      this.payForm.get('piNumber')?.clearValidators();
    }
    if (type === 'against_debit_note') {
      this.payForm.get('returnNo')?.setValidators(Validators.required);
    } else {
      this.payForm.get('returnNo')?.clearValidators();
    }
    this.payForm.get('piNumber')?.updateValueAndValidity();
    this.payForm.get('returnNo')?.updateValueAndValidity();
  }

  get selectedRefundType(): PurchaseRefundType {
    return this.payForm.get('refundType')?.value as PurchaseRefundType;
  }

  debitNoteRefundableAmount(note: PurchaseReturn): number {
    const refunded = note.refundedAmount ?? this.refunds
      .filter(refund => refund.returnNo === note.returnNo)
      .reduce((total, refund) => total + (refund.refundAmount || 0), 0);
    return Math.max(0, note.outstandingAmount ?? (note.grandTotal - refunded));
  }

  close(): void {
    if (this.saving) return;
    this.showForm = false;
    this.modalOverlay?.dispose();
    this.modalOverlay = undefined;
  }

  getVendorName(id?: string): string {
    return this.vendors.find(v => v.vendorId === id)?.vendorName || id || '';
  }

  getOutstanding(piNumber: string): number {
    return this.allInvoices.find(i => i.piNumber === piNumber)?.outstandingAmount || 0;
  }

  onInvoiceSelect(piNumber: string | null): void {
    if (!piNumber) {
      this.payForm.patchValue({
        piNumber: null,
        paymentType: 'advance',
        amount: null
      }, { emitEvent: false });
      this.calcNet();
      return;
    }

    const inv = this.filteredInvoices.find(i => i.piNumber === piNumber);
    if (!inv) {
      this.payForm.patchValue({ piNumber: null }, { emitEvent: false });
      this.toastr.error('That invoice is not available for the selected vendor');
      return;
    }

    this.payForm.patchValue({ paymentType: 'regular', amount: inv.outstandingAmount });
    this.calcNet();
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
    if (this.saving) return;

    // FIX-BUG-7: recalculate net just before submit
    this.calcNet();

    if (this.payForm.invalid) {
      this.payForm.markAllAsTouched();
      return;
    }

    const raw = this.payForm.getRawValue();

    if (this.entryKind === 'refund') {
      const selectedInvoice = this.allInvoices.find(invoice => invoice.piNumber === raw.piNumber);
      const selectedNote = this.debitNotes.find(note => note.returnNo === raw.returnNo);
      const refundAmount = Number(raw.amount);
      if (raw.refundType === 'against_invoice' && !selectedInvoice) {
        this.payForm.get('piNumber')?.setErrors({ required: true });
        this.payForm.markAllAsTouched();
        return;
      }
      if (raw.refundType === 'against_debit_note' && !selectedNote) {
        this.payForm.get('returnNo')?.setErrors({ required: true });
        this.payForm.markAllAsTouched();
        return;
      }
      const maxRefund = raw.refundType === 'against_invoice'
        ? Number(selectedInvoice?.outstandingAmount || 0)
        : raw.refundType === 'against_debit_note' && selectedNote
          ? this.debitNoteRefundableAmount(selectedNote)
          : Number.POSITIVE_INFINITY;
      if (refundAmount > maxRefund) {
        this.toastr.error(`Refund cannot exceed the available balance of ₹${this.numberFormat.format(maxRefund)}`);
        return;
      }

      const dto: PurchaseRefund = {
        companyId: this.cid() || raw.companyId,
        vendorId: raw.vendorId,
        refundType: raw.refundType,
        piNumber: raw.refundType === 'against_invoice' ? raw.piNumber : null,
        returnNo: raw.refundType === 'against_debit_note' ? raw.returnNo : null,
        refundDate: this.asDateOnly(raw.paymentDate),
        paymentMode: raw.paymentMode,
        refundAmount,
        chequeDate: (this.isCheque && raw.chequeDate) ? raw.chequeDate : null,
        chequeNo: this.isCheque ? raw.chequeNo : null,
        bankName: this.isCheque || this.needsBankRef ? raw.bankName : null,
        bankRef: this.needsBankRef ? raw.bankRef : null,
        notes: raw.notes
      };
      this.saving = true;
      this.svc.recordRefund(dto, this.cid()).pipe(takeUntil(this.destroy$)).subscribe({
        next: response => {
          this.saving = false;
          if (response.result !== 'pass') {
            this.toastr.error(response.errorMessage || 'Failed to record refund');
            return;
          }
          this.toastr.success(`Refund ${response.data?.refundNo || ''} recorded successfully`);
          const vendorId = raw.vendorId as string;
          this.close();
          this.loadRefunds();
          this.loadInvoices(vendorId);
          this.loadDebitNotes(vendorId);
        },
        error: (error: any) => {
          this.saving = false;
          this.toastr.error(error?.error?.errorMessage || error?.message || 'Failed to record refund');
        }
      });
      return;
    }

    // FIX-BUG-2: strip mode-irrelevant fields so backend never gets empty string for DateTime?
    // chequeDate: only send when mode is cheque AND a value was entered
    const dto: PurchasePayment = {
      ...raw,
      piNumber: raw.piNumber || null,
      paymentType: raw.piNumber ? raw.paymentType : 'advance',
      paymentDate: this.asDateOnly(raw.paymentDate),
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

    this.saving = true;
    this.svc.recordPayment(dto, this.cid())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (r: any) => {
          this.saving = false;
          if (r?.result === 'pass') {
            this.toastr.success(`Payment ${r.data?.payNo || r.data?.paymentNo} recorded successfully`);
            this.close();
            this.loadList();
            this.loadInvoices(this.payForm.get('vendorId')?.value);
          } else {
            this.toastr.error(r?.errorMessage || r?.message || 'Failed to record payment');
          }
        },
        error: (e: any) => {
          this.saving = false;
          this.toastr.error(e?.error?.errorMessage || e?.message || 'Failed to record payment');
        }
      });
  }

  deletePayment(paymentId: number): void {
    if (!paymentId) {
      this.toastr.error('Payment identifier is missing');
      return;
    }
    if (!confirm('Delete this payment? Invoice outstanding will be restored.')) return;
    this.svc.deletePayment(paymentId, this.cid())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (r: any) => {
          if (r?.result !== 'pass') {
            this.toastr.error(r?.errorMessage || 'Delete failed');
            return;
          }
          this.toastr.success('Payment deleted');
          this.loadList();
          this.loadInvoices(this.payForm.get('vendorId')?.value);
        },
        error: (e: any) => this.toastr.error(e?.error?.errorMessage || e?.message || 'Delete failed')
      });
  }

  get totalPaid(): number {
    return this.dataSource.data.reduce((s, p) => s + (p.amount || 0), 0);
  }

  get totalNetPaid(): number {
    return this.dataSource.data.reduce((s, p) => s + (p.netPaid || 0), 0);
  }

  isAdvancePayment(payment: PurchasePayment): boolean {
    return !payment.piNumber || payment.paymentType?.toLowerCase() === 'advance';
  }

  availableAdvance(payment: PurchasePayment): number {
    return Math.max(0, payment.availableAmount ?? ((payment.netPaid || 0) - (payment.allocatedAmount || 0)));
  }

  get selectedAllocationTotal(): number {
    return this.roundMoney(this.allocationInvoices
      .filter(invoice => invoice.selected)
      .reduce((total, invoice) => total + (Number(invoice.allocationAmount) || 0), 0));
  }

  get remainingAdvanceAfterSelection(): number {
    return this.roundMoney(this.availableAdvance(this.allocationPayment || {}) - this.selectedAllocationTotal);
  }

  get canSaveAllocation(): boolean {
    const selected = this.allocationInvoices.filter(invoice => invoice.selected);
    return !this.allocationLoading && !this.allocationSaving && selected.length > 0
      && selected.every(invoice => invoice.allocationAmount > 0
        && this.roundMoney(invoice.allocationAmount) <= invoice.outstandingAmount)
      && this.selectedAllocationTotal > 0
      && this.selectedAllocationTotal <= this.availableAdvance(this.allocationPayment || {});
  }

  private roundMoney(amount: number): number {
    return Math.round((amount + Number.EPSILON) * 100) / 100;
  }

  openAdvanceAllocation(payment: PurchasePayment): void {
    if (!payment.paymentId || !payment.vendorId || this.availableAdvance(payment) <= 0) return;
    if (this.allocationOverlay?.hasAttached()) return;

    const requestId = ++this.allocationRequestId;
    this.allocationPayment = payment;
    this.allocationInvoices = [];
    this.allocationLoading = true;
    this.allocationSaving = false;
    this.allocationOverlay = this.overlay.create({
      hasBackdrop: true,
      backdropClass: 'pp-overlay-backdrop',
      panelClass: ['pp-overlay-pane', 'pp-allocation-pane'],
      width: 'min(760px, calc(100vw - 48px))',
      maxHeight: '92vh',
      positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
      scrollStrategy: this.overlay.scrollStrategies.block()
    });
    this.allocationOverlay.backdropClick()
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.closeAdvanceAllocation());
    this.allocationOverlay.attach(new TemplatePortal(this.allocationModal, this.viewContainerRef));

    const companyId = this.cid();
    this.svc.getInvoices(companyId, undefined, payment.vendorId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: response => {
          if (requestId !== this.allocationRequestId) return;
          this.allocationLoading = false;
          if (response.result !== 'pass') {
            this.toastr.error(response.errorMessage || 'Failed to load vendor invoices');
            return;
          }

          this.allocationInvoices = (response.data || [])
            .filter(invoice => this.sameId(invoice.companyId, companyId)
              && this.sameId(invoice.vendorId, payment.vendorId)
              && ['pending', 'partial'].includes((invoice.status || '').toLowerCase())
              && invoice.outstandingAmount > 0)
            .sort((a, b) => new Date(a.dueDate || a.invoiceDate || 0).getTime()
              - new Date(b.dueDate || b.invoiceDate || 0).getTime())
            .map(invoice => ({ ...invoice, selected: false, allocationAmount: 0 }));
        },
        error: (error: any) => {
          if (requestId !== this.allocationRequestId) return;
          this.allocationLoading = false;
          this.toastr.error(error?.error?.errorMessage || error?.message || 'Failed to load vendor invoices');
        }
      });
  }

  setAllocationSelected(invoice: AdvanceInvoiceAllocationRow, selected: boolean): void {
    invoice.selected = selected;
    if (!selected) invoice.allocationAmount = 0;
  }

  closeAdvanceAllocation(): void {
    if (this.allocationSaving) return;
    this.allocationRequestId++;
    this.allocationOverlay?.dispose();
    this.allocationOverlay = undefined;
    this.allocationPayment = undefined;
    this.allocationInvoices = [];
    this.allocationLoading = false;
  }

  saveAdvanceAllocation(): void {
    if (!this.canSaveAllocation || !this.allocationPayment?.paymentId) return;
    const allocations: PurchasePaymentAllocation[] = this.allocationInvoices
      .filter(invoice => invoice.selected)
      .map(invoice => ({ piNumber: invoice.piNumber!, amount: this.roundMoney(invoice.allocationAmount) }));

    this.allocationSaving = true;
    this.svc.allocateAdvancePayment(this.allocationPayment.paymentId, this.cid(), allocations)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: response => {
          this.allocationSaving = false;
          if (response.result !== 'pass') {
            this.toastr.error(response.errorMessage || 'Failed to allocate advance');
            return;
          }
          this.toastr.success('Advance allocated to the selected invoices');
          this.closeAdvanceAllocation();
          this.loadList();
        },
        error: (error: any) => {
          this.allocationSaving = false;
          this.toastr.error(error?.error?.errorMessage || error?.message || 'Failed to allocate advance');
        }
      });
  }
}
