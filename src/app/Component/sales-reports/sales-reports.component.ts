// src/app/Component/sales-reports/sales-reports.component.ts
import { Component, Injectable, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { MaterialModule } from '../../material.module';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE, NativeDateAdapter } from '@angular/material/core';
import { ToastrService } from 'ngx-toastr';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { InvoiceService } from '../../_service/invoice.service';
import { AuthService } from '../../_service/authentication.service';
import { SelectedCompanyService } from '../../_service/selected-company.service';
import { MasterService } from '../../_service/master.service';
import { jsPDF } from 'jspdf';

const SALES_REPORT_DATE_FORMATS = {
  parse: { dateInput: { day: '2-digit', month: '2-digit', year: 'numeric' } },
  display: {
    dateInput: { day: '2-digit', month: '2-digit', year: 'numeric' },
    monthYearLabel: { month: 'short', year: 'numeric' },
    dateA11yLabel: { day: 'numeric', month: 'long', year: 'numeric' },
    monthYearA11yLabel: { month: 'long', year: 'numeric' }
  }
};

@Injectable()
class SalesReportDateAdapter extends NativeDateAdapter {
  override format(date: Date, _displayFormat: unknown): string {
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  }

  override parse(value: unknown): Date | null {
    if (typeof value !== 'string') return null;
    const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return null;
    const day = Number(match[1]);
    const month = Number(match[2]) - 1;
    const year = Number(match[3]);
    const date = new Date(year, month, day);
    return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day ? date : null;
  }
}

@Component({
  selector: 'app-sales-reports',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule],
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'en-GB' },
    { provide: DateAdapter, useClass: SalesReportDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: SALES_REPORT_DATE_FORMATS }
  ],
  templateUrl: './sales-reports.component.html',
  styleUrls: ['./sales-reports.component.css']
})
export class SalesReportsComponent implements OnInit, OnDestroy {

  filterForm!: FormGroup;
  loading     = false;
  exporting   = false;
  reportEmailSending = false;
  dateRangeError = '';
  readonly pageSizeOptions = [10, 20, 50, 100, 200, 500, 1000];

  reportType = 'summary';
  dataSource = new MatTableDataSource<any>();
  customers: any[] = [];
  customerSearch = new FormControl('', { nonNullable: true });
  readonly allCustomersOption = { uniqueKeyID: '', name: 'All Customers' };

  get filteredCustomers(): any[] {
    const query = this.customerSearch.value.trim().toLocaleLowerCase();
    if (!query || query === 'all customers') return this.customers;
    return this.customers.filter(customer =>
      [customer.name, customer.customer_company, customer.uniqueKeyID, customer.email, customer.emailId, customer.phone, customer.mobileNo]
        .some(value => String(value || '').toLocaleLowerCase().includes(query))
    );
  }

  summaryColumns = [
    'serialNumber', 'invoiceNumber', 'displayInvNumber', 'invoiceDate',
    'customerName', 'totalAmount', 'totalReturns', 'netAmount',
    'isApproved', 'isLocked', 'approvedBy'
  ];
  returnsColumns = [
    'serialNumber', 'returnNo', 'invoiceNumber', 'returnDate',
    'customerName', 'returnType', 'grandTotal', 'creditNoteNo', 'reason'
  ];

  get displayedColumns(): string[] {
    return this.reportType === 'returns' ? this.returnsColumns : this.summaryColumns;
  }

  // Summary totals
  totalInvoiced  = 0;
  totalReturns   = 0;
  totalNet       = 0;

  private paginatorRef?: MatPaginator;
  private reportRequest$ = new Subject<void>();

  @ViewChild(MatPaginator)
  set paginator(paginator: MatPaginator | undefined) {
    this.paginatorRef = paginator;
    if (paginator) this.dataSource.paginator = paginator;
  }

  @ViewChild(MatSort)
  set sort(sort: MatSort | undefined) {
    if (sort) this.dataSource.sort = sort;
  }

  private destroy$ = new Subject<void>();

  constructor(
    private fb:           FormBuilder,
    private invoiceSvc:   InvoiceService,
    private auth:         AuthService,
    private selectedCo:   SelectedCompanyService,
    private toastr:       ToastrService,
    private masterSvc:    MasterService
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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.reportRequest$.complete();
  }

