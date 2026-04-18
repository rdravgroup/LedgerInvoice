import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
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
import { catchError, takeUntil } from 'rxjs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner'; // ✅ Correct import
import { MatGridListModule } from '@angular/material/grid-list';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';

import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';


import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field'; 
import { MatButtonModule } from '@angular/material/button';
import { DecimalFormatterService } from '../../utils/decimal-formatter.service';
import {  ViewChild, ElementRef } from '@angular/core';

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
    MatProgressSpinnerModule,MatGridListModule,MatDatepickerModule, MatNativeDateModule,
    MatInputModule, MatSelectModule,FormsModule,MatTableModule,MatFormFieldModule,MatButtonModule
  ],
  templateUrl: './createinvoice.component.html',
  styleUrl: './createinvoice.component.css',
})
export class CreateinvoiceComponent implements OnInit, OnDestroy {




  invoiceFormShowHide = new FormGroup({
    showOptionalFields: new FormControl<boolean>(false), // Explicitly setting type
    dispatchedThrough: new FormControl(''),
    deliveryNote: new FormControl('')
  });

  get showOptionalFieldsControl(): FormControl {
    return this.invoiceFormShowHide.get('showOptionalFields') as FormControl;
  }



  invoiceYear: string = APP_CONSTANTS.INVOICE_YEAR;
  companyId: string = APP_CONSTANTS.DEFAULT_COMPANY_ID;
  createBy: string = '';
  updateBy: string = '';
  isEditing = false;
  isLoading = true;
  selectedInvoiceDate: Date | null = null;
  //updateDate: string = new Date().toISOString();
  invoiceform!: FormGroup; // Declare the form variable
  
