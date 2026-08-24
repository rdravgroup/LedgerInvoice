import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormGroup, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from '../../material.module';

export interface AuthPinDialogData {
  mode: 'setup' | 'validate';
  username?: string;
}

@Component({
  selector: 'app-auth-pin-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule],
  templateUrl: './auth-pin-dialog.component.html',
  styleUrl: './auth-pin-dialog.component.css'
})
export class AuthPinDialogComponent {
  hidePin = true;
  hideConfirmPin = true;
  readonly isSetup: boolean;
  form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<AuthPinDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AuthPinDialogData
  ) {
    this.isSetup = this.data.mode === 'setup';
    this.form = this.fb.group({
      pin: ['', [Validators.required, Validators.pattern(/^[0-9]{4,8}$/)]],
      confirmPin: ['']
    });

    if (this.isSetup) {
      this.form.get('confirmPin')?.addValidators([Validators.required, Validators.pattern(/^[0-9]{4,8}$/)]);
    }
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const pin = this.form.value.pin || '';
    const confirmPin = this.form.value.confirmPin || '';
    if (this.isSetup && pin !== confirmPin) {
      this.form.get('confirmPin')?.setErrors({ mismatch: true });
      return;
    }

    this.dialogRef.close({ pin, confirmPin: this.isSetup ? confirmPin : pin });
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
