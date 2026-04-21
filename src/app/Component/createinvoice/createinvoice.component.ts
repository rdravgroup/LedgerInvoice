import { Component, OnInit, ChangeDetectorRef, OnDestroy, ViewChild, TemplateRef } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { MaterialModule } from '../../material.module';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MasterService } from '../../_service/master.service';
import { LedgerService } from '../../_service/ledger.service';
import { ToastrService } from 'ngx-toastr';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../_service/authentication.service';
import { IpService } from '../../_service/ip.service';
import { takeUntil } from 'rxjs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { MatBottomSheet, MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { DecimalFormatterService } from '../../utils/decimal-formatter.service';
import { APP_CONSTANTS } from '../../_model/app-constants';
import { PaymentDialogComponent } from '../ledger/payment-dialog/payment-dialog.component';
import { PaymentDetailsDialogComponent } from '../ledger/payment-details-dialog/payment-details-dialog.component';
import { CustomerDetailsDialogComponent } from '../ledger/customer-details-dialog/customer-details-dialog.component';

@Component({
  selector: 'app-createinvoice',
  standalone: true,
  imports: [
    CommonModule,
    MaterialModule,
    ReactiveFormsModule,
    RouterLink,
    MatProgressSpinnerModule, MatGridListModule, MatDatepickerModule, MatNativeDateModule,
    MatInputModule, MatSelectModule, FormsModule, MatTableModule, MatFormFieldModule,
    MatButtonModule, MatBottomSheetModule
  ],
  templateUrl: './createinvoice.component.html',
  styleUrl: './createinvoice.component.css',
})
export class CreateinvoiceComponent implements OnInit, OnDestroy {

  @ViewChild('mobileItemSheet') mobileItemSheetTpl!: TemplateRef<any>;

  invoiceFormShowHide = new FormGroup({
    showOptionalFields: new FormControl<boolean>(false),
    dispatchedThrough: new FormControl(''),
    deliveryNote: new FormControl('')
  });

  get showOptionalFieldsControl(): FormControl {
    return this.invoiceFormShowHide.get('showOptionalFields') as FormControl;
  }

  // Core state
  invoiceYear: string = APP_CONSTANTS.INVOICE_YEAR;
  companyId: string = APP_CONSTANTS.DEFAULT_COMPANY_ID;
  createBy: string = '';
  updateBy: string = '';
  isEditing = false;
  isLoading = true;
  selectedInvoiceDate: Date | null = null;
  invoiceform!: FormGroup;

  // Customer action state
  selectedCustomerId: string = '';
  selectedCustomerName: string = '';
  showCustomerActions = false;
  showCustomerActionsPanel = false;   // PUBLIC — used in template

  private apiCustomerId: string = '';
  private originalInvoiceAmount: number = 0;
  private fullOutstandingAmount: number = 0;
  private destroy$ = new Subject<void>();

  // Summary panel state — PUBLIC so template can toggle it
  summaryCollapsed = true;

  // Mobile item entry form
  mobileItemForm!: FormGroup;
  /** PUBLIC so template can read it for label display */
  mobileEditIndex = -1;
  private openSheetRef: any = null;

  constructor(
    private builder: FormBuilder,
    private service: MasterService,
    private ledgerService: LedgerService,
    private router: Router,
    private alert: ToastrService,
    private activeroute: ActivatedRoute,
    private http: HttpClient,
    private authService: AuthService,
    private ipService: IpService,
    private cdr: ChangeDetectorRef,
    public decimalFormatter: DecimalFormatterService,
    private dialog: MatDialog,
    private bottomSheet: MatBottomSheet
  ) {}

  ipAddress: string = '';
  pagetitle = 'Create Invoice';
  invoicedetail!: FormArray<any>;
  invoiceproduct!: FormGroup<any>;
  mastercustomer: any[] = [];
  masterproduct: any[] = [];
  editinvoiceno: any;
  isedit = false;
  editinvdetail: any;
  displayedColumns: string[] = ['slNo', 'product', 'qty', 'rate', 'total', 'action'];
  private totalAmountSubject = new BehaviorSubject<number>(0);
  outstandingAmount: number = 0;
  isLoadingOutstanding: boolean = false;

