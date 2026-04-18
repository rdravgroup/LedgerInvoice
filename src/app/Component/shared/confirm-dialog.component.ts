import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MaterialModule } from '../../material.module';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  templateUrl: './confirm-dialog.component.html'
})
export class ConfirmDialogComponent {
  title = 'Confirm';
  message = 'Are you sure?';
  confirmText = 'Yes';
  cancelText = 'Cancel';

  constructor(
    private dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    if (data) {
      this.title = data.title || this.title;
      this.message = data.message || this.message;
      this.confirmText = data.confirmText || this.confirmText;
      this.cancelText = data.cancelText || this.cancelText;
    }
  }

  confirm() {
    this.dialogRef.close(true);
  }

  cancel() {
    this.dialogRef.close(false);
  }
}
