// src/app/Component/listinvoice/sales-return-dialog.component.ts
// FIXED: Moved template to separate .html file (eliminates backtick escaping issue).
// FIXED: Removed [disabled] attribute binding on reactive form inputs.
// FIXED: FormArray enable/disable via FormControl only.

import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MaterialModule } from '../../material.module';
import { ToastrService } from 'ngx-toastr';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { InvoiceService, SalesReturnRequest } from '../../_service/invoice.service';
import { jsPDF } from 'jspdf';

export interface SalesReturnDialogData {
  invoice: {
    invoiceNumber: string;
    cuName: string;
    totalAmt: number;
    isApproved?: boolean;
    totalReturns?: number;
  };
  companyId?: string;
}

export interface SalesItem {
  productId:   string;
  productName: string;
  soldQuantity: number;
  returnableQuantity: number;
  rate: number;
  gstRate:     number;
}

@Component({
  selector: 'app-sales-return-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule, MatDialogModule],
  templateUrl: './sales-return-dialog.component.html',
  styleUrls:  ['./sales-return-dialog.component.css']
})
export class SalesReturnDialogComponent implements OnInit, OnDestroy {

  form!:      FormGroup;
  items:      SalesItem[] = [];
  loading     = false;
  submitting  = false;
  errorMsg    = '';
  grandTotal  = 0;
  completedReturn: any = null;
  refundPaymentModes = ['cash', 'bank_transfer', 'upi', 'card', 'cheque'];

  private destroy$ = new Subject<void>();

  constructor(
    public  dialogRef:  MatDialogRef<SalesReturnDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: SalesReturnDialogData,
    private fb:         FormBuilder,
    private invoiceSvc: InvoiceService,
    private toastr:     ToastrService
  ) {}

  ngOnInit(): void {
    this.buildForm();
    this.loadItems();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get lines(): FormArray {
    return this.form.get('lines') as FormArray;
  }

  private buildForm(): void {
    this.form = this.fb.group({
      returnType: ['credit', Validators.required],
      reason:     [''],
      refundDate: [this.todayIsoDate()],
      paymentMode: ['cash'],
      bankName: [''],
      bankRef: [''],
      chequeNo: [''],
      chequeDate: [''],
      lines:      this.fb.array([])
    });
    this.form.get('returnType')!.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(returnType => this.updateRefundValidators(returnType));
    this.form.get('paymentMode')!.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.updateRefundValidators(this.form.get('returnType')!.value));
    this.updateRefundValidators(this.form.get('returnType')!.value);
  }

  private todayIsoDate(): string {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }

  private updateRefundValidators(returnType: string): void {
    const isRefund = returnType === 'refund';
    for (const controlName of ['refundDate', 'paymentMode']) {
      const control = this.form.get(controlName)!;
      control.setValidators(isRefund ? [Validators.required] : []);
      if (!isRefund) control.markAsPristine();
      control.updateValueAndValidity({ emitEvent: false });
    }
    const bankName = this.form.get('bankName')!;
    const mode = this.form.get('paymentMode')?.value;
    bankName.setValidators(isRefund && ['bank_transfer', 'cheque'].includes(mode) ? [Validators.required] : []);
    bankName.updateValueAndValidity({ emitEvent: false });
  }

