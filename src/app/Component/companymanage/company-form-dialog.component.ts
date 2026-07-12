import { Component, Inject } from '@angular/core';
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

@Component({
  selector: 'app-company-form-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule],
  templateUrl: './company-form-dialog.component.html'
})
export class CompanyFormDialogComponent {
  form: any;
  submitting = false;
  isEdit = false;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<CompanyFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { company?: Company } | null,
    private service: CompanyService,
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
      gstNumber: ['', Validators.required],
      bankName: [''],
      accountNumber: [''],
      ifsc: [''],
      accountAddress: ['']
    });

    if (data && data.company) {
      this.isEdit = true;
      this.form.patchValue(data.company as any);
    }
  }

  private isSuccess(resp: any) {
    return resp && (resp.result === 'pass' || resp.Result === 'pass');
  }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.submitting = true;

    if (this.isEdit) {
      // FIX: send null (not "") for unchanged/blank optional fields.
      // Backend uses null-check: null = skip, any other value = update.
      const raw = this.form.getRawValue();
      const payload: any = {
        companyId: raw.companyId ?? raw.CompanyId ?? this.data?.company?.companyId
      };
      const fields = [
        'name','emailId','mobileNo','alternateMobile','addressDetails',
        'countryCode','countryName','stateCode','stateName','gstNumber',
        'bankName','accountNumber','ifsc','accountAddress'
      ];
      fields.forEach(field => {
        const v = raw[field];
        payload[field] = (v === '' || v === null || v === undefined) ? null : v;
      });

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
      // CREATE: send null for blank optional bank fields
      const payload = this.form.getRawValue();
      ['bankName','accountNumber','ifsc','accountAddress','alternateMobile']
        .forEach(f => { if (!payload[f]) payload[f] = null; });

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
