// src/app/Component/purchase/purchase-reports/purchase-reports.component.ts
import { Component, Injectable, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE, NativeDateAdapter } from '@angular/material/core';
import { ToastrService } from 'ngx-toastr';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { PurchaseService } from '../../../_service/purchase.service';
import { AuthService } from '../../../_service/authentication.service';
import { SelectedCompanyService } from '../../../_service/selected-company.service';
import {
  PurchaseRegisterRow, VendorOutstanding, PurchaseLedgerEntry, StockSummary, Vendor
} from '../../../_model/purchase.model';

const REPORT_DATE_FORMATS = {
  parse: { dateInput: { day: '2-digit', month: '2-digit', year: 'numeric' } },
  display: {
    dateInput: { day: '2-digit', month: '2-digit', year: 'numeric' },
    monthYearLabel: { month: 'short', year: 'numeric' },
    dateA11yLabel: { day: 'numeric', month: 'long', year: 'numeric' },
    monthYearA11yLabel: { month: 'long', year: 'numeric' }
  }
};

@Injectable()
class ReportDateAdapter extends NativeDateAdapter {
  override format(date: Date, _displayFormat: unknown): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${date.getFullYear()}`;
  }

  override parse(value: unknown): Date | null {
    if (typeof value !== 'string') return null;
    const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return null;
    const day = Number(match[1]);
    const month = Number(match[2]) - 1;
    const year = Number(match[3]);
    const date = new Date(year, month, day);
    return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day ? date : null;
  }
}

@Component({
  selector: 'app-purchase-reports',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule],
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'en-GB' },
    { provide: DateAdapter, useClass: ReportDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: REPORT_DATE_FORMATS }
  ],
  templateUrl: './purchase-reports.component.html',
  styleUrls: ['../purchase-shared.css', './purchase-reports.component.css']
})
export class PurchaseReportsComponent implements OnInit, OnDestroy {
  activeTab = 0;

  /* ── Purchase Register ─────────────────────────────────────── */
  registerForm!: FormGroup;
  registerRows:  PurchaseRegisterRow[] = [];
  regLoading   = false;
  regCols      = ['piNumber','invoiceDate','vendorName','subtotal','totalGstAmount','grandTotal','paidAmount','outstandingAmount','status'];

  /* ── Vendor Outstanding ────────────────────────────────────── */
  outstanding:    VendorOutstanding[] = [];
  outLoading    = false;
  outCols       = ['vendorName','totalPurchased','totalPaid','outstandingAmount','overdueAmount','overdueInvoices','oldestDueDate'];

  /* ── Vendor Ledger ─────────────────────────────────────────── */
  ledgerForm!: FormGroup;
  ledgerRows:   PurchaseLedgerEntry[] = [];
  ledLoading  = false;
  ledCols     = ['referenceDate','referenceType','referenceNumber','debitAmount','creditAmount','outstandingAmount','dueDate'];
  vendors:     Vendor[] = [];
  vendorSearch = new FormControl('', { nonNullable: true });
  runningBalance = 0;

  /* ── Stock Summary ─────────────────────────────────────────── */
  stockRows:   StockSummary[] = [];
  stkLoading = false;
  stkCols    = ['productName','stockQty','minStockQty','reorderLevel','lastPurchaseRate','lastPurchaseDate','status'];

  private destroy$ = new Subject<void>();

  constructor(
    private svc: PurchaseService,
    private fb: FormBuilder,
    private toastr: ToastrService,
    private auth: AuthService,
    private selectedCo: SelectedCompanyService
  ) {}

  ngOnInit(): void {
    this.buildForms();
    this.selectedCo.selectedCompanyId$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.loadRegister();
      this.loadVendors();
      this.loadOutstanding();
      this.loadStock();
    });
  }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  private cid = () => this.selectedCo.getSelectedCompanyId() || this.auth.getCompanyId() || '';

  buildForms(): void {
    const now = new Date();
    const from = new Date(now.getFullYear() - (now.getMonth() < 3 ? 1 : 0), 3, 1);
    const to = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    this.registerForm = this.fb.group({ from: [from, Validators.required], to: [to, Validators.required] });
    this.ledgerForm   = this.fb.group({ vendorId: ['', Validators.required] });
  }

  private toDateInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private rowsFrom<T>(response: any): T[] {
    const rows = response?.data ?? response?.Data ?? response?.items ?? response?.Items ?? response;
    return Array.isArray(rows) ? rows : [];
  }

  get filteredVendors(): Vendor[] {
    const query = this.vendorSearch.value.trim().toLocaleLowerCase();
    if (!query) return this.vendors;
    return this.vendors.filter(vendor =>
      [vendor.vendorName, vendor.vendorId, vendor.gstin, vendor.phone, vendor.mobile, vendor.email, vendor.contactPerson]
        .some(value => String(value || '').toLocaleLowerCase().includes(query))
    );
  }

  displayVendor(value: Vendor | string | null): string {
    return typeof value === 'string' ? value : (value?.vendorName || '');
  }

  onVendorSearchInput(): void {
    const selectedVendor = this.vendors.find(vendor => vendor.vendorId === this.ledgerForm.get('vendorId')?.value);
    if (selectedVendor?.vendorName !== this.vendorSearch.value) {
      this.ledgerForm.get('vendorId')?.setValue('');
    }
  }

  selectVendor(vendor: Vendor): void {
    this.ledgerForm.get('vendorId')?.setValue(vendor.vendorId || '');
    this.vendorSearch.setValue(vendor.vendorName || '', { emitEvent: false });
  }

  private showApiFailure(response: any, fallback: string): boolean {
    const result = response?.result ?? response?.Result;
    if (String(result || '').toLowerCase() !== 'fail') return false;
    this.toastr.error(response?.errorMessage || response?.ErrorMessage || fallback);
    return true;
  }

  loadVendors(): void {
    this.svc.getVendors(this.cid()).pipe(takeUntil(this.destroy$)).subscribe({
      next: (r: any) => {
        const vendors = this.showApiFailure(r, 'Failed to load vendors') ? [] : this.rowsFrom<Vendor>(r);
        this.vendors = [...vendors].sort((a, b) =>
          (a.vendorName || '').localeCompare(b.vendorName || '', undefined, { sensitivity: 'base', numeric: true })
        );
      },
      error: (error: any) => this.toastr.error(error?.error?.errorMessage || error?.message || 'Failed to load vendors')
    });
  }

  // ── Purchase Register ──────────────────────────────────────────
  loadRegister(): void {
    if (this.registerForm.invalid) return;
    this.regLoading = true;
    const { from, to } = this.registerForm.value;
    this.svc.getPurchaseRegister(this.cid(), this.toDateInput(from), this.toDateInput(to)).pipe(takeUntil(this.destroy$)).subscribe({
      next: (r: any) => {
        this.registerRows = this.showApiFailure(r, 'Failed to load register') ? [] : this.rowsFrom<PurchaseRegisterRow>(r);
        this.regLoading = false;
      },
      error: (error: any) => {
        this.toastr.error(error?.error?.errorMessage || error?.error?.ErrorMessage || error?.message || 'Failed to load register');
        this.regLoading = false;
      }
    });
  }

  get regTotalGrand(): number { return this.registerRows.reduce((s, r) => s + r.grandTotal, 0); }
  get regTotalPaid():  number { return this.registerRows.reduce((s, r) => s + r.paidAmount, 0); }
  get regTotalDue():   number { return this.registerRows.reduce((s, r) => s + r.outstandingAmount, 0); }
  get regTotalGst():   number { return this.registerRows.reduce((s, r) => s + r.totalGstAmount, 0); }

  // ── Vendor Outstanding ─────────────────────────────────────────
  loadOutstanding(): void {
    this.outLoading = true;
    this.svc.getVendorOutstanding(this.cid()).pipe(takeUntil(this.destroy$)).subscribe({
      next: (r: any) => {
        this.outstanding = this.showApiFailure(r, 'Failed to load outstanding') ? [] : this.rowsFrom<VendorOutstanding>(r);
        this.outLoading = false;
      },
      error: () => { this.toastr.error('Failed to load outstanding'); this.outLoading = false; }
    });
  }

  get outTotalDue():     number { return this.outstanding.reduce((s, o) => s + o.outstandingAmount, 0); }
  get outTotalOverdue(): number { return this.outstanding.reduce((s, o) => s + o.overdueAmount, 0); }

  // ── Vendor Ledger ──────────────────────────────────────────────
  loadLedger(): void {
    if (this.ledgerForm.invalid) return;
    this.ledLoading = true;
    const { vendorId } = this.ledgerForm.value;
    this.svc.getVendorLedger(vendorId, this.cid()).pipe(takeUntil(this.destroy$)).subscribe({
      next: (r: any) => {
        this.ledgerRows = this.showApiFailure(r, 'Failed to load ledger') ? [] : this.rowsFrom<PurchaseLedgerEntry>(r);
        // compute running balance
        let bal = 0;
        this.ledgerRows.forEach(l => { bal += l.creditAmount - l.debitAmount; });
        this.runningBalance = Math.round(bal * 100) / 100;
        this.ledLoading = false;
      },
      error: () => { this.toastr.error('Failed to load ledger'); this.ledLoading = false; }
    });
  }

  get ledgerVendorName(): string {
    const vid = this.ledgerForm.get('vendorId')?.value;
    return this.vendors.find(vendor => vendor.vendorId === vid)?.vendorName || '';
  }

  // ── Stock Summary ──────────────────────────────────────────────
  loadStock(): void {
    this.stkLoading = true;
    this.svc.getStockSummary(this.cid()).pipe(takeUntil(this.destroy$)).subscribe({
      next: (r: any) => {
        this.stockRows = this.showApiFailure(r, 'Failed to load stock summary') ? [] : this.rowsFrom<StockSummary>(r);
        this.stkLoading = false;
      },
      error: () => { this.toastr.error('Failed to load stock'); this.stkLoading = false; }
    });
  }

  get stockBelowReorder(): number { return this.stockRows.filter(s => s.isBelowReorder).length; }
  get stockOutOfStock():   number { return this.stockRows.filter(s => s.isOutOfStock).length; }
  get stockTotalItems():   number { return this.stockRows.length; }

  onTabChange(idx: number): void {
    this.activeTab = idx;
    if (idx === 0) this.loadRegister();
    if (idx === 1) this.loadOutstanding();
    if (idx === 3) this.loadStock();
  }
}
