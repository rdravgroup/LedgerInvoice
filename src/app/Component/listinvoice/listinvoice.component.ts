import { Component, OnInit, AfterViewInit, ViewChild, OnDestroy } from '@angular/core';
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
export class ListinvoiceComponent implements OnInit, AfterViewInit, OnDestroy {
  displayedColumns: string[] = ['invoiceNumber', 'invDate', 'cuName', 'totalAmt', 'status', 'actions'];
  dataSource = new MatTableDataSource<Invoice>();

  loading = false;
  isMobile = false;
  isSuperAdmin = false;
  isSuperDuper = false;   // NEW: read-only role
  canApprove   = false;   // NEW: can approve/lock
  canReturn    = false;   // NEW: can create return

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  private destroy$ = new Subject<void>();

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

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    setTimeout(() => {
      if (this.sort) this.sort.sort({ id: 'invoiceNumber', start: 'desc', disableClear: false });
    }, 0);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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
              this.dataSource.data = data;
              const applySort = () => {
                if (!this.sort) return false;
                this.dataSource.sort = this.sort;
                this.sort.sort({ id: 'invoiceNumber', start: 'desc', disableClear: false });
                return true;
              };
              if (!applySort()) setTimeout(() => applySort(), 50);
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
        .subscribe((res: any) => {
          if (res.Result === 'pass' || res.result === 'pass') {
            this.alert.success('Invoice deleted successfully.', 'Delete Invoice');
            this.LoadInvoice();
          } else {
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
          const url = window.URL.createObjectURL(res.body as Blob);
          window.open(url, '_blank');
          setTimeout(() => window.URL.revokeObjectURL(url), 1000);
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
      next: (res) => {
        if (res.body && res.body.size > 0) {
          const url = window.URL.createObjectURL(res.body as Blob);
          const a = document.createElement('a');
          a.download = `Invoice_${invoiceno.replace('/', '_')}.pdf`;
          a.href = url;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        } else { this.alert.error('PDF file is empty', 'Error'); }
      },
      error: (err) => {
        if (this.handleSubscriptionExpired(err, () => this.DownloadInvoice(invoiceno))) return;
        this.alert.error(`Failed to download invoice ${invoiceno}`, 'Error');
      }
    });
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
          a.download = `Statement_${invoiceno.replace('/', '_')}.pdf`;
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
