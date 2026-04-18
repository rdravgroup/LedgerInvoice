import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { DomSanitizer } from '@angular/platform-browser';

@Component({
  selector: 'app-preview-dialog',
  standalone: true,
  imports: [MatDialogModule, MatIconModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Preview Invoice: <b>{{ data.invoiceno }}</b>
      <mat-dialog-actions align="end">
        <button mat-icon-button (click)="close()" matTooltip="Close">
          <mat-icon>close</mat-icon>
        </button>
      </mat-dialog-actions>
    </h2>
    <mat-dialog-content style="flex: 1; display: flex; min-height: 400px;">
      <iframe [src]="safeUrl" width="100%" style="border: none; flex: 1;"></iframe>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button color="warn" (click)="close()">Close</button>
    </mat-dialog-actions>
  `
})
export class PreviewDialogComponent {
  safeUrl: any;

  constructor(
    public dialogRef: MatDialogRef<PreviewDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private sanitizer: DomSanitizer
  ) {
    this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(data.pdfurl);
  }

  close(): void {
    this.dialogRef.close();
  }
}