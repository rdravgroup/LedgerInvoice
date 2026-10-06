import { Component, OnInit, ViewChild, OnDestroy, HostListener, Injectable } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OverlayModule, ConnectedPosition } from '@angular/cdk/overlay';
import { MaterialModule } from '../../material.module';
import { ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MasterService } from '../../_service/master.service';
import { ToastrService } from 'ngx-toastr';
import { MatDialog } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE, NativeDateAdapter } from '@angular/material/core';
import { PreviewDialogComponent } from './preview-dialog.component';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AuthService } from '../../_service/authentication.service';
import { CompanyService } from '../../_service/company.service';
import { LoggerService } from '../../_service/logger.service';
import { SelectedCompanyService } from '../../_service/selected-company.service';
// CHANGE: Added company context banner and confirm dialog imports
import { CompanyContextBannerComponent } from '../company-context-banner/company-context-banner.component';
import {
  ConfirmDestructiveActionDialogComponent,
  ConfirmDestructiveDialogData
} from '../confirm-dialog/confirm-destructive-action-dialog.component';
// NEW: Invoice service for approve / lock / return
import { InvoiceService } from '../../_service/invoice.service';

const INVOICE_LIST_DATE_FORMATS = {
  parse: { dateInput: { day: '2-digit', month: '2-digit', year: 'numeric' } },
  display: {
    dateInput: { day: '2-digit', month: '2-digit', year: 'numeric' },
    monthYearLabel: { month: 'short', year: 'numeric' },
    dateA11yLabel: { day: 'numeric', month: 'long', year: 'numeric' },
    monthYearA11yLabel: { month: 'long', year: 'numeric' }
  }
};

@Injectable()
class InvoiceListDateAdapter extends NativeDateAdapter {
  override format(date: Date, _displayFormat: unknown): string {
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  }

  override parse(value: unknown): Date | null {
    if (typeof value !== 'string') return super.parse(value, '');
    const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return null;

    const day = Number(match[1]);
    const month = Number(match[2]) - 1;
    const year = Number(match[3]);
    const date = new Date(year, month, day);
    return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day
      ? date
      : null;
  }
}

interface Invoice {
  invNum: string;
  invoiceNumber: string;
  invDate: string;
  createDate?: string;
  cuName: string;
  coName: string;
  totalAmt: number;
  // NEW: approval, locking, returns
  isApproved?:  boolean;
  isLocked?:    boolean;
  approvedBy?:  string;
  approvedDate?: string;
  lockedBy?:    string;
  lockReason?:  string;
  totalReturns?: number;
}

@Component({
  selector: 'app-listinvoice',
  standalone: true,
  imports: [
    CommonModule,
    MaterialModule,
    OverlayModule,
    ReactiveFormsModule,
    RouterLink,
    // CHANGE: New shared components
    CompanyContextBannerComponent,
  ],
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'en-GB' },
    { provide: DateAdapter, useClass: InvoiceListDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: INVOICE_LIST_DATE_FORMATS }
  ],
  templateUrl: './listinvoice.component.html',
  styleUrls: ['./listinvoice.component.css'],
})
export class ListinvoiceComponent implements OnInit, OnDestroy {
  displayedColumns: string[] = ['serialNumber', 'invoiceNumber', 'invDate', 'cuName', 'totalAmt', 'status', 'actions'];
  dataSource = new MatTableDataSource<Invoice>();
  readonly pageSizeOptions = [10, 20, 50, 100, 200, 500, 1000];
  fromDate: Date | null = null;
  toDate: Date | null = null;
  appliedFromDate = '';
  appliedToDate = '';
  dateRangeError = '';

  loading = false;
  isMobile = false;
  isSuperAdmin = false;
  isSuperDuper = false;   // NEW: read-only role
  canApprove   = false;   // NEW: can approve/lock
  canReturn    = false;   // NEW: can create return
  actionConfig = {
    preview: true, pdf: true, posPrint: true, posPreview: true,
    email: true, whatsapp: true, statement: true
  };

  private paginator?: MatPaginator;
  private sort?: MatSort;

  @ViewChild(MatPaginator)
  set matPaginator(paginator: MatPaginator | undefined) {
    this.paginator = paginator;
    this.attachTableControls();
  }

  @ViewChild(MatSort)
  set matSort(sort: MatSort | undefined) {
    this.sort = sort;
    this.attachTableControls();
  }

