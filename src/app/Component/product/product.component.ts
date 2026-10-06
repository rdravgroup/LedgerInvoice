import { Component, OnInit, ViewChild, Inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../material.module';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { MasterService } from '../../_service/master.service';
import { ToastrService } from 'ngx-toastr';
import { SelectedCompanyService } from '../../_service/selected-company.service';
import { AuthService } from '../../_service/authentication.service';
import { CompanyService } from '../../_service/company.service';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatDialog, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-product-list-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  template: `
    <div class="dialog-header">
      <h2 mat-dialog-title>Product List</h2>
      <div class="dialog-header-actions">
        <button mat-icon-button color="primary" type="button" (click)="exportExcel()"
                [disabled]="exporting || dataSource.filteredData.length === 0"
                matTooltip="Export products to Excel" aria-label="Export products to Excel">
          <mat-icon>grid_on</mat-icon>
        </button>
        <button mat-icon-button mat-dialog-close class="close-button" aria-label="Close product list">
          <mat-icon>close</mat-icon>
        </button>
      </div>
    </div>
    <mat-dialog-content>
      <mat-form-field appearance="outline" class="search-field">
        <mat-label>Search</mat-label>
        <input matInput (keyup)="applyFilter($event)" placeholder="Search products">
        <mat-icon matPrefix>search</mat-icon>
      </mat-form-field>

      <!-- Mobile card list (shown on small viewports) -->
      <div class="mobile-only mobile-card-list">
        <mat-card class="list-card" *ngFor="let element of dataSource.filteredData">
          <mat-card-content>
            <div class="list-card-header">
              <div class="list-card-avatar">{{ (element.productName || '').charAt(0) }}</div>
              <div class="list-card-info">
                <div class="list-card-name">{{ element.productName }}</div>
                <div class="list-card-sub">{{ getCategoryName(element.categoryCode) }} • {{ (element.rateWithTax) | currency:'INR' }}</div>
              </div>
            </div>
            <div class="list-card-company">
              <mat-icon>inventory_2</mat-icon>
              <span>{{ element.measurement }}</span>
            </div>
            <div class="list-card-actions">
              <button mat-icon-button color="primary" (click)="onEdit(element)" matTooltip="Edit">
                <mat-icon>edit</mat-icon>
              </button>
              <button mat-icon-button color="warn" (click)="onDelete(element)" matTooltip="Delete">
                <mat-icon>delete</mat-icon>
              </button>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <table mat-table [dataSource]="dataSource" matSort class="desktop-only product-table">
        <ng-container matColumnDef="productName">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>Product Name</th>
          <td mat-cell *matCellDef="let element">{{ element.productName }}</td>
        </ng-container>

        <ng-container matColumnDef="categoryCode">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>Category</th>
          <td mat-cell *matCellDef="let element">{{ getCategoryName(element.categoryCode) }}</td>
        </ng-container>

        <ng-container matColumnDef="price">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>Price</th>
          <td mat-cell *matCellDef="let element">{{ (element.rateWithTax) | currency:'INR' }}</td>
        </ng-container>

        <ng-container matColumnDef="purchaseRate">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>Purchase Rate</th>
            <td mat-cell *matCellDef="let element"><span class="purchase-highlight">{{ element.purchaseRate | currency:'INR' }}</span></td>
        </ng-container>
        
          <ng-container matColumnDef="purchaseRateDate">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Purchase Date</th>
            <td mat-cell *matCellDef="let element"><span class="purchase-highlight">{{ element.purchaseRateDate | date:'dd-MM-yyyy' }}</span></td>
          </ng-container>

        <ng-container matColumnDef="isActive">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>Status</th>
          <td mat-cell *matCellDef="let element">
            <span class="status-badge" [ngClass]="{ 'active': element.isActive, 'inactive': !element.isActive }">
              {{ element.isActive ? 'Active' : 'Inactive' }}
            </span>
          </td>
        </ng-container>

        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef>Actions</th>
          <td mat-cell *matCellDef="let element">
            <button mat-icon-button color="primary" (click)="onEdit(element)" matTooltip="Edit">
              <mat-icon>edit</mat-icon>
            </button>
            <button mat-icon-button color="warn" (click)="onDelete(element)" matTooltip="Delete">
              <mat-icon>delete</mat-icon>
            </button>
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
        <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
      </table>

        <mat-paginator [pageSizeOptions]="[5, 10, 20]" showFirstLastButtons></mat-paginator>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-raised-button mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px 0;
    }
    .dialog-header-actions { display: flex; align-items: center; gap: 8px; }
    .dialog-header h2 {
      margin: 0;
    }
    .close-button {
      position: relative;
      top: -10px;
      right: -10px;
    }
    mat-dialog-content { min-width: clamp(320px, 70vw, 800px); max-height: 70vh; box-sizing: border-box; padding: 0 12px; }
    .search-field { width: 100%; margin-bottom: 20px; }
    .product-table { width: 100%; }
    .status-badge { padding: clamp(4px,0.8vw,8px) clamp(8px,1.4vw,12px); border-radius: 12px; font-size: clamp(11px,1.2vw,14px); font-weight: 500; display: inline-flex; align-items:center; justify-content:center; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    /* Use MD3 semantic token classes (defined in md3-utilities.css) for colors */
    /* .status-badge.active / .status-badge.inactive are handled globally by md3-utilities */
    .purchase-highlight { background-color: var(--md-sys-color-surface-container-high) !important; color: var(--md-sys-color-on-surface) !important; padding: 4px 8px; border-radius: 6px; display: inline-block; }
    /* Mobile card list styling (spacing & card appearance) */
    .mobile-card-list {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }
    .mobile-card-list.hidden { display: none; }
    .list-card {
      border-radius: var(--md-sys-shape-corner-medium) !important;
      box-shadow: var(--md-sys-elevation-1) !important;
      border: 1px solid var(--md-sys-color-outline) !important;
      margin-bottom: var(--space-2);
    }
    .list-card mat-card-content { padding: var(--space-3) var(--space-4) !important; }
    .list-card-actions { display: flex; gap: var(--space-2); margin-top: var(--space-2); }
    @media (max-width: 768px) { mat-dialog-content { min-width: 90vw; } }
  `],
})
export class ProductListDialogComponent implements OnInit, OnDestroy {
  dataSource: any;
  exporting = false;
  searchValue = '';
  private destroy$ = new Subject<void>();
  displayedColumns: string[] = ['productName', 'categoryCode', 'price', 'purchaseRate', 'purchaseRateDate', 'isActive', 'actions'];
  private categoryNames = new Map<string, string>();
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    public dialogRef: MatDialogRef<ProductListDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private masterService: MasterService,
    private toastr: ToastrService
  ) {
    this.dataSource = new MatTableDataSource(data.products);
    this.categoryNames = new Map<string, string>(
      (data.categories || []).map((category: any) => [String(category.code), String(category.name || category.code)])
    );
  }

  getCategoryName(code: string | null | undefined): string {
    const value = String(code ?? '').trim();
    return this.categoryNames.get(value) || value || 'Uncategorized';
  }

  ngOnInit() {
    setTimeout(() => {
      this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this.sort;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.searchValue = filterValue;
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }

  exportExcel(): void {
    if (this.exporting || this.dataSource.filteredData.length === 0) return;
    this.exporting = true;
    this.masterService.ExportProductsExcel(this.data.companyId, this.searchValue)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.exporting = false)
      )
      .subscribe({
        next: (response: any) => {
          if (!response.body || response.body.size === 0) {
            this.toastr.error('The product Excel file is empty.', 'Export failed');
            return;
          }
          const disposition = response.headers.get('Content-Disposition') || '';
          const match = disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
          let fileName = match?.[1] || match?.[2] || this.fallbackFileName();
          try { fileName = decodeURIComponent(fileName); } catch { /* Use the server-provided filename as-is. */ }
          const url = URL.createObjectURL(response.body);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.style.display = 'none';
          anchor.download = fileName;
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        },
        error: () => this.toastr.error('Failed to export products to Excel.', 'Export failed')
      });
  }

  private fallbackFileName(): string {
    const companyId = String(this.data.companyId || 'ALL')
      .replace(/[^a-zA-Z0-9_-]/g, '');
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `Products_${companyId || 'ALL'}_${date}.xlsx`;
  }

  onEdit(product: any) {
    this.dialogRef.close();
    this.data.onEdit(product);
  }

  onDelete(product: any) {
    this.dialogRef.close();
    this.data.onDelete(product);
  }
}

