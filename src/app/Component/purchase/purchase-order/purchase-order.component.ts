// src/app/Component/purchase/purchase-order/purchase-order.component.ts
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
import { PurchaseOrder, PurchaseOrderLine, Vendor, GST_RATES, PO_STATUSES } from '../../../_model/purchase.model';

@Component({
  selector: 'app-purchase-order',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule],
  templateUrl: './purchase-order.component.html',
  styleUrls: ['../purchase-shared.css', './purchase-order.component.css']
})
export class PurchaseOrderComponent implements OnInit, OnDestroy {
  listColumns = ['poNumber','poDate','vendorName','expectedDate','grandTotal','status','action'];
  dataSource  = new MatTableDataSource<PurchaseOrder>();
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  loading      = false;
  view: 'list' | 'form' | 'detail' = 'list';
  isMobile     = window.innerWidth < 768;
  statusFilter = '';
  poStatuses   = PO_STATUSES;

  poForm!:  FormGroup;
  vendors:  Vendor[] = [];
  products: any[]   = [];
  gstRates  = GST_RATES;
  selectedPO: PurchaseOrder | null = null;
  isInterState = false;

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
    console.log('PurchaseOrder.ngOnInit');
    this.buildForm();
    this.selectedCo.selectedCompanyId$.pipe(takeUntil(this.destroy$)).subscribe(() => this.loadList());
    this.loadVendors();
    this.loadProducts();
  }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }
  ngAfterViewInit(): void { this.dataSource.paginator = this.paginator; this.dataSource.sort = this.sort; }

  private cid = () => this.selectedCo.getSelectedCompanyId() || this.auth.getCompanyId() || '';

  buildForm(po?: PurchaseOrder): void {
    // FIX: previously used new Date().toISOString().split('T')[0] for the
    // default date, which converts to UTC first — for anyone west of UTC
    // this can silently shift "today" back by a day depending on the time
    // of day. Also switched poDate/expectedDate to real Date objects,
    // required by mat-datepicker (previously plain 'yyyy-MM-dd' strings
    // for a native <input type="date">, which rendered inconsistently
    // across browsers — the reported "no date picker" issue).
    const today = new Date();
    this.poForm = this.fb.group({
      poNumber:        [po?.poNumber || null],
      companyId:       [po?.companyId || this.cid()],
      vendorId:        [po?.vendorId || '', Validators.required],
      poDate:          [po?.poDate ? new Date(po.poDate) : today, Validators.required],
      expectedDate:    [po?.expectedDate ? new Date(po.expectedDate) : null],
      referenceNo:     [po?.referenceNo || ''],
      deliveryAddress: [po?.deliveryAddress || ''],
      paymentTerms:    [po?.paymentTerms || ''],
      shippingTerms:   [po?.shippingTerms || ''],
      freightCharges:  [po?.freightCharges || 0, Validators.min(0)],
      otherCharges:    [po?.otherCharges   || 0, Validators.min(0)],
      discountAmount:  [po?.discountAmount  || 0, Validators.min(0)],
      remark:          [po?.remark || ''],
      items: this.fb.array(po?.items?.map((i: PurchaseOrderLine) => this.buildLine(i)) ?? [this.buildLine()])
    });
  }

  /** Converts a Date (from mat-datepicker) to a 'yyyy-MM-dd' string for the API. */
  private toIsoDate(d: any): string | null {
    if (!d) return null;
    const date = d instanceof Date ? d : new Date(d);
    if (isNaN(date.getTime())) return null;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  buildLine(i?: PurchaseOrderLine): FormGroup {
    return this.fb.group({
      productId:    [i?.productId    || '', Validators.required],
      productName:  [i?.productName  || ''],
      hsnSac:       [i?.hsnSac       || ''],
      measurement:  [i?.measurement  || ''],
      orderedQty:   [i?.orderedQty   || 1,  [Validators.required, Validators.min(0.001)]],
      receivedQty:  [{ value: i?.receivedQty || 0, disabled: true }],
      rate:         [i?.rate         || 0,  [Validators.required, Validators.min(0)]],
      discountPct:  [i?.discountPct  || 0],
      discountAmt:  [{ value: i?.discountAmt  || 0, disabled: true }],
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

  get items(): FormArray { return this.poForm.get('items') as FormArray; }
  addLine(): void { this.items.push(this.buildLine()); }
  removeLine(idx: number): void { if (this.items.length > 1) { this.items.removeAt(idx); } }

  onLineChange(idx: number): void {
    const l   = this.items.at(idx);
    const qty = +(l.get('orderedQty')?.value) || 0;
    const rt  = +(l.get('rate')?.value) || 0;
    const dp  = +(l.get('discountPct')?.value) || 0;
    const gross   = qty * rt;
    const damt    = (gross * dp) / 100;
    const taxable = gross - damt;
    const cr = this.isInterState ? 0 : +(l.get('cgstRate')?.value || 0);
    const sr = this.isInterState ? 0 : +(l.get('sgstRate')?.value || 0);
    const ir = this.isInterState ? +(l.get('igstRate')?.value || 0) : 0;
    l.patchValue({
      discountAmt: this.r2(damt), taxableAmount: this.r2(taxable),
      cgstAmount: this.r2(taxable * cr / 100),
      sgstAmount: this.r2(taxable * sr / 100),
      igstAmount: this.r2(taxable * ir / 100),
      totalAmount: this.r2(taxable + taxable*(cr+sr+ir)/100)
    }, { emitEvent: false });
  }

  onGstRateChange(idx: number, rate: number): void {
    const l = this.items.at(idx);
    if (this.isInterState) l.patchValue({ igstRate: rate, cgstRate: 0, sgstRate: 0 }, { emitEvent: false });
    else { const h = rate/2; l.patchValue({ cgstRate: h, sgstRate: h, igstRate: 0 }, { emitEvent: false }); }
    this.onLineChange(idx);
  }

  toggleInterState(v: boolean): void {
    this.isInterState = v;
    for (let i = 0; i < this.items.length; i++) this.onLineChange(i);
  }

  onProductSelect(idx: number, pid: string): void {
    if (!pid) return;
    const p = this.products.find((x: any) =>
      x.uniqueKeyID === pid || x.uniqueKeyId === pid || x.raw?.uniqueKeyID === pid || x.raw?.uniqueKeyId === pid || x.raw?.id === pid || x.raw?.productId === pid
    );
    if (!p) {
      console.warn('Selected product id not found in products list:', pid);
      return;
    }
    this.items.at(idx).patchValue({
      productName: p.productName || p.raw?.productName || p.raw?.name || '',
      hsnSac: p.hsnSacCode || p.raw?.hsnSacCode || p.raw?.hsn_sac_number || '',
      measurement: p.measurement || p.raw?.measurement || '',
      rate: +(p.purchaseRate || p.sellingPrice || p.raw?.purchaseRate || p.raw?.purchase_rate || 0)
    }, { emitEvent: false });
    this.onLineChange(idx);
  }

  private r2 = (n: number) => Math.round(n * 100) / 100;
  get subtotal():     number { return this.r2(this.items.controls.reduce((s,l)=>s+(+l.get('taxableAmount')?.value||0),0)); }
  get totalCgst():    number { return this.r2(this.items.controls.reduce((s,l)=>s+(+l.get('cgstAmount')?.value||0),0)); }
  get totalSgst():    number { return this.r2(this.items.controls.reduce((s,l)=>s+(+l.get('sgstAmount')?.value||0),0)); }
  get totalIgst():    number { return this.r2(this.items.controls.reduce((s,l)=>s+(+l.get('igstAmount')?.value||0),0)); }
  get totalGst():     number { return this.r2(this.totalCgst+this.totalSgst+this.totalIgst); }
  get freight():      number { return +(this.poForm.get('freightCharges')?.value||0); }
  get other():        number { return +(this.poForm.get('otherCharges')?.value||0); }
  get discount():     number { return +(this.poForm.get('discountAmount')?.value||0); }
  get grandTotal():   number { return this.r2(this.subtotal+this.totalGst+this.freight+this.other-this.discount); }

  loadList(): void {
    this.loading = true;
    this.svc.getOrders(this.cid(), this.statusFilter || undefined).pipe(takeUntil(this.destroy$)).subscribe({
      next: (r: any) => { this.dataSource.data = r?.data || []; this.loading = false; },
      error: () => { this.toastr.error('Failed to load purchase orders'); this.loading = false; }
    });
  }

  loadVendors(): void {
    this.svc.getVendors(this.cid()).pipe(takeUntil(this.destroy$)).subscribe({
      next: (r: any) => this.vendors = r?.data || []
    });
  }

  loadProducts(): void {
    const companyId = this.cid() || undefined;
    console.log('PurchaseOrder.loadProducts - companyId:', companyId);
    this.masterSvc.GetProducts(companyId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (r: any) => {
        console.log('PurchaseOrder.loadProducts - response:', r);
        let list = Array.isArray(r) ? r : (r?.data || r?.result || r?.items || []);
        this.products = (list || []).map((p: any) => ({
          uniqueKeyID: p.uniqueKeyID || p.uniqueKeyId || p.uniqueKey || p.id || p.productId || p.code,
          productName: p.productName || p.product_name || p.name || p.ProductName || '',
          hsnSacCode: p.hsnSacCode || p.hsn_sac_number || p.hsn_sac || p.hsn || '',
          measurement: p.measurement || p.unit || p.uom || '',
          purchaseRate: p.purchaseRate ?? p.purchase_rate ?? p.rateWithTax ?? p.rate_without_tax ?? p.RateWithTax ?? 0,
          sellingPrice: p.rateWithTax ?? p.rate_with_tax ?? p.rateWithoutTax ?? p.rate_without_tax ?? 0,
          raw: p
        }));
      },
      error: (e: any) => { console.error('Failed to load products', e); this.products = []; }
    });
  }

  applyFilter(e: Event): void {
    this.dataSource.filter = (e.target as HTMLInputElement).value.trim().toLowerCase();
  }

  openNew(): void { this.buildForm(); this.view = 'form'; }

  openEdit(po: PurchaseOrder): void {
    if (po.status === 'approved' || po.status === 'received' || po.status === 'cancelled') {
      this.toastr.info('This PO cannot be edited in its current status'); return;
    }
    this.buildForm(po); this.view = 'form';
  }

  openDetail(po: PurchaseOrder): void { this.selectedPO = po; this.view = 'detail'; }
  backToList(): void { this.selectedPO = null; this.view = 'list'; this.loadList(); }

  save(submitAfter = false): void {
    if (this.poForm.invalid) { this.poForm.markAllAsTouched(); return; }
    const raw = this.poForm.getRawValue();
    const dto: PurchaseOrder = {
      ...raw,
      poDate: this.toIsoDate(raw.poDate),
      expectedDate: this.toIsoDate(raw.expectedDate),
      subtotal: this.subtotal,
      cgstAmount: this.totalCgst, sgstAmount: this.totalSgst, igstAmount: this.totalIgst,
      totalGstAmount: this.totalGst, grandTotal: this.grandTotal,
      freightCharges: this.freight, otherCharges: this.other, discountAmount: this.discount
    };
    this.svc.saveOrder(dto, this.cid()).pipe(takeUntil(this.destroy$)).subscribe({
      next: (r: any) => {
        if (r?.result === 'pass') {
          this.toastr.success('Purchase order saved');
          if (submitAfter && r?.data?.poNumber) {
            this.submitPO(r.data.poNumber);
          } else { this.backToList(); }
        } else { this.toastr.error(r?.errorMessage || 'Save failed'); }
      },
      error: (e: any) => this.toastr.error(e?.error?.errorMessage || e?.error?.message || 'Save failed')
    });
  }

  submitPO(poNumber: string): void {
    this.toastr.info(`PO ${poNumber} submitted for approval`);
    this.backToList();
  }

  approve(poNumber: string): void {
    if (!confirm(`Approve PO ${poNumber}?`)) return;
    this.svc.approveOrder(poNumber).pipe(takeUntil(this.destroy$)).subscribe({
      next: (r: any) => {
        if (r?.result === 'pass') { this.toastr.success('PO approved'); this.loadList(); }
        else this.toastr.error(r?.errorMessage || 'Approval failed');
      },
      error: (e: any) => this.toastr.error(e?.error?.errorMessage || e?.error?.message || 'Approval failed')
    });
  }

  cancel(poNumber: string): void {
    if (!confirm(`Cancel PO ${poNumber}?`)) return;
    this.svc.cancelOrder(poNumber).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.toastr.success('PO cancelled'); this.loadList(); },
      error: (e: any) => this.toastr.error(e?.error?.errorMessage || e?.error?.message || 'Cancel failed')
    });
  }

  getReceiptProgress(po: PurchaseOrder): number {
    if (!po.items?.length) return 0;
    const ordered  = po.items.reduce((s: number, i: PurchaseOrderLine) => s + (i.orderedQty || 0), 0);
    const received = po.items.reduce((s: number, i: PurchaseOrderLine) => s + (i.receivedQty || 0), 0);
    return ordered > 0 ? Math.round((received / ordered) * 100) : 0;
  }

  getStatusColor(status: string): string {
    const map: Record<string,string> = {
      draft:'neutral', submitted:'purple', approved:'green',
      partially_received:'orange', received:'blue', cancelled:'red'
    };
    return map[status] || 'neutral';
  }
}
