import { Component, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../material.module';
import { Router, RouterLink } from '@angular/router';
import { customer } from '../../_model/customer.model';
import { UserService } from '../../_service/user.service';
import { CustomerService } from '../../_service/customer.service';
import { AuthService } from '../../_service/authentication.service';
import { SelectedCompanyService } from '../../_service/selected-company.service';
import { MatTableDataSource } from '@angular/material/table';
import { MenuPermission } from '../../_model/user.model';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { ToastrService } from 'ngx-toastr';
import { CompanyContextBannerComponent } from '../company-context-banner/company-context-banner.component';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

/** Resolves role string to canonical role name. */
function resolveRole(raw: string): 'super_duper_admin' | 'super_admin' | 'other' {
  const r = (raw || '').toLowerCase().replace(/[\s-]/g, '_');
  if (r === 'super_duper_admin' || r === 'superduper') return 'super_duper_admin';
  if (r === 'super_admin' || r === 'superadmin') return 'super_admin';
  return 'other';
}

@Component({
  selector: 'app-customer',
  standalone: true,
  imports: [CommonModule, MaterialModule, RouterLink, CompanyContextBannerComponent],
  templateUrl: './customer.component.html',
  styleUrls: ['./customer.component.css'],
})
export class CustomerComponent implements OnInit, OnDestroy {
  customerlist!: customer[];
  displayedColumns: string[] = ['name', 'phone', 'company', 'status', 'action'];
  datasource = new MatTableDataSource<customer>();
  _response: any;
  private destroy$ = new Subject<void>();

  loading  = false;
  isMobile = false;
  companyMap: { [companyId: string]: string } = {};

  /** True when the logged-in user is super_admin or super_duper_admin. */
  isSuperAdmin      = false;
  /** True when the logged-in user is super_duper_admin (read-only, no company required). */
  isSuperDuperAdmin = false;

  _permission: MenuPermission = {
    code: '', name: '', haveview: false,
    haveadd: false, haveedit: false, havedelete: false,
    userrole: '', menucode: '',
  };

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private service: CustomerService,
    private userservice: UserService,
    private toastr: ToastrService,
    private router: Router,
    private authService: AuthService,
    private selectedCompanyService: SelectedCompanyService
  ) {
    this.checkMobile();
    window.addEventListener('resize', () => this.checkMobile());

    // Resolve role once at construction
    const role = resolveRole(this.authService.getUserRole() || '');
    this.isSuperAdmin      = role === 'super_admin' || role === 'super_duper_admin';
    this.isSuperDuperAdmin = role === 'super_duper_admin';
  }

  ngOnInit(): void {
    this.loadAccess();
    this.loadCompanies();

    // React to company selection changes — reloads customer list whenever
    // super_admin switches company in the toolbar.
    this.selectedCompanyService.selectedCompanyId$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.loadCustomer();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    window.removeEventListener('resize', () => this.checkMobile());
  }

  private checkMobile(): void {
    this.isMobile = window.innerWidth <= 768;
  }

  applyFilter(event: Event): void {
    this.datasource.filter = (event.target as HTMLInputElement).value.trim().toLowerCase();
  }

  getActiveCount(): number   { return this.customerlist?.filter(c =>  c.isActive)?.length || 0; }
  getInactiveCount(): number { return this.customerlist?.filter(c => !c.isActive)?.length || 0; }

  loadAccess(): void {
    const role = this.authService.getUserRole();
    if (!role) return;
    this.userservice.getMenuPermission(role, 'customer')
      .pipe(takeUntil(this.destroy$))
      .subscribe(item => { this._permission = item; });
  }

  /**
   * Resolves the effective company ID for the API call:
   * - super_duper_admin with no selection → null (returns ALL companies)
   * - super_admin with a selection         → selected company
   * - super_admin with no selection        → null (returns ALL companies)
   * - regular user                         → always their own company from the JWT
   */
  private getEffectiveCompanyId(): string | undefined {
    const role = resolveRole(this.authService.getUserRole() || '');
    if (role === 'super_duper_admin' || role === 'super_admin') {
      // For both super roles: use the selected company as a filter, or null = all
      const sel = this.selectedCompanyService.getSelectedCompanyId();
      return sel ?? undefined;   // undefined → no ?companyId= query param → backend returns all
    }
    // Regular user: always scope to their own company
    return this.authService.getCompanyId() ?? undefined;
  }

  loadCustomer(): void {
    this.loading = true;
    const effectiveCompanyId = this.getEffectiveCompanyId();

    this.service.Getall(effectiveCompanyId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (item) => {
          this.customerlist = item;
          // Sort descending by ID
          this.customerlist.sort((a, b) => {
            const keyA = a.uniqueKeyID || '';
            const keyB = b.uniqueKeyID || '';
            return keyB.localeCompare(keyA, undefined, { numeric: true });
          });
          this.datasource = new MatTableDataSource<customer>(this.customerlist);
          this.datasource.paginator = this.paginator;
          this.datasource.sort = this.sort;
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading customers:', error);
          this.loading = false;
        }
      });
  }

  loadCompanies(): void {
    this.userservice.getActiveCompanies()
      .pipe(takeUntil(this.destroy$))
      .subscribe(companies => {
        if (!companies) return;
        companies.forEach(c => {
          if (c?.companyId) this.companyMap[c.companyId] = c.name || '';
        });
      });
  }

  customerremove(uniqueKeyID: string): void {
    if (!this._permission.havedelete) {
      this.toastr.warning('User not having delete access', 'Warning');
      return;
    }
    // super_duper_admin is read-only
    if (this.isSuperDuperAdmin) {
      this.toastr.warning('super_duper_admin is read-only. Deletion not permitted.', 'Warning');
      return;
    }
    if (confirm('Are you sure you want to delete this customer?')) {
      const effectiveCompanyId = this.getEffectiveCompanyId();
      this.service.Deletecustomer(uniqueKeyID, effectiveCompanyId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            if (response?.result === 'pass') {
              this.toastr.success('Customer deleted successfully', 'Success');
              this.loadCustomer();
            } else {
              this.toastr.error('Failed to delete: ' + response?.message, 'Error');
            }
          },
          error: (error) => {
            console.error('Delete error:', error);
            this.toastr.error('Failed to delete customer', 'Error');
          }
        });
    }
  }
}
