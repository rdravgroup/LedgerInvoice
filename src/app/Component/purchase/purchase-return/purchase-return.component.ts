// src/app/Component/purchase/purchase-return/purchase-return.component.ts
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
import { PurchaseReturn, PurchaseReturnItem, Vendor, PurchaseInvoice, GST_RATES } from '../../../_model/purchase.model';

@Component({
  selector: 'app-purchase-return',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule],
  templateUrl: './purchase-return.component.html',
  styleUrls: ['../purchase-shared.css', './purchase-return.component.css']
})
export class PurchaseReturnComponent implements OnInit, OnDestroy {
  listColumns = ['returnNo','returnDate','vendorId','piNumber','grandTotal','status','action'];
  dataSource  = new MatTableDataSource<PurchaseReturn>();
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort)      sort!: MatSort;

  loading   = false;
  showForm  = false;
  isMobile  = window.innerWidth < 768;
  returnForm!: FormGroup;
  vendors:    Vendor[]          = [];
  invoices:   PurchaseInvoice[] = [];
  products:   any[]             = [];
  gstRates    = GST_RATES;

  private destroy$ = new Subject<void>();

  constructor(
    private svc: PurchaseService,
    private masterSvc: MasterService,
    private fb: FormBuilder,
    private toastr: ToastrService,
    private auth: AuthService,
    private selectedCo: SelectedCompanyService
  ) { window.addEventListener('resize', () => this.isMobile = window.innerWidth < 768); }

  ngOnInit(): void {
    this.buildForm();
    this.selectedCo.selectedCompanyId$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.loadList(); this.loadVendors(); this.loadInvoices(); this.loadProducts();
    });
  }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }
  ngAfterViewInit(): void { this.dataSource.paginator = this.paginator; this.dataSource.sort = this.sort; }

  private cid = () => this.selectedCo.getSelectedCompanyId() || this.auth.getCompanyId() || '';

  buildForm(): void {
    this.returnForm = this.fb.group({
      companyId:  [this.cid()],
      vendorId:   ['', Validators.required],
      piNumber:   [''],
      returnDate: [new Date().toISOString().split('T')[0], Validators.required],
      reason:     ['', Validators.required],
      remark:     [''],
      items: this.fb.array([this.buildLine()])
    });
  }

  buildLine(i?: PurchaseReturnItem): FormGroup {
    return this.fb.group({
      productId:    [i?.productId    || '', Validators.required],
      productName:  [i?.productName  || ''],
      quantity:     [i?.quantity     || 1,  [Validators.required, Validators.min(0.001)]],
      rate:         [i?.rate         || 0,  [Validators.required, Validators.min(0)]],
      taxableAmount:[{ value: i?.taxableAmount || 0, disabled: true }],
      gstRate:      [i?.gstRate      || 0],
      gstAmount:    [{ value: i?.gstAmount || 0, disabled: true }],
      totalAmount:  [{ value: i?.totalAmount || 0, disabled: true }]
    });
  }

  get items(): FormArray { return this.returnForm.get('items') as FormArray; }
  addLine(): void { this.items.push(this.buildLine()); }
  removeLine(i: number): void { if (this.items.length > 1) this.items.removeAt(i); }

  onLineChange(idx: number): void {
    const l   = this.items.at(idx);
    const qty = +(l.get('quantity')?.value || 0);
    const rt  = +(l.get('rate')?.value || 0);
    const gr  = +(l.get('gstRate')?.value || 0);
    const taxable = qty * rt;
    const gstAmt  = (taxable * gr) / 100;
    l.patchValue({ taxableAmount: this.r2(taxable), gstAmount: this.r2(gstAmt), totalAmount: this.r2(taxable + gstAmt) }, { emitEvent: false });
  }

  onProductSelect(idx: number, pid: string): void {
    const p = this.products.find(x => x.uniqueKeyID === pid);
    if (!p) return;
    this.items.at(idx).patchValue({ productName: p.productName || p.name, rate: +(p.purchaseRate || p.sellingPrice || 0) }, { emitEvent: false });
    this.onLineChange(idx);
  }

  onInvoiceSelect(piNumber: string): void {
    const inv = this.invoices.find(i => i.piNumber === piNumber);
    if (inv) this.returnForm.patchValue({ vendorId: inv.vendorId });
  }

  private r2 = (n: number) => Math.round(n * 100) / 100;
  get subtotal():   number { return this.r2(this.items.controls.reduce((s, l) => s + (+l.get('taxableAmount')?.value||0), 0)); }
  get totalGst():   number { return this.r2(this.items.controls.reduce((s, l) => s + (+l.get('gstAmount')?.value||0), 0)); }
  get grandTotal(): number { return this.r2(this.subtotal + this.totalGst); }

  loadList(): void {
    this.loading = true;
    this.svc.getReturns(this.cid()).pipe(takeUntil(this.destroy$)).subscribe({
      next: (r: any) => { this.dataSource.data = r?.data || []; this.loading = false; },
      error: () => { this.toastr.error('Failed to load returns'); this.loading = false; }
    });
  }
  loadVendors(): void { this.svc.getVendors(this.cid()).pipe(takeUntil(this.destroy$)).subscribe({ next: (r: any) => this.vendors = r?.data || [] }); }
  loadInvoices(): void { this.svc.getInvoices(this.cid()).pipe(takeUntil(this.destroy$)).subscribe({ next: (r: any) => this.invoices = r?.data || [] }); }
  loadProducts(): void { this.masterSvc.GetProducts(this.cid() || undefined).pipe(takeUntil(this.destroy$)).subscribe({ next: (r: any) => this.products = Array.isArray(r) ? r : (r?.data || []) }); }
  applyFilter(e: Event): void { this.dataSource.filter = (e.target as HTMLInputElement).value.trim().toLowerCase(); }
  openNew(): void { this.buildForm(); this.showForm = true; }
  close(): void { this.showForm = false; }
  getVendorName(id?: string): string { return this.vendors.find(v => v.vendorId === id)?.vendorName || id || ''; }

  save(): void {
    if (this.returnForm.invalid) { this.returnForm.markAllAsTouched(); return; }
    const dto: PurchaseReturn = { ...this.returnForm.getRawValue(), subtotal: this.subtotal, totalGstAmount: this.totalGst, grandTotal: this.grandTotal };
    this.svc.saveReturn(dto, this.cid()).pipe(takeUntil(this.destroy$)).subscribe({
      next: (r: any) => {
        if (r?.result === 'pass') { this.toastr.success(`Return ${r.data?.returnNo} created`); this.showForm = false; this.loadList(); }
        else this.toastr.error(r?.errorMessage || 'Save failed');
      },
      error: (e: any) => this.toastr.error(e?.message || 'Failed')
    });
  }

  approve(returnNo: string): void {
    if (!confirm(`Approve return ${returnNo}? Stock will be reduced.`)) return;
    this.svc.approveReturn(returnNo).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.toastr.success('Return approved'); this.loadList(); },
      error: (e: any) => this.toastr.error(e?.message || 'Approval failed')
    });
  }
}
