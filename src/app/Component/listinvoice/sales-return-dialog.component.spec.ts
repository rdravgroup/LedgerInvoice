import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { InvoiceService } from '../../_service/invoice.service';
import { SalesReturnDialogComponent } from './sales-return-dialog.component';

describe('SalesReturnDialogComponent', () => {
  let fixture: ComponentFixture<SalesReturnDialogComponent>;
  let component: SalesReturnDialogComponent;
  let invoiceService: jasmine.SpyObj<InvoiceService>;

  beforeEach(async () => {
    invoiceService = jasmine.createSpyObj<InvoiceService>('InvoiceService', ['getReturnableItems', 'createReturn']);
    invoiceService.getReturnableItems.and.returnValue(of({
      result: 'pass',
      data: [{
        productId: 'PROD001',
        productName: 'Product one',
        soldQuantity: 5,
        previouslyReturnedQuantity: 2,
        returnableQuantity: 3,
        rate: 50,
        gstRate: 18
      }]
    }));
    invoiceService.createReturn.and.returnValue(of({
      result: 'pass',
      data: {
        returnNo: 'SR0001',
        creditNoteNo: 'CN0001',
        returnType: 'refund',
        grandTotal: 177,
        invoiceNumber: 'INV0001',
        paymentMode: 'bank_transfer'
      }
    }));

    await TestBed.configureTestingModule({
      imports: [SalesReturnDialogComponent],
      providers: [
        { provide: InvoiceService, useValue: invoiceService },
        { provide: MAT_DIALOG_DATA, useValue: { invoice: { invoiceNumber: 'INV0001', cuName: 'Customer', totalAmt: 250 }, companyId: 'COMP00001' } },
        { provide: MatDialogRef, useValue: { close: jasmine.createSpy('close') } },
        { provide: ToastrService, useValue: { success: jasmine.createSpy('success'), error: jasmine.createSpy('error'), warning: jasmine.createSpy('warning') } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SalesReturnDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads available-to-return quantity and calculates quantity plus GST', () => {
    expect(invoiceService.getReturnableItems).toHaveBeenCalledWith('INV0001', 'COMP00001');
    expect(component.items[0].soldQuantity).toBe(5);
    expect(component.getMaxReturnable(0)).toBe(3);

    component.lines.at(0).get('included')?.setValue(true);

    expect(component.lines.at(0).get('quantity')?.value).toBe(3);
    expect(component.grandTotal).toBe(177);
  });

  it('submits refund mode and bank details with the return lines', () => {
    component.form.patchValue({
      returnType: 'refund',
      refundDate: '2026-10-06',
      paymentMode: 'bank_transfer',
      bankName: 'HDFC Bank',
      bankRef: 'UTR001'
    });
    component.lines.at(0).get('included')?.setValue(true);
    component.submit();

    expect(invoiceService.createReturn).toHaveBeenCalledWith(jasmine.objectContaining({
      invoiceNumber: 'INV0001',
      companyId: 'COMP00001',
      returnType: 'refund',
      refundDate: '2026-10-06',
      paymentMode: 'bank_transfer',
      bankName: 'HDFC Bank',
      bankRef: 'UTR001',
      items: [jasmine.objectContaining({
        productId: 'PROD001',
        quantity: 3,
        rate: 50,
        gstRate: 18
      })]
    }));
    expect(component.completedReturn.returnNo).toBe('SR0001');
  });
});
