// src/app/Component/purchase/purchase-reports/purchase-reports.component.ts
import { Component, Injectable, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE, NativeDateAdapter } from '@angular/material/core';
import { ToastrService } from 'ngx-toastr';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { PurchaseService } from '../../../_service/purchase.service';
import { AuthService } from '../../../_service/authentication.service';
import { SelectedCompanyService } from '../../../_service/selected-company.service';
import { CompanyNumberPipe } from '../../../_pipe/company-number.pipe';
import { CompanyNumberFormatService } from '../../../_service/company-number-format.service';
import { jsPDF } from 'jspdf';
import {
  PurchaseRegisterRow, VendorOutstanding, PurchaseLedgerEntry, StockSummary, Vendor
} from '../../../_model/purchase.model';

const REPORT_DATE_FORMATS = {
  parse: { dateInput: { day: '2-digit', month: '2-digit', year: 'numeric' } },
  display: {
    dateInput: { day: '2-digit', month: '2-digit', year: 'numeric' },
    monthYearLabel: { month: 'short', year: 'numeric' },
    dateA11yLabel: { day: 'numeric', month: 'long', year: 'numeric' },
    monthYearA11yLabel: { month: 'long', year: 'numeric' }
  }
};

@Injectable()
class ReportDateAdapter extends NativeDateAdapter {
  override format(date: Date, _displayFormat: unknown): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${date.getFullYear()}`;
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
  selector: 'app-purchase-reports',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule, CompanyNumberPipe],
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'en-GB' },
    { provide: DateAdapter, useClass: ReportDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: REPORT_DATE_FORMATS }
  ],
  templateUrl: './purchase-reports.component.html',
  styleUrls: ['../purchase-shared.css', './purchase-reports.component.css']
})
export class PurchaseReportsComponent implements OnInit, OnDestroy {
  activeTab = 0;
  reportEmailSending = false;

  /* ── Purchase Register ─────────────────────────────────────── */
  registerForm!: FormGroup;
  registerRows:  PurchaseRegisterRow[] = [];
  regLoading   = false;
  regCols      = ['piNumber','invoiceDate','vendorName','subtotal','totalGstAmount','grandTotal','paidAmount','outstandingAmount','status'];

  /* ── Vendor Outstanding ────────────────────────────────────── */
  outstanding:    VendorOutstanding[] = [];
  outLoading    = false;
  outCols       = ['vendorName','totalPurchased','totalPaid','outstandingAmount','overdueAmount','overdueInvoices','oldestDueDate'];

  /* ── Vendor Ledger ─────────────────────────────────────────── */
  ledgerForm!: FormGroup;
  ledgerRows:   PurchaseLedgerEntry[] = [];
  ledLoading  = false;
  ledCols     = ['referenceDate','referenceType','referenceNumber','debitAmount','creditAmount','outstandingAmount','dueDate'];
  vendors:     Vendor[] = [];
  vendorSearch = new FormControl('', { nonNullable: true });
  runningBalance = 0;

  /* ── Stock Summary ─────────────────────────────────────────── */
  stockRows:   StockSummary[] = [];
  stkLoading = false;
  stkCols    = ['productName','stockQty','minStockQty','reorderLevel','lastPurchaseRate','lastPurchaseDate','status'];

  private destroy$ = new Subject<void>();

  constructor(
    private svc: PurchaseService,
    private fb: FormBuilder,
    private toastr: ToastrService,
    private auth: AuthService,
    private selectedCo: SelectedCompanyService,
    private numberFormat: CompanyNumberFormatService
  ) {}

  ngOnInit(): void {
    this.buildForms();
    this.selectedCo.selectedCompanyId$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.loadRegister();
      this.loadVendors();
      this.loadOutstanding();
      this.loadStock();
    });
  }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  private cid = () => this.selectedCo.getSelectedCompanyId() || this.auth.getCompanyId() || '';

  get isReportLoading(): boolean {
    return [this.regLoading, this.outLoading, this.ledLoading, this.stkLoading][this.activeTab] ?? false;
  }

  buildForms(): void {
    const now = new Date();
    const from = new Date(now.getFullYear() - (now.getMonth() < 3 ? 1 : 0), 3, 1);
    const to = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    this.registerForm = this.fb.group({ from: [from, Validators.required], to: [to, Validators.required] });
    this.ledgerForm   = this.fb.group({ vendorId: ['', Validators.required] });
  }

  private toDateInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private rowsFrom<T>(response: any): T[] {
    const rows = response?.data ?? response?.Data ?? response?.items ?? response?.Items ?? response;
    return Array.isArray(rows) ? rows : [];
  }

  get filteredVendors(): Vendor[] {
    const query = this.vendorSearch.value.trim().toLocaleLowerCase();
    if (!query) return this.vendors;
    return this.vendors.filter(vendor =>
      [vendor.vendorName, vendor.vendorId, vendor.gstin, vendor.phone, vendor.mobile, vendor.email, vendor.contactPerson]
        .some(value => String(value || '').toLocaleLowerCase().includes(query))
    );
  }

  displayVendor(value: Vendor | string | null): string {
    return typeof value === 'string' ? value : (value?.vendorName || '');
  }

  onVendorSearchInput(): void {
    const selectedVendor = this.vendors.find(vendor => vendor.vendorId === this.ledgerForm.get('vendorId')?.value);
    if (selectedVendor?.vendorName !== this.vendorSearch.value) {
      this.ledgerForm.get('vendorId')?.setValue('');
    }
  }

  selectVendor(vendor: Vendor): void {
    this.ledgerForm.get('vendorId')?.setValue(vendor.vendorId || '');
    this.vendorSearch.setValue(vendor.vendorName || '', { emitEvent: false });
  }

  private showApiFailure(response: any, fallback: string): boolean {
    const result = response?.result ?? response?.Result;
    if (String(result || '').toLowerCase() !== 'fail') return false;
    this.toastr.error(response?.errorMessage || response?.ErrorMessage || fallback);
    return true;
  }

  loadVendors(): void {
    this.svc.getVendors(this.cid()).pipe(takeUntil(this.destroy$)).subscribe({
      next: (r: any) => {
        const vendors = this.showApiFailure(r, 'Failed to load vendors') ? [] : this.rowsFrom<Vendor>(r);
        this.vendors = [...vendors].sort((a, b) =>
          (a.vendorName || '').localeCompare(b.vendorName || '', undefined, { sensitivity: 'base', numeric: true })
        );
      },
      error: (error: any) => this.toastr.error(error?.error?.errorMessage || error?.message || 'Failed to load vendors')
    });
  }

  // ── Purchase Register ──────────────────────────────────────────
  loadRegister(): void {
    if (this.registerForm.invalid) return;
    this.regLoading = true;
    const { from, to } = this.registerForm.value;
    this.svc.getPurchaseRegister(this.cid(), this.toDateInput(from), this.toDateInput(to)).pipe(takeUntil(this.destroy$)).subscribe({
      next: (r: any) => {
        this.registerRows = this.showApiFailure(r, 'Failed to load register') ? [] : this.rowsFrom<PurchaseRegisterRow>(r);
        this.regLoading = false;
      },
      error: (error: any) => {
        this.toastr.error(error?.error?.errorMessage || error?.error?.ErrorMessage || error?.message || 'Failed to load register');
        this.regLoading = false;
      }
    });
  }

  get regTotalGrand(): number { return this.registerRows.reduce((s, r) => s + r.grandTotal, 0); }
  get regTotalPaid():  number { return this.registerRows.reduce((s, r) => s + r.paidAmount, 0); }
  get regTotalDue():   number { return this.registerRows.reduce((s, r) => s + r.outstandingAmount, 0); }
  get regTotalGst():   number { return this.registerRows.reduce((s, r) => s + r.totalGstAmount, 0); }

  // ── Vendor Outstanding ─────────────────────────────────────────
  loadOutstanding(): void {
    this.outLoading = true;
    this.svc.getVendorOutstanding(this.cid()).pipe(takeUntil(this.destroy$)).subscribe({
      next: (r: any) => {
        this.outstanding = this.showApiFailure(r, 'Failed to load outstanding') ? [] : this.rowsFrom<VendorOutstanding>(r);
        this.outLoading = false;
      },
      error: () => { this.toastr.error('Failed to load outstanding'); this.outLoading = false; }
    });
  }

  get outTotalDue():     number { return this.outstanding.reduce((s, o) => s + o.outstandingAmount, 0); }
  get outTotalOverdue(): number { return this.outstanding.reduce((s, o) => s + o.overdueAmount, 0); }

  // ── Vendor Ledger ──────────────────────────────────────────────
  loadLedger(): void {
    if (this.ledgerForm.invalid) return;
    this.ledLoading = true;
    const { vendorId } = this.ledgerForm.value;
    this.svc.getVendorLedger(vendorId, this.cid()).pipe(takeUntil(this.destroy$)).subscribe({
      next: (r: any) => {
        const rows = this.showApiFailure(r, 'Failed to load ledger')
          ? []
          : this.rowsFrom<PurchaseLedgerEntry>(r);
        let balanceInCents = 0;
        const balancesByLedgerId = new Map<number, number>();

        [...rows]
          .sort((a, b) => {
            const dateA = Date.parse(a.referenceDate);
            const dateB = Date.parse(b.referenceDate);
            const chronologicalDifference = (Number.isFinite(dateA) ? dateA : 0)
              - (Number.isFinite(dateB) ? dateB : 0);
            return chronologicalDifference || a.ledgerId - b.ledgerId;
          })
          .forEach(row => {
            balanceInCents += Math.round((Number(row.creditAmount) || 0) * 100)
              - Math.round((Number(row.debitAmount) || 0) * 100);
            balancesByLedgerId.set(row.ledgerId, balanceInCents / 100);
          });

        this.ledgerRows = rows.map(row => ({
          ...row,
          outstandingAmount: balancesByLedgerId.get(row.ledgerId) ?? 0
        }));
        this.runningBalance = balanceInCents / 100;
        this.ledLoading = false;
      },
      error: () => { this.toastr.error('Failed to load ledger'); this.ledLoading = false; }
    });
  }

  get ledgerVendorName(): string {
    const vid = this.ledgerForm.get('vendorId')?.value;
    return this.vendors.find(vendor => vendor.vendorId === vid)?.vendorName || '';
  }

  // ── Stock Summary ──────────────────────────────────────────────
  loadStock(): void {
    this.stkLoading = true;
    this.svc.getStockSummary(this.cid()).pipe(takeUntil(this.destroy$)).subscribe({
      next: (r: any) => {
        this.stockRows = this.showApiFailure(r, 'Failed to load stock summary') ? [] : this.rowsFrom<StockSummary>(r);
        this.stkLoading = false;
      },
      error: () => { this.toastr.error('Failed to load stock'); this.stkLoading = false; }
    });
  }

  get stockBelowReorder(): number { return this.stockRows.filter(s => s.isBelowReorder).length; }
  get stockOutOfStock():   number { return this.stockRows.filter(s => s.isOutOfStock).length; }
  get stockTotalItems():   number { return this.stockRows.length; }

  printCurrentReport(): void {
    if (this.isReportLoading) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      this.toastr.error('Allow pop-ups to print the report.');
      return;
    }

    try {
      const pdf = this.createCurrentReportPdf();
      pdf.autoPrint();
      printWindow.location.href = pdf.output('bloburl').toString();
    } catch (error) {
      printWindow.close();
      console.error('Purchase report PDF generation failed:', error);
      this.toastr.error('Unable to generate the report PDF.');
    }
  }

  sendCurrentReportEmail(): void {
    if (this.isReportLoading || this.reportEmailSending) return;
    const companyId = this.cid();
    if (!companyId) {
      this.toastr.error('Select a company before sending the report.');
      return;
    }

    this.reportEmailSending = true;
    try {
      const pdf = this.createCurrentReportPdf();
      const bytes = new Uint8Array(pdf.output('arraybuffer'));
      const binary: string[] = [];
      const chunkSize = 0x8000;
      for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary.push(String.fromCharCode(...bytes.subarray(offset, offset + chunkSize)));
      }
      const pdfBase64 = btoa(binary.join(''));

      this.svc.emailPurchaseReport({
        companyId,
        reportName: this.currentReportTitle,
        pdfBase64
      }).pipe(takeUntil(this.destroy$)).subscribe({
        next: response => {
          this.reportEmailSending = false;
          if (String(response?.result || '').toLowerCase() !== 'pass') {
            this.toastr.error(response?.errorMessage || 'Failed to send the report email.');
            return;
          }
          this.toastr.success(response.message || 'Report sent to the company email.');
        },
        error: (error: any) => {
          this.reportEmailSending = false;
          this.toastr.error(error?.error?.errorMessage || error?.message || 'Failed to send the report email.');
        }
      });
    } catch (error) {
      this.reportEmailSending = false;
      console.error('Purchase report PDF generation failed:', error);
      this.toastr.error('Unable to generate the report PDF.');
    }
  }

  private get currentReportTitle(): string {
    return ['Purchase Register', 'Vendor Outstanding', 'Vendor Ledger', 'Stock Summary'][this.activeTab]
      || 'Purchase Report';
  }

  private createCurrentReportPdf(): jsPDF {
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const margin = 12;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const report = this.currentReportData();
    let y = 16;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(17);
    pdf.setTextColor(31, 48, 78);
    pdf.text(this.currentReportTitle, margin, y);
    y += 7;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(95, 105, 120);
    pdf.text(`${report.subtitle}  |  Generated ${new Date().toLocaleString('en-GB')}`, margin, y);
    y += 7;

    if (report.summary.length > 0) {
      pdf.setFontSize(9);
      pdf.setTextColor(40, 48, 60);
      for (const summaryLine of report.summary) {
        const wrapped = pdf.splitTextToSize(summaryLine, pageWidth - margin * 2) as string[];
        pdf.text(wrapped, margin, y);
        y += wrapped.length * 4.5;
      }
      y += 2;
    }

    if (report.rows.length === 0) {
      pdf.setFontSize(11);
      pdf.setTextColor(100, 100, 100);
      pdf.text(report.emptyMessage, margin, y + 4);
    } else {
      const columnWidth = (pageWidth - margin * 2) / report.headers.length;
      const lineHeight = 4;
      const drawHeader = (): number => {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.setTextColor(255, 255, 255);
        pdf.setFillColor(40, 71, 125);
        pdf.rect(margin, y, pageWidth - margin * 2, 8, 'F');
        report.headers.forEach((header, index) => {
          pdf.text(header, margin + index * columnWidth + 2, y + 5.3, {
            maxWidth: columnWidth - 4
          });
        });
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(35, 42, 52);
        pdf.setFontSize(7.5);
        return y + 8;
      };

      y = drawHeader();
      for (const [rowIndex, row] of report.rows.entries()) {
        const cellLines = row.map(cell => pdf.splitTextToSize(cell || '-', columnWidth - 4) as string[]);
        const rowHeight = Math.max(7, ...cellLines.map(lines => lines.length * lineHeight + 3));
        if (y + rowHeight > pageHeight - 12) {
          pdf.addPage();
          y = 12;
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(9);
          pdf.setTextColor(65, 75, 90);
          pdf.text(this.currentReportTitle, margin, y);
          y += 4;
          y = drawHeader();
        }

        if (rowIndex % 2 === 0) {
          pdf.setFillColor(245, 247, 250);
          pdf.rect(margin, y, pageWidth - margin * 2, rowHeight, 'F');
        }
        pdf.setDrawColor(220, 225, 232);
        pdf.setLineWidth(0.15);
        pdf.rect(margin, y, pageWidth - margin * 2, rowHeight);
        for (let index = 1; index < report.headers.length; index++) {
          pdf.line(margin + index * columnWidth, y, margin + index * columnWidth, y + rowHeight);
        }
        cellLines.forEach((lines, index) => {
          pdf.text(lines, margin + index * columnWidth + 2, y + 4.5, {
            maxWidth: columnWidth - 4
          });
        });
        y += rowHeight;
      }
    }

    const pageCount = pdf.getNumberOfPages();
    for (let page = 1; page <= pageCount; page++) {
      pdf.setPage(page);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      pdf.setTextColor(125, 130, 140);
      pdf.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 5, { align: 'right' });
    }
    return pdf;
  }

  private currentReportData(): {
    subtitle: string;
    summary: string[];
    headers: string[];
    rows: string[][];
    emptyMessage: string;
  } {
    const currency = (value: number | undefined): string =>
      `INR ${this.numberFormat.format(value)}`;
    const quantity = (value: number | undefined): string =>
      this.numberFormat.format(value, '1.0-3');
    const date = (value?: string | Date): string => {
      if (!value) return '-';
      const parsed = value instanceof Date ? value : new Date(value);
      return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleDateString('en-GB');
    };

    switch (this.activeTab) {
      case 0: {
        const { from, to } = this.registerForm.value;
        return {
          subtitle: `Period: ${date(from)} to ${date(to)}`,
          summary: [
            `Total purchases: ${currency(this.regTotalGrand)}  |  GST: ${currency(this.regTotalGst)}  |  Paid: ${currency(this.regTotalPaid)}  |  Outstanding: ${currency(this.regTotalDue)}`
          ],
          headers: ['Invoice #', 'Date', 'Vendor', 'Taxable', 'GST', 'Total', 'Paid', 'Outstanding', 'Status'],
          rows: this.registerRows.map(row => [
            row.piNumber || '-', date(row.invoiceDate), row.vendorName || '-', currency(row.subtotal),
            currency(row.totalGstAmount), currency(row.grandTotal), currency(row.paidAmount),
            currency(row.outstandingAmount), row.status || '-'
          ]),
          emptyMessage: 'No purchase register rows are available for the selected period.'
        };
      }
      case 1:
        return {
          subtitle: 'Current vendor payables and overdue balances',
          summary: [
            `Vendors with dues: ${this.outstanding.length}  |  Total outstanding: ${currency(this.outTotalDue)}  |  Overdue: ${currency(this.outTotalOverdue)}`
          ],
          headers: ['Vendor', 'GSTIN', 'Purchased', 'Paid', 'Outstanding', 'Overdue', 'Overdue Bills', 'Oldest Due'],
          rows: this.outstanding.map(row => [
            row.vendorName || row.vendorId, row.gstin || '-', currency(row.totalPurchased), currency(row.totalPaid),
            currency(row.outstandingAmount), currency(row.overdueAmount), String(row.overdueInvoices || 0),
            date(row.oldestDueDate)
          ]),
          emptyMessage: 'No outstanding vendor balances are available.'
        };
      case 2:
        return {
          subtitle: `Vendor: ${this.ledgerVendorName || 'Not selected'}`,
          summary: this.ledgerRows.length > 0
            ? [`Balance payable: ${currency(this.runningBalance)}`]
            : [],
          headers: ['Date', 'Type', 'Reference', 'Debit (Payment)', 'Credit (Invoice)', 'Outstanding', 'Due Date'],
          rows: this.ledgerRows.map(row => [
            date(row.referenceDate), row.referenceType || '-', row.referenceNumber || '-',
            currency(row.debitAmount), currency(row.creditAmount), currency(row.outstandingAmount), date(row.dueDate)
          ]),
          emptyMessage: this.ledgerForm.get('vendorId')?.value
            ? 'No ledger entries are available for this vendor.'
            : 'Select a vendor and load the ledger to view its entries.'
        };
      default:
        return {
          subtitle: 'Current stock position',
          summary: [
            `Products: ${this.stockTotalItems}  |  Below reorder: ${this.stockBelowReorder}  |  Out of stock: ${this.stockOutOfStock}`
          ],
          headers: ['Product', 'Stock Qty', 'Min Qty', 'Reorder Level', 'Last Purchase Rate', 'Last Purchase', 'Status'],
          rows: this.stockRows.map(row => [
            row.productName || row.productId, quantity(row.stockQty), quantity(row.minStockQty),
            quantity(row.reorderLevel), row.lastPurchaseRate ? currency(row.lastPurchaseRate) : '-',
            date(row.lastPurchaseDate), row.isOutOfStock ? 'Out of Stock' : row.isBelowReorder ? 'Low Stock' : 'OK'
          ]),
          emptyMessage: 'No stock summary rows are available.'
        };
    }
  }

  onTabChange(idx: number): void {
    this.activeTab = idx;
    if (idx === 0) this.loadRegister();
    if (idx === 1) this.loadOutstanding();
    if (idx === 3) this.loadStock();
  }
}
