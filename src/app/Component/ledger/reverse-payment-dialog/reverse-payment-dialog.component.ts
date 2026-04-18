import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../../material.module';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { LedgerService } from '../../../_service/ledger.service';
import { take } from 'rxjs/operators';

interface DialogData {
  paymentId: number;
  customerName?: string;
}

@Component({
  selector: 'app-reverse-payment-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule],
  templateUrl: './reverse-payment-dialog.component.html'
})
export class ReversePaymentDialogComponent {
  form: any;

  isSubmitting = false;

  constructor(
    private fb: FormBuilder,
    private ledgerService: LedgerService,
    private dialogRef: MatDialogRef<ReversePaymentDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData
  ) {
    this.form = this.fb.group({
      reason: ['', [Validators.required, Validators.minLength(5)]]
    });
  }

  submit(): void {
    if (this.form.invalid) return;

    this.isSubmitting = true;
    const reason = this.form.get('reason')?.value || '';

    this.ledgerService.reversePayment(this.data.paymentId, reason)
      .pipe(take(1))
      .subscribe({
        next: (resp) => {
          this.isSubmitting = false;
          if (resp && (resp.result === 'pass' || resp.result === 'success')) {
            this.dialogRef.close({ ok: true, data: resp.data });
          } else {
            this.dialogRef.close({ ok: false, error: resp?.errorMessage });
          }
        },
        error: (err) => {
          this.isSubmitting = false;
          this.dialogRef.close({ ok: false, error: err?.message || 'Error reversing payment' });
        }
      });
  }

  cancel(): void {
    this.dialogRef.close({ ok: false });
  }
}
