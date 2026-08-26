import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { MaterialModule } from '../../material.module';
import { forkJoin, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AuthService } from '../../_service/authentication.service';
import { LoginLogRecord, LoginLogService, LoginStats } from '../../_service/login-log.service';
import { SelectedCompanyService } from '../../_service/selected-company.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-login-log',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  templateUrl: './login-log.component.html',
  styleUrls: ['./login-log.component.css']
})
export class LoginLogComponent implements OnInit, OnDestroy {
  logs: LoginLogRecord[] = [];
  activeSessions: LoginLogRecord[] = [];
  stats: LoginStats | null = null;
  days = 30;
  statusFilter = 'All';
  authFilter = 'All';
  loading = false;
  error = '';
  isAdmin = false;
  isSuperAdmin = false;
  private companyId = '';
  private readonly destroy$ = new Subject<void>();

  constructor(
    private loginLogService: LoginLogService,
    private authService: AuthService,
    private selectedCompanyService: SelectedCompanyService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    const role = (this.authService.getUserRole() || '').toLowerCase().replace(/[\s-]/g, '_');
    this.isSuperAdmin = role === 'super_admin' || role === 'superadmin';
    this.isAdmin = this.isSuperAdmin || role === 'admin';
    this.selectedCompanyService.selectedCompanyId$
      .pipe(takeUntil(this.destroy$))
      .subscribe(companyId => {
        this.companyId = this.isSuperAdmin ? (companyId || '') : (this.authService.getCompanyId() || '');
        this.load();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    const history$ = this.isAdmin
      ? this.loginLogService.getCompanyHistory(this.days, this.companyId || undefined)
      : this.loginLogService.getMyHistory(this.days);
    const stats$ = this.isAdmin
      ? this.loginLogService.getCompanyStats(this.days, this.companyId || undefined)
      : null;
    const requests: any[] = [history$];
    if (stats$) requests.push(stats$);
    if (this.isSuperAdmin) requests.push(this.loginLogService.getActiveSessions());

    forkJoin(requests).pipe(takeUntil(this.destroy$)).subscribe({
      next: (responses: any[]) => {
        const history = responses[0];
        if (history?.result !== 'pass') throw new Error(history?.errorMessage || 'Unable to load login history');
        this.logs = history.data || [];
        if (stats$) this.stats = responses[1]?.data || null;
        if (this.isSuperAdmin) this.activeSessions = responses[stats$ ? 2 : 1]?.data || [];
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.errorMessage || err?.message || 'Unable to load login history';
        this.toastr.error(this.error, 'Login log');
      }
    });
  }

  get filteredLogs(): LoginLogRecord[] {
    return this.logs.filter(log =>
      (this.statusFilter === 'All' || log.status === this.statusFilter) &&
      (this.authFilter === 'All' || log.authMethod === this.authFilter)
    );
  }

  get authMethods(): string[] {
    return [...new Set(this.logs.map(log => log.authMethod).filter(Boolean))];
  }

  formatDuration(seconds?: number): string {
    if (!seconds && seconds !== 0) return '-';
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;
    return minutes ? `${minutes}m ${remaining}s` : `${remaining}s`;
  }

  refresh(): void {
    this.load();
  }
}
