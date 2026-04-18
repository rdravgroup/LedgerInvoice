import { Component, OnInit, ViewChild, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../material.module';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MasterService } from '../../_service/master.service';
import { ToastrService } from 'ngx-toastr';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatDialog, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-category-list-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  template: `
    <div class="dialog-header">
      <h2 mat-dialog-title>Category List</h2>
      <button mat-icon-button mat-dialog-close class="close-button">
        <mat-icon>close</mat-icon>
      </button>
    </div>
    <mat-dialog-content>
      <mat-form-field appearance="outline" class="search-field">
        <mat-label>Search</mat-label>
        <input matInput (keyup)="applyFilter($event)" placeholder="Search categories">
        <mat-icon matPrefix>search</mat-icon>
      </mat-form-field>

      <table mat-table [dataSource]="dataSource" matSort class="category-table">
        <ng-container matColumnDef="name">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>Category Name</th>
          <td mat-cell *matCellDef="let element">{{ element.name }}</td>
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
    mat-dialog-content {
      min-width: 600px;
      max-height: 70vh;
    }
    .search-field {
      width: 100%;
      margin-bottom: 20px;
    }
    .category-table {
      width: 100%;
    }
    .status-badge {
      padding: 6px 12px;
      border-radius: 12px;
      font-size: 0.85rem;
      font-weight: 500;
      display: inline-block;
    }
    .chip-active {
      background-color: #4caf50 !important;
      color: white;
    }
    .chip-inactive {
      background-color: #f44336 !important;
      color: white;
    }
    @media (max-width: 768px) {
      mat-dialog-content {
        min-width: 90vw;
      }
    }
  `]
})
export class CategoryListDialogComponent implements OnInit {
  dataSource: any;
  displayedColumns: string[] = ['name', 'isActive', 'actions'];
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    public dialogRef: MatDialogRef<CategoryListDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.dataSource = new MatTableDataSource(data.categories);
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

  onEdit(category: any) {
    this.dialogRef.close();
    this.data.onEdit(category);
  }
}

@Component({
  selector: 'app-category',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule],
  templateUrl: './category.component.html',
  styleUrl: './category.component.css'
})
export class CategoryComponent implements OnInit {
  categoryForm!: FormGroup;
  categoryList: any[] = [];
  isEditMode = false;
  editCategoryId: string = '';
  totalCategories = 0;
  activeCategories = 0;

  constructor(
    private fb: FormBuilder,
    private service: MasterService,
    private toastr: ToastrService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadCategories();
  }

  initForm() {
    this.categoryForm = this.fb.group({
      name: ['', Validators.required],
      isActive: [true]
    });
  }

  loadCategories() {
    this.service.GetCategories().subscribe({
      next: (res: any) => {
        this.categoryList = res || [];
        this.totalCategories = this.categoryList.length;
        this.activeCategories = this.categoryList.filter(c => c.isActive).length;
      },
      error: () => {
        this.toastr.error('Failed to load categories', 'Error');
      }
    });
  }

  openCategoryList() {
    this.dialog.open(CategoryListDialogComponent, {
      width: '800px',
      maxWidth: '95vw',
      data: {
        categories: this.categoryList,
        onEdit: (category: any) => this.editCategory(category)
      }
    });
  }

  onSubmit() {
    if (this.categoryForm.invalid) {
      this.toastr.warning('Please fill all required fields', 'Validation');
      return;
    }

    const payload = {
      uniqueKeyId: this.isEditMode ? this.editCategoryId : null,
      name: this.categoryForm.value.name,
      isActive: this.categoryForm.value.isActive
    };

    this.service.SaveCategory(payload).subscribe({
      next: (res: any) => {
        if (res.result === 'pass') {
          this.toastr.success(
            this.isEditMode ? 'Updated successfully' : 'Created successfully',
            'Category'
          );
          this.resetForm();
          this.loadCategories();
        } else {
          this.toastr.error(res.message || 'Failed to save', 'Error');
        }
      },
      error: () => {
        this.toastr.error('Failed to save category', 'Error');
      }
    });
  }

  editCategory(category: any) {
    this.isEditMode = true;
    this.editCategoryId = category.uniqueKeyId;
    this.categoryForm.patchValue({
      name: category.name,
      isActive: category.isActive
    });
  }

  resetForm() {
    this.isEditMode = false;
    this.editCategoryId = '';
    this.categoryForm.reset({ isActive: true });
  }
}
