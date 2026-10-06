// src/app/Component/sales-returns/sales-returns.component.ts
//
// Dedicated Sales Returns management page — separate from Sales Reports
// for navigation parity with the Purchase module (which has distinct
// purchase-returns vs purchase-reports pages). Reuses the SAME backend
// endpoint as Sales Reports (GET /api/Invoice/Report?reportType=returns
// and /Report/Export), since that already returns exactly this data —
// no backend changes were needed for this page.
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

const SALES_RETURNS_DATE_FORMATS = {
  parse: { dateInput: { day: '2-digit', month: '2-digit', year: 'numeric' } },
  display: {
    dateInput: { day: '2-digit', month: '2-digit', year: 'numeric' },
    monthYearLabel: { month: 'short', year: 'numeric' },
    dateA11yLabel: { day: 'numeric', month: 'long', year: 'numeric' },
    monthYearA11yLabel: { month: 'long', year: 'numeric' }
  }
};

@Injectable()
class SalesReturnsDateAdapter extends NativeDateAdapter {
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
  selector: 'app-sales-returns',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule],
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'en-GB' },
    { provide: DateAdapter, useClass: SalesReturnsDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: SALES_RETURNS_DATE_FORMATS }
  ],
  templateUrl: './sales-returns.component.html',
  styleUrls: ['./sales-returns.component.css']
})
export class SalesReturnsComponent implements OnInit, OnDestroy {

  filterForm!: FormGroup;
  loading     = false;
  exporting   = false;
  dateRangeError = '';
  readonly pageSizeOptions = [10, 20, 50, 100, 200, 500, 1000];

  dataSource = new MatTableDataSource<any>();
  customers: any[] = [];
  filteredCustomers: any[] = [];
  customerSearch = new FormControl('', { nonNullable: true });
  readonly allCustomersOption = { uniqueKeyID: '', name: 'All Customers' };

  displayedColumns = [
    'serialNumber', 'returnNo', 'invoiceNumber', 'returnDate',
    'customerName', 'returnType', 'refundDate', 'paymentMode',
    'grandTotal', 'creditNoteNo', 'reason'
  ];

  // Totals
  totalReturnsValue = 0;

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

