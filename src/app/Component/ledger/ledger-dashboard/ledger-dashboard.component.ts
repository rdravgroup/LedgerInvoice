import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../../material.module';
import { LedgerService } from '../../../_service/ledger.service';
import { AuthService } from '../../../_service/authentication.service';
import { SelectedCompanyService } from '../../../_service/selected-company.service';
import { ToastrService } from 'ngx-toastr';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ledgerSummary, ageDistribution } from '../../../_model/ledger.model';

/** Resolves role string to canonical role name. */
function resolveRole(raw: string): 'super_duper_admin' | 'super_admin' | 'other' {
  const r = (raw || '').toLowerCase().replace(/[\s-]/g, '_');
  if (r === 'super_duper_admin' || r === 'superduper') return 'super_duper_admin';
  if (r === 'super_admin'  || r === 'superadmin')  return 'super_admin';
  return 'other';
}

@Component({
  selector: 'app-ledger-dashboard',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  templateUrl: './ledger-dashboard.component.html',
  styleUrls: ['./ledger-dashboard.component.css']
})
export class LedgerDashboardComponent implements OnInit, OnDestroy {
  // Data properties
  companySummary: ledgerSummary | null = null;
  ageDistribution: ageDistribution | null = null;

  // UI properties
  loading   = true;
  error: string | null = null;
  companyId = '';

  private destroy$ = new Subject<void>();
  private isSuperRole = false;

  constructor(
    private ledgerService: LedgerService,
    private authService: AuthService,
    private toastr: ToastrService,
    // FIXED: direct injection — no longer uses (this as any) cast
    private selectedCompanyService: SelectedCompanyService
  ) {}

  ngOnInit(): void {
    const role = resolveRole(this.authService.getUserRole() || '');
    this.isSuperRole = role === 'super_admin' || role === 'super_duper_admin';

    // Subscribe to company selection changes — drives both initial load and reloads
    // when super_admin switches company in the toolbar.
    this.selectedCompanyService.selectedCompanyId$
      .pipe(takeUntil(this.destroy$))
      .subscribe((cid: string | null) => {
        if (this.isSuperRole) {
          // super_duper_admin: null = all companies; super_admin: use selected company
          this.companyId = cid || '';
        } else {
          // Regular users: always their own company from JWT
          this.companyId = this.authService.getCompanyId() || '';
        }
        this.loadDashboardData();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Template helper methods — required by ledger-dashboard.component.html ──

  /** Format number as Indian Rupee currency string. */
  formatCurrency(value: number | undefined): string {
    if (!value) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency', currency: 'INR',
      minimumFractionDigits: 2, maximumFractionDigits: 2
    }).format(value);
  }

  /** Format a number as a percentage string (rounded). */
  getPercentage(value: number | undefined): string {
    if (!value) return '0%';
    return Math.round(value) + '%';
  }

  /** Manually refresh all dashboard data and show a toast. */
  refreshDashboard(): void {
    this.loadDashboardData();
    this.toastr.info('Dashboard refreshed', 'Refresh');
  }

  loadDashboardData(): void {
    this.loading = true;
    this.error   = null;

    // Load company summary
    this.ledgerService.getCompanySummary(this.companyId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.result === 'pass' && response.data) {
            this.companySummary = response.data as ledgerSummary;
          } else {
            this.error = response.errorMessage || 'Failed to load company summary';
          }
        },
        error: (err) => {
          this.error = 'Error loading summary: ' + err.message;
          this.toastr.error('Failed to load company summary', 'Error');
        }
      });

    // Load age distribution
    this.ledgerService.getAgeDistribution(this.companyId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.result === 'pass' && response.data) {
            this.ageDistribution = response.data as ageDistribution;
          } else {
            this.error = response.errorMessage || 'Failed to load age distribution';
          }
          this.loading = false;
        },
        error: (err) => {
          this.error = 'Error loading age distribution: ' + err.message;
          this.toastr.error('Failed to load age distribution', 'Error');
          this.loading = false;
        }
      });
  }
}
