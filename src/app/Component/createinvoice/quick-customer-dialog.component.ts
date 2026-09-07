import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { MaterialModule } from '../../material.module';
import { CustomerService } from '../../_service/customer.service';
import { MasterService } from '../../_service/master.service';
import { SelectedCompanyService } from '../../_service/selected-company.service';
import { AuthService } from '../../_service/authentication.service';

@Component({
  selector: 'app-quick-customer-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule],
  template: `
    <div class="qcd-header">
      <div>
        <h2 mat-dialog-title>New Customer</h2>
        <p>Add a customer without leaving this invoice.</p>
      </div>
      <button mat-icon-button mat-dialog-close type="button" aria-label="Close"><mat-icon>close</mat-icon></button>
    </div>
    <mat-dialog-content>
      <form [formGroup]="form" class="qcd-form" (ngSubmit)="save()">
        <mat-form-field appearance="outline">
          <mat-label>Customer Name</mat-label>
          <input matInput formControlName="name" autocomplete="off">
          <mat-error>Customer name is required</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Company</mat-label>
          <input matInput formControlName="customer_company" autocomplete="organization">
          <mat-error>Company is required</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Mobile Number</mat-label>
          <input matInput formControlName="mobileNo" inputmode="tel" autocomplete="tel">
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Email</mat-label>
          <input matInput formControlName="email" type="email" autocomplete="email">
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Country</mat-label>
          <mat-select formControlName="countryCode" (selectionChange)="loadStates($event.value)">
            <mat-option *ngFor="let country of countries" [value]="country.countryCode">{{ country.countryName }}</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>State</mat-label>
          <mat-select formControlName="stateCode">
            <mat-option *ngFor="let state of states" [value]="state.stateCode">{{ state.stateName }}</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" class="qcd-wide">
          <mat-label>Address</mat-label>
          <textarea matInput rows="2" formControlName="addressDetails"></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button type="button" mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" type="button" (click)="save()" [disabled]="form.invalid || saving">
        <mat-icon>person_add</mat-icon>{{ saving ? 'Saving...' : 'Add Customer' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    :host { display:block; }
    .qcd-header { display:flex;align-items:flex-start;justify-content:space-between;padding:20px 24px 4px; }
    h2 { margin:0;font-size:22px;font-weight:700; }
    .qcd-header p { margin:5px 0 0;color:#64748b;font-size:13px; }
    mat-dialog-content { padding:12px 24px 4px;min-width:min(620px, 90vw);max-height:70vh; }
    .qcd-form { display:grid;grid-template-columns:1fr 1fr;gap:2px 12px; }
    .qcd-wide { grid-column:1 / -1; }
    mat-form-field { width:100%; }
    mat-dialog-actions { padding:12px 24px 20px;gap:8px; }
    @media (max-width:600px) { mat-dialog-content { min-width:auto; } .qcd-form { grid-template-columns:1fr; } .qcd-wide { grid-column:auto; } }
  `]
})
export class QuickCustomerDialogComponent implements OnInit {
  countries: any[] = [];
  states: any[] = [];
  saving = false;
  form!: ReturnType<FormBuilder['group']>;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<QuickCustomerDialogComponent>,
    @Inject(MAT_DIALOG_DATA) private data: { companyId: string },
    private customerService: CustomerService,
    private masterService: MasterService,
    private selectedCompanyService: SelectedCompanyService,
    private authService: AuthService,
    private toastr: ToastrService
  ) {
    this.form = this.fb.group({
      name: ['', Validators.required],
      customer_company: ['', Validators.required],
      mobileNo: [''],
      email: ['', Validators.email],
      addressDetails: [''],
      countryCode: ['IN'],
      countryName: ['India'],
      stateCode: ['UP'],
      stateName: ['Uttar Pradesh'],
      isActive: [true]
    });
  }

  ngOnInit(): void {
    this.masterService.GetCountries().subscribe({
      next: (response: any) => {
        const countries = Array.isArray(response) ? response : response?.data || response?.Data || [];
        this.countries = countries.map((country: any) => ({
          countryCode: country.countryCode || country.CountryCode || country.code || country.Code,
          countryName: country.countryName || country.CountryName || country.name || country.Name
        }));
        const india = this.countries.find(country =>
          String(country.countryCode).toUpperCase() === 'IN'
          || String(country.countryName).trim().toLowerCase() === 'india');
        const countryCode = india?.countryCode || 'IN';
        this.form.patchValue({
          countryCode,
          countryName: india?.countryName || 'India',
          stateCode: 'UP',
          stateName: 'Uttar Pradesh'
        }, { emitEvent: false });
        this.loadStates(countryCode);
      }
    });
  }

  loadStates(countryCode: string): void {
    const country = this.countries.find(item => item.countryCode === countryCode);
    this.form.patchValue({ countryName: country?.countryName || 'India' }, { emitEvent: false });
    this.masterService.GetStatesByCountry(countryCode).subscribe({
      next: (response: any) => {
        const states = Array.isArray(response) ? response : response?.data || response?.Data || [];
        this.states = states.map((state: any) => ({
          stateCode: state.stateCode || state.StateCode || state.code || state.Code,
          stateName: state.stateName || state.StateName || state.name || state.Name
        }));
        const uttarPradesh = this.states.find(state =>
          String(state.stateCode).toUpperCase() === 'UP'
          || String(state.stateName).trim().toLowerCase() === 'uttar pradesh');
        this.form.patchValue({
          stateCode: uttarPradesh?.stateCode || 'UP',
          stateName: uttarPradesh?.stateName || 'Uttar Pradesh'
        }, { emitEvent: false });
      }
    });
  }

  save(): void {
    if (this.form.invalid || this.saving) { this.form.markAllAsTouched(); return; }
    this.saving = true;
    const value = this.form.getRawValue();
    const state = this.states.find(item => item.stateCode === value.stateCode);
    this.form.patchValue({ stateName: state?.stateName || '' }, { emitEvent: false });
    const companyId = this.data.companyId || this.selectedCompanyService.getSelectedCompanyId() || this.authService.getCompanyId() || undefined;
    this.customerService.Createcustomer(this.form.getRawValue() as any, companyId).subscribe({
      next: (response: any) => {
        this.saving = false;
        if (String(response?.result || response?.Result).toLowerCase() === 'pass') {
          this.toastr.success('Customer added successfully', 'Customer');
          this.dialogRef.close(response?.data || response?.Data || true);
        } else {
          this.toastr.error(response?.errorMessage || response?.ErrorMessage || response?.message || 'Failed to add customer', 'Customer');
        }
      },
      error: () => { this.saving = false; this.toastr.error('Failed to add customer', 'Customer'); }
    });
  }
}