  private updateFilteredCustomers(): void {
    const query = this.customerSearch.value.trim().toLocaleLowerCase();
    this.filteredCustomers = !query || query === 'all customers'
      ? this.customers
      : this.customers.filter(customer =>
      [customer.name, customer.customer_company, customer.uniqueKeyID, customer.email, customer.emailId, customer.phone, customer.mobileNo]
        .some(value => String(value || '').toLocaleLowerCase().includes(query))
    );
  }

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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.reportRequest$.complete();
  }

  private buildForm(): void {
    const today = new Date();
    const assessmentYearStart = new Date(today.getFullYear() - (today.getMonth() < 3 ? 1 : 0), 3, 1);
    assessmentYearStart.setHours(0, 0, 0, 0);
    const assessmentYearEnd = new Date(assessmentYearStart.getFullYear() + 1, 2, 31);

    this.filterForm = this.fb.group({
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
          this.updateFilteredCustomers();
        },
        error: () => this.toastr.error('Failed to load customers')
      });
  }

  displayCustomer(value: any): string {
    if (typeof value === 'string') return value;
    if (value === this.allCustomersOption || !value?.uniqueKeyID) return 'All Customers';
    return value?.name || value?.customer_company || '';
  }

  onCustomerSearchInput(): void {
    this.filterForm.get('customerId')?.setValue('');
    this.updateFilteredCustomers();
  }

  selectCustomer(customer: any): void {
    this.filterForm.get('customerId')?.setValue(customer?.uniqueKeyID || '');
    this.customerSearch.setValue(customer?.uniqueKeyID ? this.displayCustomer(customer) : 'All Customers', { emitEvent: false });
    this.updateFilteredCustomers();
  }

  getSerialNumber(index: number): number {
    return (this.paginatorRef?.pageIndex || 0) * (this.paginatorRef?.pageSize || 500) + index + 1;
  }

  private validDateRange(): { fromDate: string; toDate: string } | null {
    this.dateRangeError = '';
    const { fromDate, toDate } = this.filterForm.getRawValue();
    if (!fromDate || !toDate) {
      this.filterForm.markAllAsTouched();
      this.dateRangeError = 'Select both a From Date and a To Date.';
      return null;
    }
    const from = this.toIsoDate(fromDate);
    const to = this.toIsoDate(toDate);
    if (!from || !to) {
      this.dateRangeError = 'Enter valid From Date and To Date values.';
      return null;
    }
    if (from > to) {
      this.dateRangeError = 'From Date must be on or before To Date.';
      return null;
    }
    return { fromDate: from, toDate: to };
  }

  runReport(): void {
    const range = this.validDateRange();
    if (!range) return;
    const v = this.filterForm.getRawValue();
    this.loading = true;
    this.dataSource.data = [];
    this.totalReturnsValue = 0;
    this.reportRequest$.next();

    this.invoiceSvc.getSalesReport({
      companyId:  this.cid(),
      customerId: v.customerId || undefined,
      fromDate:   range.fromDate,
      toDate:     range.toDate,
      reportType: 'returns'
    }).pipe(takeUntil(this.destroy$), takeUntil(this.reportRequest$))
      .subscribe({
        next: (r: any) => {
          const data = Array.isArray(r?.data) ? r.data : [];
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
    const range = this.validDateRange();
    if (!range) return;
    const v = this.filterForm.getRawValue();
    this.exporting = true;

    this.invoiceSvc.exportSalesCsv({
      companyId:  this.cid(),
      customerId: v.customerId || undefined,
      fromDate:   range.fromDate,
      toDate:     range.toDate,
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

  formatAmount(value: number): string {
    return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0));
  }

  printReport(): void {
    if (this.loading || this.dataSource.filteredData.length === 0) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      this.toastr.error('Allow pop-ups to print the sales returns report.');
      return;
    }
    try {
      const pdf = this.createReportPdf();
      pdf.autoPrint();
      printWindow.location.href = pdf.output('bloburl').toString();
    } catch (error) {
      printWindow.close();
      console.error('Sales returns PDF generation failed:', error);
      this.toastr.error('Unable to generate the sales returns PDF.');
    }
  }

  downloadPdf(): void {
    if (this.dataSource.filteredData.length === 0) return;
    this.createReportPdf().save(`SalesReturns_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  exportExcel(): void {
    const rows = this.dataSource.filteredData;
    if (rows.length === 0) return;
    const esc = (value: unknown): string => String(value ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    const textCell = (value: unknown): string => `<Cell><Data ss:Type="String">${esc(value)}</Data></Cell>`;
    const numberCell = (value: number): string => `<Cell ss:StyleID="amount"><Data ss:Type="Number">${Number(value || 0)}</Data></Cell>`;
    const headers = ['Return #', 'Invoice #', 'Return Date', 'Customer', 'Type', 'Refund Date', 'Payment Mode', 'Amount', 'Credit Note #', 'Reason'];
    const body = rows.map(row => `<Row>${[
      textCell(row.returnNo), textCell(row.invoiceNumber), textCell(this.formatDate(row.returnDate)),
      textCell(row.customerName), textCell(row.returnType), textCell(row.refundDate ? this.formatDate(row.refundDate) : ''),
      textCell(row.paymentMode), numberCell(row.grandTotal),
      textCell(row.creditNoteNo), textCell(row.reason)
    ].join('')}</Row>`).join('');
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <?mso-application progid="Excel.Sheet"?>
      <Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
        xmlns:o="urn:schemas-microsoft-com:office:office"
        xmlns:x="urn:schemas-microsoft-com:office:excel"
        xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
        <Styles><Style ss:ID="amount"><NumberFormat ss:Format="₹ #,##,##0.00"/></Style></Styles>
        <Worksheet ss:Name="Sales Returns"><Table>
          <Row>${headers.map(textCell).join('')}</Row>${body}
        </Table></Worksheet>
      </Workbook>`;
    this.downloadBlob(new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' }),
      `SalesReturns_${new Date().toISOString().slice(0, 10)}.xls`);
  }

  private createReportPdf(): jsPDF {
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const rows = this.dataSource.filteredData;
    const margin = 12;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const from = this.toIsoDate(this.filterForm.value.fromDate) || '';
    const to = this.toIsoDate(this.filterForm.value.toDate) || '';
    const total = rows.reduce((sum, row) => sum + Number(row.grandTotal || 0), 0);
    const headers = ['#', 'Return #', 'Invoice #', 'Date', 'Customer', 'Type', 'Refund Date', 'Mode', 'Amount', 'Credit Note', 'Reason'];
    const formatDate = (value: string | Date): string => this.formatDate(value);
    const data = rows.map((row, index) => [
      String(index + 1), row.returnNo || '-', row.invoiceNumber || '-', formatDate(row.returnDate),
      row.customerName || '-', row.returnType || '-', row.refundDate ? formatDate(row.refundDate) : '-',
      row.paymentMode || '-', `INR ${this.formatAmount(row.grandTotal)}`,
      row.creditNoteNo || '-', row.reason || '-'
    ]);
    const colWidth = (pageWidth - margin * 2) / headers.length;
    let y = 17;
    const drawHeader = (): void => {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7);
      pdf.setFillColor(40, 71, 125);
      pdf.setTextColor(255, 255, 255);
      pdf.rect(margin, y, pageWidth - margin * 2, 8, 'F');
      headers.forEach((header, index) => pdf.text(header, margin + index * colWidth + 1.5, y + 5.2, { maxWidth: colWidth - 3 }));
      y += 8;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(6.5);
      pdf.setTextColor(35, 42, 52);
    };
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(15);
    pdf.text('Sales Returns', margin, y);
    y += 7;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.text(`Period: ${this.formatDate(from)} to ${this.formatDate(to)}  |  Returns: ${rows.length}  |  Total: INR ${this.formatAmount(total)}`, margin, y);
    y += 7;
    drawHeader();
    data.forEach((cells, rowIndex) => {
      const lines = cells.map(value => pdf.splitTextToSize(String(value), colWidth - 3) as string[]);
      const rowHeight = Math.max(7, ...lines.map(parts => parts.length * 3.5 + 3));
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
      lines.forEach((parts, index) => pdf.text(parts, margin + index * colWidth + 1.5, y + 4.5, { maxWidth: colWidth - 3 }));
      y += rowHeight;
    });
    return pdf;
  }

  private formatDate(value: string | Date): string {
    if (!value) return '-';
    const date = value instanceof Date
      ? value
      : /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? new Date(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10)))
        : new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('en-GB');
  }

  private downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}
