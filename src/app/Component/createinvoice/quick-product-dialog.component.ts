import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { MaterialModule } from '../../material.module';
import { MasterService } from '../../_service/master.service';
import { SelectedCompanyService } from '../../_service/selected-company.service';
import { AuthService } from '../../_service/authentication.service';

@Component({
  selector: 'app-quick-product-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule],
  template: `
    <div class="qpd-header">
      <div><h2 mat-dialog-title>New Product</h2><p>Add a product without leaving this invoice.</p></div>
      <button mat-icon-button mat-dialog-close type="button" aria-label="Close"><mat-icon>close</mat-icon></button>
    </div>
    <mat-dialog-content>
      <form [formGroup]="form" class="qpd-form">
        <mat-form-field appearance="outline"><mat-label>Product Name</mat-label><input matInput formControlName="productName" autocomplete="off"><mat-error>Product name is required</mat-error></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Measurement</mat-label><mat-select formControlName="measurement"><mat-option *ngFor="let item of measurements" [value]="item.name || item.Name">{{ item.name || item.Name }}</mat-option></mat-select><mat-error>Measurement is required</mat-error></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Category</mat-label><mat-select formControlName="categoryCode"><mat-option *ngFor="let item of categories" [value]="item.code">{{ item.name }} ({{ item.code }})</mat-option></mat-select><mat-error>Category is required</mat-error></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Rate Without Tax</mat-label><input matInput type="number" min="0" formControlName="rateWithoutTax"></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Rate With Tax</mat-label><input matInput type="number" min="0" formControlName="rateWithTax"></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>CGST Rate (%)</mat-label><input matInput type="number" min="0" formControlName="cgstRate"><mat-error>Value cannot be negative</mat-error></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>SGST Rate (%)</mat-label><input matInput type="number" min="0" formControlName="scgstRate"><mat-error>Value cannot be negative</mat-error></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Total GST Rate (%)</mat-label><input matInput type="number" min="0" formControlName="totalGstRate"></mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end"><button mat-stroked-button type="button" mat-dialog-close>Cancel</button><button mat-flat-button color="primary" type="button" (click)="save()" [disabled]="form.invalid || saving"><mat-icon>add</mat-icon>{{ saving ? 'Saving...' : 'Add Product' }}</button></mat-dialog-actions>
  `,
  styles: [`
    :host{display:block}.qpd-header{display:flex;justify-content:space-between;padding:20px 24px 4px}.qpd-header h2{margin:0;font-size:22px}.qpd-header p{margin:5px 0;color:#64748b;font-size:13px}mat-dialog-content{padding:12px 24px 4px;min-width:min(620px,90vw)}.qpd-form{display:grid;grid-template-columns:1fr 1fr;gap:2px 12px}mat-form-field{width:100%}mat-dialog-actions{padding:12px 24px 20px;gap:8px}@media(max-width:600px){mat-dialog-content{min-width:auto}.qpd-form{grid-template-columns:1fr}}
  `]
})
export class QuickProductDialogComponent implements OnInit {
  categories: any[] = [];
  measurements: any[] = [];
  saving = false;
  form!: ReturnType<FormBuilder['group']>;

  constructor(private fb: FormBuilder, private dialogRef: MatDialogRef<QuickProductDialogComponent>, @Inject(MAT_DIALOG_DATA) private data: { companyId: string }, private master: MasterService, private selectedCompany: SelectedCompanyService, private auth: AuthService, private toastr: ToastrService) {
    this.form = this.fb.group({
      productName: ['', Validators.required], measurement: ['', Validators.required], categoryCode: ['', Validators.required],
      rateWithoutTax: [0, [Validators.required, Validators.min(0)]], rateWithTax: [0, [Validators.required, Validators.min(0)]],
      totalGstRate: [0, [Validators.required, Validators.min(0)]],
      cgstRate: [0, [Validators.required, Validators.min(0)]],
      scgstRate: [0, [Validators.required, Validators.min(0)]],
      isActive: [true]
    });
  }

  ngOnInit(): void {
    this.master.GetCategories().subscribe({ next: (res: any) => { const list = Array.isArray(res) ? res : res?.data || res?.Data || []; this.categories = list.map((item: any) => ({ code: item.uniqueKeyId || item.UniqueKeyId || item.uniqueKeyID || item.UniqueKeyID, name: item.name || item.Name })).filter((item: any) => item.code); } });
    this.master.GetAllMeasurements().subscribe({ next: (res: any) => { this.measurements = Array.isArray(res) ? res : res?.data || res?.Data || []; } });
  }

  save(): void {
    if (this.form.invalid || this.saving) { this.form.markAllAsTouched(); return; }
    this.saving = true;
    const companyId = this.data.companyId || this.selectedCompany.getSelectedCompanyId() || this.auth.getCompanyId() || undefined;
    this.master.SaveProduct(this.form.getRawValue(), companyId).subscribe({
      next: (res: any) => { this.saving = false; if (String(res?.result || res?.Result).toLowerCase() === 'pass') { this.toastr.success('Product added successfully', 'Product'); this.dialogRef.close(res?.data || res?.Data || this.form.getRawValue()); } else this.toastr.error(res?.errorMessage || res?.ErrorMessage || 'Failed to add product', 'Product'); },
      error: () => { this.saving = false; this.toastr.error('Failed to add product', 'Product'); }
    });
  }
}
