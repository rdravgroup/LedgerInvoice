// src/app/Component/purchase/purchase-reports/purchase-reports.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { ToastrService } from 'ngx-toastr';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { PurchaseService } from '../../../_service/purchase.service';
import { AuthService } from '../../../_service/authentication.service';
import { SelectedCompanyService } from '../../../_service/selected-company.service';
import {
  PurchaseRegisterRow, VendorOutstanding, PurchaseLedgerEntry, StockSummary, Vendor
} from '../../../_model/purchase.model';

@Component({
  selector: 'app-purchase-reports',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule],
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
      this.loadVendors();
      this.loadOutstanding();
      this.loadStock();
    });
  }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  private cid = () => this.selectedCo.getSelectedCompanyId() || this.auth.getCompanyId() || '';

  buildForms(): void {
    const now   = new Date();
    const from  = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const to    = now.toISOString().split('T')[0];
    this.registerForm = this.fb.group({ from: [from, Validators.required], to: [to, Validators.required] });
    this.ledgerForm   = this.fb.group({ vendorId: ['', Validators.required] });
  }

  loadVendors(): void {
    this.svc.getVendors(this.cid()).pipe(takeUntil(this.destroy$)).subscribe({
      next: (r: any) => this.vendors = r?.data || []
    });
  }

  // ── Purchase Register ──────────────────────────────────────────
  loadRegister(): void {
    if (this.registerForm.invalid) return;
    this.regLoading = true;
    const { from, to } = this.registerForm.value;
    this.svc.getPurchaseRegister(this.cid(), from, to).pipe(takeUntil(this.destroy$)).subscribe({
      next: (r: any) => { this.registerRows = r?.data || []; this.regLoading = false; },
      error: () => { this.toastr.error('Failed to load register'); this.regLoading = false; }
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
      next: (r: any) => { this.outstanding = r?.data || []; this.outLoading = false; },
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
        this.ledgerRows = r?.data || [];
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
    return this.vendors.find(v => v.vendorId === vid)?.vendorName || '';
  }

  // ── Stock Summary ──────────────────────────────────────────────
  loadStock(): void {
    this.stkLoading = true;
    this.svc.getStockSummary(this.cid()).pipe(takeUntil(this.destroy$)).subscribe({
      next: (r: any) => { this.stockRows = r?.data || []; this.stkLoading = false; },
      error: () => { this.toastr.error('Failed to load stock'); this.stkLoading = false; }
    });
  }

  get stockBelowReorder(): number { return this.stockRows.filter(s => s.isBelowReorder).length; }
  get stockOutOfStock():   number { return this.stockRows.filter(s => s.isOutOfStock).length; }
  get stockTotalItems():   number { return this.stockRows.length; }

  onTabChange(idx: number): void {
    this.activeTab = idx;
    if (idx === 1) this.loadOutstanding();
    if (idx === 3) this.loadStock();
  }
}
