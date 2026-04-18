import { Component, OnInit, AfterViewInit, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../material.module';
import { ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MasterService } from '../../_service/master.service';
import { ToastrService } from 'ngx-toastr';
import { MatDialog } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { PreviewDialogComponent } from './preview-dialog.component';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

interface Invoice {
  invNum: string;
  invoiceNumber: string;
  invDate: string;
  cuName: string;
  coName: string;
  totalAmt: number;
}

@Component({
  selector: 'app-listinvoice',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule, RouterLink],
  templateUrl: './listinvoice.component.html',
  styleUrls: ['./listinvoice.component.css'],
})
export class ListinvoiceComponent implements OnInit, AfterViewInit, OnDestroy {
  displayedColumns: string[] = ['invoiceNumber', 'invDate', 'cuName', 'totalAmt', 'actions'];
  dataSource = new MatTableDataSource<Invoice>();

  loading = false;
  isMobile = false;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  private destroy$ = new Subject<void>();

  constructor(
    private service: MasterService,
    private alert: ToastrService,
    private router: Router,
    private dialog: MatDialog
  ) {
    this.checkMobile();
    window.addEventListener('resize', () => this.checkMobile());
  }

  private checkMobile(): void {
    this.isMobile = window.innerWidth <= 768;
  }

  ngOnInit(): void {
    this.LoadInvoice();
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    
    // Set default sorting by invoice number (descending) using setTimeout to avoid ExpressionChangedAfterItHasBeenCheckedError
    setTimeout(() => {
      if (this.sort) {
        this.sort.sort({ id: 'invoiceNumber', start: 'desc', disableClear: false });
      }
    }, 0);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  LoadInvoice() {
    this.loading = true;
    this.service.GetAllInvoice()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          let data: any = res;
          if (Array.isArray(data)) {
            // Direct array
          } else if (data && typeof data === 'object') {
            if (Array.isArray(data.data)) {
              data = data.data;
            } else if (Array.isArray(data.result)) {
              data = data.result;
            } else if (Array.isArray(data.invoices)) {
              data = data.invoices;
            } else {
              for (let key in data) {
                if (Array.isArray(data[key])) {
                  data = data[key];
                  break;
                }
              }
            }
          }

          if (Array.isArray(data)) {
            // assign data first
            this.dataSource.data = data;

            const applyDefaultSort = () => {
              if (!this.sort) {
                return false;
              }

              // ensure the datasource has the MatSort reference
              this.dataSource.sort = this.sort;

              // programmatically set active sort to invoiceNumber descending
              this.sort.sort({ id: 'invoiceNumber', start: 'desc', disableClear: false });

              // force-sort the data so the UI shows sorted rows immediately
              try {
                this.dataSource.data = this.dataSource.sortData(this.dataSource.data.slice(), this.sort);
              } catch (e) {
                // fallback: replace array reference to trigger table update
                this.dataSource.data = this.dataSource.data.slice();
              }

              return true;
            };

            // Try immediately, otherwise retry shortly until sort is available
            if (!applyDefaultSort()) {
              setTimeout(() => applyDefaultSort(), 50);
            }
          } else {
            this.alert.error('Invalid response format', 'Error');
          }
          this.loading = false;
        },
        error: (err) => {
          this.alert.error('Failed to load invoices.', 'Error');
          this.loading = false;
        },
      });
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  invoiceremove(invoiceno: string) {
    const dialogConfirm = confirm(`Do you want to remove this Invoice: ${invoiceno}?`);
    if (dialogConfirm) {
      this.service.RemoveInvoice(invoiceno)
        .pipe(takeUntil(this.destroy$))
        .subscribe((res: any) => {
          if (res.Result === 'pass' || res.result === 'pass') {
            this.alert.success('Removed Successfully.', 'Remove Invoice');
            this.LoadInvoice();
          } else {
            this.alert.error('Failed to Remove.', 'Invoice');
          }
        });
    }
  }

  Editinvoice(invoiceno: string) {
    this.router.navigate(['/editinvoice', invoiceno]);
  }

  PrintInvoice(invoiceno: string) {
    this.service.GenerateInvoicePDF(invoiceno)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res.body && res.body.size > 0) {
            const blob: Blob = res.body as Blob;
            const url = window.URL.createObjectURL(blob);
            window.open(url, '_blank');
            setTimeout(() => window.URL.revokeObjectURL(url), 1000);
          } else {
            this.alert.error('PDF file is empty', 'Error');
          }
        },
        error: (err) => {
          this.alert.error(`Failed to print invoice ${invoiceno}`, 'Error');
        },
      });
  }

  DownloadInvoice(invoiceno: string) {
    this.service.GenerateInvoicePDF(invoiceno)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res.body && res.body.size > 0) {
            const blob: Blob = res.body as Blob;
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.download = `Invoice_${invoiceno.replace('/', '_')}.pdf`;
            a.href = url;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
          } else {
            this.alert.error('PDF file is empty', 'Error');
          }
        },
        error: (err) => {
          this.alert.error(`Failed to download invoice ${invoiceno}`, 'Error');
        },
      });
  }

  PreviewInvoice(invoiceno: string) {
    this.service.GenerateInvoicePDF(invoiceno)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res.body && res.body.size > 0) {
            const blob = new Blob([res.body], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const isMobile = window.innerWidth < 768;
            
            const dialogRef = this.dialog.open(PreviewDialogComponent, {
              width: isMobile ? '100vw' : '80%',
              height: isMobile ? '100vh' : '80%',
              maxWidth: isMobile ? '100vw' : 'none',
              data: { pdfurl: url, invoiceno },
            });
            
            dialogRef.afterClosed().subscribe(() => {
              URL.revokeObjectURL(url);
            });
          } else {
            this.alert.error('PDF file is empty', 'Error');
          }
        },
        error: (err) => {
          this.alert.error(`Failed to preview invoice ${invoiceno}`, 'Error');
        },
      });
  }

  DownloadStatementPDF(invoiceno: string) {
    this.service.GenerateStatementAccountPdf(invoiceno)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res.body && res.body.size > 0) {
            const blob: Blob = res.body as Blob;
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.download = `Statement_${invoiceno.replace('/', '_')}.pdf`;
            a.href = url;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            this.alert.success(`Statement downloaded for ${invoiceno}`, 'Success');
          } else {
            this.alert.error('PDF file is empty', 'Error');
          }
        },
        error: (err) => {
          this.alert.error(`Failed to download statement for ${invoiceno}`, 'Error');
        },
      });
  }
}