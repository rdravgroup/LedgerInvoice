import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormGroup, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from '../../material.module';

export interface AuthPinDialogData {
  mode: 'setup' | 'validate' | 'change';
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
  hideCurrentPin = true;
  hidePin = true;
  hideConfirmPin = true;
  readonly isSetup: boolean;
  readonly isValidate: boolean;
  readonly isChange: boolean;
  form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<AuthPinDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AuthPinDialogData
  ) {
    this.isSetup = this.data.mode === 'setup';
    this.isValidate = this.data.mode === 'validate';
    this.isChange = this.data.mode === 'change';
    this.form = this.fb.group({
      currentPin: [''],
      pin: ['', [Validators.required, Validators.pattern(/^[0-9]{4,8}$/)]],
      confirmPin: ['']
    });

    if (this.isSetup || this.isChange) {
      this.form.get('confirmPin')?.addValidators([Validators.required, Validators.pattern(/^[0-9]{4,8}$/)]);
    }

    if (this.isChange) {
      this.form.get('currentPin')?.addValidators([Validators.required, Validators.pattern(/^[0-9]{4,8}$/)]);
    }
  }

  title(): string {
    if (this.isChange) return 'Change Access PIN';
    return this.isSetup ? 'Create Access PIN' : 'Enter Access PIN';
  }

  subtitle(): string {
    if (this.isChange) return 'Enter your current PIN and choose a new 4 to 8 digit PIN.';
    return this.isSetup
      ? 'Set a 4 to 8 digit PIN for remembered login on this device.'
      : 'Confirm this remembered device before opening your ERP session.';
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const currentPin = this.form.value.currentPin || '';
    const pin = this.form.value.pin || '';
    const confirmPin = this.form.value.confirmPin || '';
    if ((this.isSetup || this.isChange) && pin !== confirmPin) {
      this.form.get('confirmPin')?.setErrors({ mismatch: true });
      return;
    }

    this.dialogRef.close({ currentPin, pin, confirmPin: this.isValidate ? pin : confirmPin });
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
