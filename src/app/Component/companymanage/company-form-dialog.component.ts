import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MaterialModule } from '../../material.module';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { CompanyService } from '../../_service/company.service';
import { UserService } from '../../_service/user.service';
import { AuthService } from '../../_service/authentication.service';
import { ToastrService } from 'ngx-toastr';
import { Company } from '../../_model/company.model';
import { Country, State } from '../../_model/location.model';
import { MasterService } from '../../_service/master.service';

@Component({
  selector: 'app-company-form-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule],
  templateUrl: './company-form-dialog.component.html',
  styleUrls: ['./company-form-dialog.component.css']
})
export class CompanyFormDialogComponent implements OnInit {
  form: any;
  submitting = false;
  isEdit = false;
  countryList: Country[] = [];
  stateList: State[] = [];

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<CompanyFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { company?: Company } | null,
    private service: CompanyService,
    private masterService: MasterService,
    private userService: UserService,
    private auth: AuthService,
    private toastr: ToastrService
  ) {
    this.form = this.fb.group({
      companyId: [''],
      name: ['', Validators.required],
      emailId: ['', [Validators.required, Validators.email]],
      mobileNo: ['', Validators.required],
      alternateMobile: [''],
      addressDetails: ['', Validators.required],
      countryCode: ['IN', Validators.required],
      countryName: ['India', Validators.required],
      stateCode: ['UP', Validators.required],
      stateName: ['Uttar Pradesh', Validators.required],
      gstNumber: [''],
      bankName: [''],
      accountNumber: [''],
      ifsc: [''],
      accountAddress: [''],
      salesInvoiceRateMode: ['without_tax', Validators.required]
    });

    if (data && data.company) {
      this.isEdit = true;
      this.form.patchValue(this.normalizeCompanyForForm(data.company));
    }
  }

  ngOnInit(): void {
    this.loadCountries();
  }

  private pick(source: any, ...keys: string[]): any {
    for (const key of keys) {
      const value = source?.[key];
      if (value !== undefined && value !== null) return value;
    }
    return '';
  }

  private normalizeCompanyForForm(company: any): any {
    return {
      companyId: this.pick(company, 'companyId', 'CompanyId'),
      name: this.pick(company, 'name', 'Name'),
      emailId: this.pick(company, 'emailId', 'EmailId', 'email', 'Email'),
      mobileNo: this.pick(company, 'mobileNo', 'MobileNo', 'mobile', 'Mobile'),
      alternateMobile: this.pick(company, 'alternateMobile', 'AlternateMobile', 'coAltMob', 'CoAltMob'),
      addressDetails: this.pick(company, 'addressDetails', 'AddressDetails', 'address', 'Address', 'coAddr', 'CoAddr'),
      countryCode: this.pick(company, 'countryCode', 'CountryCode', 'cntryCode', 'CntryCode') || 'IN',
      countryName: this.pick(company, 'countryName', 'CountryName', 'cntryName', 'CntryName') || 'India',
      stateCode: this.pick(company, 'stateCode', 'StateCode', 'stCode', 'StCode') || 'UP',
      stateName: this.pick(company, 'stateName', 'StateName', 'stName', 'StName') || 'Uttar Pradesh',
      gstNumber: this.pick(company, 'gstNumber', 'GstNumber', 'gst', 'GST', 'coGST', 'CoGST'),
      bankName: this.pick(company, 'bankName', 'BankName'),
      accountNumber: this.pick(company, 'accountNumber', 'AccountNumber', 'accNum', 'AccNum'),
      ifsc: this.pick(company, 'ifsc', 'Ifsc', 'IFSC'),
      accountAddress: this.pick(company, 'accountAddress', 'AccountAddress', 'accAddr', 'AccAddr'),
      salesInvoiceRateMode: this.normalizeRateMode(this.pick(company, 'salesInvoiceRateMode', 'SalesInvoiceRateMode'))
    };
  }
  private normalizeRateMode(value: any): 'with_tax' | 'without_tax' {
    return String(value || '').toLowerCase() === 'with_tax' ? 'with_tax' : 'without_tax';
  }

  private buildCompanyPayload(raw: any): any {
    const normalized = this.normalizeCompanyForForm(raw);
    const payload: any = {
      companyId: normalized.companyId || this.data?.company?.companyId,
      name: normalized.name,
      emailId: normalized.emailId,
      mobileNo: normalized.mobileNo,
      alternateMobile: normalized.alternateMobile || null,
      addressDetails: normalized.addressDetails,
      countryCode: normalized.countryCode,
      countryName: normalized.countryName,
      stateCode: normalized.stateCode,
      stateName: normalized.stateName,
      gstNumber: normalized.gstNumber || null,
      bankName: normalized.bankName || null,
      accountNumber: normalized.accountNumber || null,
      ifsc: normalized.ifsc || null,
      accountAddress: normalized.accountAddress || null,
      salesInvoiceRateMode: this.normalizeRateMode(normalized.salesInvoiceRateMode)
    };

    Object.keys(payload).forEach(key => {
      if (typeof payload[key] === 'string') payload[key] = payload[key].trim();
    });

    return payload;
  }

  private unwrapList<T>(response: any): T[] {
    if (Array.isArray(response)) return response;
    return response?.data || response?.Data || response?.items || response?.Items || [];
  }

  loadCountries(): void {
    this.masterService.GetCountries().subscribe({
      next: (response: any) => {
        this.countryList = this.unwrapList<any>(response).map(country => ({
          countryCode: this.pick(country, 'countryCode', 'CountryCode', 'code', 'Code'),
          countryName: this.pick(country, 'countryName', 'CountryName', 'name', 'Name'),
          isActive: country.isActive ?? country.IsActive ?? true
        }));
        const selected = this.findCountry(this.form.get('countryCode')?.value);
        if (selected) {
          this.form.patchValue({
            countryCode: selected.countryCode,
            countryName: selected.countryName
          }, { emitEvent: false });
          this.loadStates(selected.countryCode);
        }
      },
      error: () => this.toastr.error('Failed to load countries', 'Error')
    });
  }

  onCountryChange(countryCode: string): void {
    const selected = this.findCountry(countryCode);
    this.stateList = [];
    this.form.patchValue({ stateCode: '', stateName: '' }, { emitEvent: false });
    if (selected) {
      this.form.patchValue({
        countryCode: selected.countryCode,
        countryName: selected.countryName
      }, { emitEvent: false });
      this.loadStates(selected.countryCode);
    }
  }

  onStateChange(stateCode: string): void {
    const selected = this.stateList.find(state =>
      state.stateCode === stateCode);
    if (selected) {
      this.form.patchValue({
        stateCode: selected.stateCode,
        stateName: selected.stateName
      }, { emitEvent: false });
    }
  }

  private loadStates(countryCode: string): void {
    this.masterService.GetStatesByCountry(countryCode).subscribe({
      next: (response: any) => {
        this.stateList = this.unwrapList<any>(response).map(state => ({
          stateCode: this.pick(state, 'stateCode', 'StateCode', 'code', 'Code'),
          stateName: this.pick(state, 'stateName', 'StateName', 'name', 'Name'),
          countryCode: this.pick(state, 'countryCode', 'CountryCode'),
          isActive: state.isActive ?? state.IsActive ?? true
        }));
        const selected = this.stateList.find(state =>
          state.stateCode === this.form.get('stateCode')?.value);
        if (selected) this.onStateChange(selected.stateCode);
      },
      error: () => this.toastr.error('Failed to load states', 'Error')
    });
  }

  private findCountry(countryCode: string): Country | undefined {
    return this.countryList.find(country => country.countryCode === countryCode);
  }
  private isSuccess(resp: any) {
    return resp && (resp.result === 'pass' || resp.Result === 'pass');
  }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.submitting = true;

    if (this.isEdit) {
      const payload = this.buildCompanyPayload(this.form.getRawValue());

      this.service.updateCompany(payload)
        .pipe(finalize(() => (this.submitting = false)))
        .subscribe({
          next: (r: any) => {
            if (this.isSuccess(r)) {
              this.toastr.success('Company updated successfully', 'Success');
              // Return updated data so parent refreshes list without a second GET
              this.dialogRef.close(r?.data ?? r?.Data ?? true);
            } else {
              // Show server-provided message when available
              const msg = r?.errorMessage ?? r?.ErrorMessage ?? 'Failed to update company';
              this.toastr.error(msg, 'Error');
            }
          },
          error: (e: any) => {
            console.error('[DIALOG] updateCompany error', e);
            const serverMsg = e?.error?.errorMessage ?? e?.error?.ErrorMessage ?? e?.message;
            this.toastr.error(serverMsg ?? 'Failed to update company', 'Error');
          }
        });

    } else {
      const payload = this.buildCompanyPayload(this.form.getRawValue());

      this.service.createCompany(payload)
        .pipe(finalize(() => (this.submitting = false)))
        .subscribe({
          next: (r: any) => {
            if (this.isSuccess(r)) {
              this.toastr.success('Company created successfully', 'Success');
              // Refresh local user info so guest -> admin promotion reflects immediately
              try {
                const username = (this.auth?.getUsername && this.auth.getUsername()) || localStorage.getItem('username') || '';
                if (username) {
                  this.auth.refreshUserDetails(username).subscribe({
                    next: () => {
                      this.dialogRef.close(true);
                    },
                    error: () => { this.dialogRef.close(true); }
                  });
                } else {
                  this.dialogRef.close(true);
                }
              } catch {
                this.dialogRef.close(true);
              }
            } else {
              this.toastr.error(r?.errorMessage ?? r?.ErrorMessage ?? 'Failed to create company', 'Error');
            }
          },
          error: (e: any) => {
            console.error('[DIALOG] createCompany error', e);
            this.toastr.error('Failed to create company', 'Error');
          }
        });
    }
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}




