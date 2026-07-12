// src/app/Component/listinvoice/sales-return-dialog.component.ts
// FIXED: Moved template to separate .html file (eliminates backtick escaping issue).
// FIXED: Removed [disabled] attribute binding on reactive form inputs.
// FIXED: FormArray enable/disable via FormControl only.

import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MaterialModule } from '../../material.module';
import { ToastrService } from 'ngx-toastr';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { InvoiceService, SalesReturnRequest } from '../../_service/invoice.service';

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
  quantity:    number;
  rateWithTax: number;
  amount:      number;
  gstRate:     number;
}

@Component({
  selector: 'app-sales-return-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule, MatDialogModule, DecimalPipe],
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
      lines:      this.fb.array([])
    });
  }

  private loadItems(): void {
    this.loading  = true;
    this.errorMsg = '';

    this.invoiceSvc.getInvoiceItems(this.data.invoice.invoiceNumber)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (r: any) => {
          const raw: any[] = Array.isArray(r) ? r : (r?.data || r?.items || []);

          this.items = raw.map(i => ({
            productId:   i.productId   || i.ProductId   || '',
            productName: i.productName || i.ProductName || i.productId || '',
            quantity:    +(i.quantity   || i.Quantity    || 0),
            rateWithTax: +(i.rateWithTax || i.RateWithTax || i.rate || i.Rate || 0),
            amount:      +(i.amount     || i.Amount      || 0),
            gstRate:     this.deriveGstRate(i)
          })).filter(i => i.quantity > 0);

          if (this.items.length === 0) {
            this.errorMsg = 'No returnable items found on this invoice.';
            this.loading  = false;
            return;
          }

          const linesArray = this.form.get('lines') as FormArray;
          this.items.forEach(item => {
            // FIX: start quantity as disabled via FormControl, NOT [disabled] attribute
            const qtyCtrl = this.fb.control(
              { value: item.quantity, disabled: true },
              [Validators.min(0.001), Validators.max(item.quantity)]
            );
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
                  qtyCtr.setValue(this.getMaxReturnable(i));
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
    if (i.cgstRate !== undefined) return (+(i.cgstRate || 0) + +(i.sgstRate || 0));
    if (i.totalGstRate !== undefined) return +(i.totalGstRate || 0);
    return 0;
  }

  getMaxReturnable(i: number): number {
    return this.items[i]?.quantity || 0;
  }

  getLineReturnTotal(i: number): number {
    const ctrl = this.lines.at(i);
    if (!ctrl?.get('included')?.value) return 0;
    const qty  = +(ctrl.get('quantity')?.value || 0);
    const rate = this.items[i]?.rateWithTax || 0;
    return Math.round(qty * rate * 100) / 100;
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
    if (this.form.invalid || this.grandTotal <= 0) {
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
      rate:        this.items[i].rateWithTax,
      gstRate:     this.items[i].gstRate
    }));

    const req: SalesReturnRequest = {
      invoiceNumber: this.data.invoice.invoiceNumber,
      companyId:     this.data.companyId,
      returnType:    this.form.get('returnType')?.value || 'credit',
      reason:        this.form.get('reason')?.value || '',
      items:         reqItems
    };

    this.submitting = true;
    this.invoiceSvc.createReturn(req)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (r: any) => {
          this.submitting = false;
          if (r?.result === 'pass') {
            this.toastr.success(
              `Return ${r.data?.returnNo} created. Credit Note: ${r.data?.creditNoteNo}`
            );
            this.dialogRef.close(true);
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
    this.dialogRef.close(false);
  }
}