  ngOnInit(): void {
    this.isLoading = true;
    this.initializeForm();
    this.initMobileItemForm();
    this.GetCustomers();
    this.GetProducts();
    this.editinvoiceno = this.activeroute.snapshot.paramMap.get('invoiceno');

    if (this.editinvoiceno == null) {
      this.isLoading = false;
      this.isEditing = false;
      this.isedit = false;
    } else {
      this.isEditing = true;
      this.isedit = true;
      this.pagetitle = 'Edit Invoice';
      this.SetEditInfo(this.editinvoiceno);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.openSheetRef) {
      this.openSheetRef.dismiss();
    }
  }

  initializeForm() {
    this.totalAmountSubject.next(0);
    this.invoiceform = this.builder.group({
      invoiceYear:      this.builder.control(this.invoiceYear, Validators.required),
      invoiceNumber:    this.builder.control('', Validators.required),
      invoiceDate:      this.builder.control('', Validators.required),
      companyId:        this.builder.control(this.companyId, Validators.required),
      customerId:       this.builder.control('', Validators.required),
      destination:      this.builder.control(''),
      dispatchedThrough:this.builder.control(''),
      deliveryNote:     this.builder.control(''),
      remark:           this.builder.control(''),
      createBy:         this.builder.control(''),
      updateBy:         this.builder.control(''),
      totalAmount:      this.builder.control(0),
      grandTotalAmount: this.builder.control(0),
      cgstRate:         this.builder.control(0),
      sgstRate:         this.builder.control(0),
      cgstAmount:       this.builder.control(0),
      sgstAmount:       this.builder.control(0),
      totalGstAmount:   this.builder.control(0),
      createDate:       this.builder.control({ value: new Date().toISOString(), disabled: true }),
      updateDate:       this.builder.control({ value: new Date().toISOString(), disabled: true }),
      createIp:         this.builder.control(''),
      updateIp:         this.builder.control(''),
      sales_product_info: this.builder.array([]),
    });
  }

  initMobileItemForm() {
    this.mobileItemForm = this.builder.group({
      productId:   this.builder.control('', Validators.required),
      quantity:    this.builder.control(1, [Validators.required, Validators.min(0.001)]),
      rateWithTax: this.builder.control(0, [Validators.required, Validators.min(0.01)]),
      amount:      this.builder.control({ value: 0, disabled: true }),
    });
    this.mobileItemForm.get('quantity')?.valueChanges
      .pipe(takeUntil(this.destroy$)).subscribe(() => this.recalcMobileAmount());
    this.mobileItemForm.get('rateWithTax')?.valueChanges
      .pipe(takeUntil(this.destroy$)).subscribe(() => this.recalcMobileAmount());
  }

  private recalcMobileAmount() {
    const q = +(this.mobileItemForm.get('quantity')?.value  || 0);
    const r = +(this.mobileItemForm.get('rateWithTax')?.value || 0);
    this.mobileItemForm.get('amount')?.setValue(
      Math.round(q * r * 1000) / 1000, { emitEvent: false }
    );
  }

  SetEditInfo(invoiceno: any) {
    this.isLoading = true;
    this.service.GetInvHeaderbycode(invoiceno).subscribe({
      next: (res) => {
        const editdata = res as any;
        if (editdata) {
          const invoiceDate = editdata.invoiceDate ? new Date(editdata.invoiceDate) : null;
          this.apiCustomerId         = editdata.customerId || '';
          this.originalInvoiceAmount = editdata.totalAmount || 0;
          this.invoiceform.patchValue({
            invoiceYear:       editdata.invoiceYear       || '',
            invoiceNumber:     editdata.displayInvNumber  || '',
            customerId:        editdata.customerId        || '',
            destination:       editdata.destination       || '',
            remark:            editdata.remark            || '',
            invoiceDate:       invoiceDate,
            companyId:         editdata.companyId         || '',
            dispatchedThrough: editdata.dispatchedThrough || '',
            deliveryNote:      editdata.deliveryNote      || '',
            totalAmount:       editdata.totalAmount       || 0,
          });
          this.selectedInvoiceDate = invoiceDate;
          this.editinvoiceno       = editdata.invoiceNumber;
          this.invoiceform.get('customerId')?.disable();
          if (editdata.customerId) { this.customerchange(editdata.customerId); }
          this.cdr.detectChanges();
        }
      },
      error: () => { this.alert.error('Failed to load invoice header', 'Error'); this.isLoading = false; },
    });

    this.service.GetInvDetailbycode(invoiceno).subscribe({
      next: (res) => {
        let productData = res as any;
        if (!Array.isArray(productData)) { productData = []; }
        this.editinvdetail  = productData;
        this.invoicedetail  = this.invoiceform.get('sales_product_info') as FormArray;
        this.invoicedetail.clear();
        this.editinvdetail.forEach((detail: any) => {
          const newRow = this.Generaterow();
          newRow.patchValue({
            productId:   detail.productId,
            quantity:    Number(detail.quantity   || 0),
            rateWithTax: Number(detail.rateWithTax || 0),
            amount:      Number(detail.amount      || 0),
          });
          this.invoicedetail.push(newRow);
        });
        this.summarycalculation();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.alert.error('Failed to load invoice details', 'Error'); this.isLoading = false; },
    });
  }

