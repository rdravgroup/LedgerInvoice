import { Component, OnInit, OnDestroy, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';

import { MaterialModule } from '../../../material.module';
import { AuthService } from '../../../_service/authentication.service';
import { SelectedCompanyService } from '../../../_service/selected-company.service';
import { PurchaseService } from '../../../_service/purchase.service';
import { VendorList, Vendor } from '../../../_model/purchase.model';
import { VendorFormDialogComponent, VendorFormDialogData } from './vendor-form-dialog.component';
import { VendorLedgerDialogComponent, VendorLedgerDialogData } from './vendor-ledger-dialog.component';

// FIX #1: Edit Vendor and View Ledger previously rendered as an inline
// "side panel" (showForm/showLedger booleans toggling a permanent split
// layout), not a real modal popup. Both are now genuine MatDialog popups.
//
// FIX #2: canEdit compared the role string WITHOUT normalizing casing,
// unlike every other role-gated component in the app (listinvoice.component.ts
// etc. use .toLowerCase().replace(/-/g,'_')). If the actual role claim had
// any casing/format difference, canEdit silently evaluated to false for a
// legitimately privileged user, with zero error shown — exactly matching
// "Update vendor not enabled" / confusion about active status, since
// toggleActive() also silently no-ops when canEdit is false.
@Component({
  selector: 'app-vendor',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule],
  templateUrl: './vendor.component.html',
  styleUrls: ['./vendor.component.css']
})
export class VendorComponent implements OnInit, OnDestroy {

  loading    = false;
  activeOnly = true;
  searchText = '';

  companyId   = '';
  currentUser = '';
  userRole    = '';

  vendors: VendorList[] = [];

  displayedColumns = [
    'vendorName', 'contactPerson', 'gstin',
    'city', 'rating', 'outstandingBalance', 'isActive', 'actions'
  ];
  dataSource = new MatTableDataSource<VendorList>([]);

  @ViewChild(MatSort)      sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  private destroy$ = new Subject<void>();

