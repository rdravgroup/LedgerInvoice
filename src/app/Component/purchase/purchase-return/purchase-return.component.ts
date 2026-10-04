import {
  Component, HostListener, Injectable, OnDestroy, OnInit, TemplateRef, ViewChild, ViewContainerRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { Overlay, OverlayModule, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE, NativeDateAdapter } from '@angular/material/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { ToastrService } from 'ngx-toastr';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { jsPDF } from 'jspdf';
import { PurchaseService } from '../../../_service/purchase.service';
import { AuthService } from '../../../_service/authentication.service';
import { SelectedCompanyService } from '../../../_service/selected-company.service';
import { PurchaseInvoice, PurchaseReturn, PurchaseReturnItem, Vendor } from '../../../_model/purchase.model';

const RETURN_DATE_FORMATS = {
  parse: { dateInput: { day: '2-digit', month: '2-digit', year: 'numeric' } },
  display: {
    dateInput: { day: '2-digit', month: '2-digit', year: 'numeric' },
    monthYearLabel: { month: 'short', year: 'numeric' },
    dateA11yLabel: { day: 'numeric', month: 'long', year: 'numeric' },
    monthYearA11yLabel: { month: 'long', year: 'numeric' }
  }
};

@Injectable()
class ReturnDateAdapter extends NativeDateAdapter {
  override format(date: Date, _displayFormat: unknown): string {
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  }

  override parse(value: unknown): Date | null {
    if (typeof value !== 'string') return null;
    const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return null;
    const day = Number(match[1]);
    const month = Number(match[2]) - 1;
    const year = Number(match[3]);
    const date = new Date(year, month, day);
    return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day ? date : null;
  }
}

interface ReturnInvoiceLine {
  productId: string;
  productName: string;
  quantity: number;
  rate: number;
  taxableAmount: number;
  gstRate: number;
  gstAmount: number;
  totalAmount: number;
  selected: boolean;
  availableQuantity: number;
}

@Component({
  selector: 'app-purchase-return',
  standalone: true,
  imports: [CommonModule, MaterialModule, OverlayModule, ReactiveFormsModule],
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'en-GB' },
    { provide: DateAdapter, useClass: ReturnDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: RETURN_DATE_FORMATS }
  ],
  templateUrl: './purchase-return.component.html',
  styleUrls: ['../purchase-shared.css', './purchase-return.component.css']
})
export class PurchaseReturnComponent implements OnInit, OnDestroy {
  listColumns = ['vendorName', 'piNumber', 'returnDate', 'items', 'grandTotal', 'status', 'overdue', 'action'];
  dataSource = new MatTableDataSource<PurchaseReturn>();
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild('returnModal') returnModal!: TemplateRef<unknown>;

  loading = false;
  saving = false;
  reportEmailSending = false;
  showForm = false;
  invoicesLoading = false;
  invoiceLoading = false;
  isMobile = window.innerWidth < 768;
  today = new Date();
  returnForm!: FormGroup;
  vendors: Vendor[] = [];
  vendorSearch = '';
  invoices: PurchaseInvoice[] = [];
  invoiceDetails?: PurchaseInvoice;
  private modalOverlay?: OverlayRef;
  private invoiceRequestId = 0;
  private readonly destroy$ = new Subject<void>();

  constructor(
    private svc: PurchaseService,
    private fb: FormBuilder,
    private toastr: ToastrService,
    private auth: AuthService,
    private selectedCo: SelectedCompanyService,
    private overlay: Overlay,
    private viewContainerRef: ViewContainerRef
  ) {
    this.dataSource.filterPredicate = (row, filter) => [
      row.returnNo, row.vendorName, row.vendorId, row.piNumber, row.status, row.reason
    ].some(value => String(value || '').toLowerCase().includes(filter));
  }