  SaveInvoice() {
    if (this.invoiceform.invalid) {
      this.alert.warning('Please enter values in all mandatory fields.', 'Validation'); return;
    }
    this.invoicedetail = this.invoiceform.get('sales_product_info') as FormArray;
    if (this.invoicedetail.length === 0) {
      this.alert.warning('Please add at least one product before saving!', 'Validation'); return;
    }
    if (this.invoicedetail.controls.some(p => !p.get('productId')?.value)) {
      this.alert.warning('Please select a product for each row!', 'Validation'); return;
    }
    if (this.invoicedetail.controls.some(p => !(p.get('quantity')?.value > 0))) {
      this.alert.warning('Quantity must be greater than 0!', 'Validation'); return;
    }
    if (this.invoicedetail.controls.some(p => !(p.get('rateWithTax')?.value > 0))) {
      this.alert.warning('Rate must be greater than 0!', 'Validation'); return;
    }
    if (this.invoicedetail.controls.some(p => !(p.get('amount')?.value > 0))) {
      this.alert.warning('Total amount must be greater than 0!', 'Validation'); return;
    }

    const username = this.authService.getUsername() || '';
    if (this.isedit) {
      this.invoiceform.patchValue({ updateBy: username });
      this.invoiceform.patchValue({ customerId: this.apiCustomerId }, { emitEvent: false });
    } else {
      this.invoiceform.patchValue({ createBy: username });
    }

    const formData          = this.invoiceform.getRawValue();
    formData.invoiceDate    = this.invoiceform.get('invoiceDate')?.value;
    const payload           = this.transformPayloadForBackend(formData);

    this.service.SaveInvoice(payload).subscribe({
      next: (res) => {
        const result: any = res;
        if (result.result === APP_CONSTANTS.RESPONSE_STATUS.PASS) {
          const num = result.kyValue || 'Saved';
          this.alert.success(
            this.isedit ? 'Updated Successfully.' : 'Created Successfully.',
            'Invoice: ' + num
          );
          this.router.navigate(['/listinvoice']);
        } else {
          this.alert.error(result.message || 'Failed to save.', 'Invoice');
        }
      },
      error: () => { this.alert.error('Failed to save invoice', 'Error'); }
    });
  }

  transformPayloadForBackend(formData: any): any {
    const now    = new Date().toISOString();
    const userIp = 'string';
    const products = formData.sales_product_info.map((p: any) => ({
      invoiceYear:    formData.invoiceYear,
      productId:      p.productId,
      quantity:       p.quantity,
      rateWithoutTax: p.rateWithoutTax || 0,
      rateWithTax:    p.rateWithTax,
      amount:         p.amount,
      createBy:       formData.createBy,
      updateBy:       formData.updateBy,
      createDate:     now, updateDate: now, createIp: userIp, updateIp: userIp
    }));

    let invoiceDate: string;
    if (formData.invoiceDate instanceof Date) {
      const y = formData.invoiceDate.getFullYear();
      const m = String(formData.invoiceDate.getMonth() + 1).padStart(2, '0');
      const d = String(formData.invoiceDate.getDate()).padStart(2, '0');
      invoiceDate = `${y}-${m}-${d}T00:00:00.000Z`;
    } else {
      invoiceDate = formData.invoiceDate;
    }

    const payload: any = {
      invoiceYear:       formData.invoiceYear,
      displayInvNumber:  formData.invoiceNumber,
      invoiceDate,
      companyId:         formData.companyId,
      customerId:        formData.customerId,
      destination:       formData.destination       || '',
      dispatchedThrough: formData.dispatchedThrough || 'Not Applicable',
      deliveryNote:      formData.deliveryNote      || 'Not Applicable',
      remark:            formData.remark            || '',
      totalAmount:       formData.totalAmount,
      grandTotalAmount:  formData.grandTotalAmount  || formData.totalAmount,
      cgstRate:          formData.cgstRate          || 0,
      sgstRate:          formData.sgstRate          || 0,
      cgstAmount:        formData.cgstAmount        || 0,
      sgstAmount:        formData.sgstAmount        || 0,
      totalGstAmount:    formData.totalGstAmount    || 0,
      createBy:          formData.createBy,
      updateBy:          formData.updateBy,
      createDate:        now, updateDate: now, createIp: userIp, updateIp: userIp,
      products
    };
    if (this.isedit && this.editinvoiceno) {
      payload.invoiceNumber = this.editinvoiceno;
    }
    return payload;
  }

