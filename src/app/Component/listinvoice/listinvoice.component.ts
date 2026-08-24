import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../material.module';
import { ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MasterService } from '../../_service/master.service';
import { ToastrService } from 'ngx-toastr';
import { MatDialog } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
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
    ReactiveFormsModule,
    RouterLink,
    // CHANGE: New shared components
    CompanyContextBannerComponent,
  ],
  templateUrl: './listinvoice.component.html',
  styleUrls: ['./listinvoice.component.css'],
})
export class ListinvoiceComponent implements OnInit, OnDestroy {
  displayedColumns: string[] = ['invoiceNumber', 'invDate', 'cuName', 'totalAmt', 'status', 'actions'];
  dataSource = new MatTableDataSource<Invoice>();

  loading = false;
  isMobile = false;
  isSuperAdmin = false;
  isSuperDuper = false;   // NEW: read-only role
  canApprove   = false;   // NEW: can approve/lock
  canReturn    = false;   // NEW: can create return

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
  activeActionInvoiceNumber: string | null = null;

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
    window.addEventListener('resize', () => this.checkMobile());
    const role = (this.auth.getUserRole() || '').toLowerCase().replace(/-/g, '_');
    this.isSuperAdmin = role === 'super_admin' || role === 'superadmin' || role === 'super_duper_admin';
    this.isSuperDuper = role === 'super_duper_admin';
    this.canApprove   = !this.isSuperDuper && (role === 'super_admin' || role === 'admin');
    this.canReturn    = !this.isSuperDuper;
  }

  private checkMobile(): void {
    this.isMobile = window.innerWidth <= 768;
  }

  ngOnInit(): void {
    this.LoadInvoice();
    // CHANGE: reload when super_admin switches company
    this.selectedCompanyService.selectedCompanyId$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.LoadInvoice();
    });
  }


  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private attachTableControls(): void {
    this.dataSource.sortingDataAccessor = (item: any, property: string) => {
      if (property === 'invDate') return this.getInvoiceSortTime(item);
      return item?.[property] ?? '';
    };

    if (this.paginator) this.dataSource.paginator = this.paginator;
    if (this.sort) {
      this.dataSource.sort = this.sort;
      this.sort.active = 'invDate';
      this.sort.direction = 'desc';
    }
  }

  private sortInvoicesByCreateDate(data: Invoice[]): Invoice[] {
    return [...data].sort((a: any, b: any) => this.getInvoiceSortTime(b) - this.getInvoiceSortTime(a));
  }

  private getInvoiceSortTime(item: any): number {
    const dateVal = item?.createDate || item?.create_date || item?.createdAt || item?.CreateDate || item?.invDate || item?.inv_date || item?.invdate;
    const time = dateVal ? new Date(dateVal).getTime() : 0;
    return Number.isFinite(time) ? time : 0;
  }
  LoadInvoice(): void {
    this.loading = true;
    const performLoad = () => {
      const effectiveCompanyId = this.selectedCompanyService.getSelectedCompanyId() || this.auth.getCompanyId();
      this.service.GetAllInvoice(effectiveCompanyId ?? undefined)
        .pipe(takeUntil(this.destroy$))
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
              data = this.sortInvoicesByCreateDate(data);
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



