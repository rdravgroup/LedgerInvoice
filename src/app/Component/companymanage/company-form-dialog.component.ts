import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MaterialModule } from '../../material.module';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { CompanyService } from '../../_service/company.service';
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
    const payload = this.form.value;
    this.submitting = true;
    if (this.isEdit) {
      this.service.updateCompany(payload).pipe(finalize(() => (this.submitting = false))).subscribe({
        next: (r) => {
          if (this.isSuccess(r)) {
            this.toastr.success('Company updated', 'Success');
            this.dialogRef.close(true);
          } else {
            this.toastr.error(r?.errorMessage || 'Failed to update');
          }
        },
        error: (e) => {
          console.error(e);
          this.toastr.error('Failed to update');
        }
      });
    } else {
      this.service.createCompany(payload).pipe(finalize(() => (this.submitting = false))).subscribe({
        next: (r) => {
          if (this.isSuccess(r)) {
            this.toastr.success('Company created', 'Success');
            this.dialogRef.close(true);
          } else {
            this.toastr.error(r?.errorMessage || 'Failed to create');
          }
        },
        error: (e) => {
          console.error(e);
          this.toastr.error('Failed to create');
        }
      });
    }
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
