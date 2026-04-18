import { Component, OnInit, AfterViewInit, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../material.module';
import { Company } from '../../_model/company.model';
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
  isSuperAdmin = false;
  isAdmin = false;

  constructor(
    private companyService: CompanyService,
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
    this.loadCompanies();
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
    // super_admin: full list; admin => active list
    const obs = this.isSuperAdmin ? this.companyService.getAllCompanies(false) : this.companyService.getActiveCompanies();
    obs.subscribe({
      next: (list: Company[]) => {
        this.companies = list || [];
        this.datasource = new MatTableDataSource<Company>(this.companies);
        this.datasource.paginator = this.paginator;
        this.datasource.sort = this.sort;
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
      if (res) this.loadCompanies();
    });
  }

  openEdit(item: Company): void {
    const cfg: any = { width: this.isMobile ? '100%' : '720px', data: { company: item } };
    this.dialog.open(CompanyFormDialogComponent, cfg).afterClosed().subscribe((res) => {
      if (res) this.loadCompanies();
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
          } else {
            this.toastr.error(r?.errorMessage || r?.ErrorMessage || 'Failed to change status', 'Error');
          }
        },
        error: (err) => {
          console.error('Change status error', err);
          this.toastr.error('Failed to change status', 'Error');
        }
      });
    });
  }
}