  addnewproduct() {
    this.invoicedetail = this.invoiceform.get('sales_product_info') as FormArray;
    const customerId    = this.invoiceform.get('customerId')?.value;
    const invoiceDate   = this.invoiceform.get('invoiceDate')?.value;
    const invoiceNumber = this.invoiceform.get('invoiceNumber')?.value;
    if (!customerId   || String(customerId).trim()   === '') { this.alert.warning('Select a customer first',       'Validation'); return; }
    if (!invoiceDate)                                         { this.alert.warning('Select an invoice date first',  'Validation'); return; }
    if (!invoiceNumber || String(invoiceNumber).trim() === '') { this.alert.warning('Enter an invoice number first', 'Validation'); return; }
    this.invoicedetail.push(this.Generaterow());
  }

  get invproducts() {
    return this.invoiceform.get('sales_product_info') as FormArray;
  }

  Generaterow() {
    return this.builder.group({
      invoiceNumber: this.builder.control(''),
      productId:     this.builder.control('', Validators.required),
      quantity:      this.builder.control(0),
      rateWithTax:   this.builder.control(0),
      amount:        this.builder.control(0),
    });
  }

  productchange(index: any) {
    this.invoicedetail  = this.invoiceform.get('sales_product_info') as FormArray;
    this.invoiceproduct = this.invoicedetail.at(index) as FormGroup;
    const productcode   = this.invoiceproduct.get('productId')?.value;
    const dup = this.invoicedetail.controls.some((p, i) => p.get('productId')?.value === productcode && i !== index);
    if (dup) {
      this.alert.warning('This product is already in the invoice!', 'Validation');
      this.invoiceproduct.get('productId')?.setValue(''); return;
    }
    this.service.GetProductbycode(productcode).subscribe({
      next: (res) => {
        const p = res as any;
        if (p) { this.invoiceproduct.get('rateWithTax')?.setValue(p.rateWithTax || 0); this.Itemcalculation(index); }
      },
      error: () => { this.alert.error('Failed to fetch product details.', 'Error'); }
    });
  }

  Itemcalculation(index: any) {
    this.invoicedetail  = this.invoiceform.get('sales_product_info') as FormArray;
    this.invoiceproduct = this.invoicedetail.at(index) as FormGroup;
    const qty  = this.invoiceproduct.get('quantity')?.value;
    const rate = this.invoiceproduct.get('rateWithTax')?.value;
    this.invoiceproduct.get('amount')?.setValue(this.setValueWithThreeDecimal(qty * rate));
    this.summarycalculation();
  }

  Removeproduct(index: any) {
    if (confirm('Remove this item?')) {
      this.invproducts.removeAt(index);
      this.summarycalculation();
    }
  }

  summarycalculation() {
    const arr = this.invoiceform.getRawValue().sales_product_info;
    const sum = arr.length > 0
      ? this.setValueWithTwoDecimal(arr.reduce((acc: number, x: any) => acc + Number(x.amount), 0))
      : 0;
    this.invoiceform.get('totalAmount')?.setValue(sum);
    this.totalAmountSubject.next(sum);
    this.cdr.detectChanges();
  }

  setValueWithTwoDecimal(v: number)  { return Math.round(v * 100)  / 100;  }
  setValueWithThreeDecimal(v: number) { return Math.round(v * 1000) / 1000; }

