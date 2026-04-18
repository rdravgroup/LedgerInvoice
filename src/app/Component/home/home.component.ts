import { Component, OnInit, OnDestroy, Inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatDialog, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MaterialModule } from '../../material.module';
import { UserService } from '../../_service/user.service';
import { AuthService } from '../../_service/authentication.service';
import { CustomerService } from '../../_service/customer.service';
import { MasterService } from '../../_service/master.service';
import { LedgerService } from '../../_service/ledger.service';
import { Company } from '../../_model/company.model';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, MaterialModule, RouterLink, DecimalPipe],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  company?: Company;
  loading = true;

  // KPI values
  totalAR        = 0;
  totalPaid      = 0;
  overdueAmount  = 0;
  customerCount  = 0;
  invoiceCount   = 0;

  // Recent invoices table
  recentInvoices: any[] = [];

  constructor(
    private userSvc: UserService,
    private authService: AuthService,
    private customerSvc: CustomerService,
    private masterSvc: MasterService,
    private ledgerSvc: LedgerService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    const companyId = this.authService.getCompanyId();
    if (companyId) {
      this.userSvc.getCompanyById(companyId).pipe(takeUntil(this.destroy$)).subscribe({
        next: (co) => { this.company = co; },
        error: () => {}
      });
    }

    this.loadDashboardData();
  }

  private loadDashboardData(): void {
    this.loading = true;

    // Load customers for count KPI
    this.customerSvc.Getall().pipe(takeUntil(this.destroy$)).subscribe({
      next: (customers: any[]) => {
        this.customerCount = customers?.filter((c: any) => c.isActive)?.length || 0;
      },
      error: () => { this.customerCount = 0; }
    });

    // Load recent invoices (from GetAllInvoice endpoint)
    (this.masterSvc.GetAllInvoice() as any)?.pipe(takeUntil(this.destroy$)).subscribe({
      next: (invoices: any[]) => {
        this.invoiceCount = invoices?.length || 0;
        // Show 5 most recent
        this.recentInvoices = (invoices || []).slice(0, 5);
        this.loading = false;
      },
      error: () => {
        this.recentInvoices = [];
        this.loading = false;
      }
    });

    // Load AR summary (total A/R, total due/overdue) for KPI cards
    const companyId = this.authService.getCompanyId();
    if (companyId) {
      this.ledgerSvc.getCompanySummary(companyId).pipe(takeUntil(this.destroy$)).subscribe({
        next: (resp: any) => {
          console.debug('[Home] Company summary response:', resp);
          const summary = resp?.data || {};
          this.totalAR = Number(summary?.totalAR ?? 0);
          this.totalPaid = Number(summary?.totalPaid ?? 0);
          this.overdueAmount = Number(summary?.totalDue ?? 0);
          console.debug('[Home] KPI values - totalAR:', this.totalAR, 'totalPaid:', this.totalPaid, 'overdueAmount:', this.overdueAmount);
        },
        error: (err) => {
          console.error('[Home] Error loading company summary:', err);
          this.totalAR = 0;
          this.overdueAmount = 0;
        }
      });
    }
  }

  openCompanyDetails(): void {
    if (this.company) {
      this.dialog.open(CompanyDetailsDialog, {
        width: '420px',
        maxWidth: '95vw',
        data: this.company
      });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

@Component({
  selector: 'app-company-details-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  template: `
    <div style="padding:0">
      <h2 mat-dialog-title style="padding:20px 24px 12px;border-bottom:1px solid #e2e8f0;margin:0;font-size:18px;font-weight:700">
        {{ data.name }}
      </h2>
      <mat-dialog-content style="padding:20px 24px">
        <div class="detail-row" *ngIf="data.emailId">
          <mat-icon>mail_outline</mat-icon><span>{{ data.emailId }}</span>
        </div>
        <div class="detail-row" *ngIf="data.mobileNo">
          <mat-icon>phone</mat-icon><span>{{ data.mobileNo }}</span>
        </div>
        <div class="detail-row" *ngIf="data.addressDetails">
          <mat-icon>location_on</mat-icon>
          <span>{{ data.addressDetails }}, {{ data.stateName }}, {{ data.countryName }}</span>
        </div>
        <div class="detail-row" *ngIf="data.gstNumber">
          <mat-icon>receipt</mat-icon><span>GST: {{ data.gstNumber }}</span>
        </div>
        <div class="detail-row" *ngIf="data.bankName">
          <mat-icon>account_balance</mat-icon>
          <span>{{ data.bankName }} — IFSC: {{ data.ifsc }}</span>
        </div>
        <div class="detail-row" *ngIf="data.accountNumber">
          <mat-icon>credit_card</mat-icon><span>A/C: {{ data.accountNumber }}</span>
        </div>
      </mat-dialog-content>
      <mat-dialog-actions style="padding:12px 24px;border-top:1px solid #e2e8f0;justify-content:flex-end">
        <button mat-flat-button color="primary" mat-dialog-close>Close</button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .detail-row {
      display: flex; align-items: flex-start; gap: 12px;
      padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #334155;
    }
    .detail-row:last-child { border-bottom: none; }
    .detail-row mat-icon { font-size: 18px; width: 18px; height: 18px; color: #4f46e5; flex-shrink: 0; margin-top: 1px; }
  `]
})
export class CompanyDetailsDialog {
  constructor(@Inject(MAT_DIALOG_DATA) public data: Company) {}
}