  private buildForm(): void {
    const today         = new Date();
    const assessmentYearStart = new Date(today.getFullYear() - (today.getMonth() < 3 ? 1 : 0), 3, 1);
    assessmentYearStart.setHours(0, 0, 0, 0);
    const assessmentYearEnd = new Date(assessmentYearStart.getFullYear() + 1, 2, 31);

    this.filterForm = this.fb.group({
      reportType: ['summary'],
      fromDate:   [assessmentYearStart, Validators.required],
      toDate:     [assessmentYearEnd, Validators.required],
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
      .subscribe({
        next: (r: any) => {
          const rows = Array.isArray(r) ? r : r?.data ?? r?.Data ?? r?.items ?? r?.Items ?? [];
          this.customers = (Array.isArray(rows) ? rows : []).sort((a: any, b: any) =>
            String(a?.name || a?.customer_company || '').localeCompare(
              String(b?.name || b?.customer_company || ''), undefined, { sensitivity: 'base', numeric: true }
            )
          );
        }
      });
  }

  displayCustomer(value: any): string {
    if (typeof value === 'string') return value;
    if (value === this.allCustomersOption || !value?.uniqueKeyID) return 'All Customers';
    return value?.name || value?.customer_company || '';
  }

  onCustomerSearchInput(): void {
    this.filterForm.get('customerId')?.setValue('');
  }

  selectCustomer(customer: any): void {
    this.filterForm.get('customerId')?.setValue(customer?.uniqueKeyID || '');
    this.customerSearch.setValue(customer?.uniqueKeyID ? this.displayCustomer(customer) : 'All Customers', { emitEvent: false });
  }

  runReport(): void {
    this.dateRangeError = '';
    if (this.filterForm.invalid) {
      this.filterForm.markAllAsTouched();
      this.dateRangeError = 'Select both a From Date and a To Date.';
      return;
    }
    const v = this.filterForm.getRawValue();
    const fromDate = this.toIsoDate(v.fromDate);
    const toDate = this.toIsoDate(v.toDate);
    if (!fromDate || !toDate) {
      this.dateRangeError = 'Enter valid From Date and To Date values.';
      return;
    }
    if (fromDate > toDate) {
      this.dateRangeError = 'From Date must be on or before To Date.';
      return;
    }

    this.reportType = v.reportType;
    this.loading    = true;
    this.reportRequest$.next();
    this.dataSource.data = [];
    this.clearTotals();

    this.invoiceSvc.getSalesReport({
      companyId:  this.cid(),
      customerId: v.customerId || undefined,
      fromDate:   this.toIsoDate(v.fromDate),
      toDate:     this.toIsoDate(v.toDate),
      reportType: v.reportType || 'summary'
    }).pipe(takeUntil(this.destroy$), takeUntil(this.reportRequest$))
      .subscribe({
        next: (r: any) => {
          const data = Array.isArray(r?.data) ? r.data : [];
          this.dataSource.data = data;
          this.calcTotals(data);
          this.loading = false;
        },
        error: (error: any) => {
          this.toastr.error(error?.error?.errorMessage || 'Failed to load report');
          this.loading = false;
        }
      });
  }

  getSerialNumber(index: number): number {
    return (this.paginatorRef?.pageIndex || 0) * (this.paginatorRef?.pageSize || 500) + index + 1;
  }

  printReport(): void {
    if (this.loading || this.dataSource.filteredData.length === 0) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      this.toastr.error('Allow pop-ups to print the report.');
      return;
    }

    try {
      const pdf = this.createReportPdf();
      pdf.autoPrint();
      printWindow.location.href = pdf.output('bloburl').toString();
    } catch (error) {
      printWindow.close();
      console.error('Sales report PDF generation failed:', error);
      this.toastr.error('Unable to generate the sales report PDF.');
    }
  }

  sendReport(): void {
    if (this.loading || this.reportEmailSending || this.dataSource.data.length === 0) return;
    const companyId = this.cid();
    if (!companyId) {
      this.toastr.error('Select a company before sending the report.');
      return;
    }

    this.reportEmailSending = true;
    try {
      const pdf = this.createReportPdf();
      const bytes = new Uint8Array(pdf.output('arraybuffer'));
      const binary: string[] = [];
      const chunkSize = 0x8000;
      for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary.push(String.fromCharCode(...bytes.subarray(offset, offset + chunkSize)));
      }

      this.invoiceSvc.emailSalesReport({
        companyId,
        reportName: this.reportType === 'returns' ? 'Sales Returns' : 'Sales Summary',
        pdfBase64: btoa(binary.join(''))
      }).pipe(takeUntil(this.destroy$)).subscribe({
        next: response => {
          this.reportEmailSending = false;
          if (String(response?.result || '').toLowerCase() !== 'pass') {
            this.toastr.error(response?.errorMessage || 'Failed to send the report email.');
            return;
          }
          this.toastr.success(response.message || 'Sales report sent to the registered company email.');
        },
        error: (error: any) => {
          this.reportEmailSending = false;
          this.toastr.error(error?.error?.errorMessage || error?.message || 'Failed to send the report email.');
        }
      });
    } catch (error) {
      this.reportEmailSending = false;
      console.error('Sales report PDF generation failed:', error);
      this.toastr.error('Unable to generate the sales report PDF.');
    }
  }

