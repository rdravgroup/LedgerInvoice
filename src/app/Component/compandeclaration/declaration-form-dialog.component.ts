import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MaterialModule } from '../../material.module';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { CompanyService } from '../../_service/company.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-declaration-form-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule],
  templateUrl: './declaration-form-dialog.component.html'
})
export class DeclarationFormDialogComponent {
  form: any;
  submitting = false;

  isEdit = false;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<DeclarationFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private service: CompanyService,
    private toastr: ToastrService
  ) {
    this.form = this.fb.group({
      recId: [0],
      companyId: ['', Validators.required],
      declaration: ['', Validators.required],
      active: ['Y']
    });

    if (data) {
      if (data.companyId) this.form.patchValue({ companyId: data.companyId });
      if (data.item) {
        this.isEdit = true;
        const it = data.item;
        this.form.patchValue({ recId: it.recId || it.RecId || it.Rec_Id, companyId: it.companyId || it.CompanyId, declaration: it.declaration || it.Declaration, active: it.active || it.Active });
      }
    }
  }

  private isSuccess(resp: any) { return resp && (resp.result === 'pass' || resp.Result === 'pass'); }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const payload = this.form.value;
    this.submitting = true;
    if (this.isEdit) {
      this.service.updateDeclaration(payload).pipe(finalize(() => (this.submitting = false))).subscribe({ next: (r) => { if (this.isSuccess(r)) { this.toastr.success('Updated'); this.dialogRef.close(true); } else { this.toastr.error(r?.errorMessage || 'Failed'); } }, error: (e) => { console.error(e); this.toastr.error('Failed to update'); } });
    } else {
      this.service.createDeclaration(payload).pipe(finalize(() => (this.submitting = false))).subscribe({ next: (r) => { if (this.isSuccess(r)) { this.toastr.success('Created'); this.dialogRef.close(true); } else { this.toastr.error(r?.errorMessage || 'Failed'); } }, error: (e) => { console.error(e); this.toastr.error('Failed to create'); } });
    }
  }

  cancel(): void { this.dialogRef.close(false); }
}
