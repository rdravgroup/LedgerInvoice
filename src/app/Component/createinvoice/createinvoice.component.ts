import {
  Component, OnInit, ChangeDetectorRef, OnDestroy,
  ViewChild, TemplateRef
} from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { MaterialModule } from '../../material.module';
import {
  FormArray, FormBuilder, FormControl, FormGroup,
  FormsModule, ReactiveFormsModule, Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MasterService } from '../../_service/master.service';
import { LedgerService } from '../../_service/ledger.service';
import { ToastrService } from 'ngx-toastr';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../_service/authentication.service';
import { SelectedCompanyService } from '../../_service/selected-company.service';
import { UserService } from '../../_service/user.service';
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
    CommonModule, MaterialModule, ReactiveFormsModule, RouterLink, FormsModule,
    MatProgressSpinnerModule, MatGridListModule, MatDatepickerModule, MatNativeDateModule,
    MatInputModule, MatSelectModule, MatTableModule, MatFormFieldModule,
    MatButtonModule, MatBottomSheetModule,
  ],
  templateUrl: './createinvoice.component.html',
  styleUrl: './createinvoice.component.css',
})
export class CreateinvoiceComponent implements OnInit, OnDestroy {

  @ViewChild('mobileItemSheet') mobileItemSheetTpl!: TemplateRef<any>;

  invoiceFormShowHide = new FormGroup({
    showOptionalFields: new FormControl<boolean>(false),
    dispatchedThrough:  new FormControl(''),
    deliveryNote:       new FormControl('')
  });
  get showOptionalFieldsControl(): FormControl {
    return this.invoiceFormShowHide.get('showOptionalFields') as FormControl;
  }

  /** Search terms — PUBLIC, bound directly in template via [(ngModel)] */
  customerSearchTerm = '';
  productSearchTerm  = '';
  rowProductSearch: string[] = [];

  get filteredCustomers(): any[] {
    const q = this.customerSearchTerm.toLowerCase();
    return q ? this.mastercustomer.filter((c: any) => (c.name || '').toLowerCase().includes(q)) : this.mastercustomer;
  }
  getFilteredProducts(term: string): any[] {
    const q = (term || '').toLowerCase();
    return q ? this.masterproduct.filter((p: any) => (p.productName || '').toLowerCase().includes(q)) : this.masterproduct;
  }

  invoiceYear = APP_CONSTANTS.INVOICE_YEAR;
  companyId   = APP_CONSTANTS.DEFAULT_COMPANY_ID;
  isLoading = true;
  selectedInvoiceDate: Date | null = null;
  invoiceform!: FormGroup;

  selectedCustomerId   = '';
  selectedCustomerName = '';
  showCustomerActions  = false;
  showCustomerActionsPanel = false;
  private apiCustomerId         = '';
  private originalInvoiceAmount = 0;
  private fullOutstandingAmount = 0;
  private destroy$ = new Subject<void>();

  summaryCollapsed = true;
  summaryStyle: { [k: string]: string } = { bottom: '24px', right: '24px', left: 'auto' };
  private _dragging = false;
  private _dragStartX = 0; private _dragStartY = 0;
  private _startLeft  = 0; private _startBottom = 0;

  mobileItemForm!: FormGroup;
  mobileEditIndex = -1;
  private openSheetRef: any = null;

  ipAddress = ''; pagetitle = 'Create Invoice';
  invoicedetail!: FormArray<any>;
  invoiceproduct!: FormGroup<any>;
  mastercustomer: any[] = [];
  masterproduct:  any[] = [];
  editinvoiceno:  any;
  isedit = false; editinvdetail: any;
  displayedColumns = ['slNo','product','qty','rate','total','action'];
  private totalAmountSubject = new BehaviorSubject<number>(0);
  outstandingAmount    = 0;
  isLoadingOutstanding = false;

  constructor(
    private builder:  FormBuilder,
    private service:  MasterService,
    private ledgerService: LedgerService,
    private router:   Router,
    private alert:    ToastrService,
    private activeroute: ActivatedRoute,
    private http:     HttpClient,
    private authService: AuthService,
    private selectedCompanyService: SelectedCompanyService,
    private ipService:   IpService,
    private cdr:      ChangeDetectorRef,
    public  decimalFormatter: DecimalFormatterService,
    private dialog:   MatDialog,
    private bottomSheet: MatBottomSheet
  ) {}

