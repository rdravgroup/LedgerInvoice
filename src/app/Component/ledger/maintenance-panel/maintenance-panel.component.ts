import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../../material.module';
import { LedgerService } from '../../../_service/ledger.service';
import { AuthService } from '../../../_service/authentication.service';
import { ToastrService } from 'ngx-toastr';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-maintenance-panel',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  templateUrl: './maintenance-panel.component.html',
  styleUrls: ['./maintenance-panel.component.css']
})
export class MaintenancePanelComponent implements OnInit, OnDestroy {
  // Loading states for each job
  loadingAgeing = false;
  loadingOutstanding = false;
  loadingSnapshot = false;

  // User role
  userRole: string = '';

  // Lifecycle
  private destroy$ = new Subject<void>();

  constructor(
    private ledgerService: LedgerService,
    private authService: AuthService,
    private toastr: ToastrService
  ) {
    this.userRole = this.authService.getUserRole() || '';
  }

  ngOnInit(): void {
    // Component is ready
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Check if user is admin
   */
  isAdmin(): boolean {
    // Maintenance operations require super_admin privileges on the backend.
    return this.userRole?.toLowerCase() === 'super_admin';
  }

  /**
   * Trigger ageing bucket update
   */
  triggerAgeingUpdate(): void {
    if (!this.isAdmin()) {
      this.toastr.error('You are not authorized to perform this action. Super-admin role required.', 'Forbidden');
      return;
    }

    if (!confirm('This will recalculate ageing buckets for all customers. Continue?')) {
      return;
    }

    this.loadingAgeing = true;
    this.ledgerService.triggerAgeingUpdate()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.loadingAgeing = false;
          if (response.result === 'pass') {
            this.toastr.success('Ageing buckets updated successfully', 'Success');
          } else {
            this.toastr.error(response.errorMessage || 'Failed to update ageing', 'Error');
          }
        },
        error: (err) => {
          this.loadingAgeing = false;
          this.toastr.error('Error: ' + err.message, 'Error');
        }
      });
  }

  /**
   * Trigger outstanding refresh
   */
  triggerOutstandingRefresh(): void {
    if (!this.isAdmin()) {
      this.toastr.error('You are not authorized to perform this action. Super-admin role required.', 'Forbidden');
      return;
    }

    if (!confirm('This will refresh outstanding summary for all companies. Continue?')) {
      return;
    }

    this.loadingOutstanding = true;
    this.ledgerService.triggerOutstandingRefresh()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.loadingOutstanding = false;
          if (response.result === 'pass') {
            this.toastr.success('Outstanding summary refreshed successfully', 'Success');
          } else {
            this.toastr.error(response.errorMessage || 'Failed to refresh outstanding', 'Error');
          }
        },
        error: (err) => {
          this.loadingOutstanding = false;
          this.toastr.error('Error: ' + err.message, 'Error');
        }
      });
  }

  /**
   * Trigger ageing snapshot creation
   */
  triggerSnapshotCreation(): void {
    if (!this.isAdmin()) {
      this.toastr.error('You are not authorized to perform this action. Super-admin role required.', 'Forbidden');
      return;
    }

    if (!confirm('This will create an ageing snapshot. Continue?')) {
      return;
    }

    this.loadingSnapshot = true;
    this.ledgerService.triggerSnapshotCreation()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.loadingSnapshot = false;
          if (response.result === 'pass') {
            this.toastr.success('Ageing snapshot created successfully', 'Success');
          } else {
            this.toastr.error(response.errorMessage || 'Failed to create snapshot', 'Error');
          }
        },
        error: (err) => {
          this.loadingSnapshot = false;
          this.toastr.error('Error: ' + err.message, 'Error');
        }
      });
  }

  /**
   * Trigger all maintenance jobs at once
   */
  triggerAllMaintenance(): void {
    if (!confirm('This will run all maintenance jobs. This may take a few minutes. Continue?')) {
      return;
    }

    this.toastr.info('Running all maintenance jobs...', 'Processing');
    
    // Run ageing update first
    this.triggerAgeingUpdate();
    
    // Then outstanding refresh (after slight delay)
    setTimeout(() => this.triggerOutstandingRefresh(), 2000);
    
    // Then snapshot creation (after longer delay)
    setTimeout(() => this.triggerSnapshotCreation(), 4000);
  }
}