  @HostListener('window:resize')
  onResize(): void {
    this.isMobile = window.innerWidth < 768;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.showForm && !this.saving) this.close();
  }

  ngOnInit(): void {
    this.buildForm();
    this.selectedCo.selectedCompanyId$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.loadList();
      this.loadVendors();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.modalOverlay?.dispose();
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  private cid = (): string => this.selectedCo.getSelectedCompanyId() || this.auth.getCompanyId() || '';

  private buildForm(): void {
    this.returnForm = this.fb.group({
      companyId: [this.cid()],
      vendorId: ['', Validators.required],
      piNumber: [{ value: '', disabled: true }, Validators.required],
      returnDate: [new Date(), Validators.required],
      reason: ['', [Validators.required, Validators.maxLength(500)]],
      remark: ['', Validators.maxLength(500)],
      items: this.fb.array([])
    });
  }

  get items(): FormArray {
    return this.returnForm.get('items') as FormArray;
  }

  get selectedReturnLines(): FormGroup[] {
    return this.items.controls.filter(control => control.get('selected')?.value) as FormGroup[];
  }

  get subtotal(): number {
    return this.money(this.selectedReturnLines.reduce((total, line) => total + Number(line.get('taxableAmount')?.value || 0), 0));
  }

  get totalGst(): number {
    return this.money(this.selectedReturnLines.reduce((total, line) => total + Number(line.get('gstAmount')?.value || 0), 0));
  }

  get grandTotal(): number {
    return this.money(this.subtotal + this.totalGst);
  }

  get totalReturnAmount(): number {
    return this.money(this.dataSource.data.reduce((total, row) => total + Number(row.grandTotal || 0), 0));
  }

  get pendingReturnCount(): number {
    return this.dataSource.data.filter(row => row.status?.toLowerCase() === 'pending').length;
  }

  get approvedReturnCount(): number {
    return this.dataSource.data.filter(row => row.status?.toLowerCase() === 'approved').length;
  }

  get overdueReturnCount(): number {
    return this.dataSource.data.filter(row => this.returnIsOverdue(row)).length;
  }

  get filteredVendors(): Vendor[] {
    const query = this.vendorSearch.trim().toLocaleLowerCase();
    if (!query) return this.vendors;
    return this.vendors.filter(vendor =>
      [vendor.vendorName, vendor.vendorId, vendor.gstin, vendor.phone, vendor.mobile, vendor.email, vendor.contactPerson]
        .some(value => String(value || '').toLocaleLowerCase().includes(query))
    );
  }

  onVendorDropdownChange(opened: boolean): void {
    if (opened) this.vendorSearch = '';
  }

  applyFilter(event: Event): void {
    this.dataSource.filter = (event.target as HTMLInputElement).value.trim().toLowerCase();
    this.dataSource.paginator?.firstPage();
  }

  loadList(): void {
    this.loading = true;
    this.svc.getReturns(this.cid()).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response: any) => {
        if (String(response?.result || '').toLowerCase() === 'fail') {
          this.dataSource.data = [];
          this.toastr.error(response?.errorMessage || 'Failed to load purchase returns');
        } else {
          this.dataSource.data = response?.data || response?.Data || [];
        }
        this.loading = false;
      },
      error: (error: any) => {
        this.toastr.error(error?.error?.errorMessage || error?.message || 'Failed to load purchase returns');
        this.loading = false;
      }
    });
  }

  loadVendors(): void {
    this.svc.getVendors(this.cid()).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response: any) => {
        if (String(response?.result || '').toLowerCase() === 'fail') {
          this.vendors = [];
          this.toastr.error(response?.errorMessage || 'Failed to load vendors');
          return;
        }
        this.vendors = response?.data || response?.Data || [];
      },
      error: (error: any) => this.toastr.error(error?.error?.errorMessage || error?.message || 'Failed to load vendors')
    });
  }

  openNew(): void {
    if (this.loading || this.modalOverlay?.hasAttached()) return;
    this.buildForm();
    this.vendorSearch = '';
    this.invoiceDetails = undefined;
    this.invoices = [];
    this.invoicesLoading = false;
    this.invoiceLoading = false;
    this.showForm = true;
    this.modalOverlay = this.overlay.create({
      hasBackdrop: true,
      backdropClass: 'pp-overlay-backdrop',
      panelClass: ['pp-overlay-pane', 'pr-return-pane'],
      width: 'min(900px, calc(100vw - 32px))',
      maxHeight: '94vh',
      positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
      scrollStrategy: this.overlay.scrollStrategies.block()
    });
    this.modalOverlay.backdropClick()
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.close());
    this.modalOverlay.attach(new TemplatePortal(this.returnModal, this.viewContainerRef));
  }

  close(): void {
    if (this.saving) return;
    this.invoiceRequestId++;
    this.invoicesLoading = false;
    this.invoiceLoading = false;
    this.showForm = false;
    this.modalOverlay?.dispose();
    this.modalOverlay = undefined;
  }

  onVendorChange(vendorId: string): void {
    this.invoiceRequestId++;
    this.invoiceLoading = false;
    this.invoiceDetails = undefined;
    this.invoices = [];
    this.items.clear();
    this.returnForm.get('piNumber')?.reset({ value: '', disabled: !vendorId });
    if (!vendorId) return;

    const requestId = this.invoiceRequestId;
    this.invoicesLoading = true;
    this.svc.getInvoices(this.cid(), undefined, vendorId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response: any) => {
        if (requestId !== this.invoiceRequestId) return;
        this.invoicesLoading = false;
        if (String(response?.result || '').toLowerCase() === 'fail') {
          this.toastr.error(response?.errorMessage || 'Failed to load this vendor’s invoices');
          return;
        }
        this.invoices = (response?.data || response?.Data || [])
          .filter((invoice: PurchaseInvoice) => this.sameId(invoice.vendorId, vendorId)
            && (invoice.status || '').toLowerCase() !== 'cancelled');
      },
      error: (error: any) => {
        if (requestId !== this.invoiceRequestId) return;
        this.invoicesLoading = false;
        this.toastr.error(error?.error?.errorMessage || error?.message || 'Failed to load this vendor’s invoices');
      }
    });
  }

  onInvoiceSelect(piNumber: string): void {
    const selectedInvoice = this.invoices.find(invoice => invoice.piNumber === piNumber);
    this.invoiceDetails = undefined;
    this.items.clear();
    if (!selectedInvoice?.piNumber) return;

    const requestId = ++this.invoiceRequestId;
    this.invoiceLoading = true;
    this.svc.getInvoiceById(selectedInvoice.piNumber, this.cid()).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response: any) => {
        if (requestId !== this.invoiceRequestId) return;
        this.invoiceLoading = false;
        if (String(response?.result || '').toLowerCase() === 'fail') {
          this.toastr.error(response?.errorMessage || 'Failed to load invoice details');
          return;
        }
        const detail = response?.data || response?.Data;
        if (!detail || !this.sameId(detail.vendorId, this.returnForm.get('vendorId')?.value)) {
          this.toastr.error('The selected invoice does not belong to this vendor.');
          this.returnForm.get('piNumber')?.setValue('');
          return;
        }
        this.invoiceDetails = detail;
        this.populateInvoiceLines(detail);
      },
      error: (error: any) => {
        if (requestId !== this.invoiceRequestId) return;
        this.invoiceLoading = false;
        this.toastr.error(error?.error?.errorMessage || error?.message || 'Failed to load invoice details');
      }
    });
  }

  private populateInvoiceLines(invoice: PurchaseInvoice): void {
    const grouped = new Map<string, {
      productName: string; quantity: number; taxable: number; gst: number;
    }>();
    for (const invoiceLine of invoice.items || []) {
      const current = grouped.get(invoiceLine.productId) || {
        productName: invoiceLine.productName || invoiceLine.productId,
        quantity: 0,
        taxable: 0,
        gst: 0
      };
      current.quantity += Number(invoiceLine.quantity) || 0;
      current.taxable += Number(invoiceLine.taxableAmount) || 0;
      current.gst += (Number(invoiceLine.cgstAmount) || 0)
        + (Number(invoiceLine.sgstAmount) || 0)
        + (Number(invoiceLine.igstAmount) || 0);
      grouped.set(invoiceLine.productId, current);
    }

    for (const [productId, invoiceLine] of grouped) {
      const alreadyReserved = (this.dataSource.data || [])
        .filter(returnRow => this.sameId(returnRow.piNumber, invoice.piNumber)
          && ['pending', 'approved'].includes((returnRow.status || '').toLowerCase()))
        .flatMap(returnRow => returnRow.items || [])
        .filter(returnItem => this.sameId(returnItem.productId, productId))
        .reduce((total, returnItem) => total + Number(returnItem.quantity || 0), 0);
      const availableQuantity = Math.max(0, invoiceLine.quantity - alreadyReserved);
      const rate = invoiceLine.quantity > 0
        ? Math.round((invoiceLine.taxable / invoiceLine.quantity) * 10000) / 10000
        : 0;
      const gstRate = invoiceLine.taxable > 0 ? invoiceLine.gst / invoiceLine.taxable * 100 : 0;
      this.items.push(this.fb.group({
        productId: [productId],
        productName: [invoiceLine.productName],
        quantity: [0],
        rate: [rate],
        taxableAmount: [0],
        gstRate: [this.money(gstRate)],
        gstAmount: [0],
        totalAmount: [0],
        selected: [false],
        invoiceQuantity: [invoiceLine.quantity],
        availableQuantity: [availableQuantity]
      }));
    }
  }

  setLineSelected(index: number, selected: boolean): void {
    const line = this.items.at(index);
    line.get('selected')?.setValue(selected);
    if (selected) {
      const available = Number(line.get('availableQuantity')?.value || 0);
      line.get('quantity')?.setValidators([
        Validators.required,
        Validators.min(0.001),
        Validators.max(available)
      ]);
      line.get('quantity')?.setValue(available > 0 ? Math.min(1, available) : 0);
      this.onLineChange(index);
    } else {
      line.get('quantity')?.clearValidators();
      line.get('quantity')?.setValue(0);
      line.patchValue({ taxableAmount: 0, gstAmount: 0, totalAmount: 0 });
    }
    line.get('quantity')?.updateValueAndValidity({ emitEvent: false });
  }

  onLineChange(index: number): void {
    const line = this.items.at(index);
    const quantity = Math.max(0, Number(line.get('quantity')?.value) || 0);
    const available = Number(line.get('availableQuantity')?.value) || 0;
    if (quantity > available) {
      line.get('quantity')?.setValue(available);
      this.toastr.warning(`Return quantity cannot exceed ${available}.`);
    }
    const finalQuantity = Math.min(quantity, available);
    const rate = Number(line.get('rate')?.value) || 0;
    const gstRate = Number(line.get('gstRate')?.value) || 0;
    const taxableAmount = this.money(finalQuantity * rate);
    const gstAmount = this.money(taxableAmount * gstRate / 100);
    line.patchValue({
      taxableAmount,
      gstAmount,
      totalAmount: this.money(taxableAmount + gstAmount)
    }, { emitEvent: false });
  }

  getVendorName(vendorId?: string): string {
    return this.vendors.find(vendor => this.sameId(vendor.vendorId, vendorId))?.vendorName || vendorId || '';
  }

  getReturnItemCount(returnRow: PurchaseReturn): number {
    const totalQuantity = (returnRow.items || []).reduce((total, item) => total + Number(item.quantity || 0), 0);
    return Math.round((totalQuantity + Number.EPSILON) * 1000) / 1000;
  }

  getReturnItemQuantityLabel(returnRow: PurchaseReturn): string {
    const quantity = this.getReturnItemCount(returnRow);
    return `${quantity.toLocaleString('en-IN', { maximumFractionDigits: 3 })} ${quantity === 1 ? 'unit' : 'units'}`;
  }

  returnIsOverdue(returnRow: PurchaseReturn): boolean {
    return returnRow.isOverdue === true;
  }

  approve(returnNo?: string): void {
    if (!returnNo || !confirm(`Approve return ${returnNo}? This will reduce stock and accounts payable.`)) return;
    this.svc.approveReturn(returnNo, this.cid()).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response: any) => {
        if (String(response?.result || '').toLowerCase() !== 'pass') {
          this.toastr.error(response?.errorMessage || 'Approval failed');
          return;
        }
        this.toastr.success(`Return ${returnNo} approved`);
        this.loadList();
      },
      error: (error: any) => this.toastr.error(error?.error?.errorMessage || error?.message || 'Approval failed')
    });
  }

  deletePendingReturn(returnNo?: string): void {
    if (!returnNo || !confirm(`Delete pending return ${returnNo}? This action cannot be undone.`)) return;
    this.svc.deletePendingReturn(returnNo, this.cid()).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response: any) => {
        if (String(response?.result || '').toLowerCase() !== 'pass') {
          this.toastr.error(response?.errorMessage || 'Failed to delete pending return');
          return;
        }
        this.toastr.success(`Pending return ${returnNo} deleted`);
        this.loadList();
      },
      error: (error: any) => this.toastr.error(error?.error?.errorMessage || error?.message || 'Failed to delete pending return')
    });
  }

  cancelApprovedReturn(returnNo?: string): void {
    if (!returnNo || !confirm(`Cancel approved return ${returnNo}? This will restore stock and reverse the accounts payable adjustment.`)) return;
    this.svc.cancelApprovedReturn(returnNo, this.cid()).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response: any) => {
        if (String(response?.result || '').toLowerCase() !== 'pass') {
          this.toastr.error(response?.errorMessage || 'Failed to cancel approved return');
          return;
        }
        this.toastr.success(`Return ${returnNo} cancelled and reversed`);
        this.loadList();
      },
      error: (error: any) => this.toastr.error(error?.error?.errorMessage || error?.message || 'Failed to cancel approved return')
    });
  }

  save(): void {
    if (this.returnForm.invalid || this.invoiceLoading || this.invoicesLoading || this.selectedReturnLines.length === 0) {
      this.returnForm.markAllAsTouched();
      if (this.selectedReturnLines.length === 0) this.toastr.warning('Select at least one invoice item to return.');
      return;
    }
    this.persistReturn();
  }

  printReturns(): void {
      if (this.loading) return;
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        this.toastr.error('Allow pop-ups to print the purchase returns report.');
        return;
      }

      try {
        const pdf = this.createReturnsPdf();
        pdf.autoPrint();
        printWindow.location.href = pdf.output('bloburl').toString();
      } catch (error) {
        printWindow.close();
        console.error('Purchase returns PDF generation failed:', error);
        this.toastr.error('Unable to generate the purchase returns PDF.');
      }
    }

  sendReturnsToCompanyEmail(): void {
      if (this.loading || this.reportEmailSending) return;
      const companyId = this.cid();
      if (!companyId) {
        this.toastr.error('Select a company before sending the report.');
        return;
      }

      this.reportEmailSending = true;
      try {
        const bytes = new Uint8Array(this.createReturnsPdf().output('arraybuffer'));
        const chunks: string[] = [];
        const chunkSize = 0x8000;
        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
          chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + chunkSize)));
        }

        this.svc.emailPurchaseReport({
          companyId,
          reportName: 'Purchase Returns',
          pdfBase64: btoa(chunks.join(''))
        }).pipe(takeUntil(this.destroy$)).subscribe({
          next: response => {
            this.reportEmailSending = false;
            if (String(response?.result || '').toLowerCase() !== 'pass') {
              this.toastr.error(response?.errorMessage || 'Failed to send the purchase returns report.');
              return;
            }
            this.toastr.success(response.message || 'Purchase returns report sent to company email.');
          },
          error: (error: any) => {
            this.reportEmailSending = false;
            this.toastr.error(error?.error?.errorMessage || error?.message || 'Failed to send the purchase returns report.');
          }
        });
      } catch (error) {
        this.reportEmailSending = false;
        console.error('Purchase returns PDF generation failed:', error);
        this.toastr.error('Unable to generate the purchase returns PDF.');
      }
    }

  private createReturnsPdf(): jsPDF {
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const margin = 12;
      const width = pdf.internal.pageSize.getWidth();
      const height = pdf.internal.pageSize.getHeight();
      const rows = this.dataSource.filteredData;
      const headers = ['Return #', 'Vendor', 'Invoice', 'Return Date', 'Returned Qty', 'Amount', 'Status', 'Overdue'];
      const columnWidth = (width - margin * 2) / headers.length;
      const currency = (amount: number): string =>
        `INR ${(Number(amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const formatDate = (value?: string): string => {
        if (!value) return '-';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('en-GB');
      };
      let y = 16;

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(17);
      pdf.setTextColor(31, 48, 78);
      pdf.text('Purchase Returns', margin, y);
      y += 7;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(95, 105, 120);
      pdf.text(`Generated ${new Date().toLocaleString('en-GB')}`, margin, y);
      y += 8;

      pdf.setFontSize(9);
      pdf.setTextColor(40, 48, 60);
      pdf.text(
        `Returns: ${this.dataSource.data.length}  |  Pending: ${this.pendingReturnCount}  |  Approved: ${this.approvedReturnCount}  |  Overdue: ${this.overdueReturnCount}  |  Total amount: ${currency(this.totalReturnAmount)}`,
        margin,
        y,
        { maxWidth: width - margin * 2 }
      );
      y += 8;

      const drawHeader = (): void => {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.setTextColor(255, 255, 255);
        pdf.setFillColor(40, 71, 125);
        pdf.rect(margin, y, width - margin * 2, 8, 'F');
        headers.forEach((header, index) => {
          pdf.text(header, margin + index * columnWidth + 2, y + 5.3, { maxWidth: columnWidth - 4 });
        });
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7.5);
        pdf.setTextColor(35, 42, 52);
        y += 8;
      };

      drawHeader();
      rows.forEach((row, rowIndex) => {
        const overdue = this.returnIsOverdue(row)
          ? `${row.daysOverdue || 0}d · due ${formatDate(row.dueDate)}`
          : '-';
        const values = [
          row.returnNo || '-',
          row.vendorName || this.getVendorName(row.vendorId) || '-',
          row.piNumber || '-',
          formatDate(row.returnDate),
          this.getReturnItemQuantityLabel(row),
          currency(row.grandTotal),
          row.status || '-',
          overdue
        ];
        const lines = values.map(value => pdf.splitTextToSize(value, columnWidth - 4) as string[]);
        const rowHeight = Math.max(7, ...lines.map(value => value.length * 4 + 3));
        if (y + rowHeight > height - 12) {
          pdf.addPage();
          y = 12;
          drawHeader();
        }

        if (rowIndex % 2 === 0) {
          pdf.setFillColor(245, 247, 250);
          pdf.rect(margin, y, width - margin * 2, rowHeight, 'F');
        }
        pdf.setDrawColor(220, 225, 232);
        pdf.setLineWidth(0.15);
        pdf.rect(margin, y, width - margin * 2, rowHeight);
        for (let index = 1; index < headers.length; index++) {
          pdf.line(margin + index * columnWidth, y, margin + index * columnWidth, y + rowHeight);
        }
        lines.forEach((value, index) => {
          pdf.text(value, margin + index * columnWidth + 2, y + 4.5, { maxWidth: columnWidth - 4 });
        });
        y += rowHeight;
      });

      if (rows.length === 0) {
        pdf.setFontSize(10);
        pdf.text('No purchase return entries match the current search.', margin, y + 4);
      }

      const pageCount = pdf.getNumberOfPages();
      for (let page = 1; page <= pageCount; page++) {
        pdf.setPage(page);
        pdf.setFontSize(7);
        pdf.setTextColor(125, 130, 140);
        pdf.text(`Page ${page} of ${pageCount}`, width - margin, height - 5, { align: 'right' });
      }
      return pdf;
  }

  private persistReturn(): void {
    const raw = this.returnForm.getRawValue();
    const returnDate = raw.returnDate as Date;
    const dto: PurchaseReturn = {
      companyId: this.cid(),
      vendorId: raw.vendorId,
      piNumber: raw.piNumber,
      returnDate: this.toApiDate(returnDate),
      reason: raw.reason.trim(),
      remark: raw.remark?.trim() || '',
      items: this.selectedReturnLines.map(line => ({
        productId: line.get('productId')?.value,
        productName: line.get('productName')?.value,
        quantity: Number(line.get('quantity')?.value),
        rate: Number(line.get('rate')?.value),
        taxableAmount: Number(line.get('taxableAmount')?.value),
        gstRate: Number(line.get('gstRate')?.value),
        gstAmount: Number(line.get('gstAmount')?.value),
        totalAmount: Number(line.get('totalAmount')?.value)
      } as PurchaseReturnItem)),
      subtotal: this.subtotal,
      totalGstAmount: this.totalGst,
      grandTotal: this.grandTotal,
      status: 'pending'
    };

    this.saving = true;
    this.svc.saveReturn(dto, this.cid()).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response: any) => {
        this.saving = false;
        if (String(response?.result || '').toLowerCase() !== 'pass') {
          this.toastr.error(response?.errorMessage || 'Failed to create purchase return');
          return;
        }
        this.toastr.success(`Return ${response?.data?.returnNo || response?.Data?.returnNo || ''} created`);
        this.close();
        this.loadList();
      },
      error: (error: any) => {
        this.saving = false;
        this.toastr.error(error?.error?.errorMessage || error?.message || 'Failed to create purchase return');
      }
    });
  }

  private toApiDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private sameId(first?: string | null, second?: string | null): boolean {
    return String(first || '').trim().toLowerCase() === String(second || '').trim().toLowerCase();
  }

  private money(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
