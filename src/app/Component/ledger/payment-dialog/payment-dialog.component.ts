import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../../material.module';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MAT_DATE_LOCALE } from '@angular/material/core';
import { LedgerService } from '../../../_service/ledger.service';
import { paymentEntryRequest } from '../../../_model/ledger.model';
import { take } from 'rxjs/operators';

interface DialogData {
  customerId?: string;
  customerName?: string;
  companyId: string;
}

@Component({
  selector: 'app-payment-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule],
  templateUrl: './payment-dialog.component.html',
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'en-GB' } // Use dd/MM/yyyy display for this dialog
  ]
})
export class PaymentDialogComponent {
  form: any;

  // invoice dropdown removed per request
  

  constructor(
    private fb: FormBuilder,
    private ledgerService: LedgerService,
    private dialogRef: MatDialogRef<PaymentDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData
  ) {
    // initialize reactive form after fb is available
    this.form = this.fb.group({
      invoiceNumber: [''],
      amountPaid: [null, [Validators.required, Validators.min(0.01)]],
      // Use Date object for mat-datepicker; provider sets locale to en-GB (dd/MM/yyyy)
      paymentDate: [new Date(), Validators.required],
      // Default payment method should be Cash
      paymentMethod: ['Cash', Validators.required],
      reference: [''],
      chequeNumber: [''],
      chequeBank: [''],
      chequeBranch: [''],
      // Date fields left null until user selects
      chequeDate: [null],
      transactionId: [''],
      transactionDate: [null]
    });

    // No invoice lookup: invoice not required for payment

    // Enforce method-specific validators
    const methodControl = this.form.get('paymentMethod');
    methodControl?.valueChanges.subscribe((method: string) => {
      const isCheque = (method || '').toString().toLowerCase().includes('cheque');
      if (isCheque) {
        this.form.get('chequeNumber')?.setValidators([Validators.required]);
        this.form.get('chequeBank')?.setValidators([Validators.required]);
        this.form.get('chequeBranch')?.setValidators([Validators.required]);
        this.form.get('chequeDate')?.setValidators([Validators.required]);
      } else {
        this.form.get('chequeNumber')?.clearValidators();
        this.form.get('chequeBank')?.clearValidators();
        this.form.get('chequeBranch')?.clearValidators();
        this.form.get('chequeDate')?.clearValidators();
      }
      this.form.get('chequeNumber')?.updateValueAndValidity();
      this.form.get('chequeBank')?.updateValueAndValidity();
      this.form.get('chequeBranch')?.updateValueAndValidity();
      this.form.get('chequeDate')?.updateValueAndValidity();
    });
  }

  submit(): void {
    if (this.form.invalid) return;
    const value = this.form.value || {};
    // Map to backend payload expected by API
    const toISO = (input: any) => {
      if (!input) return undefined;
      try {
        let d: Date | undefined;

        if (input instanceof Date) {
          d = input;
        } else if (typeof input === 'string') {
          // Try native parse first (ISO)
          d = new Date(input);
          if (isNaN(d.getTime())) {
            // Try dd/MM/yyyy or dd-MM-yyyy
            const m = input.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
            if (m) {
              const day = Number(m[1]);
              const month = Number(m[2]) - 1;
              const year = Number(m[3]);
              d = new Date(year, month, day);
            } else {
              return undefined;
            }
          }
        } else if (input && typeof input === 'object' && typeof (input as any).toDate === 'function') {
          // moment-like
          d = (input as any).toDate();
        } else {
          d = new Date(input);
        }

        if (!d || isNaN(d.getTime())) return undefined;
        return d.toISOString();
      } catch {
        return undefined;
      }
    };

    // Map friendly labels to backend codes
    const methodMap: any = {
      'Cash': 'CASH',
      'Cheque': 'CHEQUE',
      'Bank Transfer': 'BANK_TRANSFER',
      'Other': 'OTHER'
    };

    const mappedMethod = methodMap[String(value.paymentMethod || 'Cash')] || String(value.paymentMethod || 'OTHER');

    const payment = {
      customerId: this.data.customerId || '',
      paymentAmount: Number(value.amountPaid),
      receiptDate: toISO(value.paymentDate) || new Date().toISOString(),
      paymentMethod: mappedMethod,
      notes: String(value.reference || ''),
      chequeNumber: (value.chequeNumber || '') || undefined,
      chequeBank: (value.chequeBank || '') || undefined,
      chequeBranch: (value.chequeBranch || '') || undefined,
      chequeDate: toISO(value.chequeDate),
      transactionId: (value.transactionId || '') || undefined,
      transactionDate: toISO(value.transactionDate)
    };

    this.ledgerService.recordPayment(payment)
      .pipe(take(1))
      .subscribe({
        next: (resp) => {
          if (resp && (resp.result === 'pass' || resp.result === 'success')) {
            this.dialogRef.close({ ok: true });
          } else {
            this.dialogRef.close({ ok: false, error: resp?.errorMessage });
          }
        },
        error: (err) => this.dialogRef.close({ ok: false, error: err?.message || 'Error' })
      });
  }

  cancel(): void {
    this.dialogRef.close({ ok: false });
  }
}