  GetCustomers() {
    this.service.GetCustomer().subscribe({
      next: (res: any) => { this.mastercustomer = Array.isArray(res) ? res : []; },
      error: () => { this.alert.error('Failed to load customers', 'Error'); this.mastercustomer = []; }
    });
  }

  GetProducts() {
    this.service.GetProducts().subscribe({
      next: (res: any) => { this.masterproduct = Array.isArray(res) ? res : []; },
      error: () => { this.alert.error('Failed to load products', 'Error'); this.masterproduct = []; }
    });
  }

  customerchange(selectedCustomer: string) {
    const customercode        = this.invoiceform.get('customerId')?.value || selectedCustomer;
    this.selectedCustomerId   = customercode;
    const cust                = this.mastercustomer.find(c => c.uniqueKeyID === customercode);
    this.selectedCustomerName = cust?.name || '';
    this.showCustomerActions  = !!customercode;
    this.service.GetCustomerbycode(customercode).subscribe({
      next: (res) => {
        const d = res as any;
        if (d) {
          this.invoiceform.get('destination')?.setValue(
            `${d.addressDetails || ''},${d.phone || ''},${d.email || ''},${d.name || ''}`
          );
        }
      },
      error: () => { this.alert.error('Failed to load customer details', 'Error'); }
    });
    this.loadOutstandingAmount(customercode);
  }

  loadOutstandingAmount(customerId: string): void {
    if (!customerId) { this.fullOutstandingAmount = 0; this.outstandingAmount = 0; return; }
    this.isLoadingOutstanding = true;
    this.ledgerService.getCustomerLedger(customerId).subscribe({
      next: (response: any) => {
        const data = response.data || response;
        const outstanding = data?.outstanding || data?.balance
          || data?.outstandingBalance?.totalOutstanding || data?.totalOutstanding || 0;
        if (typeof outstanding === 'number' && outstanding >= 0) {
          this.fullOutstandingAmount = outstanding;
          this.outstandingAmount     = (this.isedit && this.originalInvoiceAmount > 0)
            ? Math.max(0, outstanding - this.originalInvoiceAmount)
            : outstanding;
        } else {
          this.fullOutstandingAmount = 0; this.outstandingAmount = 0;
        }
        this.isLoadingOutstanding = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.alert.warning(`Could not load outstanding: ${err.message}`, 'Warning');
        this.fullOutstandingAmount = 0; this.outstandingAmount = 0;
        this.isLoadingOutstanding  = false;
      }
    });
  }

