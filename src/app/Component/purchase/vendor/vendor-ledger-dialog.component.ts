import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from '../../../material.module';
import { PurchaseService } from '../../../_service/purchase.service';
import { PurchaseLedgerEntry } from '../../../_model/purchase.model';
import { CompanyNumberPipe } from '../../../_pipe/company-number.pipe';

export interface VendorLedgerDialogData {
  vendorId: string; companyId: string; vendorName: string; creditLimit: number;
}

interface VendorLedgerRow extends PurchaseLedgerEntry {
  runningBalance: number;
}

@Component({
  selector: 'app-vendor-ledger-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule, CompanyNumberPipe],
  templateUrl: './vendor-ledger-dialog.component.html',
  styleUrls: ['./vendor-ledger-dialog.component.css']
})
export class VendorLedgerDialogComponent implements OnInit {
  loading = true;
  errorMsg = '';
  ledgerRows: VendorLedgerRow[] = [];
  ledgerColumns = [
    'referenceDate', 'referenceType', 'referenceNumber', 'refundAmount',
    'paymentMode', 'debitAmount', 'creditAmount', 'outstandingAmount', 'description'
  ];

  constructor(
    public dialogRef: MatDialogRef<VendorLedgerDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: VendorLedgerDialogData,
    private svc: PurchaseService
  ) {}

  ngOnInit(): void {
    this.svc.getVendorLedger(this.data.vendorId, this.data.companyId).subscribe({
      next: res => {
        this.loading = false;
        if (res.result === 'pass') {
          this.ledgerRows = this.withRunningBalances(res.data ?? []);
        } else {
          this.errorMsg = res.errorMessage || 'Failed to load ledger';
        }
      },
      error: (e: any) => {
        this.loading = false;
        this.errorMsg = e?.error?.errorMessage || e?.error?.message || 'Error loading ledger';
      }
    });
  }

  get ledgerBalance(): number {
    return this.ledgerRows.length ? this.ledgerRows[0].runningBalance : 0;
  }

  getRefundAmount(row: PurchaseLedgerEntry): number {
    return row.refundAmount || ((row.referenceType || '').toLowerCase().includes('refund')
      ? row.debitAmount || row.creditAmount
      : 0);
  }

  private withRunningBalances(rows: PurchaseLedgerEntry[]): VendorLedgerRow[] {
    const balances = new Map<number, number>();
    let balance = 0;

    [...rows]
      .sort((a, b) => {
        const dateDifference = new Date(a.referenceDate).getTime() - new Date(b.referenceDate).getTime();
        return dateDifference || a.ledgerId - b.ledgerId;
      })
      .forEach(row => {
        balance = Math.round((balance + (row.creditAmount || 0) - (row.debitAmount || 0)) * 100) / 100;
        balances.set(row.ledgerId, balance);
      });

    return [...rows]
      .sort((a, b) => {
        const dateDifference = new Date(b.referenceDate).getTime() - new Date(a.referenceDate).getTime();
        return dateDifference || b.ledgerId - a.ledgerId;
      })
      .map(row => ({
        ...row,
        runningBalance: balances.get(row.ledgerId) ?? 0
      }));
  }

  close(): void { this.dialogRef.close(); }
}
