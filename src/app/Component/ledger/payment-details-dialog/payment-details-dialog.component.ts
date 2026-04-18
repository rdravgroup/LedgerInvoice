import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../../material.module';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { LedgerService } from '../../../_service/ledger.service';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { ViewChild } from '@angular/core';
import { ToastrService } from 'ngx-toastr';

interface DialogData {
  customerId: string;
  customerName: string;
}

interface PaymentDetail {
  paymentNumber: string;
  paymentDate: string;
  paymentAmount: number;
  paymentMethod: string;
  reference: string;
  chequeNumber?: string;
  chequeBank?: string;
  chequeDate?: string;
  status: string;
  customerName: string;
  companyName: string;
  allocations?: any[];
}

@Component({
  selector: 'app-payment-details-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  templateUrl: './payment-details-dialog.component.html',
  styleUrls: ['./payment-details-dialog.component.css']
})
export class PaymentDetailsDialogComponent implements OnInit {
  displayedColumns: string[] = ['paymentNumber', 'paymentDate', 'paymentAmount', 'paymentMethod', 'status', 'actions'];
  dataSource = new MatTableDataSource<PaymentDetail>();
  
  @ViewChild(MatSort) sort!: MatSort;

  loading = true;
  error: string | null = null;

  constructor(
    private ledgerService: LedgerService,
    private dialogRef: MatDialogRef<PaymentDetailsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData,
    private toastr: ToastrService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    if (this.data.customerId) {
      this.loadPayments();
    }
  }

  /**
   * Load payments for the customer
   */
  loadPayments(): void {
    this.loading = true;
    this.error = null;

    this.ledgerService.getPaymentsByCustomerId(this.data.customerId).subscribe({
      next: (response: any) => {
        // Handle both wrapped and raw list responses
        let payments: PaymentDetail[] = [];
        
        if (Array.isArray(response)) {
          // Raw list response from API
          payments = response as PaymentDetail[];
        } else if (response.result === 'pass' && response.data) {
          // Wrapped APIResponse
          payments = Array.isArray(response.data) ? response.data : [response.data];
        } else if (response.data) {
          // Just has data property
          payments = Array.isArray(response.data) ? response.data : [response.data];
        }
        
        if (payments && payments.length > 0) {
          this.dataSource.data = payments;
          this.dataSource.sort = this.sort;
        } else {
          this.error = response.errorMessage || 'No payments found';
        }
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Error loading payments: ' + err.message;
        this.loading = false;
      }
    });
  }

  /**
   * Format currency
   */
  formatCurrency(value: number | undefined): string {
    if (!value) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  /**
   * Format date
   */
  formatDate(dateString: string | null | undefined): string {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-IN');
    } catch {
      return dateString;
    }
  }

  /**
   * Get status badge CSS class
   */
  getStatusCss(status: string | undefined): string {
    if (!status) return 'status-default';
    const normalizedStatus = status.toLowerCase();
    if (normalizedStatus.includes('reconciled') || normalizedStatus.includes('settled')) {
      return 'status-reconciled';
    } else if (normalizedStatus.includes('pending') || normalizedStatus.includes('unallocated')) {
      return 'status-pending';
    }
    return 'status-default';
  }

  /**
   * View payment allocation details
   */
  viewAllocations(payment: PaymentDetail): void {
    if (payment.allocations && payment.allocations.length > 0) {
      const allocationDetails = payment.allocations
        .map((a: any) => `Invoice: ${a.invoiceNumber}, Amount: ₹${a.allocationAmount}`)
        .join('\n');
      alert(`Allocations for ${payment.paymentNumber}:\n\n${allocationDetails}`);
    } else {
      alert(`No allocations for payment ${payment.paymentNumber}`);
    }
  }

  /**
   * Delete/Inactivate a payment
   */
  deletePayment(payment: PaymentDetail): void {
    if (!payment.paymentNumber) return;

    // Confirm deletion
    const confirmed = confirm(
      `Are you sure you want to delete payment ${payment.paymentNumber}?\n\n` +
      `Amount: ${this.formatCurrency(payment.paymentAmount)}\n\n` +
      `This action will mark the payment as inactive and reverse allocations.`
    );

    if (!confirmed) return;

    // Call service to delete payment
    this.ledgerService.deletePayment(payment.paymentNumber).subscribe({
      next: (response: any) => {
        if (response.result === 'pass' || response.result === 'success') {
          this.toastr.success(`Payment ${payment.paymentNumber} deleted successfully`, 'Payment Deleted');
          // Reload payments list
          this.loadPayments();
          // Close dialog with success flag so parent can refresh outstanding amounts
          this.dialogRef.close({ ok: true, paymentDeleted: true, customerId: this.data.customerId });
        } else {
          this.toastr.error('Failed to delete payment: ' + (response.errorMessage || 'Unknown error'), 'Error');
        }
      },
      error: (err) => {
        this.toastr.error('Error deleting payment: ' + err.message, 'Error');
      }
    });
  }

  /**
   * Close dialog
   */
  closeDialog(): void {
    this.dialogRef.close();
  }
}