  private createReportPdf(): jsPDF {
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const margin = 12;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const rows = this.dataSource.filteredData;
    const from = this.toIsoDate(this.filterForm.value.fromDate) || '';
    const to = this.toIsoDate(this.filterForm.value.toDate) || '';
    const reportTitle = this.reportType === 'returns' ? 'Sales Returns' : 'Sales Summary';
    const currency = (value: number): string =>
      `INR ${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const date = (value?: string | Date): string => {
      if (!value) return '-';
      const parsed = value instanceof Date
        ? value
        : /^\d{4}-\d{2}-\d{2}$/.test(value)
          ? new Date(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10)))
          : new Date(value);
      return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleDateString('en-GB');
    };

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.text(reportTitle, margin, 16);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.text(`Period: ${date(from)} to ${date(to)}  |  Generated: ${date(new Date())}`, margin, 23);

    let y = 31;
    if (this.reportType === 'returns') {
      const total = rows.reduce((sum, row) => sum + Number(row.grandTotal || 0), 0);
      pdf.text(`Return records: ${rows.length}  |  Total return value: ${currency(total)}`, margin, y);
    } else {
      const invoiced = rows.reduce((sum, row) => sum + Number(row.totalAmount || 0), 0);
      const returns = rows.reduce((sum, row) => sum + Number(row.totalReturns || 0), 0);
      const net = rows.reduce((sum, row) => sum + Number(row.netAmount || 0), 0);
      pdf.text(`Invoices: ${rows.length}  |  Total invoiced: ${currency(invoiced)}  |  Returns: ${currency(returns)}  |  Net revenue: ${currency(net)}`, margin, y);
    }
    y += 7;

    const headers = this.reportType === 'returns'
      ? ['#', 'Return #', 'Invoice #', 'Date', 'Customer', 'Type', 'Amount', 'Credit Note', 'Reason']
      : ['#', 'Invoice #', 'Display #', 'Date', 'Customer', 'Invoiced', 'Returns', 'Net', 'Approved', 'Locked'];
    const columns = this.reportType === 'returns'
      ? rows.map((row, index) => [
          String(index + 1), row.returnNo || '-', row.invoiceNumber || '-', date(row.returnDate),
          row.customerName || '-', row.returnType || '-', currency(row.grandTotal),
          row.creditNoteNo || '-', row.reason || '-'
        ])
      : rows.map((row, index) => [
          String(index + 1), row.invoiceNumber || '-', row.displayInvNumber || '-', date(row.invoiceDate),
          row.customerName || '-', currency(row.totalAmount), currency(row.totalReturns),
          currency(row.netAmount), row.isApproved ? 'Yes' : 'No', row.isLocked ? 'Yes' : 'No'
        ]);
    const columnWidth = (pageWidth - margin * 2) / headers.length;
    const drawHeader = (): void => {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7);
      pdf.setFillColor(40, 71, 125);
      pdf.setTextColor(255, 255, 255);
      pdf.rect(margin, y, pageWidth - margin * 2, 8, 'F');
      headers.forEach((header, index) =>
        pdf.text(header, margin + index * columnWidth + 1.5, y + 5.2, { maxWidth: columnWidth - 3 })
      );
      y += 8;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(6.5);
      pdf.setTextColor(35, 42, 52);
    };
    drawHeader();
    columns.forEach((cells, rowIndex) => {
      const lines = cells.map(cell => pdf.splitTextToSize(String(cell), columnWidth - 3) as string[]);
      const rowHeight = Math.max(7, ...lines.map(cellLines => cellLines.length * 3.5 + 3));
      if (y + rowHeight > pageHeight - 12) {
        pdf.addPage();
        y = 12;
        drawHeader();
      }
      if (rowIndex % 2 === 0) {
        pdf.setFillColor(245, 247, 250);
        pdf.rect(margin, y, pageWidth - margin * 2, rowHeight, 'F');
      }
      pdf.setDrawColor(220, 225, 232);
      pdf.rect(margin, y, pageWidth - margin * 2, rowHeight);
      lines.forEach((cellLines, index) => {
        pdf.text(cellLines, margin + index * columnWidth + 1.5, y + 4.5, { maxWidth: columnWidth - 3 });
      });
      y += rowHeight;
    });
    return pdf;
  }

  exportCsv(): void {
    const v = this.filterForm.value;
    this.exporting = true;

    this.invoiceSvc.exportSalesCsv({
      companyId:  this.cid(),
      customerId: v.customerId || undefined,
      fromDate:   this.toIsoDate(v.fromDate),
      toDate:     this.toIsoDate(v.toDate),
      reportType: v.reportType || 'summary'
    }).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob: Blob) => {
          const url  = URL.createObjectURL(blob);
          const a    = document.createElement('a');
          const type = v.reportType === 'returns' ? 'SalesReturns' : 'SalesReport';
          a.href     = url;
          a.download = `${type}_${new Date().toISOString().split('T')[0]}.csv`;
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
    this.paginatorRef?.firstPage();
  }

  private calcTotals(rows: any[]): void {
    if (this.reportType !== 'returns') {
      this.totalInvoiced = rows.reduce((s, r) => s + (r.totalAmount   || 0), 0);
      this.totalReturns  = rows.reduce((s, r) => s + (r.totalReturns  || 0), 0);
      this.totalNet      = rows.reduce((s, r) => s + (r.netAmount     || 0), 0);
    } else {
      this.totalReturns  = rows.reduce((s, r) => s + (r.grandTotal    || 0), 0);
    }
  }

  private clearTotals(): void {
    this.totalInvoiced = 0;
    this.totalReturns  = 0;
    this.totalNet      = 0;
  }
}