  ngOnInit(): void {
    this.isLoading = true;
    this.initializeForm();
    this.initMobileItemForm();
    const initialCompany = this.getEffectiveCompanyId();
    this.companyId = initialCompany;
    this.invoiceform.patchValue({ companyId: initialCompany }, { emitEvent: false });

    this.GetCustomers();
    this.GetProducts();

    this.selectedCompanyService.selectedCompanyId$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      const eff = this.getEffectiveCompanyId();
      this.companyId = eff;
      this.invoiceform.patchValue({ companyId: eff }, { emitEvent: false });
      this.GetCustomers();
      this.GetProducts();
    });

    this.editinvoiceno = this.activeroute.snapshot.paramMap.get('invoiceno');
    if (this.editinvoiceno == null) {
      this.isedit = false;
      this.isLoading = false;
    } else {
      this.isedit = true;
      this.pagetitle = 'Edit Invoice';
    }
  }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); this.openSheetRef?.dismiss(); }

  initializeForm() {
    this.totalAmountSubject.next(0);
    this.invoiceform = this.builder.group({
      invoiceYear: this.builder.control(this.invoiceYear, Validators.required),
      invoiceNumber: this.builder.control('', Validators.required),
      invoiceDate: this.builder.control('', Validators.required),
      companyId: this.builder.control(this.companyId, Validators.required),
      customerId: this.builder.control('', Validators.required),
      destination: this.builder.control(''),
      dispatchedThrough: this.builder.control(''),
      deliveryNote: this.builder.control(''),
      remark: this.builder.control(''),
      createBy: this.builder.control(''), updateBy: this.builder.control(''),
      totalAmount: this.builder.control(0), grandTotalAmount: this.builder.control(0),
      cgstRate: this.builder.control(0), sgstRate: this.builder.control(0),
      cgstAmount: this.builder.control(0), sgstAmount: this.builder.control(0),
      totalGstAmount: this.builder.control(0),
      createDate: this.builder.control({ value: new Date().toISOString(), disabled: true }),
      updateDate: this.builder.control({ value: new Date().toISOString(), disabled: true }),
      createIp: this.builder.control(''), updateIp: this.builder.control(''),
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
    this.mobileItemForm.get('quantity')?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.recalcMobileAmount());
    this.mobileItemForm.get('rateWithTax')?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.recalcMobileAmount());
  }

  private recalcMobileAmount() {
    const q = +(this.mobileItemForm.get('quantity')?.value  || 0);
    const r = +(this.mobileItemForm.get('rateWithTax')?.value || 0);
    this.mobileItemForm.get('amount')?.setValue(Math.round(q * r * 1000) / 1000, { emitEvent: false });
  }

  SetEditInfo(invoiceno: any) {
    this.isLoading = true;
    this.service.GetInvHeaderbycode(invoiceno).subscribe({
      next: (res) => {
        const d = res as any;
        if (!d) { this.isLoading = false; return; }
        const invoiceDate = d.invoiceDate ? new Date(d.invoiceDate) : null;
        this.apiCustomerId = d.customerId || '';
        this.originalInvoiceAmount = d.totalAmount || 0;
        this.invoiceform.patchValue({
          invoiceYear: d.invoiceYear||'', invoiceNumber: d.displayInvNumber||'',
          customerId: d.customerId||'', destination: d.destination||'', remark: d.remark||'',
          invoiceDate, companyId: d.companyId||'', dispatchedThrough: d.dispatchedThrough||'',
          deliveryNote: d.deliveryNote||'', totalAmount: d.totalAmount||0,
        });
        this.selectedInvoiceDate = invoiceDate;
        this.editinvoiceno = d.invoiceNumber;
        this.invoiceform.get('customerId')?.disable();
        if (d.customerId) this.customerchange(d.customerId);
        this.cdr.detectChanges();
      },
      error: () => { this.alert.error('Failed to load invoice header', 'Error'); this.isLoading = false; },
    });
    this.service.GetInvDetailbycode(invoiceno).subscribe({
      next: (res) => {
        let pd = res as any; if (!Array.isArray(pd)) pd = [];
        this.editinvdetail = pd;
        this.invoicedetail = this.invoiceform.get('sales_product_info') as FormArray;
        this.invoicedetail.clear(); this.rowProductSearch = [];
        pd.forEach((detail: any) => {
          const row = this.Generaterow();
          row.patchValue({ productId: detail.productId, quantity: Number(detail.quantity||0),
            rateWithTax: Number(detail.rateWithTax||0), amount: Number(detail.amount||0) });
          this.invoicedetail.push(row); this.rowProductSearch.push('');
        });
        this.summarycalculation(); this.isLoading = false; this.cdr.detectChanges();
      },
      error: () => { this.alert.error('Failed to load invoice details', 'Error'); this.isLoading = false; },
    });
  }

  SaveInvoice() {
    if (this.invoiceform.invalid) { this.alert.warning('Please fill all mandatory fields.', 'Validation'); return; }
    this.invoicedetail = this.invoiceform.get('sales_product_info') as FormArray;
    if (!this.invoicedetail.length) { this.alert.warning('Add at least one product!', 'Validation'); return; }
    if (this.invoicedetail.controls.some(p => !p.get('productId')?.value)) { this.alert.warning('Select a product for each row!', 'Validation'); return; }
    if (this.invoicedetail.controls.some(p => !(p.get('quantity')?.value > 0))) { this.alert.warning('Quantity must be > 0!', 'Validation'); return; }
    if (this.invoicedetail.controls.some(p => !(p.get('rateWithTax')?.value > 0))) { this.alert.warning('Rate must be > 0!', 'Validation'); return; }
    const username = this.authService.getUsername() || '';
    if (this.isedit) { this.invoiceform.patchValue({ updateBy: username }); this.invoiceform.patchValue({ customerId: this.apiCustomerId }, { emitEvent: false }); }
    else this.invoiceform.patchValue({ createBy: username });
    const formData = this.invoiceform.getRawValue();
    formData.invoiceDate = this.invoiceform.get('invoiceDate')?.value;
    const companyId = this.invoiceform.get('companyId')?.value || this.getEffectiveCompanyId();
    this.service.SaveInvoice(this.transformPayloadForBackend(formData), companyId).subscribe({
      next: (res) => {
        const r: any = res;
        if (r.result === APP_CONSTANTS.RESPONSE_STATUS.PASS) {
          this.alert.success(this.isedit ? 'Updated Successfully.' : 'Created Successfully.', 'Invoice: ' + (r.kyValue||''));
          this.router.navigate(['/listinvoice']);
        } else this.alert.error(r.message||'Failed to save.', 'Invoice');
      },
      error: () => { this.alert.error('Failed to save invoice', 'Error'); }
    });
  }

  transformPayloadForBackend(formData: any): any {
    const now = new Date().toISOString();
    const products = formData.sales_product_info.map((p: any) => ({
      invoiceYear: formData.invoiceYear, productId: p.productId, quantity: p.quantity,
      rateWithoutTax: p.rateWithoutTax||0, rateWithTax: p.rateWithTax, amount: p.amount,
      createBy: formData.createBy, updateBy: formData.updateBy,
      createDate: now, updateDate: now, createIp: 'string', updateIp: 'string'
    }));
    let invoiceDate: string;
    if (formData.invoiceDate instanceof Date) {
      const y = formData.invoiceDate.getFullYear();
      const m = String(formData.invoiceDate.getMonth()+1).padStart(2,'0');
      const d = String(formData.invoiceDate.getDate()).padStart(2,'0');
      invoiceDate = `${y}-${m}-${d}T00:00:00.000Z`;
    } else invoiceDate = formData.invoiceDate;
    const payload: any = {
      invoiceYear: formData.invoiceYear, displayInvNumber: formData.invoiceNumber, invoiceDate,
      companyId: formData.companyId, customerId: formData.customerId, destination: formData.destination||'',
      dispatchedThrough: formData.dispatchedThrough||'Not Applicable', deliveryNote: formData.deliveryNote||'Not Applicable',
      remark: formData.remark||'', totalAmount: formData.totalAmount,
      grandTotalAmount: formData.grandTotalAmount||formData.totalAmount,
      cgstRate: 0, sgstRate: 0, cgstAmount: 0, sgstAmount: 0, totalGstAmount: 0,
      createBy: formData.createBy, updateBy: formData.updateBy,
      createDate: now, updateDate: now, createIp: 'string', updateIp: 'string', products
    };
    if (this.isedit && this.editinvoiceno) payload.invoiceNumber = this.editinvoiceno;
    return payload;
  }

  addnewproduct() {
    this.invoicedetail = this.invoiceform.get('sales_product_info') as FormArray;
    const cid = this.invoiceform.get('customerId')?.value;
    const dt  = this.invoiceform.get('invoiceDate')?.value;
    const num = this.invoiceform.get('invoiceNumber')?.value;
    if (!cid||!String(cid).trim()) { this.alert.warning('Select a customer first','Validation'); return; }
    if (!dt) { this.alert.warning('Select an invoice date first','Validation'); return; }
    if (!num||!String(num).trim()) { this.alert.warning('Enter an invoice number first','Validation'); return; }
    this.invoicedetail.push(this.Generaterow());
    this.rowProductSearch.push('');
  }

  get invproducts() { return this.invoiceform.get('sales_product_info') as FormArray; }

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
    const code = this.invoiceproduct.get('productId')?.value;
    if (this.invoicedetail.controls.some((p, i) => p.get('productId')?.value === code && i !== index)) {
      this.alert.warning('Product already in invoice!','Validation'); this.invoiceproduct.get('productId')?.setValue(''); return;
    }
    const companyId = this.invoiceform.get('companyId')?.value || this.getEffectiveCompanyId();
    this.service.GetProductbycode(code, companyId).subscribe({
      next: (res) => { const p = res as any; if (p) { this.invoiceproduct.get('rateWithTax')?.setValue(p.rateWithTax||0); this.Itemcalculation(index); } },
      error: () => { this.alert.error('Failed to fetch product details.','Error'); }
    });
  }

  Itemcalculation(index: any) {
    this.invoicedetail  = this.invoiceform.get('sales_product_info') as FormArray;
    this.invoiceproduct = this.invoicedetail.at(index) as FormGroup;
    const qty  = this.invoiceproduct.get('quantity')?.value;
    const rate = this.invoiceproduct.get('rateWithTax')?.value;
    this.invoiceproduct.get('amount')?.setValue(Math.round(qty*rate*1000)/1000);
    this.summarycalculation();
  }

  Removeproduct(index: any) {
    if (confirm('Remove this item?')) { this.invproducts.removeAt(index); this.rowProductSearch.splice(index,1); this.summarycalculation(); }
  }

  summarycalculation() {
    const arr = this.invoiceform.getRawValue().sales_product_info;
    const sum = arr.length ? Math.round(arr.reduce((a: number, x: any) => a+Number(x.amount), 0)*100)/100 : 0;
    this.invoiceform.get('totalAmount')?.setValue(sum);
    this.totalAmountSubject.next(sum);
    this.cdr.detectChanges();
  }

  getEffectiveCompanyId(): string {
    const sel = this.selectedCompanyService.getSelectedCompanyId();
    const tokenCid = this.authService.getCompanyId() || APP_CONSTANTS.DEFAULT_COMPANY_ID;
    const role = this.authService.getUserRole() || '';
    const isSuper = role.toLowerCase() === 'super_admin';
    return (isSuper && sel) ? sel : tokenCid;
  }

  GetCustomers() {
    const companyId = this.invoiceform.get('companyId')?.value || this.getEffectiveCompanyId();
    this.service.GetCustomer(companyId).subscribe({
      next: (res: any) => { this.mastercustomer = Array.isArray(res) ? res : []; },
      error: () => { this.alert.error('Failed to load customers','Error'); }
    });
  }

  GetProducts() {
    const companyId = this.invoiceform.get('companyId')?.value || this.getEffectiveCompanyId();
    this.service.GetProducts(companyId).subscribe({
      next: (res: any) => { this.masterproduct = Array.isArray(res) ? res : []; },
      error: () => { this.alert.error('Failed to load products','Error'); }
    });
  }


  customerchange(selectedCustomer: string) {
    const code = this.invoiceform.get('customerId')?.value || selectedCustomer;
    this.selectedCustomerId   = code;
    const c = this.mastercustomer.find((x: any) => x.uniqueKeyID === code);
    this.selectedCustomerName = c?.name || '';
    this.showCustomerActions  = !!code;
    const companyId = this.invoiceform.get('companyId')?.value || this.getEffectiveCompanyId();
    this.service.GetCustomerbycode(code, companyId).subscribe({
      next: (res) => { const d = res as any; if (d) this.invoiceform.get('destination')?.setValue(`${d.addressDetails||''},${d.phone||''},${d.email||''},${d.name||''}`); },
      error: () => {}
    });
    this.loadOutstandingAmount(code);
  }

  loadOutstandingAmount(customerId: string): void {
    if (!customerId) { this.outstandingAmount = 0; return; }
    this.isLoadingOutstanding = true;
    this.ledgerService.getCustomerLedger(customerId).subscribe({
      next: (response: any) => {
        const data = response.data || response;
        const outstanding = data?.outstanding||data?.balance||data?.outstandingBalance?.totalOutstanding||data?.totalOutstanding||0;
        this.fullOutstandingAmount = (typeof outstanding==='number'&&outstanding>=0) ? outstanding : 0;
        this.outstandingAmount = (this.isedit&&this.originalInvoiceAmount>0) ? Math.max(0,this.fullOutstandingAmount-this.originalInvoiceAmount) : this.fullOutstandingAmount;
        this.isLoadingOutstanding = false; this.cdr.detectChanges();
      },
      error: (err) => { this.alert.warning(`Could not load outstanding: ${err.message}`,'Warning'); this.outstandingAmount=0; this.isLoadingOutstanding=false; }
    });
  }

  viewCustomer(customerId: string): void {
    if (!customerId) return;
    this.ledgerService.getCustomerLedger(customerId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response: any) => {
        const customer = response.data||response;
        if (customer?.customerId) this.dialog.open(CustomerDetailsDialogComponent,{width:'1000px',data:{customer}});
        else this.alert.error('Failed to load customer details','Error');
      },
      error: (err) => { this.alert.error('Error loading customer: '+err.message,'Error'); }
    });
  }

  viewPayments(customerId: string, customerName: string): void {
    if (!customerId) return;
    this.dialog.open(PaymentDetailsDialogComponent,{width:'900px',data:{customerId,customerName:customerName||'Customer'}})
      .afterClosed().pipe(takeUntil(this.destroy$)).subscribe((r: any) => {
        if (r?.ok&&r?.paymentDeleted&&r?.customerId) this.loadOutstandingAmount(r.customerId);
      });
  }

  sendReminder(customerId: string, customerName: string): void {
    if (customerId) this.alert.info(`Sending reminder to ${customerName}...`,'Reminder');
  }

  openPaymentPrompt(): void {
    if (!this.selectedCustomerId) return;
    this.dialog.open(PaymentDialogComponent,{width:'420px',data:{customerId:this.selectedCustomerId,customerName:this.selectedCustomerName,companyId:this.companyId}})
      .afterClosed().pipe(takeUntil(this.destroy$)).subscribe((r: any) => {
        if (r?.ok) { this.alert.success('Payment recorded','Payment'); this.loadOutstandingAmount(this.selectedCustomerId); }
        else if (r?.error) this.alert.error(r.error,'Payment');
      });
  }

  openMobileItemEntry(editIndex = -1): void {
    if (editIndex < 0) {
      const cid = this.invoiceform.get('customerId')?.value;
      const dt  = this.invoiceform.get('invoiceDate')?.value;
      const num = this.invoiceform.get('invoiceNumber')?.value;
      if (!cid||!String(cid).trim()) { this.alert.warning('Select a customer first','Validation'); return; }
      if (!dt) { this.alert.warning('Select an invoice date first','Validation'); return; }
      if (!num||!String(num).trim()) { this.alert.warning('Enter an invoice number first','Validation'); return; }
    }
    this.mobileEditIndex = editIndex;
    this.productSearchTerm = '';
    if (editIndex >= 0) {
      const row = this.invproducts.at(editIndex);
      this.mobileItemForm.patchValue({ productId: row.get('productId')?.value||'', quantity: row.get('quantity')?.value||1, rateWithTax: row.get('rateWithTax')?.value||0 });
    } else this.mobileItemForm.reset({ productId:'', quantity:1, rateWithTax:0 });
    this.recalcMobileAmount();
    this.openSheetRef = this.bottomSheet.open(this.mobileItemSheetTpl as any, { panelClass:'inv-mobile-sheet-panel', disableClose:false });
  }

  closeMobileItemEntry(): void { this.openSheetRef?.dismiss(); this.openSheetRef = null; }

  saveMobileItem(): void {
    if (this.mobileItemForm.invalid) { this.mobileItemForm.markAllAsTouched(); this.alert.warning('Fill all required fields','Validation'); return; }
    const val = this.mobileItemForm.getRawValue();
    const amt = Math.round((+val.quantity)*(+val.rateWithTax)*1000)/1000;
    if (this.mobileEditIndex >= 0) {
      const row = this.invproducts.at(this.mobileEditIndex) as FormGroup;
      row.patchValue({ productId:val.productId, quantity:val.quantity, rateWithTax:val.rateWithTax, amount:amt });
    } else {
      if (this.invproducts.controls.some(p => p.get('productId')?.value===val.productId)) { this.alert.warning('Product already in invoice!','Validation'); return; }
      const newRow = this.Generaterow();
      newRow.patchValue({ productId:val.productId, quantity:val.quantity, rateWithTax:val.rateWithTax, amount:amt });
      this.invproducts.push(newRow); this.rowProductSearch.push('');
    }
    this.summarycalculation(); this.closeMobileItemEntry();
  }

  onMobileProductSelected(): void {
    const pid = this.mobileItemForm.get('productId')?.value;
    if (!pid) return;
    this.service.GetProductbycode(pid).subscribe({ next: (res: any) => { if (res?.rateWithTax!=null) this.mobileItemForm.get('rateWithTax')?.setValue(res.rateWithTax); }, error: () => {} });
  }

  incrementMobileQty(): void { const c=+(this.mobileItemForm.get('quantity')?.value||0); this.mobileItemForm.get('quantity')?.setValue(+(c+1).toFixed(3)); }
  decrementMobileQty(): void { const c=+(this.mobileItemForm.get('quantity')?.value||1); this.mobileItemForm.get('quantity')?.setValue(+Math.max(0.001,c-1).toFixed(3)); }

  get mobileItemTotal(): number {
    return Math.round((+(this.mobileItemForm?.get('quantity')?.value||0))*(+(this.mobileItemForm?.get('rateWithTax')?.value||0))*100)/100;
  }

  getProductName(productId: string): string {
    return this.masterproduct.find((p: any) => p.uniqueKeyID===productId)?.productName||'';
  }

  onSummaryMouseDown(e: MouseEvent): void {
    if (window.innerWidth<=599) return;
    this._dragging=true; this._dragStartX=e.clientX; this._dragStartY=e.clientY;
    const el=(e.currentTarget as HTMLElement).closest('.inv-summary') as HTMLElement;
    if (el) { this._startLeft=el.offsetLeft; this._startBottom=window.innerHeight-el.offsetTop-el.offsetHeight; }
    e.preventDefault();
  }
  onDocumentMouseMove(e: MouseEvent): void {
    if (!this._dragging) return;
    this.summaryStyle={ bottom: Math.max(0,this._startBottom-(e.clientY-this._dragStartY))+'px', left: Math.max(0,this._startLeft+(e.clientX-this._dragStartX))+'px', right:'auto' };
  }
  onDocumentMouseUp(): void { this._dragging=false; }

  get totalAmountValue():         number { return this.totalAmountSubject.value; }
  get displayOutstandingAmount(): number { return this.outstandingAmount; }
  get displayTotalToPayAmount():  number { return this.outstandingAmount + this.totalAmountValue; }
}
