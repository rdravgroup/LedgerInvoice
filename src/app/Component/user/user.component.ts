import { Component, OnInit, AfterViewInit, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../../material.module';
import { UserDetailed } from '../../_model/user.model';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { UserService } from '../../_service/user.service';
import { AuthService } from '../../_service/authentication.service';
import { ToastrService } from 'ngx-toastr';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { UserupdateComponent } from '../userupdate/userupdate.component';
import { MapCompanyComponent } from './map-company.component';
import { UserDetailsDialogComponent } from './user-details-dialog.component';
import { LoggerService } from '../../_service/logger.service';
import { CreateManagedUserDialogComponent } from './create-managed-user-dialog.component';

@Component({
  selector: 'app-user',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MaterialModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatDialogModule
  ],
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.css'],
})
export class UserComponent implements OnInit, AfterViewInit {
  userlist: UserDetailed[] = [];
  displayedColumns: string[] = [
    'name',
    'loginId',
    'companyname',
    'status',
    'role',
    'action',
  ];
  datasource = new MatTableDataSource<UserDetailed>([]);

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  isMobile = false;
  filterValue = '';

  constructor(
    private service: UserService,
    private toastr: ToastrService,
    private dialog: MatDialog,
    private logger: LoggerService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.logger.logComponentLifecycle('UserComponent', 'ngOnInit');
    this.loadUsers();
    this.checkScreenSize();
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

  canShowActions(targetRole: string): boolean {
    const current = (localStorage.getItem('userrole') || '').toLowerCase();
    return current === 'super_admin';
  }

  loadUsers() {
    this.service.getAllUsersDetailed().subscribe({
      next: (users: UserDetailed[]) => {
        this.userlist = users || [];
        this.datasource = new MatTableDataSource<UserDetailed>(this.userlist);
        this.datasource.filterPredicate = (user, filter) => this.matchesFilter(user, filter);
        this.datasource.sortingDataAccessor = (user, property) => {
          if (property === 'loginId') return this.getLoginId(user).toLowerCase();
          if (property === 'companyname') return (user.company?.companyName || '').toLowerCase();
          return String((user as any)[property] ?? '').toLowerCase();
        };
        this.datasource.paginator = this.paginator;
        this.datasource.sort = this.sort;
        this.logger.info('UserComponent', `Loaded ${this.userlist.length} users`);
        this.toastr.success(`Loaded ${this.userlist.length} users`, 'Success');
      },
      error: (error) => {
        console.error('Error loading users:', error);
        this.datasource = new MatTableDataSource<UserDetailed>([]);
        this.toastr.error('Failed to load users', 'Error');
      }
    });
  }

  get filteredUsers(): UserDetailed[] {
    const filter = this.filterValue.trim().toLowerCase();
    return filter ? this.userlist.filter(user => this.matchesFilter(user, filter)) : this.userlist;
  }

  applyFilter(event: Event): void {
    this.filterValue = (event.target as HTMLInputElement).value;
    this.datasource.filter = this.filterValue.trim().toLowerCase();
    if (this.datasource.paginator) this.datasource.paginator.firstPage();
  }

  getLoginId(user: UserDetailed): string {
    return user.username || user.email || 'N/A';
  }

  private matchesFilter(user: UserDetailed, filter: string): boolean {
    const values = [
      user.name,
      user.username,
      user.email,
      user.company?.companyName,
      user.companyId,
      user.role,
      user.isactive ? 'active' : 'inactive'
    ];
    return values.some(value => String(value || '').toLowerCase().includes(filter));
  }

  updaterole(username: string) {
    this.openPopup(username, 'role');
  }

  updatestatus(username: string) {
    this.openPopup(username, 'status');
  }

  private openPopup(username: string, type: string) {
    const cfg: any = {
      width: this.isMobile ? '100%' : '30%',
      maxWidth: this.isMobile ? '100vw' : '640px',
      maxHeight: this.isMobile ? '100vh' : '80vh',
      height: this.isMobile ? '100vh' : undefined,
      panelClass: this.isMobile ? 'full-screen-dialog' : undefined,
      enterAnimationDuration: '300ms',
      exitAnimationDuration: '200ms',
      data: { username, type }
    };

    this.dialog.open(UserupdateComponent, cfg).afterClosed().subscribe(() => {
      this.loadUsers();
    });
  }

  mapCompanyCode(username: string) {
    const cfg: any = {
      width: this.isMobile ? '100%' : '360px',
      maxWidth: this.isMobile ? '100vw' : '480px',
      maxHeight: this.isMobile ? '100vh' : '80vh',
      height: this.isMobile ? '100vh' : undefined,
      panelClass: this.isMobile ? 'full-screen-dialog' : undefined,
      enterAnimationDuration: '200ms',
      exitAnimationDuration: '200ms',
      data: { username }
    };

    this.dialog.open(MapCompanyComponent, cfg).afterClosed().subscribe(result => {
      if (result) {
        this.loadUsers();
      }
    });
  }

  /**
   * View full user details in a dialog
   */
  viewUserDetails(username: string) {
    const cfg: any = {
      width: this.isMobile ? '100%' : '600px',
      maxWidth: this.isMobile ? '100vw' : '700px',
      maxHeight: this.isMobile ? '100vh' : '90vh',
      height: this.isMobile ? '100vh' : undefined,
      panelClass: this.isMobile ? 'full-screen-dialog' : undefined,
      enterAnimationDuration: '300ms',
      exitAnimationDuration: '200ms',
      data: { username }
    };

    this.dialog.open(UserDetailsDialogComponent, cfg);
  }

  addUser(): void {
    const ref = this.dialog.open(CreateManagedUserDialogComponent, {
      width: this.isMobile ? '100%' : '620px',
      maxWidth: '96vw',
      data: { companyId: this.authService.getCompanyId() },
      autoFocus: false
    });
    ref.afterClosed().subscribe(result => {
      if (result?.result === 'pass' || result?.Result === 'pass') {
        this.toastr.success('User created and credentials emailed.', 'User');
        this.loadUsers();
      }
    });
  }

  editUser(user: UserDetailed): void {
    const ref = this.dialog.open(CreateManagedUserDialogComponent, {
      width: this.isMobile ? '100%' : '620px',
      maxWidth: '96vw',
      data: { user },
      autoFocus: false
    });
    ref.afterClosed().subscribe(result => {
      if (result?.result === 'pass' || result?.Result === 'pass') {
        this.toastr.success('User updated successfully.', 'User');
        this.loadUsers();
      }
    });
  }
}