@Component({
  selector: 'app-product',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule, FormsModule],
  templateUrl: './product.component.html',
  styleUrls: ['./product.component.css']
})
export class ProductComponent implements OnInit, OnDestroy {
  private readonly superAdminFallbackCompanyId = 'COMP1';
  private destroy$ = new Subject<void>();
  productForm!: FormGroup;
  productList: any[] = [];
  categoryList: any[] = [];
  measurementList: any[] = [];
  isEditMode = false;
  editProductCode: string = '';
  totalProducts = 0;
  activeProducts = 0;
  showExtraFields = false;
  defaultCategoryCode = '';
  private readonly decimalMax = 999999999999999;

  private numberValidator(maxValue: number, decimals: number, minValue = 0) {
    return (control: any) => {
      const value = control?.value;
      if (value === null || value === undefined || value === '') return null;
      const numericValue = Number(value);
      if (Number.isNaN(numericValue)) return { invalidNumber: true };
      if (numericValue < minValue) return { min: true };
      if (numericValue > maxValue) return { max: true };
      const rounded = Number(numericValue.toFixed(decimals));
      if (Number(value) !== rounded && String(value).includes('.')) {
        const decimalsValue = String(value).split('.')[1]?.length ?? 0;
        if (decimalsValue > decimals) return { precision: true };
      }
      return null;
    };
  }