  viewCustomer(customerId: string): void {
    if (!customerId) return;
    this.ledgerService.getCustomerLedger(customerId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response: any) => {
        const customer = response.data || response;
        if (customer?.customerId) {
          this.dialog.open(CustomerDetailsDialogComponent, { width: '1000px', data: { customer } });
        } else {
          this.alert.error('Failed to load customer details', 'Error');
        }
      },
      error: (err) => { this.alert.error('Error loading customer details: ' + err.message, 'Error'); }
    });
  }

  viewPayments(customerId: string, customerName: string): void {
    if (!customerId) return;
    const ref = this.dialog.open(PaymentDetailsDialogComponent, {
      width: '900px', data: { customerId, customerName: customerName || 'Customer' }
    });
    ref.afterClosed().pipe(takeUntil(this.destroy$)).subscribe((result: any) => {
      if (result?.ok && result?.paymentDeleted && result?.customerId) {
        this.loadOutstandingAmount(result.customerId);
      }
    });
  }

  sendReminder(customerId: string, customerName: string): void {
    if (!customerId) return;
    this.alert.info(`Sending reminder to ${customerName}...`, 'Reminder');
  }

  openPaymentPrompt(): void {
    if (!this.selectedCustomerId) return;
    const ref = this.dialog.open(PaymentDialogComponent, {
      width: '420px',
      data: { customerId: this.selectedCustomerId, customerName: this.selectedCustomerName, companyId: this.companyId }
    });
    ref.afterClosed().pipe(takeUntil(this.destroy$)).subscribe((result: any) => {
      if (result?.ok) {
        this.alert.success('Payment recorded successfully', 'Payment');
        this.loadOutstandingAmount(this.selectedCustomerId);
      } else if (result?.error) {
        this.alert.error(result.error || 'Failed to record payment', 'Payment');
      }
    });
  }

  /* ── Mobile bottom-sheet item entry ───────────────────── */

  openMobileItemEntry(editIndex: number = -1): void {
    if (editIndex < 0) {
      const customerId    = this.invoiceform.get('customerId')?.value;
      const invoiceDate   = this.invoiceform.get('invoiceDate')?.value;
      const invoiceNumber = this.invoiceform.get('invoiceNumber')?.value;
      if (!customerId   || String(customerId).trim()   === '') { this.alert.warning('Select a customer first',       'Validation'); return; }
      if (!invoiceDate)                                         { this.alert.warning('Select an invoice date first',  'Validation'); return; }
      if (!invoiceNumber || String(invoiceNumber).trim() === '') { this.alert.warning('Enter an invoice number first', 'Validation'); return; }
    }
    this.mobileEditIndex = editIndex;
    if (editIndex >= 0) {
      const row = this.invproducts.at(editIndex);
      this.mobileItemForm.patchValue({
        productId:   row.get('productId')?.value   || '',
        quantity:    row.get('quantity')?.value    || 1,
        rateWithTax: row.get('rateWithTax')?.value || 0,
      });
    } else {
      this.mobileItemForm.reset({ productId: '', quantity: 1, rateWithTax: 0 });
    }
    this.recalcMobileAmount();
    this.openSheetRef = this.bottomSheet.open(this.mobileItemSheetTpl as any, {
      panelClass: 'inv-mobile-sheet-panel',
      disableClose: false,
    });
  }

  closeMobileItemEntry(): void {
    if (this.openSheetRef) { this.openSheetRef.dismiss(); this.openSheetRef = null; }
  }

  saveMobileItem(): void {
    if (this.mobileItemForm.invalid) {
      this.mobileItemForm.markAllAsTouched();
      this.alert.warning('Please fill in all required fields', 'Validation'); return;
    }
    const val    = this.mobileItemForm.getRawValue();
    const amount = this.setValueWithThreeDecimal((+val.quantity) * (+val.rateWithTax));
    if (this.mobileEditIndex >= 0) {
      const row = this.invproducts.at(this.mobileEditIndex) as FormGroup;
      row.patchValue({ productId: val.productId, quantity: val.quantity, rateWithTax: val.rateWithTax, amount });
    } else {
      const dup = this.invproducts.controls.some(p => p.get('productId')?.value === val.productId);
      if (dup) { this.alert.warning('This product is already in the invoice!', 'Validation'); return; }
      const newRow = this.Generaterow();
      newRow.patchValue({ productId: val.productId, quantity: val.quantity, rateWithTax: val.rateWithTax, amount });
      this.invproducts.push(newRow);
    }
    this.summarycalculation();
    this.closeMobileItemEntry();
  }

  onMobileProductSelected(): void {
    const productId = this.mobileItemForm.get('productId')?.value;
    if (!productId) return;
    this.service.GetProductbycode(productId).subscribe({
      next: (res: any) => {
        if (res?.rateWithTax != null) {
          this.mobileItemForm.get('rateWithTax')?.setValue(res.rateWithTax);
        }
      },
      error: () => {}
    });
  }

  incrementMobileQty(): void {
    const cur = +(this.mobileItemForm.get('quantity')?.value || 0);
    this.mobileItemForm.get('quantity')?.setValue(+(cur + 1).toFixed(3));
  }

  decrementMobileQty(): void {
    const cur  = +(this.mobileItemForm.get('quantity')?.value || 1);
    const next = Math.max(0.001, cur - 1);
    this.mobileItemForm.get('quantity')?.setValue(+next.toFixed(3));
  }

  get mobileItemTotal(): number {
    const q = +(this.mobileItemForm?.get('quantity')?.value  || 0);
    const r = +(this.mobileItemForm?.get('rateWithTax')?.value || 0);
    return Math.round(q * r * 100) / 100;
  }

  getProductName(productId: string): string {
    return this.masterproduct.find(p => p.uniqueKeyID === productId)?.productName || '';
  }

  get totalAmountValue(): number       { return this.totalAmountSubject.value; }
  get displayOutstandingAmount(): number { return this.outstandingAmount; }
  get displayTotalToPayAmount(): number  { return this.outstandingAmount + this.totalAmountValue; }
}
