import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-invoice-list-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './invoice-list-dialog.component.html'
})
export class InvoiceListDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    public dialogRef: MatDialogRef<InvoiceListDialogComponent>
  ) {}

  performAction(invoiceId: string, action: string) {
    // Call the parent component's method
    this.data.performInvoiceAction(invoiceId, action);
    
    // Close dialog after action
    this.dialogRef.close();
  }
}