  constructor(
    private fb: FormBuilder,
    private service: MasterService,
    private toastr: ToastrService,
    private dialog: MatDialog
    , private selectedCompanyService: SelectedCompanyService
    , private authService: AuthService
    , private companyService: CompanyService
  ) {}

  ngOnInit(): void {
    this.initForm();
    if (this.isSuperAdminRole() && !this.selectedCompanyService.getSelectedCompanyId()) {
      Promise.resolve().then(() => {
        if (!this.destroy$.isStopped && !this.selectedCompanyService.getSelectedCompanyId()) {
          this.selectedCompanyService.setSelectedCompanyId(this.superAdminFallbackCompanyId);
        }
      });
    }
    this.loadProducts();
    this.loadCategories();
    this.loadMeasurements();
    this.loadCompanyConfiguration();

    // Reload products when selected company changes
    this.selectedCompanyService.selectedCompanyId$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.loadProducts();
      this.loadCompanyConfiguration();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private isSuperAdminRole(): boolean {
    const role = (this.authService.getUserRole() || '').toLowerCase().replace(/-/g, '_');
    return role === 'super_admin' || role === 'superadmin'
      || role === 'super_duper_admin' || role === 'superduper';
  }

  private effectiveProductCompanyId(): string {
    const selectedCompanyId = this.selectedCompanyService.getSelectedCompanyId()?.trim();
    if (this.isSuperAdminRole()) {
      return selectedCompanyId || this.superAdminFallbackCompanyId;
    }
    return this.authService.getCompanyId() || selectedCompanyId || '';
  }

  initForm() {
    this.productForm = this.fb.group({
      productName: ['', [Validators.required, Validators.maxLength(200)]],
      measurement: ['', [Validators.required, Validators.maxLength(10)]],
      hsnSacNumber: ['', Validators.maxLength(20)],
      categoryCode: ['', [Validators.required, Validators.maxLength(20)]],
      cgstRate: [0, [Validators.required, Validators.min(0), Validators.max(100), this.numberValidator(100, 2)]],
      scgstRate: [0, [Validators.required, Validators.min(0), Validators.max(100), this.numberValidator(100, 2)]],
      totalGstRate: [0, [Validators.required, Validators.min(0), Validators.max(100), this.numberValidator(100, 2)]],
      rateWithoutTax: [0, [Validators.required, Validators.min(0), this.numberValidator(this.decimalMax, 3)]],
      rateWithTax: [0, [Validators.required, Validators.min(0), this.numberValidator(this.decimalMax, 3)]],
      discountType: ['percentage', Validators.required],
      discountValue: [0, [Validators.required, Validators.min(0)]],
      purchaseRate: [null, [Validators.min(0), this.numberValidator(this.decimalMax, 3)]],
      purchaseRateDate: [null],
      stockQty: [0, [Validators.min(0), this.numberValidator(this.decimalMax, 3)]],
      minStockQty: [0, [Validators.min(0), this.numberValidator(this.decimalMax, 3)]],
      maxStockQty: [0, [Validators.min(0), this.numberValidator(this.decimalMax, 3)]],
      reorderLevel: [0, [Validators.min(0), this.numberValidator(this.decimalMax, 3)]],
      lastPurchaseRate: [0, [Validators.min(0), this.numberValidator(this.decimalMax, 4)]],
      lastPurchaseDate: [null],
      remark: ['', Validators.maxLength(200)],
      isActive: [true]
    });
    // Ensure form controls match initial showExtraFields state
    this.setExtraFieldsState(this.showExtraFields);
  }

  private setExtraFieldsState(enabled: boolean) {
    const keys = [
      'cgstRate',
      'scgstRate',
      'totalGstRate',
      'stockQty',
      'minStockQty',
      'maxStockQty',
      'reorderLevel',
      'lastPurchaseRate',
      'lastPurchaseDate'
    ];
    for (const k of keys) {
      const c = this.productForm.get(k);
      if (!c) { continue; }
      if (enabled) { c.enable({ emitEvent: false }); } else { c.disable({ emitEvent: false }); }
    }
  }

  onShowExtraFieldsChange(checked: boolean) {
    this.showExtraFields = !!checked;
    if (this.productForm) { this.setExtraFieldsState(this.showExtraFields); }
  }

  loadProducts() {
    const effectiveCompanyId = this.effectiveProductCompanyId();
    this.service.GetProducts(effectiveCompanyId ?? undefined).subscribe({
      next: (res: any) => {
        this.productList = res || [];
        // Sort by uniqueKeyID in descending order
        this.productList.sort((a, b) => {
          const keyA = a.uniqueKeyID || '';
          const keyB = b.uniqueKeyID || '';
          return keyB.localeCompare(keyA, undefined, { numeric: true });
        });
        this.totalProducts = this.productList.length;
        this.activeProducts = this.productList.filter(p => p.isActive).length;
      },
      error: () => this.toastr.error('Failed to load products', 'Error')
    });
  }

  loadCategories() {
    this.service.GetCategories().subscribe({
      next: (res: any) => {
        const categories = Array.isArray(res)
          ? res
          : res?.data || res?.Data || res?.items || res?.Items || [];
        this.categoryList = categories
          .map((category: any) => ({
            code: category.uniqueKeyId || category.UniqueKeyId || category.uniqueKeyID || category.UniqueKeyID || category.code || category.Code,
            name: category.name || category.Name || '',
            isActive: category.isActive ?? category.IsActive ?? true
          }))
          .filter((category: any) => category.isActive && category.code);
      },
      error: () => this.toastr.error('Failed to load categories', 'Error')
    });
  }

  private loadCompanyConfiguration(): void {
    const companyId = this.effectiveProductCompanyId();
    if (!companyId) return;
    this.companyService.getCompanyById(companyId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (company: any) => {
        this.defaultCategoryCode = company?.defaultProductCategoryCode || company?.DefaultProductCategoryCode || '';
        if (!this.isEditMode && this.defaultCategoryCode && this.productForm?.get('categoryCode')?.value === '') {
          this.productForm.patchValue({ categoryCode: this.defaultCategoryCode }, { emitEvent: false });
        }
      }
    });
  }

