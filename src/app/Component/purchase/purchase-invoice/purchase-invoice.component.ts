// src/app/Component/purchase/purchase-invoice/purchase-invoice.component.ts
import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
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
import { MasterService } from '../../../_service/master.service';
import {
  PurchaseInvoice, PurchaseInvoiceLine, Vendor, GST_RATES, PI_STATUSES
} from '../../../_model/purchase.model';

@Component({
  selector: 'app-purchase-invoice',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule],
  templateUrl: './purchase-invoice.component.html',
  styleUrls: ['../purchase-shared.css', './purchase-invoice.component.css']
})
export class PurchaseInvoiceComponent implements OnInit, OnDestroy {
  /* ── List state ─────────────────────────────────────────────── */
  listColumns = ['piNumber','invoiceDate','vendorName','grandTotal','paidAmount','outstandingAmount','status','action'];
  dataSource  = new MatTableDataSource<PurchaseInvoice>();
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  loading    = false;
  view: 'list' | 'form' | 'detail' = 'list';
  isMobile   = window.innerWidth < 768;
  statusFilter = '';
  piStatuses   = PI_STATUSES;

  /* ── Form state ─────────────────────────────────────────────── */
  invoiceForm!: FormGroup;
  vendors: Vendor[] = [];
  products: any[]  = [];
  gstRates = GST_RATES;
  selectedInvoice: PurchaseInvoice | null = null;
  isInterState = false;  // IGST vs CGST+SGST toggle

  private destroy$ = new Subject<void>();

  constructor(
    private svc: PurchaseService,
    private masterSvc: MasterService,
    private fb: FormBuilder,
    private toastr: ToastrService,
    private auth: AuthService,
    private selectedCo: SelectedCompanyService
  ) {
    window.addEventListener('resize', () => this.isMobile = window.innerWidth < 768);
  }