  constructor(
    private auth:    AuthService,
    private company: SelectedCompanyService,
    private svc:     PurchaseService,
    private snack:   MatSnackBar,
    private dialog:  MatDialog,
    private cd:      ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.currentUser = this.auth.getUsername() ?? '';
    // FIX: normalize role casing/format exactly like listinvoice.component.ts.
    this.userRole = (this.auth.getUserRole() || '').toLowerCase().replace(/-/g, '_');

    this.company.selectedCompanyId$
      .pipe(takeUntil(this.destroy$))
      .subscribe(id => {
        this.companyId = id ?? this.auth.getCompanyId() ?? '';
        if (this.companyId) this.loadVendors();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get canEdit(): boolean {
    return ['super_admin', 'admin'].includes(this.userRole);
  }

  get summaryStats() {
    const active    = this.vendors.filter(v => v.isActive).length;
    const inactive  = this.vendors.length - active;
    const totalOut  = this.vendors.reduce((s, v) => s + (v.outstandingBalance ?? 0), 0);
    const overLimit = this.vendors.filter(
      v => v.isActive && v.creditLimit > 0 && (v.outstandingBalance ?? 0) > v.creditLimit
    ).length;
    return { active, inactive, total: this.vendors.length, totalOut, overLimit };
  }

  starFilledList(rating: number, i: number): boolean {
    return i <= rating;
  }

  loadVendors(): void {
    if (!this.companyId) return;
    this.loading = true;
    this.svc.getVendors(this.companyId, this.searchText || undefined, this.activeOnly)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: res => {
          this.loading = false;
          if (res.result === 'pass') {
            this.vendors    = res.data ?? [];
            this.dataSource = new MatTableDataSource(this.vendors);
            setTimeout(() => {
              if (this.sort)      this.dataSource.sort      = this.sort;
              if (this.paginator) this.dataSource.paginator = this.paginator;
            });
          } else {
            this.showSnack(res.errorMessage || 'Failed to load vendors', 'error');
          }
          this.cd.markForCheck();
        },
        error: () => { this.loading = false; this.showSnack('Error loading vendors', 'error'); }
      });
  }

  applyFilter(event: Event): void {
    const val = (event.target as HTMLInputElement).value.trim().toLowerCase();
    this.dataSource.filter = val;
  }

  toggleActiveFilter(): void {
    this.activeOnly = !this.activeOnly;
    this.loadVendors();
  }

  openCreateForm(): void {
    const data: VendorFormDialogData = { companyId: this.companyId, canEdit: this.canEdit };
    const ref = this.dialog.open(VendorFormDialogComponent, {
      width: '640px', maxWidth: '96vw', maxHeight: '90vh', data, autoFocus: false
    });
    ref.afterClosed().pipe(takeUntil(this.destroy$)).subscribe(result => {
      if (result?.saved) {
        this.showSnack('Vendor created successfully', 'success');
        this.loadVendors();
      }
    });
  }

  openEditForm(vendor: VendorList): void {
    if (!this.canEdit) return;
    const data: VendorFormDialogData = {
      companyId: this.companyId, vendorId: vendor.vendorId, canEdit: this.canEdit
    };
    const ref = this.dialog.open(VendorFormDialogComponent, {
      width: '640px', maxWidth: '96vw', maxHeight: '90vh', data, autoFocus: false
    });
    ref.afterClosed().pipe(takeUntil(this.destroy$)).subscribe(result => {
      if (result?.saved) {
        this.showSnack('Vendor updated successfully', 'success');
        this.loadVendors();
      }
    });
  }

  viewLedger(vendor: VendorList): void {
    const data: VendorLedgerDialogData = {
      vendorId: vendor.vendorId, companyId: this.companyId,
      vendorName: vendor.vendorName, creditLimit: vendor.creditLimit
    };
    this.dialog.open(VendorLedgerDialogComponent, {
      width: '720px', maxWidth: '96vw', maxHeight: '85vh', data, autoFocus: false
    });
  }

  toggleActive(vendor: VendorList): void {
    if (!this.canEdit) return;
    // FIX: activate/deactivate previously fired immediately with no
    // confirmation, and no feedback on what the action actually meant.
    const action = vendor.isActive ? 'deactivate' : 'activate';
    const confirmed = window.confirm(
      vendor.isActive
        ? `Deactivate vendor "${vendor.vendorName}"? Deactivated vendors are hidden from the active list by default and cannot be selected on new purchase orders/invoices until reactivated.`
        : `Activate vendor "${vendor.vendorName}"? This will make it selectable again on new purchase orders/invoices.`
    );
    if (!confirmed) return;

    const updated: Vendor = {
      vendorId: vendor.vendorId, companyId: vendor.companyId,
      vendorName: vendor.vendorName, paymentTermsDays: 30,
      openingBalance: 0, creditLimit: vendor.creditLimit,
      rating: vendor.rating, isActive: !vendor.isActive
    };
    this.svc.updateVendor(updated).pipe(takeUntil(this.destroy$)).subscribe({
      next: res => {
        if (res.result === 'pass') {
          vendor.isActive = !vendor.isActive;
          this.showSnack(vendor.isActive ? `Vendor ${vendor.vendorName} activated` : `Vendor ${vendor.vendorName} deactivated`, 'success');
        } else {
          this.showSnack(res.errorMessage || `Failed to ${action} vendor`, 'error');
        }
      },
      error: () => this.showSnack(`Error trying to ${action} vendor`, 'error')
    });
  }

  private showSnack(msg: string, type: 'success' | 'error'): void {
    this.snack.open(msg, '✕', {
      duration: 3500,
      panelClass: type === 'success' ? ['snack-success'] : ['snack-error'],
      horizontalPosition: 'end',
      verticalPosition: 'top'
    });
  }
}
