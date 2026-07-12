import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../material.module';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';

/**
 * Data shape passed to the dialog via MAT_DIALOG_DATA.
 */
export interface ConfirmDestructiveDialogData {
  /** Dialog header, e.g. "Delete Invoice" */
  title: string;
  /** The record identifier shown prominently, e.g. "INV/2026/001" */
  entityId: string;
  /** Human-readable type label, e.g. "Invoice" | "Customer" | "Product" */
  entityType: string;
  /** Company name for context — especially important for super_admin */
  companyName?: string;
  /** Company ID */
  companyId?: string;
  /** When true, amber "Cross-company action" badge is shown */
  isSuperAdmin?: boolean;
  /**
   * When set, user must type this exact value to enable the Confirm button.
   * Recommended for irreversible deletes: pass entityId.
   */
  requireTyping?: boolean;
}

/**
 * Generic confirmation dialog for destructive (delete) actions.
 * Replaces browser confirm() throughout the application.
 *
 * Usage:
 *   import { ConfirmDestructiveActionDialogComponent, ConfirmDestructiveDialogData }
 *     from '../confirm-dialog/confirm-destructive-action-dialog.component';
 *
 *   const ref = this.dialog.open(ConfirmDestructiveActionDialogComponent, {
 *     width: '440px',
 *     data: {
 *       title: 'Delete Invoice',
 *       entityId: invoiceNo,
 *       entityType: 'Invoice',
 *       companyName: this.activeCompanyName,
 *       isSuperAdmin: this.isSuperAdmin,
 *       requireTyping: true   // make user type the invoice number
 *     } as ConfirmDestructiveDialogData
 *   });
 *   ref.afterClosed().subscribe((confirmed: boolean) => {
 *     if (confirmed) { ... proceed with deletion ... }
 *   });
 */
@Component({
  selector: 'app-confirm-destructive-action-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule, FormsModule],
  template: `
    <h2 mat-dialog-title class="dlg-title">
      <mat-icon class="dlg-warn-icon">warning</mat-icon>
      {{ data.title }}
    </h2>

    <mat-dialog-content class="dlg-content">

      <p class="dlg-desc">You are about to permanently delete this {{ data.entityType }}:</p>

      <div class="dlg-entity-chip">
        <mat-icon>{{ entityIcon }}</mat-icon>
        <span class="dlg-entity-id">{{ data.entityId }}</span>
      </div>

      <!-- Company attribution -->
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

      <p class="dlg-warning-text">
        <strong>This action cannot be undone.</strong>
      </p>

      <!-- Optional type-to-confirm -->
      <div *ngIf="data.requireTyping" class="dlg-type-confirm">
        <label class="dlg-type-label">
          Type <code class="dlg-code">{{ data.entityId }}</code> to confirm:
        </label>
        <mat-form-field appearance="outline" class="dlg-type-field">
          <input matInput [(ngModel)]="typedValue"
                 [placeholder]="data.entityId"
                 autocomplete="off" />
        </mat-form-field>
      </div>

    </mat-dialog-content>

    <mat-dialog-actions align="end" class="dlg-actions">
      <button mat-stroked-button (click)="cancel()">Cancel</button>
      <button mat-flat-button color="warn"
              [disabled]="!canConfirm"
              (click)="confirm()">
        <mat-icon>delete_forever</mat-icon>
        Confirm Delete
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dlg-title {
      display: flex; align-items: center; gap: 8px;
      font-size: 18px; font-weight: 500;
    }
    .dlg-warn-icon { color: #d32f2f; }

    .dlg-content { padding: 0 24px 8px; min-width: 300px; }

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
    .dlg-company-super {
      background: #fff8e1; border: 1px solid #ffe082;
    }
    .dlg-cross-badge {
      background: #ef6c00; color: #fff;
      font-size: 11px; padding: 1px 8px; border-radius: 10px; font-weight: 500;
    }

    .dlg-warning-text {
      color: #c62828; background: #ffebee;
      border-radius: 6px; padding: 8px 12px;
      font-size: 13px; margin-bottom: 14px;
    }

    .dlg-type-confirm { margin-top: 4px; }
    .dlg-type-label { display: block; font-size: 13px; color: rgba(0,0,0,0.65); margin-bottom: 6px; }
    .dlg-code { background: #f5f5f5; padding: 1px 6px; border-radius: 4px; font-weight: 600; }
    .dlg-type-field { width: 100%; }

    .dlg-actions { padding: 12px 24px 16px; gap: 8px; }
  `]
})
export class ConfirmDestructiveActionDialogComponent {
  typedValue = '';

  constructor(
    public dialogRef: MatDialogRef<ConfirmDestructiveActionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDestructiveDialogData
  ) {}

  get entityIcon(): string {
    switch ((this.data.entityType || '').toLowerCase()) {
      case 'invoice':  return 'receipt_long';
      case 'customer': return 'person';
      case 'product':  return 'inventory_2';
      default:         return 'delete';
    }
  }

  get canConfirm(): boolean {
    if (!this.data.requireTyping) return true;
    return this.typedValue.trim() === this.data.entityId.trim();
  }

  confirm(): void { this.dialogRef.close(true); }
  cancel():  void { this.dialogRef.close(false); }
}
