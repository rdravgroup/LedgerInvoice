import { Component, OnInit, AfterViewInit, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../material.module';
import { Company } from '../../_model/company.model';
import { PaymentService, PaymentStatusResponse } from '../../_service/payment.service';
import { VoucherService } from '../../_service/voucher.service';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { CompanyService } from '../../_service/company.service';
import { ToastrService } from 'ngx-toastr';
import { CompanyFormDialogComponent } from './company-form-dialog.component';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';
import { AuthService } from '../../_service/authentication.service';
import { LoggerService } from '../../_service/logger.service';
import { isAlreadyInTargetStatusMessage, isPaymentRequiredResponse } from '../../_service/api-response-utils';

@Component({
  selector: 'app-companymanage',
  standalone: true,
  imports: [CommonModule, MaterialModule, MatTableModule, MatPaginatorModule, MatSortModule, MatDialogModule],
  templateUrl: './companymanage.component.html',
  styleUrls: ['./companymanage.component.css']
})
export class CompanyManageComponent implements OnInit, AfterViewInit {
  companies: Company[] = [];
  displayedColumns: string[] = ['companyId', 'name', 'status', 'emailId', 'mobileNo', 'gstNumber', 'createdDate', 'action'];
  datasource = new MatTableDataSource<Company>([]);

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  isMobile = false;
  paymentStatusMap: Record<string, PaymentStatusResponse> = {};
  isSuperAdmin = false;
  isAdmin = false;
  isGuest = false;

  constructor(
    private companyService: CompanyService,
    private paymentSvc: PaymentService,
    private voucherSvc: VoucherService,
    private dialog: MatDialog,
    private toastr: ToastrService,
    private logger: LoggerService,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    this.checkScreenSize();
    const role = (this.auth.getUserRole() || '').toLowerCase();
    this.isSuperAdmin = role === 'super_admin' || role === 'superadmin';
    this.isAdmin = role === 'admin';
    this.isGuest = role === 'guest';
    this.loadCompanies();
  }

  applyFilter(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.datasource.filter = value.trim().toLowerCase();
    if (this.datasource.paginator) this.datasource.paginator.firstPage();
  }

  clearFilter() {
    if (!this.datasource) return;
    this.datasource.filter = '';
    if (this.datasource.paginator) this.datasource.paginator.firstPage();
  }

  ngAfterViewInit(): void {
    if (this.datasource) {
      this.datasource.paginator = this.paginator;
      this.datasource.sort = this.sort;
    }
  }

  @HostListener('window:resize')
  onResize() {
    this.checkScreenSize();
  }

  private checkScreenSize() {
    this.isMobile = window.innerWidth < 768;
  }

  loadCompanies(): void {
    // Re-evaluate role each time so UI reflects immediate changes (e.g. guest -> admin promotion)
    const role = (this.auth.getUserRole() || '').toLowerCase();
    this.isSuperAdmin = role === 'super_admin' || role === 'superadmin';
    this.isAdmin = role === 'admin';
    this.isGuest = role === 'guest';

    // super_admin: full list; others get their scoped/active companies (server enforces visibility)
    const obs = this.isSuperAdmin ? this.companyService.getAllCompanies(true) : this.companyService.getActiveCompanies();
    obs.subscribe({
      next: (list: Company[]) => {
        this.companies = list || [];
        this.datasource = new MatTableDataSource<Company>(this.companies);
        this.datasource.paginator = this.paginator;
        this.datasource.sort = this.sort;
        // filter predicate matches companyId, name, email, mobile, gst
        this.datasource.filterPredicate = (data: Company, filter: string) => {
          const f = filter.trim().toLowerCase();
          return (data.companyId ?? '').toLowerCase().includes(f)
              || (data.name ?? '').toLowerCase().includes(f)
              || (data.emailId ?? '').toLowerCase().includes(f)
              || (data.mobileNo ?? '').toLowerCase().includes(f)
              || (data.gstNumber ?? '').toLowerCase().includes(f);
        };
        this.logger.info('CompanyManageComponent', `Loaded ${this.companies.length} companies`);
      },
      error: (err) => {
        console.error('Failed to load companies', err);
        this.toastr.error('Failed to load companies', 'Error');
      }
    });
  }

  openCreate(): void {
    const cfg: any = {
      width: this.isMobile ? '100%' : '720px',
      data: null
    };
    this.dialog.open(CompanyFormDialogComponent, cfg).afterClosed().subscribe((res) => {
      this.handleDialogResult(res);
    });
  }

  openEdit(item: Company): void {
    // Admins are allowed a single update. If already updated, prevent opening the dialog.
    if (this.isAdmin && item.updatedDate) {
      this.toastr.info('Admin can update company details only once. Request super_admin for further changes.', 'Info');
      return;
    }

    // Fetch full company details before opening the edit dialog so address and other fields are present
    this.companyService.getCompanyById(item.companyId).subscribe({
      next: (company) => {
        const cfg: any = { width: this.isMobile ? '100%' : '720px', data: { company } };
        this.dialog.open(CompanyFormDialogComponent, cfg).afterClosed().subscribe((res) => {
          this.handleDialogResult(res);
        });
      },
      error: () => {
        // Fallback to opening with list item if detailed fetch fails
        const cfg: any = { width: this.isMobile ? '100%' : '720px', data: { company: item } };
        this.dialog.open(CompanyFormDialogComponent, cfg).afterClosed().subscribe((res) => {
          this.handleDialogResult(res);
        });
      }
    });
  }

  changeStatus(item: Company): void {
    const newStatus = item.status === 'active' ? 'inactive' : 'active';
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: { title: 'Confirm status change', message: `Change status of ${item.name} to ${newStatus}?` }
    });

    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      const payload = { CompanyId: item.companyId, Status: newStatus };
      this.companyService.changeCompanyStatus(payload).subscribe({
        next: (r: any) => {
          if ((r && (r.result === 'pass' || r.Result === 'pass'))) {
            this.toastr.success('Status updated', 'Success');
            this.loadCompanies();
          } else if (isPaymentRequiredResponse(r)) {
            // Activation requires payment — open payment/voucher dialog
            this.toastr.info('Payment required to activate company. Opening payment dialog...', 'Info');
            this.openPaymentDialog(item);
          } else if (isAlreadyInTargetStatusMessage(r)) {
            this.toastr.info(r?.errorMessage || r?.ErrorMessage || 'Company is already in the requested state.', 'Info');
            this.loadCompanies();
          } else {
            this.toastr.error(r?.errorMessage || r?.ErrorMessage || 'Failed to change status', 'Error');
          }
        },
        error: (err) => {
          const body = err?.error || err;
          if (err?.status === 402 || isPaymentRequiredResponse(body)) {
            this.toastr.info('Payment required to activate company. Opening payment dialog...', 'Info');
            this.openPaymentDialog(item);
            return;
          }
          if (isAlreadyInTargetStatusMessage(body)) {
            this.toastr.info(body?.errorMessage || body?.ErrorMessage || 'Company is already in the requested state.', 'Info');
            this.loadCompanies();
            return;
          }
          console.error('Change status error', err);
          this.toastr.error('Failed to change status', 'Error');
        }
      });
    });
  }
  openPaymentDialog(item: Company): void {
    // First, check current payment/subscription status — do not open dialog if already active
    this.paymentSvc.getPaymentStatus(item.companyId).subscribe({
      next: (s: PaymentStatusResponse) => {
        if (s?.isActive || s?.isPaymentDone) {
          this.toastr.info('Company already has an active subscription', 'Info');
          return; // nothing to do
        }

        // If current user is super-admin, do not show payment dialog — offer direct activation
        if (this.isSuperAdmin) {
          const ref = this.dialog.open(ConfirmDialogComponent, {
            width: '420px',
            data: { title: 'Super admin action', message: `Activate ${item.name} without payment?` }
          });
          ref.afterClosed().subscribe((confirmed) => {
            if (!confirmed) return;
            const payload = { CompanyId: item.companyId, Status: 'active' };
            this.companyService.changeCompanyStatus(payload).subscribe({
              next: (r: any) => {
                if ((r && (r.result === 'pass' || r.Result === 'pass'))) {
                  this.toastr.success('Status updated', 'Success');
                  this.loadCompanies();
                } else {
                  this.toastr.error(r?.errorMessage || r?.ErrorMessage || 'Failed to change status', 'Error');
                }
              },
              error: (err) => { console.error('Super-admin activation failed', err); this.toastr.error('Failed to activate company', 'Error'); }
            });
          });
          return;
        }

        // Not super-admin and company not active -> open activation/payment dialog (modal, not closable)
        import('../payment-admin/activation-dialog.component').then(m => {
          this.dialog.open(m.ActivationDialogComponent, {
            width: window.innerWidth < 768 ? '100%' : '600px',
            maxWidth: '100vw', maxHeight: '90vh',
            disableClose: true,
            data: { companyId: item.companyId, companyName: item.name }
          }).afterClosed().subscribe((activated: boolean) => {
            if (activated) {
              this.toastr.success('Company activated successfully!', 'Success');
              this.loadCompanies();
            }
          });
        });
      },
      error: () => {
        // If status check fails, fall back to opening dialog (modal)
        import('../payment-admin/activation-dialog.component').then(m => {
          this.dialog.open(m.ActivationDialogComponent, {
            width: window.innerWidth < 768 ? '100%' : '600px',
            maxWidth: '100vw', maxHeight: '90vh',
            disableClose: true,
            data: { companyId: item.companyId, companyName: item.name }
          }).afterClosed().subscribe((activated: boolean) => {
            if (activated) {
              this.toastr.success('Company activated successfully!', 'Success');
              this.loadCompanies();
            }
          });
        });
      }
    });
  }

  loadPaymentStatus(companyId: string): void {
    this.paymentSvc?.getPaymentStatus(companyId).subscribe({
      next: (s) => { this.paymentStatusMap[companyId] = s; },
      error: () => {}
    });
  }

  private handleDialogResult(res: any) {
    if (!res) return;

    // Normalized company payload may be the object itself or nested under `data`/`Data`.
    const candidate = (res && res.companyId) ? res : (res?.data ?? res?.Data ?? null);
    if (candidate && candidate.companyId) {
      this.updateCompanyInList(candidate as Company);
      return;
    }

    // Fallback: if we cannot find a company object, reload the list to be safe
    this.loadCompanies();
  }

  private updateCompanyInList(updated: Company) {
    const idx = this.companies.findIndex((c) => c.companyId === updated.companyId);
    let updatedRef: any = null;
    if (idx > -1) {
      // Merge fields to preserve any client-only fields
      this.companies[idx] = { ...this.companies[idx], ...updated } as Company;
      updatedRef = this.companies[idx] as any;
    } else {
      // New company: insert at top
      (updated as any)._justUpdated = true;
      this.companies.unshift(updated as Company);
      updatedRef = this.companies[0] as any;
    }

    // Mark row/card as recently-updated for a brief highlight
    if (updatedRef) {
      updatedRef._justUpdated = true;
      // Refresh datasource so table shows the change immediately
      if (this.datasource) this.datasource.data = this.companies;
      setTimeout(() => {
        updatedRef._justUpdated = false;
        if (this.datasource) this.datasource.data = this.companies;
      }, 2200);
    }

    // Ensure datasource exists and is in-sync
    if (!this.datasource) {
      this.datasource = new MatTableDataSource<Company>(this.companies);
      this.datasource.paginator = this.paginator;
      this.datasource.sort = this.sort;
    }
  }

}