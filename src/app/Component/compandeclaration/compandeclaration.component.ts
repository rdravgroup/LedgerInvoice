import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../material.module';
import { Company } from '../../_model/company.model';
import { CompanyService } from '../../_service/company.service';
import { AuthService } from '../../_service/authentication.service';
import { SelectedCompanyService } from '../../_service/selected-company.service';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { DeclarationFormDialogComponent } from './declaration-form-dialog.component';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';
import { LoggerService } from '../../_service/logger.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-clear',
  standalone: true,
  imports: [CommonModule, MaterialModule, MatTableModule, MatPaginatorModule, MatSortModule, MatDialogModule],
  templateUrl: './compandeclaration.component.html',
  styleUrls: ['./compandeclaration.component.css']
})
export class CompanDeclarationComponent implements OnInit, OnDestroy {
  companies: Company[] = [];
  selectedCompanyId = '';
  datasource = new MatTableDataSource<any>([]);
  declarations: any[] = [];  // for mobile card list
  displayedColumns: string[] = ['recId', 'declaration', 'active', 'createdDate', 'action'];

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  isSuperAdmin = false;
  isAdmin = false;
  private destroy$ = new Subject<void>();

  constructor(
    private companyService: CompanyService,
    private auth: AuthService,
    private dialog: MatDialog,
    private toastr: ToastrService,
    private logger: LoggerService,
    private selectedCompanyService: SelectedCompanyService
  ) {}

  ngOnInit(): void {
    const role = (this.auth.getUserRole() || '').toLowerCase();
    this.isSuperAdmin = role === 'super_admin' || role === 'superadmin';
    this.isAdmin = role === 'admin';

    if (this.isSuperAdmin) {
      this.companyService.getAllCompanies(true).subscribe({
        next: (list) => { this.companies = list || []; },
        error: (err) => { console.error(err); this.toastr.error('Failed to load companies'); }
      });
    } else {
      const cid = this.auth.getCompanyId();
      if (cid) {
        this.selectedCompanyId = cid;
        this.loadDeclarations(cid);
      }
    }

    // Subscribe to selected company changes (useful for super_admin selection elsewhere)
    this.selectedCompanyService.selectedCompanyId$.pipe(takeUntil(this.destroy$)).subscribe((cid: string | null) => {
      if (!cid) return;
      this.selectedCompanyId = cid;
      this.loadDeclarations(cid);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onCompanyChange(): void {
    if (this.selectedCompanyId) this.loadDeclarations(this.selectedCompanyId);
  }

  loadDeclarations(companyId: string): void {
    this.companyService.getDeclarations(companyId).subscribe({
      next: (list: any[]) => {
        this.declarations = list || [];
        this.datasource = new MatTableDataSource<any>(list || []);
        this.datasource.paginator = this.paginator;
        this.datasource.sort = this.sort;
        this.logger.info('CompanDeclarationComponent', `Loaded ${list?.length || 0} declarations`);
      },
      error: (err) => { console.error(err); this.toastr.error('Failed to load declarations'); }
    });
  }

  openCreate(): void {
    if (!this.selectedCompanyId) { this.toastr.warning('Select a company'); return; }
    const ref = this.dialog.open(DeclarationFormDialogComponent, { width: '600px', data: { companyId: this.selectedCompanyId } });
    ref.afterClosed().subscribe(res => { if (res) this.loadDeclarations(this.selectedCompanyId); });
  }

  openEdit(item: any): void {
    const ref = this.dialog.open(DeclarationFormDialogComponent, { width: '600px', data: { item } });
    ref.afterClosed().subscribe(res => { if (res) this.loadDeclarations(this.selectedCompanyId); });
  }

  deleteItem(recId: number): void {
    const ref = this.dialog.open(ConfirmDialogComponent, { width: '420px', data: { title: 'Confirm delete', message: 'Delete this declaration?' } });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.companyService.deleteDeclaration(recId).subscribe({
        next: (r: any) => {
          if (r && (r.result === 'pass' || r.Result === 'pass')) {
            this.toastr.success('Deleted', 'Success');
            this.loadDeclarations(this.selectedCompanyId);
          } else {
            this.toastr.error(r?.errorMessage || 'Failed to delete');
          }
        },
        error: (e) => { console.error(e); this.toastr.error('Failed to delete'); }
      });
    });
  }

  applyFilter(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.datasource.filter = val.trim().toLowerCase();
    if (this.datasource.paginator) this.datasource.paginator.firstPage();
  }
}