  ngOnInit(): void {
    this.buildForm();
    this.selectedCo.selectedCompanyId$.pipe(takeUntil(this.destroy$)).subscribe(() => this.loadList());
    this.loadVendors();
    this.loadProducts();
  }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }
  ngAfterViewInit(): void { this.dataSource.paginator = this.paginator; this.dataSource.sort = this.sort; }

  private cid = () => this.selectedCo.getSelectedCompanyId() || this.auth.getCompanyId() || '';

  // ── Form builder ──────────────────────────────────────────────
  buildForm(inv?: PurchaseInvoice): void {
    const today = new Date().toISOString().split('T')[0];
    this.invoiceForm = this.fb.group({
      piNumber:       [inv?.piNumber || null],
      companyId:      [inv?.companyId || this.cid()],
      vendorId:       [inv?.vendorId || '', Validators.required],
      vendorInvoiceNo:[inv?.vendorInvoiceNo || ''],
      poNumber:       [inv?.poNumber || ''],
      invoiceDate:    [inv?.invoiceDate?.split('T')[0] || today, Validators.required],
      dueDate:        [inv?.dueDate?.split('T')[0] || ''],
      supplyPlace:    [inv?.supplyPlace || ''],
      freightCharges: [inv?.freightCharges || 0, Validators.min(0)],
      otherCharges:   [inv?.otherCharges  || 0, Validators.min(0)],
      discountAmount: [inv?.discountAmount || 0, Validators.min(0)],
      remark:         [inv?.remark || ''],
      items: this.fb.array(
        inv?.items?.map((i: PurchaseInvoiceLine) => this.buildLine(i)) ?? [this.buildLine()]
      )
    });
    this.updateTotals();
  }

  buildLine(i?: PurchaseInvoiceLine): FormGroup {
    return this.fb.group({
      productId:    [i?.productId  || '', Validators.required],
      productName:  [i?.productName || ''],
      hsnSac:       [i?.hsnSac  || ''],
      measurement:  [i?.measurement || ''],
      quantity:     [i?.quantity  || 1,    [Validators.required, Validators.min(0.001)]],
      rate:         [i?.rate      || 0,    [Validators.required, Validators.min(0)]],
      discountPct:  [i?.discountPct || 0,  Validators.min(0)],
      discountAmt:  [{ value: i?.discountAmt || 0, disabled: true }],
      taxableAmount:[{ value: i?.taxableAmount || 0, disabled: true }],
      cgstRate:     [i?.cgstRate || 0],
      sgstRate:     [i?.sgstRate || 0],
      igstRate:     [i?.igstRate || 0],
      cgstAmount:   [{ value: i?.cgstAmount || 0, disabled: true }],
      sgstAmount:   [{ value: i?.sgstAmount || 0, disabled: true }],
      igstAmount:   [{ value: i?.igstAmount || 0, disabled: true }],
      totalAmount:  [{ value: i?.totalAmount || 0, disabled: true }],
      remark:       [i?.remark || '']
    });
  }

  get items(): FormArray { return this.invoiceForm.get('items') as FormArray; }

  addLine(): void { this.items.push(this.buildLine()); }
  removeLine(idx: number): void { if (this.items.length > 1) { this.items.removeAt(idx); this.updateTotals(); } }

  // ── Calculation helpers ───────────────────────────────────────
  onLineChange(idx: number): void {
    const line = this.items.at(idx);
    const qty  = +line.get('quantity')?.value || 0;
    const rate = +line.get('rate')?.value || 0;
    const dpct = +line.get('discountPct')?.value || 0;
    const gross = qty * rate;
    const damt  = (gross * dpct) / 100;
    const taxable = gross - damt;
    const cgstR = this.isInterState ? 0 : (+line.get('cgstRate')?.value || 0);
    const sgstR = this.isInterState ? 0 : (+line.get('sgstRate')?.value || 0);
    const igstR = this.isInterState ? (+line.get('igstRate')?.value || 0) : 0;
    const cgstA = (taxable * cgstR) / 100;
    const sgstA = (taxable * sgstR) / 100;
    const igstA = (taxable * igstR) / 100;
    const total = taxable + cgstA + sgstA + igstA;
    line.patchValue({
      discountAmt: this.r2(damt), taxableAmount: this.r2(taxable),
      cgstAmount: this.r2(cgstA), sgstAmount: this.r2(sgstA),
      igstAmount: this.r2(igstA), totalAmount: this.r2(total)
    }, { emitEvent: false });
    this.updateTotals();
  }

  onGstRateChange(idx: number, rate: number): void {
    const line = this.items.at(idx);
    if (this.isInterState) {
      line.patchValue({ igstRate: rate, cgstRate: 0, sgstRate: 0 }, { emitEvent: false });
    } else {
      const half = rate / 2;
      line.patchValue({ cgstRate: half, sgstRate: half, igstRate: 0 }, { emitEvent: false });
    }
    this.onLineChange(idx);
  }

  toggleInterState(v: boolean): void {
    this.isInterState = v;
    for (let i = 0; i < this.items.length; i++) this.onLineChange(i);
  }

  onProductSelect(idx: number, productId: string): void {
    const p = this.products.find(x => x.uniqueKeyID === productId);
    if (!p) return;
    this.items.at(idx).patchValue({
      productName: p.productName || p.name,
      hsnSac: p.hsnSacCode || p.hsnSac || '',
      measurement: p.measurement || p.unit || '',
      rate: +(p.purchaseRate || p.sellingPrice || 0)
    }, { emitEvent: false });
    this.onLineChange(idx);
  }

  // ── Summary totals ────────────────────────────────────────────
  get subtotal():      number { return this.r2(this.items.controls.reduce((s, l) => s + (+l.get('taxableAmount')?.value||0), 0)); }
  get totalCgst():     number { return this.r2(this.items.controls.reduce((s, l) => s + (+l.get('cgstAmount')?.value||0), 0)); }
  get totalSgst():     number { return this.r2(this.items.controls.reduce((s, l) => s + (+l.get('sgstAmount')?.value||0), 0)); }
  get totalIgst():     number { return this.r2(this.items.controls.reduce((s, l) => s + (+l.get('igstAmount')?.value||0), 0)); }
  get totalGst():      number { return this.r2(this.totalCgst + this.totalSgst + this.totalIgst); }
  get freightCharges():number { return +(this.invoiceForm.get('freightCharges')?.value||0); }
  get otherCharges():  number { return +(this.invoiceForm.get('otherCharges')?.value||0); }
  get discountAmount():number { return +(this.invoiceForm.get('discountAmount')?.value||0); }
  get preRound():      number { return this.r2(this.subtotal + this.totalGst + this.freightCharges + this.otherCharges - this.discountAmount); }
  get roundOff():      number { return this.r2(Math.round(this.preRound) - this.preRound); }
  get grandTotal():    number { return this.r2(this.preRound + this.roundOff); }
  get amountInWords(): string { return this.toWords(this.grandTotal); }

  updateTotals(): void { /* triggers getters reactively — no-op required for CD */ }

  private r2 = (n: number) => Math.round(n * 100) / 100;

  private toWords(amount: number): string {
    if (!amount) return 'Zero Rupees Only';
    const r = Math.floor(amount), p = Math.round((amount - r) * 100);
    const words = this.numWords(r) + ' Rupees' + (p > 0 ? ' and ' + this.numWords(p) + ' Paise' : '') + ' Only';
    return words;
  }
  private numWords(n: number): string {
    const o=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
    const t=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
    if(n<20) return o[n]; if(n<100) return t[Math.floor(n/10)]+(n%10?' '+o[n%10]:'');
    if(n<1000) return o[Math.floor(n/100)]+' Hundred'+(n%100?' '+this.numWords(n%100):'');
    if(n<100000) return this.numWords(Math.floor(n/1000))+' Thousand'+(n%1000?' '+this.numWords(n%1000):'');
    if(n<10000000) return this.numWords(Math.floor(n/100000))+' Lakh'+(n%100000?' '+this.numWords(n%100000):'');
    return this.numWords(Math.floor(n/10000000))+' Crore'+(n%10000000?' '+this.numWords(n%10000000):'');
  }

  // ── Load data ─────────────────────────────────────────────────
  loadList(): void {
    this.loading = true;
    this.svc.getInvoices(this.cid(), this.statusFilter || undefined).pipe(takeUntil(this.destroy$)).subscribe({
      next: (r: any) => { this.dataSource.data = r?.data || []; this.loading = false; },
      error: () => { this.toastr.error('Failed to load invoices'); this.loading = false; }
    });
  }

  loadVendors(): void {
    this.svc.getVendors(this.cid()).pipe(takeUntil(this.destroy$)).subscribe({
      next: (r: any) => this.vendors = r?.data || []
    });
  }

  loadProducts(): void {
    this.masterSvc.GetProducts(this.cid() || undefined).pipe(takeUntil(this.destroy$)).subscribe({
      next: (r: any) => this.products = Array.isArray(r) ? r : (r?.data || r?.result || [])
    });
  }

  applyFilter(e: Event): void {
    this.dataSource.filter = (e.target as HTMLInputElement).value.trim().toLowerCase();
  }

  // ── Navigation ────────────────────────────────────────────────
  openNew(): void { this.buildForm(); this.view = 'form'; }
  openEdit(inv: PurchaseInvoice): void { this.buildForm(inv); this.view = 'form'; }
  openDetail(inv: PurchaseInvoice): void { this.selectedInvoice = inv; this.view = 'detail'; }
  backToList(): void { this.selectedInvoice = null; this.view = 'list'; this.loadList(); }

  // ── Save ──────────────────────────────────────────────────────
  save(): void {
    if (this.invoiceForm.invalid) { this.invoiceForm.markAllAsTouched(); return; }
    const dto: PurchaseInvoice = {
      ...this.invoiceForm.getRawValue(),
      subtotal:       this.subtotal,
      cgstAmount:     this.totalCgst,
      sgstAmount:     this.totalSgst,
      igstAmount:     this.totalIgst,
      totalGstAmount: this.totalGst,
      roundOff:       this.roundOff,
      grandTotal:     this.grandTotal,
      amountInWords:  this.amountInWords,
      freightCharges: this.freightCharges,
      otherCharges:   this.otherCharges,
      discountAmount: this.discountAmount,
      paidAmount:     0, outstandingAmount: this.grandTotal, status: 'pending'
    };
    this.svc.saveInvoice(dto, this.cid()).pipe(takeUntil(this.destroy$)).subscribe({
      next: (r: any) => {
        if (r?.result === 'pass') { this.toastr.success('Purchase invoice saved'); this.backToList(); }
        else this.toastr.error(r?.errorMessage || 'Save failed');
      },
      error: (e: any) => this.toastr.error(e?.message || 'Save failed')
    });
  }

  cancel(piNumber: string): void {
    if (!confirm(`Cancel invoice ${piNumber}? This will reverse stock.`)) return;
    this.svc.cancelInvoice(piNumber).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.toastr.success('Invoice cancelled'); this.loadList(); },
      error: (e: any) => this.toastr.error(e?.message || 'Cancel failed')
    });
  }

  getVendorName(id: string): string {
    return this.vendors.find(v => v.vendorId === id)?.vendorName || id;
  }
}