  private destroy$ = new Subject<void>();
  private invoiceLoad$ = new Subject<void>();
  activeActionInvoiceNumber: string | null = null;

  // FIX: Actions popover rendered via CDK Overlay (attached to <body>) instead of an
  // absolutely-positioned child of the table cell. This stops the panel from being
  // clipped by the table card's `overflow: hidden` when there are few rows, and lets
  // it automatically flip above the trigger when there isn't room below (short lists,
  // small screens). Positions are tried in order until one fits the viewport.
  readonly actionPopoverPositions: ConnectedPosition[] = [
    { originX: 'end',   originY: 'bottom', overlayX: 'end',   overlayY: 'top',    offsetY: 8 },
    { originX: 'end',   originY: 'top',    overlayX: 'end',   overlayY: 'bottom', offsetY: -8 },
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top',    offsetY: 8 },
    { originX: 'start', originY: 'top',    overlayX: 'start', overlayY: 'bottom', offsetY: -8 },
  ];

  constructor(
    private service: MasterService,
    private invoiceSvc: InvoiceService,     // NEW
    private alert: ToastrService,
    private router: Router,
    private dialog: MatDialog,
    private auth: AuthService,
    private companySvc: CompanyService,
    private logger: LoggerService,
    private selectedCompanyService: SelectedCompanyService
  ) {
    this.checkMobile();
    const assessmentYearStart = new Date();
    if (assessmentYearStart.getMonth() < 3) assessmentYearStart.setFullYear(assessmentYearStart.getFullYear() - 1);
    assessmentYearStart.setMonth(3, 1);
    assessmentYearStart.setHours(0, 0, 0, 0);
    const assessmentYearEnd = new Date(assessmentYearStart.getFullYear() + 1, 2, 31);
    this.fromDate = assessmentYearStart;
    this.toDate = assessmentYearEnd;
    this.appliedFromDate = this.formatDateInput(assessmentYearStart);
    this.appliedToDate = this.formatDateInput(assessmentYearEnd);
    const role = (this.auth.getUserRole() || '').toLowerCase().replace(/-/g, '_');
    this.isSuperAdmin = role === 'super_admin' || role === 'superadmin' || role === 'super_duper_admin';
    this.isSuperDuper = role === 'super_duper_admin';
    this.canApprove   = !this.isSuperDuper && (role === 'super_admin' || role === 'admin');
    this.canReturn    = !this.isSuperDuper;
  }

  private checkMobile(): void {
    this.isMobile = window.innerWidth <= 768;
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.checkMobile();
  }

