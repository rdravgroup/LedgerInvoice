import { Component, OnInit, ViewChild, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../material.module';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { MasterService } from '../../_service/master.service';
import { ToastrService } from 'ngx-toastr';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatDialog, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-product-list-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  template: `
    <div class="dialog-header">
      <h2 mat-dialog-title>Product List</h2>
      <button mat-icon-button mat-dialog-close class="close-button">
        <mat-icon>close</mat-icon>
      </button>
    </div>
    <mat-dialog-content>
      <mat-form-field appearance="outline" class="search-field">
        <mat-label>Search</mat-label>
        <input matInput (keyup)="applyFilter($event)" placeholder="Search products">
        <mat-icon matPrefix>search</mat-icon>
      </mat-form-field>

      <table mat-table [dataSource]="dataSource" matSort class="product-table">
        <ng-container matColumnDef="productName">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>Product Name</th>
          <td mat-cell *matCellDef="let element">{{ element.productName }}</td>
        </ng-container>

        <ng-container matColumnDef="categoryCode">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>Category</th>
          <td mat-cell *matCellDef="let element">{{ element.categoryCode }}</td>
        </ng-container>

        <ng-container matColumnDef="price">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>Price</th>
          <td mat-cell *matCellDef="let element">{{ element.rateWithTax | currency:'INR' }}</td>
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
            <span [class]="element.isActive ? 'chip-active' : 'chip-inactive'" class="status-badge">
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
    .dialog-header h2 {
      margin: 0;
    }
    .close-button {
      position: relative;
      top: -10px;
      right: -10px;
    }
    mat-dialog-content { min-width: 800px; max-height: 70vh; }
    .search-field { width: 100%; margin-bottom: 20px; }
    .product-table { width: 100%; }
    .status-badge { padding: 6px 12px; border-radius: 12px; font-size: 0.85rem; font-weight: 500; display: inline-block; }
    .chip-active { background-color: #4caf50 !important; color: white; }
    .chip-inactive { background-color: #f44336 !important; color: white; }
      .purchase-highlight { background-color: #8B0000 !important; color: #fff !important; padding: 4px 8px; border-radius: 6px; display: inline-block; }
    @media (max-width: 768px) { mat-dialog-content { min-width: 90vw; } }
  `]
})
export class ProductListDialogComponent implements OnInit {
  dataSource: any;
  displayedColumns: string[] = ['productName', 'categoryCode', 'price', 'purchaseRate', 'purchaseRateDate', 'isActive', 'actions'];
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    public dialogRef: MatDialogRef<ProductListDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.dataSource = new MatTableDataSource(data.products);
  }

  ngOnInit() {
    setTimeout(() => {
      this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this.sort;
    });
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();
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
  styleUrl: './product.component.css'
})
export class ProductComponent implements OnInit {
  productForm!: FormGroup;
  productList: any[] = [];
  categoryList: any[] = [];
  measurementList: any[] = [];
  isEditMode = false;
  editProductCode: string = '';
  totalProducts = 0;
  activeProducts = 0;
  showExtraFields = false;

  constructor(
    private fb: FormBuilder,
    private service: MasterService,
    private toastr: ToastrService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadProducts();
    this.loadCategories();
    this.loadMeasurements();
  }

  initForm() {
    this.productForm = this.fb.group({
      productName: ['', Validators.required],
      measurement: ['', Validators.required],
      hsnSacNumber: [''],
      categoryCode: ['', Validators.required],
      cgstRate: [{value: 9, disabled: true}, [Validators.required, Validators.min(0)]],
      scgstRate: [{value: 9, disabled: true}, [Validators.required, Validators.min(0)]],
      totalGstRate: [{value: 18, disabled: true}, [Validators.required, Validators.min(0)]],
      rateWithoutTax: [{value: 0, disabled: true}, Validators.min(0)],
      rateWithTax: [0, [Validators.required, Validators.min(0)]],
      // Purchase fields
      purchaseRate: [null, [Validators.min(0)]],
      purchaseRateDate: [null],
      remark: [''],
      isActive: [true]
    });
  }

  loadProducts() {
    this.service.GetProducts().subscribe({
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
      next: (res: any) => this.categoryList = res || [],
      error: () => this.toastr.error('Failed to load categories', 'Error')
    });
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
        onEdit: (product: any) => this.editProduct(product),
        onDelete: (product: any) => this.deleteProduct(product)
      }
    });
  }

  onSubmit() {
    if (this.productForm.invalid) {
      this.toastr.warning('Please fill all required fields', 'Validation');
      return;
    }

    const formValue = this.productForm.getRawValue();
    const payload = {
      uniqueKeyId: this.isEditMode ? this.editProductCode : null,
      ...formValue,
      rateWithoutTax: formValue.rateWithoutTax || 0
    };

    this.service.SaveProduct(payload).subscribe({
      next: (res: any) => {
        if (res.result === 'pass') {
          this.toastr.success(
            this.isEditMode ? 'Updated successfully' : 'Created successfully',
            'Product'
          );
          this.resetForm();
          this.loadProducts();
        } else {
          this.toastr.error(res.message || 'Failed to save', 'Error');
        }
      },
      error: () => this.toastr.error('Failed to save product', 'Error')
    });
  }

  editProduct(product: any) {
    this.isEditMode = true;
    this.editProductCode = product.uniqueKeyID;
    this.productForm.patchValue({
      productName: product.productName,
      measurement: product.measurement,
      hsnSacNumber: product.hsnSacNumber,
      categoryCode: product.categoryCode,
      cgstRate: product.cgstRate,
      scgstRate: product.scgstRate,
      totalGstRate: product.totalGstRate,
      rateWithoutTax: product.rateWithoutTax,
      rateWithTax: product.rateWithTax,
      purchaseRate: product.purchaseRate,
      purchaseRateDate: product.purchaseRateDate ? new Date(product.purchaseRateDate) : null,
      remark: product.remark,
      isActive: product.isActive
    });
  }

  deleteProduct(product: any) {
    if (confirm(`Delete product "${product.productName}"?`)) {
      this.service.RemoveProduct(product.uniqueKeyID).subscribe({
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
    this.productForm.reset({ isActive: true, rateWithTax: 0, purchaseRate: null, purchaseRateDate: null });
    this.productForm.patchValue({ cgstRate: 9, scgstRate: 9, totalGstRate: 18, rateWithoutTax: 0 });
  }
}
