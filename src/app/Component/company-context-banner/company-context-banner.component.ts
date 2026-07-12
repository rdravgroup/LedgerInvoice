import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../material.module';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AuthService } from '../../_service/authentication.service';
import { SelectedCompanyService } from '../../_service/selected-company.service';
import { UserService } from '../../_service/user.service';

/**
 * Reusable company context banner.
 * Shows which company's data is currently being viewed/edited.
 *
 * - super_admin: amber/warning style — unmistakably different from normal content.
 * - Regular users: subtle neutral style.
 * - super_admin with no company selected: red warning bar.
 *
 * Usage — add to any tenant-scoped page template:
 *   <app-company-context-banner></app-company-context-banner>
 *
 * The component imports MaterialModule, so no extra imports needed in the host.
 */
@Component({
  selector: 'app-company-context-banner',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  template: `
    <!-- super_admin — no company selected -->
    <div *ngIf="isSuperAdmin && !companyName" class="ctx-banner ctx-no-company">
      <mat-icon>warning</mat-icon>
      <span>No company selected. Please select a company from the toolbar before working with this data.</span>
    </div>

    <!-- Company selected / regular user -->
    <div *ngIf="companyName" class="ctx-banner" [class.ctx-super]="isSuperAdmin">
      <mat-icon>business</mat-icon>
      <span class="ctx-label">{{ isSuperAdmin ? 'Acting as:' : 'Company:' }}</span>
      <strong class="ctx-name">{{ companyName }}</strong>
      <span class="ctx-id" *ngIf="companyId && isSuperAdmin">({{ companyId }})</span>
    </div>
  `,
  styles: [`
    .ctx-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      border-radius: 8px;
      background: rgba(0,0,0,0.04);
      color: rgba(0,0,0,0.6);
      font-size: 13px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    /* super_admin: amber style so cross-company context is unmistakably visible */
    .ctx-super {
      background: #fff8e1;
      color: #5f4200;
      border: 1px solid #ffe082;
    }
    /* super_admin with no company: red warning */
    .ctx-no-company {
      background: #fff3e0;
      color: #bf360c;
      border: 1px solid #ffab40;
      font-weight: 500;
    }
    mat-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }
    .ctx-label { opacity: 0.75; }
    .ctx-name  { font-weight: 600; }
    .ctx-id    { opacity: 0.55; font-size: 11px; font-family: monospace; }
  `]
})
export class CompanyContextBannerComponent implements OnInit, OnDestroy {
  companyName = '';
  companyId: string | null = null;
  isSuperAdmin = false;

  private destroy$ = new Subject<void>();

  constructor(
    private auth: AuthService,
    private selectedCompany: SelectedCompanyService,
    private userService: UserService   // already available in the app, no new dep needed
  ) {}

  ngOnInit(): void {
    const role = (this.auth.getUserRole() || '').toLowerCase();
    this.isSuperAdmin = role === 'super_admin' || role === 'superadmin';

    // React to company selection changes
    this.selectedCompany.selectedCompanyId$
      .pipe(takeUntil(this.destroy$))
      .subscribe(id => {
        const effectiveId = id || this.auth.getCompanyId();
        this.companyId = effectiveId;
        if (effectiveId) {
          this.userService.getCompanyById(effectiveId)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (c: any) => {
                this.companyName = c?.name || c?.Name || effectiveId;
              },
              error: () => { this.companyName = effectiveId; }
            });
        } else {
          this.companyName = '';
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
