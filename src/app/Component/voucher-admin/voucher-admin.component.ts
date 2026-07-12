import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MaterialModule } from '../../material.module';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { VoucherService } from '../../_service/voucher.service';
import { ToastrService } from 'ngx-toastr';
import { VoucherResponse, PaymentConfigResponse, ConfigKeyValue } from '../../_model/voucher.model';

@Component({
  selector: 'app-voucher-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, MaterialModule,
            MatProgressSpinnerModule, MatDialogModule,
            MatTableModule, MatPaginatorModule, MatSortModule, MatProgressBarModule],
  templateUrl: './voucher-admin.component.html',
  styleUrls: ['./voucher-admin.component.css']
})
export class VoucherAdminComponent implements OnInit {

  // ── Tab state ─────────────────────────────────────────────
  activeTab: 'vouchers'|'config' = 'vouchers';

  // ── Voucher list ──────────────────────────────────────────
  vouchers: VoucherResponse[] = [];
  datasource = new MatTableDataSource<VoucherResponse>([]);
  displayedColumns = ['code','type','discount','uses','status','expiry','actions'];
  loading = false;
  showDisabled = false;

  // ── Voucher form ──────────────────────────────────────────
  showForm    = false;
  isEdit      = false;
  saving      = false;
  editId?: number;
  voucherForm!: FormGroup;

  // ── Config ────────────────────────────────────────────────
  config?: PaymentConfigResponse;
  configLoading = false;
  configSaving: Record<string,boolean> = {};

  constructor(
    private svc: VoucherService,
    private fb: FormBuilder,
    private toastr: ToastrService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.buildForm();
    this.loadVouchers();
    this.loadConfig();
  }

  // ── Form ─────────────────────────────────────────────────
  buildForm(): void {
    this.voucherForm = this.fb.group({
      voucherCode:     ['', [Validators.required, Validators.minLength(3), Validators.maxLength(50),
                             Validators.pattern('^[A-Z0-9_-]+$')]],
      voucherType:     ['activation', Validators.required],
      discountType:    ['percent', Validators.required],
      discountValue:   [0, [Validators.min(0), Validators.max(100000)]],
      freeDays:        [0, [Validators.min(0), Validators.max(3650)]],
      planRestriction: [''],
      maxUses:         [1, [Validators.min(0), Validators.max(100000)]],
      isActive:        [true],
      isEnabled:       [true],
      expiryDate:      [null],
      description:     ['', Validators.maxLength(500)],
      notes:           ['', Validators.maxLength(1000)]
    });
    // Auto-uppercase voucher code
    this.voucherForm.get('voucherCode')?.valueChanges.subscribe(v => {
      if (v && v !== v.toUpperCase())
        this.voucherForm.get('voucherCode')?.setValue(v.toUpperCase(), { emitEvent: false });
    });
    // Reset discount value when type changes
    this.voucherForm.get('discountType')?.valueChanges.subscribe(t => {
      if (t === 'free_days') {
        this.voucherForm.get('discountValue')?.setValue(0);
        this.voucherForm.get('voucherType')?.setValue('free_trial');
      }
    });
  }

  openCreate(): void {
    this.isEdit = false; this.editId = undefined;
    this.voucherForm.reset({
      voucherType:'activation', discountType:'percent', discountValue:0,
      freeDays:0, maxUses:1, isActive:true, isEnabled:true
    });
    this.showForm = true;
  }

  openEdit(v: VoucherResponse): void {
    this.isEdit = true; this.editId = v.voucherId;
    this.voucherForm.patchValue({
      voucherCode:     v.voucherCode,
      voucherType:     v.voucherType,
      discountType:    v.discountType,
      discountValue:   v.discountValue,
      freeDays:        v.freeDays,
      planRestriction: v.planRestriction ?? '',
      maxUses:         v.maxUses,
      isActive:        v.isActive,
      isEnabled:       v.isEnabled,
      expiryDate:      v.expiryDate ? new Date(v.expiryDate) : null,
      description:     v.description ?? '',
      notes:           v.notes ?? ''
    });
    this.showForm = true;
  }

  cancelForm(): void { this.showForm = false; }

  saveVoucher(): void {
    if (this.voucherForm.invalid) { this.voucherForm.markAllAsTouched(); return; }
    this.saving = true;
    const val = this.voucherForm.value;
    if (this.isEdit && this.editId) {
      this.svc.updateVoucher({ voucherId: this.editId, ...val }).subscribe({
        next: () => { this.saving=false; this.showForm=false; this.toastr.success('Voucher updated','Success'); this.loadVouchers(); },
        error: (e:any) => { this.saving=false; this.toastr.error(e?.error?.errorMessage??'Update failed','Error'); }
      });
    } else {
      this.svc.createVoucher(val).subscribe({
        next: () => { this.saving=false; this.showForm=false; this.toastr.success('Voucher created','Success'); this.loadVouchers(); },
        error: (e:any) => { this.saving=false; this.toastr.error(e?.error?.errorMessage??'Create failed','Error'); }
      });
    }
  }

  deleteVoucher(v: VoucherResponse): void {
    if (!confirm(`Disable voucher "${v.voucherCode}"?`)) return;
    this.svc.deleteVoucher(v.voucherId).subscribe({
      next: () => { this.toastr.success('Voucher disabled','Success'); this.loadVouchers(); },
      error: () => { this.toastr.error('Delete failed','Error'); }
    });
  }

  // ── Data ─────────────────────────────────────────────────
  loadVouchers(): void {
    this.loading = true;
    this.svc.listVouchers(this.showDisabled).subscribe({
      next: list => {
        this.vouchers = list;
        this.datasource.data = list;
        this.loading = false;
      },
      error: () => { this.loading=false; this.toastr.error('Failed to load vouchers','Error'); }
    });
  }

  applyFilter(e: Event): void {
    this.datasource.filter = (e.target as HTMLInputElement).value.trim().toLowerCase();
  }

  // ── Config ───────────────────────────────────────────────
  loadConfig(): void {
    this.configLoading = true;
    this.svc.getConfig().subscribe({
      next: c => { this.config=c; this.configLoading=false; },
      error: () => { this.configLoading=false; }
    });
  }

  updateConfig(key: string, value: string): void {
    this.configSaving[key] = true;
    this.svc.updateConfig(key, value).subscribe({
      next: c => { this.config=c; this.configSaving[key]=false; this.toastr.success('Setting saved','Success'); },
      error: (e:any) => { this.configSaving[key]=false; this.toastr.error(e?.error?.errorMessage??'Save failed','Error'); }
    });
  }

  toggleOnlinePayment(): void {
    const newVal = (!this.config?.onlinePaymentEnabled).toString();
    this.updateConfig('online_payment_enabled', newVal);
  }

  toggleVoucherRequired(): void {
    const newVal = (!this.config?.voucherRequired).toString();
    this.updateConfig('voucher_required', newVal);
  }

  updatePrice(key: string, val: string): void {
    if (!val || isNaN(+val)) return;
    this.updateConfig(key, val);
  }

  // ── Helpers ──────────────────────────────────────────────
  getDiscountLabel(v: VoucherResponse): string {
    if (v.discountType==='percent') return `${v.discountValue}% off`;
    if (v.discountType==='flat')    return `₹${v.discountValue} off`;
    return `+${v.freeDays} days`;
  }

  getTypeColor(t: string): string {
    return t==='activation'?'primary': t==='discount'?'accent':'warn';
  }

  get formDiscountType(): string { return this.voucherForm.get('discountType')?.value; }
  get formVoucherType():  string { return this.voucherForm.get('voucherType')?.value; }
}
