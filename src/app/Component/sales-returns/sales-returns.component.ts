// src/app/Component/sales-returns/sales-returns.component.ts
//
// Dedicated Sales Returns management page — separate from Sales Reports
// for navigation parity with the Purchase module (which has distinct
// purchase-returns vs purchase-reports pages). Reuses the SAME backend
// endpoint as Sales Reports (GET /api/Invoice/Report?reportType=returns
// and /Report/Export), since that already returns exactly this data —
// no backend changes were needed for this page.
import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { MaterialModule } from '../../material.module';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { ToastrService } from 'ngx-toastr';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { InvoiceService } from '../../_service/invoice.service';
import { AuthService } from '../../_service/authentication.service';
import { SelectedCompanyService } from '../../_service/selected-company.service';
import { MasterService } from '../../_service/master.service';

@Component({
  selector: 'app-sales-returns',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule],
  templateUrl: './sales-returns.component.html',
  styleUrls: ['./sales-returns.component.css']
})
export class SalesReturnsComponent implements OnInit, OnDestroy {

  filterForm!: FormGroup;
  loading     = false;
  exporting   = false;

  dataSource = new MatTableDataSource<any>();
  customers: any[] = [];

  displayedColumns = [
    'returnNo', 'invoiceNumber', 'returnDate',
    'customerName', 'returnType', 'grandTotal', 'creditNoteNo', 'reason'
  ];

  // Totals
  totalReturnsValue = 0;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort)      sort!: MatSort;

  private destroy$ = new Subject<void>();

  constructor(
    private fb:         FormBuilder,
    private invoiceSvc: InvoiceService,
    private auth:       AuthService,
    private selectedCo: SelectedCompanyService,
    private toastr:     ToastrService,
    private masterSvc:  MasterService
  ) {}

  ngOnInit(): void {
    this.buildForm();
    this.selectedCo.selectedCompanyId$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.loadCustomers();
        this.runReport();
      });
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort      = this.sort;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private buildForm(): void {
    const today        = new Date();
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    this.filterForm = this.fb.group({
      fromDate:   [firstOfMonth],
      toDate:     [today],
      customerId: ['']
    });
  }

  /** Converts a Date (from mat-datepicker) to a 'yyyy-MM-dd' string for the API. */
  private toIsoDate(d: any): string | undefined {
    if (!d) return undefined;
    const date = d instanceof Date ? d : new Date(d);
    if (isNaN(date.getTime())) return undefined;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private cid(): string {
    return this.selectedCo.getSelectedCompanyId() || this.auth.getCompanyId() || '';
  }

  loadCustomers(): void {
    this.masterSvc.GetCustomer(this.cid())
      .pipe(takeUntil(this.destroy$))
      .subscribe({ next: (r: any) => this.customers = r?.data || r || [] });
  }

  runReport(): void {
    const v = this.filterForm.value;
    this.loading = true;
    this.dataSource.data = [];
    this.totalReturnsValue = 0;

    this.invoiceSvc.getSalesReport({
      companyId:  this.cid(),
      customerId: v.customerId || undefined,
      fromDate:   this.toIsoDate(v.fromDate),
      toDate:     this.toIsoDate(v.toDate),
      reportType: 'returns'
    }).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (r: any) => {
          const data = r?.data || [];
          this.dataSource.data = data;
          this.totalReturnsValue = data.reduce((s: number, row: any) => s + (row.grandTotal || 0), 0);
          this.loading = false;
        },
        error: () => {
          this.toastr.error('Failed to load sales returns');
          this.loading = false;
        }
      });
  }

  exportCsv(): void {
    const v = this.filterForm.value;
    this.exporting = true;

    this.invoiceSvc.exportSalesCsv({
      companyId:  this.cid(),
      customerId: v.customerId || undefined,
      fromDate:   this.toIsoDate(v.fromDate),
      toDate:     this.toIsoDate(v.toDate),
      reportType: 'returns'
    }).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob: Blob) => {
          const url  = URL.createObjectURL(blob);
          const a    = document.createElement('a');
          a.href     = url;
          a.download = `SalesReturns_${new Date().toISOString().split('T')[0]}.csv`;
          a.click();
          URL.revokeObjectURL(url);
          this.exporting = false;
        },
        error: () => {
          this.toastr.error('CSV export failed');
          this.exporting = false;
        }
      });
  }

  applyFilter(e: Event): void {
    this.dataSource.filter = (e.target as HTMLInputElement).value.trim().toLowerCase();
  }
}