  private resolveCategoryCode(value: any): string {
    const rawValue = String(value ?? '');
    const category = this.categoryList.find(item =>
      item.code === rawValue || item.name === rawValue);
    return category?.code || rawValue;
  }

  loadMeasurements() {
    this.service.GetAllMeasurements().subscribe({
      next: (res: any) => this.measurementList = res || [],
      error: () => this.toastr.error('Failed to load measurements', 'Error')
    });
  }

  openProductList() {
    this.dialog.open(ProductListDialogComponent, {
      width: '900px',
      maxWidth: '95vw',
      data: {
        products: this.productList,
        categories: this.categoryList,
        companyId: this.effectiveProductCompanyId(),
        onEdit: (product: any) => this.editProduct(product),
        onDelete: (product: any) => this.deleteProduct(product)
      }
    });
  }

  onSubmit() {
    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      this.toastr.warning('Please fill all required fields', 'Validation');
      return;
    }

    const formValue = this.productForm.getRawValue();
    const discountType = String(formValue.discountType || 'percentage').toLowerCase();
    const discountValue = Number(formValue.discountValue || 0);
    if (discountValue < 0 || (discountType === 'percentage' && discountValue > 100)) {
      this.toastr.warning(discountType === 'percentage' ? 'Discount percentage must be between 0 and 100.' : 'Discount cannot be negative.', 'Validation');
      return;
    }
    const payload = {
      uniqueKeyId: this.isEditMode ? this.editProductCode : null,
      ...formValue,
      rateWithTax: formValue.rateWithTax || 0,
      rateWithoutTax: formValue.rateWithoutTax || 0
    };