  private loadItems(): void {
    this.loading  = true;
    this.errorMsg = '';

    this.invoiceSvc.getReturnableItems(this.data.invoice.invoiceNumber, this.data.companyId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (r: any) => {
          const raw: any[] = Array.isArray(r) ? r : (r?.data || r?.items || []);

          this.items = raw.map(i => ({
            productId:   i.productId   || i.ProductId   || '',
            productName: i.productName || i.ProductName || i.productId || '',
            soldQuantity: +(i.soldQuantity || i.SoldQuantity || i.quantity || i.Quantity || 0),
            returnableQuantity: +(i.returnableQuantity ?? i.ReturnableQuantity ?? i.quantity ?? i.Quantity ?? 0),
            rate: +(i.rate ?? i.Rate ?? i.rateWithoutTax ?? i.RateWithoutTax ?? 0),
            gstRate: this.deriveGstRate(i)
          })).filter(i => i.returnableQuantity > 0);

          if (this.items.length === 0) {
            this.errorMsg = 'No returnable items found on this invoice.';
            this.loading  = false;
            return;
          }

          const linesArray = this.form.get('lines') as FormArray;
          this.items.forEach(item => {
            // FIX: start quantity as disabled via FormControl, NOT [disabled] attribute
            const qtyCtrl = this.fb.control({ value: item.returnableQuantity, disabled: true }, [
              Validators.required, Validators.min(0.001), Validators.max(item.returnableQuantity)
            ]);
            linesArray.push(this.fb.group({
              included: [false],
              quantity: qtyCtrl
            }));
          });

          // Wire up included → enable/disable qty
          linesArray.controls.forEach((ctrl, i) => {
            ctrl.get('included')!.valueChanges
              .pipe(takeUntil(this.destroy$))
              .subscribe((checked: boolean) => {
                const qtyCtr = ctrl.get('quantity')!;
                if (checked) {
                  qtyCtr.enable();
                  qtyCtr.setValue(this.items[i].returnableQuantity);
                } else {
                  qtyCtr.disable();
                  qtyCtr.setValue(0);
                }
                this.recalcTotal();
              });

            ctrl.get('quantity')!.valueChanges
              .pipe(takeUntil(this.destroy$))
              .subscribe(() => this.recalcTotal());
          });

          this.loading = false;
        },
        error: () => {
          this.errorMsg = 'Failed to load invoice items. Please try again.';
          this.loading  = false;
        }
      });
  }

  private deriveGstRate(i: any): number {
    if (i.gstRate !== undefined || i.GstRate !== undefined) return +(i.gstRate ?? i.GstRate ?? 0);
    if (i.cgstRate !== undefined || i.CgstRate !== undefined) {
      return +(i.cgstRate || i.CgstRate || 0) + +(i.sgstRate || i.SgstRate || 0) + +(i.igstRate || i.IgstRate || 0);
    }
    if (i.totalGstRate !== undefined || i.TotalGstRate !== undefined) return +(i.totalGstRate ?? i.TotalGstRate ?? 0);
    return 0;
  }

  getMaxReturnable(i: number): number {
    return this.items[i]?.returnableQuantity || 0;
  }

  getLineReturnTotal(i: number): number {
    const ctrl = this.lines.at(i);
    if (!ctrl?.get('included')?.value) return 0;
    const qty  = +(ctrl.get('quantity')?.value || 0);
    const taxable = Math.round(qty * (this.items[i]?.rate || 0) * 100) / 100;
    const gst = Math.round(taxable * (this.items[i]?.gstRate || 0)) / 100;
    return Math.round((taxable + gst) * 100) / 100;
  }

  formatAmount(value: number): string {
    return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
  }

  isLineIncluded(i: number): boolean {
    return !!this.lines.at(i)?.get('included')?.value;
  }

  private recalcTotal(): void {
    let total = 0;
    this.lines.controls.forEach((_, i) => { total += this.getLineReturnTotal(i); });
    this.grandTotal = Math.round(total * 100) / 100;
  }

  submit(): void {
    if (this.form.invalid || this.grandTotal <= 0 || this.completedReturn) {
      this.form.markAllAsTouched();
      return;
    }

    const selectedLines = this.lines.controls
      .map((ctrl, i) => ({ ctrl, i }))
      .filter(({ ctrl }) => ctrl.get('included')?.value);

    if (selectedLines.length === 0) {
      this.toastr.warning('Select at least one item to return.');
      return;
    }

    const reqItems = selectedLines.map(({ ctrl, i }) => ({
      productId:   this.items[i].productId,
      productName: this.items[i].productName,
      quantity:    +(ctrl.getRawValue()?.quantity || 0),
      rate:        this.items[i].rate,
      gstRate:     this.items[i].gstRate
    }));

    const req: SalesReturnRequest = {
      invoiceNumber: this.data.invoice.invoiceNumber,
      companyId:     this.data.companyId,
      returnType:    this.form.get('returnType')?.value || 'credit',
      reason:        this.form.get('reason')?.value || '',
      refundDate:    this.form.get('returnType')?.value === 'refund' ? this.form.get('refundDate')?.value : undefined,
      paymentMode:   this.form.get('returnType')?.value === 'refund' ? this.form.get('paymentMode')?.value : undefined,
      bankName:      this.form.get('returnType')?.value === 'refund' ? this.form.get('bankName')?.value : undefined,
      bankRef:       this.form.get('returnType')?.value === 'refund' ? this.form.get('bankRef')?.value : undefined,
      chequeNo:      this.form.get('returnType')?.value === 'refund' ? this.form.get('chequeNo')?.value : undefined,
      chequeDate:    this.form.get('returnType')?.value === 'refund' ? this.form.get('chequeDate')?.value || undefined : undefined,
      items:         reqItems
    };

    this.submitting = true;
    this.invoiceSvc.createReturn(req)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (r: any) => {
          this.submitting = false;
          if (r?.result === 'pass') {
            this.completedReturn = r.data;
            this.toastr.success(`Return ${r.data?.returnNo} created. Credit Note: ${r.data?.creditNoteNo}`);
          } else {
            this.toastr.error(r?.errorMessage || 'Failed to create return.');
          }
        },
        error: (e: any) => {
          this.submitting = false;
          this.toastr.error(e?.error?.errorMessage || 'Failed to create return. Please try again.');
        }
      });
  }

  close(): void {
    this.dialogRef.close(!!this.completedReturn);
  }

  downloadReturnSlip(): void {
    if (!this.completedReturn) return;
    const pdf = this.buildReturnSlip();
    pdf.save(`${this.completedReturn.returnNo || 'SalesReturn'}.pdf`);
  }

  printReturnSlip(): void {
    if (!this.completedReturn) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      this.toastr.error('Allow pop-ups to print the return slip.');
      return;
    }
    const pdf = this.buildReturnSlip();
    pdf.autoPrint();
    printWindow.location.href = pdf.output('bloburl').toString();
  }

  private buildReturnSlip(): jsPDF {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const margin = 15;
    let y = 18;
    const lineHeight = 7;
    const created = this.completedReturn;
    const date = new Date().toLocaleDateString('en-GB');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.text('Sales Return / Credit Note', margin, y);
    y += lineHeight * 2;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    [
      `Return No: ${created.returnNo || '-'}`,
      `Credit Note No: ${created.creditNoteNo || '-'}`,
      `Original Invoice: ${this.data.invoice.invoiceNumber}`,
      `Customer: ${this.data.invoice.cuName || '-'}`,
      `Return Date: ${date}`,
      `Return Type: ${created.returnType === 'refund' ? 'Refund' : 'Credit Note'}`,
      `Reason: ${this.form.get('reason')?.value || '-'}`
    ].forEach(value => { pdf.text(value, margin, y); y += lineHeight; });
    y += 3;
    pdf.setFont('helvetica', 'bold');
    pdf.text('Product', margin, y);
    pdf.text('Qty', 112, y, { align: 'right' });
    pdf.text('Rate', 145, y, { align: 'right' });
    pdf.text('GST %', 168, y, { align: 'right' });
    pdf.text('Total', 195, y, { align: 'right' });
    y += 2;
    pdf.line(margin, y, 195, y);
    y += lineHeight;
    pdf.setFont('helvetica', 'normal');
    this.lines.controls.forEach((control, index) => {
      if (!control.get('included')?.value) return;
      if (y > 270) { pdf.addPage(); y = 18; }
      const item = this.items[index];
      pdf.text(item.productName.slice(0, 42), margin, y);
      pdf.text(String(control.getRawValue().quantity), 112, y, { align: 'right' });
      pdf.text(this.formatAmount(item.rate), 145, y, { align: 'right' });
      pdf.text(this.formatAmount(item.gstRate), 168, y, { align: 'right' });
      pdf.text(this.formatAmount(this.getLineReturnTotal(index)), 195, y, { align: 'right' });
      y += lineHeight;
    });
    y += 2;
    pdf.line(margin, y, 195, y);
    y += lineHeight;
    pdf.setFont('helvetica', 'bold');
    pdf.text(`Grand Total: INR ${this.formatAmount(created.grandTotal ?? this.grandTotal)}`, 195, y, { align: 'right' });
    if (created.returnType === 'refund') {
      y += lineHeight;
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Refund: ${this.form.get('paymentMode')?.value} | Date: ${this.form.get('refundDate')?.value}`, margin, y);
    }
    return pdf;
  }
}