  // Customer action properties
  selectedCustomerId: string = '';
  selectedCustomerName: string = '';
  showCustomerActions = false;
  private apiCustomerId: string = ''; // Store original customer ID from API response for edit mode
  private originalInvoiceAmount: number = 0; // Store original invoice amount for edit mode (to adjust outstanding)
  private fullOutstandingAmount: number = 0; // Full outstanding before adjustment
  private destroy$ = new Subject<void>();

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
    private dialog: MatDialog
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
  }

  initializeForm() {
    this.totalAmountSubject.next(0);
    this.invoiceform = this.builder.group({
      invoiceYear: this.builder.control(this.invoiceYear, Validators.required),
      invoiceNumber: this.builder.control(
        '',
        Validators.required
      ),
      invoiceDate: this.builder.control('',
        Validators.required
      ),
      companyId: this.builder.control(this.companyId, Validators.required),
      customerId: this.builder.control('', Validators.required),
      destination: this.builder.control(''),
      dispatchedThrough: this.builder.control(''),
      deliveryNote: this.builder.control(''),
      remark: this.builder.control(''),
      createBy: this.builder.control(''),
      updateBy: this.builder.control(''),
      totalAmount: this.builder.control(0),
      grandTotalAmount: this.builder.control(0),
      cgstRate: this.builder.control(0),
      sgstRate: this.builder.control(0),
      cgstAmount: this.builder.control(0),
      sgstAmount: this.builder.control(0),
      totalGstAmount: this.builder.control(0),
      createDate: this.builder.control({ value: new Date().toISOString(), disabled: true }),
      updateDate: this.builder.control({ value: new Date().toISOString(), disabled: true }),
      createIp: this.builder.control(''),
      updateIp: this.builder.control(''),
      sales_product_info: this.builder.array([]),
    });
  }

  SetEditInfo(invoiceno: any) {
    this.isLoading = true;

    this.service.GetInvHeaderbycode(invoiceno).subscribe({
      next: (res) => {
        let editdata = res as any;

        if (editdata) {
          // Convert date string to Date object
          const invoiceDate = editdata.invoiceDate ? new Date(editdata.invoiceDate) : null;
          
          // Store the original customer ID from API response
          this.apiCustomerId = editdata.customerId || '';
          
          // Store the original invoice amount (for outstanding calculation adjustment)
          this.originalInvoiceAmount = editdata.totalAmount || 0;
          
          this.invoiceform.patchValue({
            invoiceYear: editdata.invoiceYear || '',
            invoiceNumber: editdata.displayInvNumber || '',
            customerId: editdata.customerId || '',
            destination: editdata.destination || '',
            remark: editdata.remark || '',
            invoiceDate: invoiceDate,
            companyId: editdata.companyId || '',
            dispatchedThrough: editdata.dispatchedThrough || '',
            deliveryNote: editdata.deliveryNote || '',
            totalAmount: editdata.totalAmount || 0,
          });
          
          // Also set the ngModel binding
          this.selectedInvoiceDate = invoiceDate;
          
          this.editinvoiceno = editdata.invoiceNumber;
          
          // Disable customer dropdown in edit mode by disabling the form control
          this.invoiceform.get('customerId')?.disable();
          
          // Trigger customer change to show action buttons and load outstanding amount
          if (editdata.customerId) {
            this.customerchange(editdata.customerId);
          }
          
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        this.alert.error('Failed to load invoice header', 'Error');
        this.isLoading = false;
      },
    });

    this.service.GetInvDetailbycode(invoiceno).subscribe({
      next: (res) => {
        let productData = res as any;

        if (!Array.isArray(productData)) {
          productData = [];
        }

        this.editinvdetail = productData;
        this.invoicedetail = this.invoiceform.get('sales_product_info') as FormArray;
        this.invoicedetail.clear();

        this.editinvdetail.forEach((detail: any, index: number) => {
          let newRow = this.Generaterow();
          newRow.patchValue({
            productId: detail.productId,
            quantity: Number(detail.quantity || 0),
            rateWithTax: Number(detail.rateWithTax || 0),
            amount: Number(detail.amount || 0),
          });

          this.invoicedetail.push(newRow);
        });

        this.summarycalculation();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.alert.error('Failed to load invoice details', 'Error');
        this.isLoading = false;
      },
    });
  }

  SaveInvoice() {
    if (this.invoiceform.invalid) {
      this.alert.warning('Please enter values in all mandatory fields.', 'Validation');
      return;
    }
    
    this.invoicedetail = this.invoiceform.get('sales_product_info') as FormArray;
    if (this.invoicedetail.length === 0) {
        this.alert.warning('Please add at least one product before saving the invoice!', 'Validation');
        return;
    }

    const invalidRows = this.invoicedetail.controls.some(product => !product.get('productId')?.value);
    if (invalidRows) {
        this.alert.warning('Please select a product for each row before saving the invoice!', 'Validation');
        return;
    }

    const invalidQuantity = this.invoicedetail.controls.some(product => {
        const qty = product.get('quantity')?.value;
        return qty === null || qty === undefined || qty <= 0;
    });
    if (invalidQuantity) {
        this.alert.warning('Quantity must be greater than 0 for all products!', 'Validation');
        return;
    }

    const invalidRate = this.invoicedetail.controls.some(product => {
        const rate = product.get('rateWithTax')?.value;
        return rate === null || rate === undefined || rate <= 0;
    });
    if (invalidRate) {
        this.alert.warning('Rate must be greater than 0 for all products!', 'Validation');
        return;
    }

    const invalidAmount = this.invoicedetail.controls.some(product => {
        const amount = product.get('amount')?.value;
        return amount === null || amount === undefined || amount <= 0;
    });
    if (invalidAmount) {
        this.alert.warning('Total amount must be greater than 0 for all products!', 'Validation');
        return;
    }

    const username = this.authService.getUsername() || '';
    if (this.isedit) {
      this.invoiceform.patchValue({ updateBy: username });
      // In edit mode, restore the original customer ID from API response
      // This ensures we don't accidentally change the customer when saving
      this.invoiceform.patchValue({ customerId: this.apiCustomerId }, { emitEvent: false });
    } else {
      this.invoiceform.patchValue({ createBy: username });
    }

    const formData = this.invoiceform.getRawValue();
    
    // Get the current date value from the form control
    const currentDateValue = this.invoiceform.get('invoiceDate')?.value;
    
    
    // Override formData.invoiceDate with the direct control value to ensure we get the latest
    formData.invoiceDate = currentDateValue;
    
    const transformedPayload = this.transformPayloadForBackend(formData);

    this.service
      .SaveInvoice(transformedPayload)
      .subscribe({
        next: (res) => {
          let result: any = res;
          if (result.result === APP_CONSTANTS.RESPONSE_STATUS.PASS) {
            const invoiceNumber = result.kyValue || 'Saved';
            if (this.isedit) {
              this.alert.success('Updated Successfully.', 'Invoice: ' + invoiceNumber);
            } else {
              this.alert.success('Created Successfully.', 'Invoice: ' + invoiceNumber);
            }
            this.router.navigate(['/listinvoice']);
          } else {
            this.alert.error(result.message || 'Failed to save.', 'Invoice');
          }
        },
        error: (err) => {
          this.alert.error('Failed to save invoice', 'Error');
        }
      });
  }

  transformPayloadForBackend(formData: any): any {
    const currentDateTime = new Date().toISOString();
    const userIp = 'string';

    // Transform to match InvoiceItemCreateDTO exactly
    const products = formData.sales_product_info.map((product: any) => ({
      invoiceYear: formData.invoiceYear,
      productId: product.productId,
      quantity: product.quantity,
      rateWithoutTax: product.rateWithoutTax || 0,
      rateWithTax: product.rateWithTax,
      amount: product.amount,
      createBy: formData.createBy,
      updateBy: formData.updateBy,
      createDate: currentDateTime,
      updateDate: currentDateTime,
      createIp: userIp,
      updateIp: userIp
    }));

    // Convert invoiceDate to ISO string, preserving the local date
    let invoiceDate: string;
    if (formData.invoiceDate instanceof Date) {
      // Get local date components to avoid timezone issues
      const year = formData.invoiceDate.getFullYear();
      const month = String(formData.invoiceDate.getMonth() + 1).padStart(2, '0');
      const day = String(formData.invoiceDate.getDate()).padStart(2, '0');
      // Create ISO string with local date at midnight UTC
      invoiceDate = `${year}-${month}-${day}T00:00:00.000Z`;
    } else {
      invoiceDate = formData.invoiceDate;
    }

    // Build payload matching InvoiceCreateDTO exactly
    const payload: any = {
      invoiceYear: formData.invoiceYear,
      displayInvNumber: formData.invoiceNumber,
      invoiceDate: invoiceDate,
      companyId: formData.companyId,
      customerId: formData.customerId,
      destination: formData.destination || '',
      dispatchedThrough: formData.dispatchedThrough || 'Not Applicable',
      deliveryNote: formData.deliveryNote || 'Not Applicable',
      remark: formData.remark || '',
      totalAmount: formData.totalAmount,
      grandTotalAmount: formData.grandTotalAmount || formData.totalAmount,
      cgstRate: formData.cgstRate || 0,
      sgstRate: formData.sgstRate || 0,
      cgstAmount: formData.cgstAmount || 0,
      sgstAmount: formData.sgstAmount || 0,
      totalGstAmount: formData.totalGstAmount || 0,
      createBy: formData.createBy,
      updateBy: formData.updateBy,
      createDate: currentDateTime,
      updateDate: currentDateTime,
      createIp: userIp,
      updateIp: userIp,
      products: products
    };

    if (this.isedit && this.editinvoiceno) {
      payload.invoiceNumber = this.editinvoiceno;
      console.log('Edit mode - sending invoiceNumber:', this.editinvoiceno);
      console.log('Edit mode - displayInvNumber:', payload.displayInvNumber);
      console.log('Edit mode - invoiceDate:', payload.invoiceDate);
    } else {
      console.log('Create mode - no invoiceNumber sent');
    }

    console.log('Final payload:', JSON.stringify(payload, null, 2));
    return payload;
  }

  addnewproduct() {
    this.invoicedetail = this.invoiceform.get(
      'sales_product_info'
    ) as FormArray;
    
    // Validate required fields before adding product
    const customerId = this.invoiceform.get('customerId')?.value;
    const invoiceDate = this.invoiceform.get('invoiceDate')?.value;
    const invoiceNumber = this.invoiceform.get('invoiceNumber')?.value;
    
    if (!customerId || customerId.trim() === '') {
      this.alert.warning('Please select a customer first', 'Validation');
      return;
    }
    
    if (!invoiceDate) {
      this.alert.warning('Please select an invoice date first', 'Validation');
      return;
    }
    
    if (!invoiceNumber || invoiceNumber.trim() === '') {
      this.alert.warning('Please enter an invoice number first', 'Validation');
      return;
    }
    
    // All validations passed, add new product row
    this.invoicedetail.push(this.Generaterow());
  }
  get invproducts() {
    return this.invoiceform.get('sales_product_info') as FormArray;
  }
  Generaterow() {
    return this.builder.group({
      invoiceNumber: this.builder.control(''),
      productId: this.builder.control('', Validators.required),
      quantity: this.builder.control(0),
      rateWithTax: this.builder.control(0),
      amount: this.builder.control(0),
    });

  }
  GetCustomers() {
    this.service.GetCustomer().subscribe({
      next: (res: any) => {
        if (Array.isArray(res)) {
          this.mastercustomer = res;
        } else {
          this.mastercustomer = [];
        }
      },
      error: (err) => {
        this.alert.error('Failed to load customers', 'Error');
        this.mastercustomer = [];
      }
    });
  }
  
  GetProducts() {
    this.service.GetProducts().subscribe({
      next: (res: any) => {
        if (Array.isArray(res)) {
          this.masterproduct = res;
        } else {
          this.masterproduct = [];
        }
      },
      error: (err) => {
        this.alert.error('Failed to load products', 'Error');
        this.masterproduct = [];
      }
    });
  }
  customerchange(selectedCustomer: string) {
    let customercode = this.invoiceform.get('customerId')?.value;
    
    // Set selected customer info for action buttons
    this.selectedCustomerId = customercode;
    const customer = this.mastercustomer.find(c => c.uniqueKeyID === customercode);
    this.selectedCustomerName = customer?.name || '';
    this.showCustomerActions = !!customercode;
    
    // Fetch customer address and destination
    this.service.GetCustomerbycode(customercode).subscribe({
      next: (res) => {
        let custdata = res as any;
        if (custdata != null) {
          this.invoiceform.get('destination')?.setValue(
            `${custdata.addressDetails || ''},${custdata.phone || ''},${custdata.email || ''},${custdata.name || ''}`
          );
        }
      },
      error: (err) => {
        this.alert.error('Failed to load customer details', 'Error');
      }
    });

    // Fetch outstanding amount for the selected customer
    this.loadOutstandingAmount(customercode);
  }

  /**
   * Load outstanding/balance amount for selected customer
   * In edit mode, adjusts the outstanding to exclude the current invoice being edited
   */
  loadOutstandingAmount(customerId: string): void {
    if (!customerId) {
      this.fullOutstandingAmount = 0;
      this.outstandingAmount = 0;
      return;
    }

    this.isLoadingOutstanding = true;
    this.ledgerService.getCustomerLedger(customerId).subscribe({
      next: (response: any) => {
        // Handle both wrapped and direct response formats
        let customerData = response.data || response;
        
        if (customerData) {
          // Try different property names for outstanding amount
          const outstanding = 
            customerData.outstanding || 
            customerData.balance || 
            customerData.outstandingBalance?.totalOutstanding || 
            customerData.totalOutstanding || 
            0;
          
          if (typeof outstanding === 'number' && outstanding >= 0) {
            // Store full outstanding amount
            this.fullOutstandingAmount = outstanding;
            
            // In edit mode, adjust outstanding by subtracting the current invoice amount
            // This prevents double-counting since the current invoice is already in the outstanding
            if (this.isedit && this.originalInvoiceAmount > 0) {
              console.log('OUTSTANDING_CALC: Edit mode - Adjusting outstanding');
              console.log('OUTSTANDING_CALC: Full Outstanding:', this.fullOutstandingAmount);
              console.log('OUTSTANDING_CALC: Original Invoice Amount:', this.originalInvoiceAmount);
              
              // Calculate adjusted outstanding (previous outstanding before current invoice)
              const adjustedOutstanding = Math.max(0, outstanding - this.originalInvoiceAmount);
              this.outstandingAmount = adjustedOutstanding;
              
              console.log('OUTSTANDING_CALC: Adjusted Outstanding:', this.outstandingAmount);
              console.log('OUTSTANDING_CALC: Calculation: ' + outstanding + ' - ' + this.originalInvoiceAmount + ' = ' + this.outstandingAmount);
            } else {
              // In create mode, use full outstanding
              this.outstandingAmount = outstanding;
            }
          } else {
            this.fullOutstandingAmount = 0;
            this.outstandingAmount = 0;
          }
          this.cdr.detectChanges();
        } else {
          this.fullOutstandingAmount = 0;
          this.outstandingAmount = 0;
        }
        this.isLoadingOutstanding = false;
      },
      error: (err) => {
        this.alert.warning(`Could not load outstanding amount for customer: ${err.message}`, 'Warning');
        this.fullOutstandingAmount = 0;
        this.outstandingAmount = 0;
        this.isLoadingOutstanding = false;
      }
    });
  }
  productchange(index: any) {
    this.invoicedetail = this.invoiceform.get('sales_product_info') as FormArray;
    this.invoiceproduct = this.invoicedetail.at(index) as FormGroup;
    let productcode = this.invoiceproduct.get('productId')?.value;

    const productExists = this.invoicedetail.controls.some(
        (product, i) => product.get('productId')?.value === productcode && i !== index
    );

    if (productExists) {
        this.alert.warning('This product has already been added to the invoice!', 'Validation');
        this.invoiceproduct.get('productId')?.setValue('');
        return;
    }

    this.service.GetProductbycode(productcode).subscribe({
      next: (res) => {
        let proddata = res as any;
        if (proddata != null) {
          let rate = proddata.rateWithTax || 0;
          this.invoiceproduct.get('rateWithTax')?.setValue(rate);
          this.Itemcalculation(index);
        }
      },
      error: (err) => {
        this.alert.error('Failed to fetch product details.', 'Error');
      }
    });
  }
  Itemcalculation(index: any) {
    this.invoicedetail = this.invoiceform.get('sales_product_info') as FormArray;
    this.invoiceproduct = this.invoicedetail.at(index) as FormGroup;
    let rowwise_quantity = this.invoiceproduct.get('quantity')?.value;
    let Rate_With_Tax = this.invoiceproduct.get('rateWithTax')?.value;
    let rowwise_total = rowwise_quantity * Rate_With_Tax;
    this.invoiceproduct.get('amount')?.setValue(this.setValueWithThreeDecimal(rowwise_total));
    this.summarycalculation();
  }
  Removeproduct(index: any) {
    if (confirm('Do you want to remove?')) {
      this.invproducts.removeAt(index);
      this.summarycalculation();
    }
  }
  summarycalculation() {
    let array = this.invoiceform.getRawValue().sales_product_info;
    if (array.length > 0) {
      let sumtotal = 0;
      array.forEach((x: any) => {
        sumtotal = sumtotal + Number(x.amount);
      });
      let roundedTotal = this.setValueWithTwoDecimal(sumtotal);
      this.invoiceform.get('totalAmount')?.setValue(roundedTotal);
      this.totalAmountSubject.next(roundedTotal);
      this.cdr.detectChanges();
    } else {
      this.totalAmountSubject.next(0);
      this.invoiceform.get('totalAmount')?.setValue(0);
    }
  }

  setValueWithTwoDecimal(value: number): number {
    return Math.round(value * 100) / 100; // Rounds to 2 decimal places
  }

  setValueWithThreeDecimal(value: number): number {
    return Math.round(value * 1000) / 1000; // Rounds to 3 decimal places
  }

  /**
   * View customer details
   */
  viewCustomer(customerId: string): void {
    if (!customerId) return;
    this.ledgerService.getCustomerLedger(customerId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          const customer = response.data || response;
          
          if (customer && customer.customerId) {
            this.dialog.open(CustomerDetailsDialogComponent, {
              width: '1000px',
              data: { customer }
            });
          } else {
            this.alert.error('Failed to load customer details', 'Error');
          }
        },
        error: (err) => {
          this.alert.error('Error loading customer details: ' + err.message, 'Error');
        }
      });
  }

  /**
   * View payments for a customer - opens modal with payment history
   */
  viewPayments(customerId: string, customerName: string): void {
    if (!customerId) return;

    const dialogRef = this.dialog.open(PaymentDetailsDialogComponent, {
      width: '900px',
      data: { customerId, customerName: customerName || 'Customer' }
    });

    dialogRef.afterClosed().pipe(takeUntil(this.destroy$)).subscribe((result: any) => {
      // If payment was deleted, refresh outstanding amounts
      if (result?.ok && result?.paymentDeleted && result?.customerId) {
        this.loadOutstandingAmount(result.customerId);
      }
    });
  }

  /**
   * Send reminder
   */
  sendReminder(customerId: string, customerName: string): void {
    if (!customerId) return;
    this.alert.info(`Sending reminder to ${customerName}...`, 'Reminder');
    // TODO: Implement send reminder functionality
  }

  /**
   * Prompt user for payment amount and optional invoice, then record the payment
   */
  openPaymentPrompt(): void {
    if (!this.selectedCustomerId) return;

    const dialogRef = this.dialog.open(PaymentDialogComponent, {
      width: '420px',
      data: { 
        customerId: this.selectedCustomerId, 
        customerName: this.selectedCustomerName, 
        companyId: this.companyId 
      }
    });

    dialogRef.afterClosed().pipe(takeUntil(this.destroy$)).subscribe((result: any) => {
      if (result?.ok) {
        this.alert.success('Payment recorded successfully', 'Payment');
        // Refresh outstanding amount after payment
        this.loadOutstandingAmount(this.selectedCustomerId);
      } else if (result?.error) {
        this.alert.error(result.error || 'Failed to record payment', 'Payment');
      }
    });
  }

  get totalAmountValue(): number {
    return this.totalAmountSubject.value;
  }

  /**
   * Get display outstanding amount
   * In edit mode, this shows the adjusted outstanding (excluding current invoice)
   * In create mode, this shows the full outstanding
   */
  get displayOutstandingAmount(): number {
    return this.outstandingAmount;
  }

  /**
   * Get display total to pay amount
   * Calculation: Previous Outstanding (adjusted in edit mode) + Current Invoice Amount
   * In create mode: Full Outstanding + New Invoice Amount
   * In edit mode: (Full Outstanding - Original Invoice) + Updated Invoice Amount
   */
  get displayTotalToPayAmount(): number {
    return this.outstandingAmount + this.totalAmountValue;
  }

}