    const effectiveCompanyId = this.effectiveProductCompanyId();
    if (!effectiveCompanyId) {
      this.toastr.warning('Please select a company before saving products.', 'Validation');
      return;
    }

    this.service.SaveProduct(payload, effectiveCompanyId).subscribe({
      next: (res: any) => {
        if (res.result === 'pass') {
          this.toastr.success(
            this.isEditMode ? 'Updated successfully' : 'Created successfully',
            'Product'
          );
          this.resetForm();
          this.loadProducts();
        } else {
          this.toastr.error(res.ErrorMessage || res.message || 'Failed to save', 'Error');
        }
      },
      error: () => this.toastr.error('Failed to save product', 'Error')
    });
  }

  editProduct(product: any) {
    this.isEditMode = true;
    this.editProductCode = product.uniqueKeyID;
    // show extra fields when editing so values are visible
    this.showExtraFields = true;
    this.setExtraFieldsState(true);
    this.productForm.patchValue({
      productName: product.productName,
      measurement: product.measurement,
      hsnSacNumber: product.hsnSacNumber,
      categoryCode: this.resolveCategoryCode(product.categoryCode),
      cgstRate: product.cgstRate,
      scgstRate: product.scgstRate,
      totalGstRate: product.totalGstRate,
      rateWithoutTax: product.rateWithoutTax,
      rateWithTax: product.rateWithTax,
      discountType: product.discountType || 'percentage',
      discountValue: product.discountValue ?? 0,
      purchaseRate: product.purchaseRate,
      purchaseRateDate: product.purchaseRateDate ? new Date(product.purchaseRateDate) : null,
      stockQty: product.stockQty ?? 0,
      minStockQty: product.minStockQty ?? 0,
      maxStockQty: product.maxStockQty ?? 0,
      reorderLevel: product.reorderLevel ?? 0,
      lastPurchaseRate: product.lastPurchaseRate ?? 0,
      lastPurchaseDate: product.lastPurchaseDate ? new Date(product.lastPurchaseDate) : null,
      remark: product.remark,
      isActive: product.isActive
    });
  }

  deleteProduct(product: any) {
    if (confirm(`Delete product "${product.productName}"?`)) {
      const effectiveCompanyId = this.effectiveProductCompanyId();
      this.service.RemoveProduct(product.uniqueKeyID, effectiveCompanyId ?? undefined).subscribe({
        next: (res: any) => {
          if (res.result === 'pass') {
            this.toastr.success('Deleted successfully', 'Product');
            this.loadProducts();
          } else {
            this.toastr.error(res.errorMessage || 'Failed to delete', 'Error');
          }
        },
        error: () => this.toastr.error('Failed to delete product', 'Error')
      });
    }
  }

  resetForm() {
    this.isEditMode = false;
    this.editProductCode = '';
    this.showExtraFields = false;
    this.productForm.reset({ isActive: true, categoryCode: this.defaultCategoryCode, rateWithoutTax: 0, rateWithTax: 0, discountType: 'percentage', discountValue: 0, purchaseRate: null, purchaseRateDate: null, stockQty: 0, minStockQty: 0, maxStockQty: 0, reorderLevel: 0, lastPurchaseRate: 0, lastPurchaseDate: null });
    this.productForm.patchValue({ cgstRate: 0, scgstRate: 0, totalGstRate: 0 });
    // Keep hidden extra fields disabled until user expands them
    this.setExtraFieldsState(this.showExtraFields);
  }
}
