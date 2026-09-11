import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from '../../material.module';
import { UserService } from '../../_service/user.service';

@Component({
  selector: 'app-force-password-change-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule],
  template: `<div class="fpc-head"><div><h2 mat-dialog-title>Change temporary password</h2><p>For security, set a new password before continuing.</p></div></div><mat-dialog-content><form [formGroup]="form"><mat-form-field appearance="outline"><mat-label>New password</mat-label><input matInput type="password" formControlName="newPassword"><mat-hint>8+ chars, uppercase, lowercase, number, and special character</mat-hint></mat-form-field><mat-form-field appearance="outline"><mat-label>Confirm password</mat-label><input matInput type="password" formControlName="confirmPassword"></mat-form-field></form></mat-dialog-content><mat-dialog-actions align="end"><button mat-flat-button color="primary" type="button" (click)="save()" [disabled]="form.invalid || saving">{{ saving ? 'Saving...' : 'Save password' }}</button></mat-dialog-actions>`,
  styles: [`:host{display:block}.fpc-head{padding:24px 24px 4px}h2{margin:0;font-size:22px}.fpc-head p{color:#64748b;font-size:13px}.fpc-head+mat-dialog-content{padding:12px 24px}.fpc-head+mat-dialog-content form{display:flex;flex-direction:column;gap:4px;min-width:min(420px,80vw)}mat-form-field{width:100%}mat-dialog-actions{padding:12px 24px 20px}`]
})
export class ForcePasswordChangeDialogComponent {
  saving = false;
  form;
  constructor(private fb: FormBuilder, private users: UserService, private ref: MatDialogRef<ForcePasswordChangeDialogComponent>, @Inject(MAT_DIALOG_DATA) public data: { username?: string }) {
    this.form = this.fb.group({
      newPassword: ['', [Validators.required, Validators.minLength(8), Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)]],
      confirmPassword: ['', Validators.required]
    });
  }
  save(): void {
    const value = this.form.getRawValue();
    if (this.form.invalid || value.newPassword !== value.confirmPassword || this.saving) { this.form.markAllAsTouched(); return; }
    this.saving = true;
    this.users.createPassword({ newPassword: value.newPassword!, confirmPassword: value.confirmPassword! }).subscribe({ next: () => { this.saving = false; this.ref.close(true); }, error: () => { this.saving = false; } });
  }
}
