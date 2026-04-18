import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../../material.module';
import { LedgerService } from '../../../_service/ledger.service';
import { AuthService } from '../../../_service/authentication.service';
import { ToastrService } from 'ngx-toastr';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ledgerSummary, ageDistribution, ageingBucket } from '../../../_model/ledger.model';

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
  loading = true;
  error: string | null = null;
  companyId: string = '';
  
  // Lifecycle
  private destroy$ = new Subject<void>();

  constructor(
    private ledgerService: LedgerService,
    private authService: AuthService,
    private toastr: ToastrService
  ) {
    this.companyId = this.authService.getCompanyId() || '';
  }

  ngOnInit(): void {
    this.loadDashboardData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load all dashboard data (summary and age distribution)
   */
  loadDashboardData(): void {
    this.loading = true;
    this.error = null;

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

  /**
   * Format number as Indian currency
   */
  formatCurrency(value: number | undefined): string {
    if (!value) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  /**
   * Get percentage string
   */
  getPercentage(value: number | undefined): string {
    if (!value) return '0%';
    return Math.round(value) + '%';
  }

  /**
   * Refresh dashboard data
   */
  refreshDashboard(): void {
    this.loadDashboardData();
    this.toastr.info('Dashboard refreshed', 'Refresh');
  }
}
