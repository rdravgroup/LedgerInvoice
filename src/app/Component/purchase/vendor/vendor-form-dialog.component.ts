import { Component, Inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from '../../../material.module';
import { PurchaseService } from '../../../_service/purchase.service';
import { Vendor } from '../../../_model/purchase.model';

export interface VendorFormDialogData {
  companyId: string;
  vendorId?: string;
  canEdit: boolean;
}

@Component({
  selector: 'app-vendor-form-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule],
  templateUrl: './vendor-form-dialog.component.html',
  styleUrls: ['./vendor-form-dialog.component.css']
})
export class VendorFormDialogComponent {
  form!: FormGroup;
  loading = false;
  saving  = false;
  hoverRating = 0;
  isEditMode: boolean;
  errorMsg = '';

  constructor(
    public dialogRef: MatDialogRef<VendorFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: VendorFormDialogData,
    private fb: FormBuilder,
    private svc: PurchaseService,
    private cd: ChangeDetectorRef
  ) {
    this.isEditMode = !!data.vendorId;
    this.buildForm();
    if (this.isEditMode) this.loadVendor();
  }

  private buildForm(): void {
    this.form = this.fb.group({
      vendorId: [null],
      companyId: [this.data.companyId],
      vendorName: ['', [Validators.required, Validators.maxLength(200)]],
      contactPerson: ['', Validators.maxLength(100)],
      email: ['', [Validators.email, Validators.maxLength(200)]],
      phone: ['', Validators.maxLength(20)],
      mobile: ['', Validators.maxLength(20)],
      address: ['', Validators.maxLength(500)],
      city: ['', Validators.maxLength(100)],
      stateName: ['', Validators.maxLength(100)],
      stateCode: [''],
      countryName: ['India', Validators.maxLength(100)],
      pincode: ['', Validators.maxLength(10)],
      gstin: ['', [Validators.maxLength(15), Validators.pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)]],
      pan: ['', [Validators.maxLength(10), Validators.pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)]],
      paymentTermsDays: [30, [Validators.required, Validators.min(0), Validators.max(365)]],
      bankName: ['', Validators.maxLength(100)],
      bankAccountNo: ['', Validators.maxLength(30)],
      bankIfsc: ['', [Validators.maxLength(11), Validators.pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/)]],
      openingBalance: [0, Validators.min(0)],
      creditLimit: [0, Validators.min(0)],
      rating: [3, [Validators.required, Validators.min(1), Validators.max(5)]],
      isActive: [true],
      notes: ['', Validators.maxLength(500)]
    });
    if (!this.data.canEdit) this.form.disable();
  }

  private loadVendor(): void {
    this.loading = true;
    this.svc.getVendorById(this.data.vendorId!, this.data.companyId).subscribe({
      next: res => {
        this.loading = false;
        if (res.result === 'pass') {
          const v: Vendor = res.data;
          this.form.patchValue({
            vendorId: v.vendorId, companyId: v.companyId, vendorName: v.vendorName,
            contactPerson: v.contactPerson, email: v.email, phone: v.phone, mobile: v.mobile,
            address: v.address, city: v.city, stateName: v.stateName, stateCode: v.stateCode,
            countryName: v.countryName, pincode: v.pincode, gstin: v.gstin, pan: v.pan,
            paymentTermsDays: v.paymentTermsDays, bankName: v.bankName, bankAccountNo: v.bankAccountNo,
            bankIfsc: v.bankIfsc, openingBalance: v.openingBalance, creditLimit: v.creditLimit,
            rating: v.rating, isActive: v.isActive, notes: v.notes
          });
        } else {
          this.errorMsg = res.errorMessage || 'Failed to load vendor';
        }
        this.cd.markForCheck();
      },
      error: () => { this.loading = false; this.errorMsg = 'Error loading vendor'; }
    });
  }

  f(name: string): AbstractControl { return this.form.get(name)!; }

  setRating(n: number): void {
    if (!this.data.canEdit) return;
    this.form.patchValue({ rating: n });
    this.hoverRating = 0;
  }

  starFilled(i: number): boolean {
    return i <= (this.hoverRating || this.f('rating').value || 0);
  }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving = true;
    this.errorMsg = '';
    const dto: Vendor = { ...this.form.getRawValue() };
    const call$ = this.isEditMode ? this.svc.updateVendor(dto) : this.svc.createVendor(dto);
    call$.subscribe({
      next: res => {
        this.saving = false;
        if (res.result === 'pass') {
          this.dialogRef.close({ saved: true, isEditMode: this.isEditMode });
        } else {
          this.errorMsg = res.errorMessage || 'Failed to save vendor';
        }
      },
      error: (e: any) => {
        this.saving = false;
        this.errorMsg = e?.error?.errorMessage || e?.error?.message || 'Error saving vendor';
      }
    });
  }

  cancel(): void { this.dialogRef.close(null); }
}