  ngOnInit(): void {
    // CHANGE: reload when super_admin switches company
    this.selectedCompanyService.selectedCompanyId$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.loadActionConfiguration();
      this.LoadInvoice();
    });
  }

  private loadActionConfiguration(): void {
    const companyId = this.selectedCompanyService.getSelectedCompanyId() || this.auth.getCompanyId();
    if (!companyId) return;
    this.companySvc.getCompanyById(companyId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (company: any) => {
        const value = (name: string, legacy: string): boolean => {
          const result = company?.[name] ?? company?.[legacy];
          return result === undefined || result === null ? true : !!result;
        };
        this.actionConfig = {
          preview: value('showActionPreview', 'ShowActionPreview'),
          pdf: value('showActionPdf', 'ShowActionPdf'),
          posPrint: value('showActionPosPrint', 'ShowActionPosPrint'),
          posPreview: value('showActionPosPreview', 'ShowActionPosPreview'),
          email: value('showActionEmail', 'ShowActionEmail'),
          whatsapp: value('showActionWhatsApp', 'ShowActionWhatsApp'),
          statement: value('showActionStatement', 'ShowActionStatement')
        };
      }
    });
  }


  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.invoiceLoad$.complete();
  }

  private formatDateInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  get mobilePageRows(): Invoice[] {
    const pageSize = this.paginator?.pageSize || 20;
    const start = (this.paginator?.pageIndex || 0) * pageSize;
    return this.dataSource.filteredData.slice(start, start + pageSize);
  }

  getMobileSerialNumber(index: number): number {
    return (this.paginator?.pageIndex || 0) * (this.paginator?.pageSize || 20) + index + 1;
  }

  getSerialNumber(index: number): number {
    return this.getMobileSerialNumber(index);
  }

  runDateFilter(): void {
    this.dateRangeError = '';
    if (!this.fromDate || !this.toDate) {
      this.dateRangeError = 'Select both a From Date and a To Date.';
      return;
    }
    const fromDate = this.formatDateInput(this.fromDate);
    const toDate = this.formatDateInput(this.toDate);
    if (fromDate > toDate) {
      this.dateRangeError = 'From Date must be on or before To Date.';
      return;
    }

    this.appliedFromDate = fromDate;
    this.appliedToDate = toDate;
    this.LoadInvoice();
  }

  printInvoices(): void {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      this.alert.error('Allow pop-ups to print the invoice list.', 'Print unavailable');
      return;
    }

    const escapeHtml = (value: unknown): string => String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    const formatDate = (value: string | undefined): string => {
      if (!value) return '';
      const dateOnly = value.slice(0, 10);
      const match = dateOnly.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (match) return `${match[3]}/${match[2]}/${match[1]}`;
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? '' : this.formatDateInput(date).split('-').reverse().join('/');
    };
    const rows = this.dataSource.filteredData.map((invoice, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(invoice.invNum || invoice.invoiceNumber)}</td>
        <td>${escapeHtml(formatDate(invoice.invDate))}</td>
        <td>${escapeHtml(invoice.cuName)}</td>
        <td class="amount">₹${Number(invoice.totalAmt || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>`).join('');

    printWindow.document.write(`<!doctype html>
      <html><head><title>Invoice List</title><meta charset="utf-8">
      <style>
        body{font:14px Arial,sans-serif;color:#222;padding:24px}
        h1{font-size:20px;margin:0 0 8px}
        p{margin:0 0 18px;color:#555}
        table{border-collapse:collapse;width:100%}
        th,td{border:1px solid #bbb;padding:8px;text-align:left}
        th{background:#eee}
        .amount{text-align:right;white-space:nowrap}
        @media print{body{padding:0}}
      </style></head><body>
      <h1>Invoice List</h1>
      <p>From ${escapeHtml(formatDate(this.appliedFromDate))} to ${escapeHtml(formatDate(this.appliedToDate))} · ${this.dataSource.filteredData.length} invoices</p>
      <table><thead><tr><th>#</th><th>Invoice #</th><th>Date</th><th>Customer</th><th>Amount</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}</script>
      </body></html>`);
    printWindow.document.close();
  }

  private attachTableControls(): void {
    this.dataSource.sortingDataAccessor = (item: any, property: string) => {
      if (property === 'invDate') return this.getInvoiceSortTime(item);
      return item?.[property] ?? '';
    };

    if (this.paginator) this.dataSource.paginator = this.paginator;
    if (this.sort) {
      this.dataSource.sort = this.sort;
    }
  }

  private getInvoiceSortTime(item: any): number {
    const dateVal = item?.invDate || item?.inv_date || item?.invdate
      || item?.createDate || item?.create_date || item?.createdAt || item?.CreateDate;
    const time = dateVal ? new Date(dateVal).getTime() : 0;
    return Number.isFinite(time) ? time : 0;
  }
  LoadInvoice(): void {
    this.invoiceLoad$.next();
    this.loading = true;
    if (this.paginator) this.paginator.firstPage();
    const performLoad = () => {
      const effectiveCompanyId = this.selectedCompanyService.getSelectedCompanyId() || this.auth.getCompanyId();
      this.service.GetAllInvoice(
        effectiveCompanyId ?? undefined,
        this.appliedFromDate,
        this.appliedToDate
      )
        .pipe(takeUntil(this.destroy$), takeUntil(this.invoiceLoad$))
        .subscribe({
          next: (res) => {
            // Normalise response to array
            let data: any = res;
            if (!Array.isArray(data)) {
              if (Array.isArray(data?.data)) data = data.data;
              else if (Array.isArray(data?.result)) data = data.result;
              else if (Array.isArray(data?.invoices)) data = data.invoices;
              else { for (const key in data) { if (Array.isArray(data[key])) { data = data[key]; break; } } }
            }
            if (Array.isArray(data)) {
              // Normalize date fields and assign createDate explicitly
              data = data.map((item: any) => {
                if (!item.createDate && item.create_date) item.createDate = item.create_date;
                if (!item.createDate && item.createdAt) item.createDate = item.createdAt;
                if (!item.createDate && item.CreateDate) item.createDate = item.CreateDate;
                if (!item.invDate && item.createDate) item.invDate = item.createDate;
                return item;
              });
              this.dataSource.data = data;
              this.closeActionPanel();
              this.attachTableControls();
            } else {
              this.alert.error('Invalid response format', 'Error');
            }
            this.loading = false;
          },
          error: (err) => {
            this.loading = false;
            if (this.handleSubscriptionExpired(err, () => this.LoadInvoice())) return;
            this.alert.error('Failed to load invoices.', 'Error');
          }
        });
    };
    performLoad();
  }
  toggleActionPanel(row: Invoice): void {
    this.activeActionInvoiceNumber = this.activeActionInvoiceNumber === row.invoiceNumber ? null : row.invoiceNumber;
  }

  closeActionPanel(): void {
    this.activeActionInvoiceNumber = null;
  }

  isActionPanelOpen(row: Invoice): boolean {
    return this.activeActionInvoiceNumber === row.invoiceNumber;
  }

  applyFilter(event: Event): void {
    this.dataSource.filter = (event.target as HTMLInputElement).value.trim().toLowerCase();
    if (this.dataSource.paginator) this.dataSource.paginator.firstPage();
  }

  /**
   * CHANGE: Replaced browser confirm() with ConfirmDestructiveActionDialogComponent.
   * Now shows invoice number, company name (critical context for super_admin),
   * and requires the user to type the invoice number to confirm.
   * Deletion logic is identical to the original.
   */
  invoiceremove(invoiceno: string, coName?: string): void {
    const effectiveCompanyId = this.selectedCompanyService.getSelectedCompanyId() || this.auth.getCompanyId();

    const dialogData: ConfirmDestructiveDialogData = {
      title:         'Delete Invoice',
      entityId:      invoiceno,
      entityType:    'Invoice',
      companyName:   coName,
      companyId:     effectiveCompanyId ?? undefined,
      isSuperAdmin:  this.isSuperAdmin,
      requireTyping: true   // user must type the invoice number — irreversible action
    };

    const ref = this.dialog.open(ConfirmDestructiveActionDialogComponent, {
      width: '460px',
      maxWidth: '96vw',
      data: dialogData
    });

    ref.afterClosed().pipe(takeUntil(this.destroy$)).subscribe((confirmed: boolean) => {
      if (!confirmed) return;
      this.service.RemoveInvoice(invoiceno)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (res: any) => {
            const success = res?.Result === 'pass' || res?.result === 'pass';
            if (success) {
              this.alert.success('Invoice deleted successfully.', 'Delete Invoice');
              this.LoadInvoice();
            } else {
              const message = res?.Message || res?.message || 'Failed to delete invoice.';
              this.alert.error(message, 'Invoice');
            }
          },
          error: (err) => {
            if (this.handleSubscriptionExpired(err, () => this.invoiceremove(invoiceno, coName))) return;
            this.alert.error('Failed to delete invoice.', 'Invoice');
          }
        });
    });
  }

  Editinvoice(invoiceno: string): void {
    this.router.navigate(['/editinvoice', invoiceno]);
  }

  PrintInvoice(invoiceno: string): void {
    this.service.GenerateInvoicePDF(invoiceno).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        if (res.body && res.body.size > 0) {
          const fileName = this.getPdfFileName(res.headers.get('Content-Disposition'), invoiceno, '');
          this.openOrSharePdf(res.body as Blob, fileName, `Invoice ${invoiceno}`);
        } else { this.alert.error('PDF file is empty', 'Error'); }
      },
      error: (err) => {
        if (this.handleSubscriptionExpired(err, () => this.PrintInvoice(invoiceno))) return;
        this.alert.error(`Failed to print invoice ${invoiceno}`, 'Error');
      }
    });
  }

  DownloadInvoice(invoiceno: string): void {
    this.service.GenerateInvoicePDF(invoiceno).pipe(takeUntil(this.destroy$)).subscribe({
      next: async (res) => {
        if (res.body && res.body.size > 0) {
          const fileName = this.getPdfFileName(res.headers.get('Content-Disposition'), invoiceno, '');
          await this.savePdf(res.body as Blob, fileName, `Invoice ${invoiceno}`);
        } else { this.alert.error('PDF file is empty', 'Error'); }
      },
      error: (err) => {
        if (this.handleSubscriptionExpired(err, () => this.DownloadInvoice(invoiceno))) return;
        this.alert.error(`Failed to download invoice ${invoiceno}`, 'Error');
      }
    });
  }

  PosPrintInvoice(invoiceno: string): void {
    this.service.GeneratePosReceipt(invoiceno).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        if (res.body && res.body.size > 0) {
          const fileName = `pos_${invoiceno.replace(/[\\/:*?"<>|]/g, '_')}.bin`;
          this.downloadBlob(res.body as Blob, fileName);
          this.alert.success('ESC/POS receipt data downloaded for the Wepsol Hook printer.', 'POS Print');
        } else {
          this.alert.error('POS receipt data is empty', 'POS Print');
        }
      },
      error: (err) => {
        if (this.handleSubscriptionExpired(err, () => this.PosPrintInvoice(invoiceno))) return;
        this.alert.error(`Failed to prepare POS receipt ${invoiceno}`, 'POS Print');
      }
    });
  }

  PosPreviewInvoice(invoiceno: string): void {
    this.service.GeneratePosReceiptPreview(invoiceno).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        if (res.body && res.body.size > 0) {
          const fileName = this.getPdfFileName(res.headers.get('Content-Disposition'), invoiceno, 'pos_preview');
          this.openOrSharePdf(res.body as Blob, fileName, `POS receipt preview ${invoiceno}`);
        } else {
          this.alert.error('POS preview PDF is empty', 'POS Preview');
        }
      },
      error: (err) => {
        if (this.handleSubscriptionExpired(err, () => this.PosPreviewInvoice(invoiceno))) return;
        this.alert.error(`Failed to preview POS receipt ${invoiceno}`, 'POS Preview');
      }
    });
  }
  private isAndroidWebView(): boolean {
    const ua = navigator.userAgent || '';
    return /Android/i.test(ua) && (/wv\)/i.test(ua) || /Version\/\d+\.\d+/i.test(ua));
  }

  private async savePdf(blob: Blob, fileName: string, title: string): Promise<void> {
    const pdfBlob = blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
    const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
    const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };

    if (this.isAndroidWebView() && navigator.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
      try {
        await navigator.share({ title, text: title, files: [file] });
        this.alert.success(`${fileName} ready to save/share`, 'PDF');
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }

    this.downloadBlob(pdfBlob, fileName);
  }

  private openOrSharePdf(blob: Blob, fileName: string, title: string): void {
    if (this.isAndroidWebView()) {
      void this.savePdf(blob, fileName, title);
      return;
    }

    const url = window.URL.createObjectURL(blob);
    const opened = window.open(url, '_blank');
    if (!opened) {
      this.downloadBlob(blob, fileName);
    }
    setTimeout(() => window.URL.revokeObjectURL(url), 30000);
  }

  private downloadBlob(blob: Blob, fileName: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = fileName;
    a.href = url;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  }

  private getPdfFileName(contentDisposition: string | null, invoiceno: string, prefix: string): string {
    const utf8Match = contentDisposition?.match(/filename\*=UTF-8''([^;]+)/i);
    const standardMatch = contentDisposition?.match(/filename="?([^";]+)"?/i);
    const fileName = utf8Match?.[1] || standardMatch?.[1];

    if (fileName) {
      try {
        return decodeURIComponent(fileName);
      } catch {
        return fileName;
      }
    }

    const safeInvoiceNo = invoiceno.replace(/[\\/:*?"<>|]/g, '_');
    return `${prefix ? `${prefix}_` : ''}${safeInvoiceNo}.pdf`;
  }

  PreviewInvoice(invoiceno: string): void {
    this.service.GenerateInvoicePDF(invoiceno).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        if (res.body && res.body.size > 0) {
          const blob = new Blob([res.body], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          const dialogRef = this.dialog.open(PreviewDialogComponent, {
            width: this.isMobile ? '100vw' : '80%',
            height: this.isMobile ? '100vh' : '80%',
            maxWidth: this.isMobile ? '100vw' : 'none',
            data: { pdfurl: url, invoiceno }
          });
          dialogRef.afterClosed().subscribe(() => URL.revokeObjectURL(url));
        } else { this.alert.error('PDF file is empty', 'Error'); }
      },
      error: (err) => {
        if (this.handleSubscriptionExpired(err, () => this.PreviewInvoice(invoiceno))) return;
        this.alert.error(`Failed to preview invoice ${invoiceno}`, 'Error');
      }
    });
  }

  DownloadStatementPDF(invoiceno: string): void {
    this.service.GenerateStatementAccountPdf(invoiceno).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        if (res.body && res.body.size > 0) {
          const url = window.URL.createObjectURL(res.body as Blob);
          const a = document.createElement('a');
          a.download = this.getPdfFileName(res.headers.get('Content-Disposition'), invoiceno, 'stsmnt');
          a.href = url;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          this.alert.success(`Statement downloaded for ${invoiceno}`, 'Success');
        } else { this.alert.error('PDF file is empty', 'Error'); }
      },
      error: (err) => {
        if (this.handleSubscriptionExpired(err, () => this.DownloadStatementPDF(invoiceno))) return;
        this.alert.error(`Failed to download statement for ${invoiceno}`, 'Error');
      }
    });
  }

  SendInvoiceByEmail(invoiceno: string): void {
    this.service.SendInvoiceByEmail(invoiceno).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res: any) => {
        const message = res?.message || 'Invoice sent successfully by email.';
        this.alert.success(message, 'Email');
      },
      error: (err) => {
        if (this.handleSubscriptionExpired(err, () => this.SendInvoiceByEmail(invoiceno))) return;
        const message = err?.error?.message || err?.error?.errorMessage || err?.message || 'Failed to send invoice via email.';
        this.alert.error(message, 'Email');
      }
    });
  }

  SendInvoiceToWhatsApp(invoiceno: string): void {
    const popup = window.open('about:blank', '_blank', 'noopener,noreferrer');

    this.service.BuildInvoiceWhatsAppLink(invoiceno).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res: any) => {
        const link = res?.shareUrl || res?.whatsappUrl || res?.fallbackShareUrl;
        if (!link) {
          if (popup) popup.close();
          this.alert.error('Could not generate WhatsApp link for this invoice. Customer mobile not found.', 'WhatsApp');
          return;
        }

        if (popup) {
          popup.opener = null;
          popup.location.href = link;
        } else {
          const linkAnchor = document.createElement('a');
          linkAnchor.href = link;
          linkAnchor.target = '_blank';
          linkAnchor.rel = 'noopener noreferrer';
          linkAnchor.style.display = 'none';
          document.body.appendChild(linkAnchor);
          linkAnchor.click();
          document.body.removeChild(linkAnchor);
        }

        this.alert.success('Invoice prepared for WhatsApp.', 'WhatsApp');
      },
      error: (err) => {
        if (popup) popup.close();
        if (this.handleSubscriptionExpired(err, () => this.SendInvoiceToWhatsApp(invoiceno))) return;
        const message = err?.error?.message || err?.error?.errorMessage || err?.message || 'Failed to prepare invoice for WhatsApp.';
        this.alert.error(message, 'WhatsApp');
      }
    });
  }

  private handleSubscriptionExpired(err: any, onActivated?: () => void): boolean {
    try {
      const isForbidden = err?.status === 403;
      const errMsg = (typeof err?.error === 'string' ? err.error :
        err?.error?.message || err?.error?.Message || err?.message || '');
      const expired = isForbidden && errMsg.toLowerCase().includes('subscription');
      if (!expired) return false;

      const companyId = this.selectedCompanyService.getSelectedCompanyId() || this.auth.getCompanyId();
      const openDialog = (cid?: string, cname?: string) => {
        if (this.isSuperAdmin) { if (onActivated) onActivated(); return; }
        import('../payment-admin/activation-dialog.component').then(m => {
          this.dialog.open(m.ActivationDialogComponent, {
            width: window.innerWidth < 768 ? '100%' : '600px',
            maxWidth: '100vw', maxHeight: '90vh', disableClose: true,
            data: { companyId: cid ?? '', companyName: cname ?? cid ?? '' }
          }).afterClosed().subscribe((activated: boolean) => {
            if (activated) { this.alert.success('Subscription renewed.', 'Success'); if (onActivated) onActivated(); }
          });
        }).catch(() => { if (onActivated) onActivated?.(); });
      };
      if (companyId) {
        this.companySvc.getCompanyById(companyId).pipe(takeUntil(this.destroy$)).subscribe({
          next: (c: any) => openDialog(companyId, c?.name ?? companyId),
          error: () => openDialog(companyId, companyId)
        });
      } else { openDialog(); }
      return true;
    } catch { return false; }
  }

  // ── NEW: Approve invoice ──────────────────────────────────────────────────
  approveInvoice(inv: Invoice): void {
    if (!this.canApprove) return;
    if (inv.isApproved) { this.alert.info('Invoice is already approved.'); return; }
    const cid = this.selectedCompanyService.getSelectedCompanyId() || this.auth.getCompanyId();
    this.invoiceSvc.approveInvoice(inv.invoiceNumber, cid ?? undefined)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (r: any) => {
          if (r?.result === 'pass') {
            inv.isApproved  = true;
            inv.approvedBy  = r.data?.approvedBy;
            inv.approvedDate = r.data?.approvedDate;
            this.alert.success(`Invoice ${inv.invoiceNumber} approved.`);
          } else {
            this.alert.error(r?.errorMessage || 'Approval failed.');
          }
        },
        error: () => this.alert.error('Approval failed. Please try again.')
      });
  }

  // ── NEW: Lock invoice ─────────────────────────────────────────────────────
  lockInvoice(inv: Invoice): void {
    if (!this.canApprove) return;
    if (inv.isLocked) { this.alert.info('Invoice is already locked.'); return; }
    const reason = window.prompt(`Enter lock reason for invoice ${inv.invoiceNumber}:`);
    if (!reason?.trim()) { this.alert.warning('Lock reason is required.'); return; }
    const cid = this.selectedCompanyService.getSelectedCompanyId() || this.auth.getCompanyId();
    this.invoiceSvc.lockInvoice(inv.invoiceNumber, reason.trim(), cid ?? undefined)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (r: any) => {
          if (r?.result === 'pass') {
            inv.isLocked = true;
            inv.lockedBy = r.data?.lockedBy;
            this.alert.success(`Invoice ${inv.invoiceNumber} locked.`);
          } else {
            this.alert.error(r?.errorMessage || 'Lock failed.');
          }
        },
        error: () => this.alert.error('Lock failed. Please try again.')
      });
  }

  // ── NEW: Unlock invoice ────────────────────────────────────────────────────
  unlockInvoice(inv: Invoice): void {
    if (!this.canApprove) return;
    if (!inv.isLocked) { this.alert.info('Invoice is not locked.'); return; }
    if (!window.confirm(`Unlock invoice ${inv.invoiceNumber}?`)) return;
    const cid = this.selectedCompanyService.getSelectedCompanyId() || this.auth.getCompanyId();
    this.invoiceSvc.unlockInvoice(inv.invoiceNumber, cid ?? undefined)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (r: any) => {
          if (r?.result === 'pass') {
            inv.isLocked   = false;
            inv.lockedBy   = undefined;
            inv.lockReason = undefined;
            this.alert.success(`Invoice ${inv.invoiceNumber} unlocked.`);
          } else {
            this.alert.error(r?.errorMessage || 'Unlock failed.');
          }
        },
        error: () => this.alert.error('Unlock failed. Please try again.')
      });
  }

  // ── NEW: Open sales return modal ──────────────────────────────────────────
  openReturn(inv: Invoice): void {
    if (!this.canReturn) return;
    if (inv.isLocked) { this.alert.warning('Invoice is locked — returns are not allowed.'); return; }
    const cid = this.selectedCompanyService.getSelectedCompanyId() || this.auth.getCompanyId();
    import('./sales-return-dialog.component').then(m => {
      this.dialog.open(m.SalesReturnDialogComponent, {
        width: this.isMobile ? '100%' : '760px',
        maxWidth: '100vw', maxHeight: '90vh',
        data: { invoice: inv, companyId: cid }
      }).afterClosed().pipe(takeUntil(this.destroy$)).subscribe((created: boolean) => {
        if (created) { this.alert.success('Sales return created.'); this.LoadInvoice(); }
      });
    }).catch(() => this.alert.error('Could not load return dialog.'));
  }

  // ── NEW: Navigate to reports ──────────────────────────────────────────────
  openReports(): void {
    this.router.navigate(['/sales-reports']);
  }
}
