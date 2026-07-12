import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from '../../../material.module';
import { PurchaseService } from '../../../_service/purchase.service';

export interface VendorLedgerDialogData {
  vendorId: string; companyId: string; vendorName: string; creditLimit: number;
}

@Component({
  selector: 'app-vendor-ledger-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  templateUrl: './vendor-ledger-dialog.component.html',
  styleUrls: ['./vendor-ledger-dialog.component.css']
})
export class VendorLedgerDialogComponent implements OnInit {
  loading = true;
  errorMsg = '';
  ledgerRows: any[] = [];
  ledgerColumns = ['referenceDate', 'referenceType', 'referenceNumber', 'debitAmount', 'creditAmount', 'outstandingAmount', 'description'];

  constructor(
    public dialogRef: MatDialogRef<VendorLedgerDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: VendorLedgerDialogData,
    private svc: PurchaseService
  ) {}

  ngOnInit(): void {
    this.svc.getVendorLedger(this.data.vendorId, this.data.companyId).subscribe({
      next: res => {
        this.loading = false;
        if (res.result === 'pass') this.ledgerRows = res.data ?? [];
        else this.errorMsg = res.errorMessage || 'Failed to load ledger';
      },
      error: (e: any) => {
        this.loading = false;
        this.errorMsg = e?.error?.errorMessage || e?.error?.message || 'Error loading ledger';
      }
    });
  }

  get ledgerBalance(): number {
    return this.ledgerRows.reduce((s: number, r: any) => s + (r.outstandingAmount ?? 0), 0);
  }

  close(): void { this.dialogRef.close(); }
}
