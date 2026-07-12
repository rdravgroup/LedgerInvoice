import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../material.module';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';

/**
 * Data shape passed to the dialog via MAT_DIALOG_DATA.
 */
export interface LockInvoiceDialogData {
  invoiceNumber: string;
  companyName?: string;
  companyId?: string;
  isSuperAdmin?: boolean;
}

export interface LockInvoiceDialogResult {
  reason: string;
}

/**
 * Confirmation dialog for locking an invoice.
 *
 * Fixes a reported flaw where the invoice number shown in a window.prompt()
 * looked like a field the user was meant to type back in — but the prompt
 * only ever collected a free-text "reason", with the invoice number never
 * validated against anything. That made it look like the app was silently
 * accepting mismatched invoice numbers.
 *
 * This dialog makes the two inputs unambiguous and enforces both:
 *  1. The invoice number is shown read-only (never typed by the user), AND
 *     the user must additionally re-type it exactly to enable the Lock
 *     button — a genuine "type to confirm" safety check, so if the app IS
 *     asking for the invoice number, it now genuinely validates it.
 *  2. A separate reason field is required (min 3 characters) and is what
 *     actually gets sent to the backend as the lock reason.
 */
@Component({
  selector: 'app-lock-invoice-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule, FormsModule],
  template: `
    <h2 mat-dialog-title class="dlg-title">
      <mat-icon class="dlg-lock-icon">lock</mat-icon>
      Lock Invoice
    </h2>

    <mat-dialog-content class="dlg-content">

      <p class="dlg-desc">You are about to lock this invoice:</p>

      <div class="dlg-entity-chip">
        <mat-icon>receipt_long</mat-icon>
        <span class="dlg-entity-id">{{ data.invoiceNumber }}</span>
      </div>

      <div *ngIf="data.companyName || data.companyId"
           class="dlg-company-row"
           [class.dlg-company-super]="data.isSuperAdmin">
        <mat-icon>business</mat-icon>
        <span>
          Company: <strong>{{ data.companyName || data.companyId }}</strong>
          <span *ngIf="data.companyId && data.companyName"> ({{ data.companyId }})</span>
        </span>
        <span *ngIf="data.isSuperAdmin" class="dlg-cross-badge">Cross-company</span>
      </div>

      <p class="dlg-info-text">
        Locking prevents edits, deletion, and returns until an authorized
        <strong>super_admin</strong> unlocks it again.
      </p>

      <mat-form-field appearance="outline" class="dlg-full-field">
        <mat-label>Reason for locking</mat-label>
        <textarea matInput rows="2" [(ngModel)]="reason"
                   placeholder="e.g. Awaiting accounts review"
                   maxlength="500"></textarea>
        <mat-hint>Required — shown to anyone who tries to edit this invoice</mat-hint>
      </mat-form-field>

      <div class="dlg-type-confirm">
        <label class="dlg-type-label">
          Type <code class="dlg-code">{{ data.invoiceNumber }}</code> to confirm:
        </label>
        <mat-form-field appearance="outline" class="dlg-full-field">
          <input matInput [(ngModel)]="typedValue"
                 [placeholder]="data.invoiceNumber"
                 autocomplete="off" />
          <mat-error *ngIf="typedValue && !invoiceNumberMatches">Does not match</mat-error>
        </mat-form-field>
      </div>

    </mat-dialog-content>

    <mat-dialog-actions align="end" class="dlg-actions">
      <button mat-stroked-button (click)="cancel()">Cancel</button>
      <button mat-flat-button color="warn"
              [disabled]="!canConfirm"
              (click)="confirm()">
        <mat-icon>lock</mat-icon>
        Lock Invoice
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dlg-title { display: flex; align-items: center; gap: 8px; font-size: 18px; font-weight: 500; }
    .dlg-lock-icon { color: #ef6c00; }
    .dlg-content { padding: 0 24px 8px; min-width: 320px; }
    .dlg-desc { color: rgba(0,0,0,0.7); margin-bottom: 12px; }
    .dlg-entity-chip {
      display: flex; align-items: center; gap: 8px;
      background: #f5f5f5; border-radius: 8px;
      padding: 10px 14px; margin-bottom: 14px;
      font-family: monospace; font-size: 15px; font-weight: 600;
    }
    .dlg-company-row {
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
      background: #e8f4fd; border-radius: 8px;
      padding: 8px 12px; margin-bottom: 14px; font-size: 13px;
    }
    .dlg-company-super { background: #fff8e1; border: 1px solid #ffe082; }
    .dlg-cross-badge { background: #ef6c00; color: #fff; font-size: 11px; padding: 1px 8px; border-radius: 10px; font-weight: 500; }
    .dlg-info-text {
      color: #8a5300; background: #fff3e0;
      border-radius: 6px; padding: 8px 12px;
      font-size: 13px; margin-bottom: 14px;
    }
    .dlg-full-field { width: 100%; margin-bottom: 6px; }
    .dlg-type-confirm { margin-top: 8px; }
    .dlg-type-label { display: block; font-size: 13px; color: rgba(0,0,0,0.65); margin-bottom: 6px; }
    .dlg-code { background: #f5f5f5; padding: 1px 6px; border-radius: 4px; font-weight: 600; }
    .dlg-actions { padding: 12px 24px 16px; gap: 8px; }
  `]
})
export class LockInvoiceDialogComponent {
  reason = '';
  typedValue = '';

  constructor(
    public dialogRef: MatDialogRef<LockInvoiceDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: LockInvoiceDialogData
  ) {}

  get invoiceNumberMatches(): boolean {
    return this.typedValue.trim() === this.data.invoiceNumber.trim();
  }

  get canConfirm(): boolean {
    return this.invoiceNumberMatches && this.reason.trim().length >= 3;
  }

  confirm(): void {
    if (!this.canConfirm) return;
    this.dialogRef.close({ reason: this.reason.trim() } as LockInvoiceDialogResult);
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
