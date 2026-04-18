import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { of, throwError } from 'rxjs';

import { QuickInvoiceComponent } from './quick-invoice.component';
import { QuickInvoiceService } from '../../_service/quick-invoice.service';
import { ProductService } from '../../_service/product.service';
import { CustomerService } from '../../_service/customer.service';
import { MaterialModule } from '../../material.module';

describe('QuickInvoiceComponent', () => {
  let component: QuickInvoiceComponent;
  let fixture: ComponentFixture<QuickInvoiceComponent>;
  let quickInvoiceService: jasmine.SpyObj<QuickInvoiceService>;
  let productService: jasmine.SpyObj<ProductService>;
  let customerService: jasmine.SpyObj<CustomerService>;
  let toastrService: jasmine.SpyObj<ToastrService>;
  let matDialog: jasmine.SpyObj<MatDialog>;

  const mockCustomer = {
    uniqueKeyID: '1',
    name: 'John Doe',
    email: 'john@example.com',
    phone: '9876543210'
  };

  const mockProduct = {
    uniqueKeyID: 'prod1',
    productName: 'Test Product',
    rateWithTax: 100,
    rateWithoutTax: 85
  };

  const mockInvoice = {
    quickInvoiceId: 'inv1',
    customerId: '1',
    customerName: 'John Doe',
    grandTotal: 500,
    items: [
      {
        productId: 'prod1',
        productName: 'Test Product',
        quantity: 5,
        rate: 100,
        total: 500
      }
    ]
  };

  beforeEach(async () => {
    const quickInvoiceServiceSpy = jasmine.createSpyObj('QuickInvoiceService', [
      'getAllInvoices',
      'getInvoiceById',
      'createInvoice',
      'updateInvoice',
      'deleteInvoice'
    ]);
    const productServiceSpy = jasmine.createSpyObj('ProductService', ['getAllProducts']);
    const customerServiceSpy = jasmine.createSpyObj('CustomerService', ['Getall']);
    const toastrServiceSpy = jasmine.createSpyObj('ToastrService', ['success', 'error', 'warning', 'info']);
    const matDialogSpy = jasmine.createSpyObj('MatDialog', ['open']);

    await TestBed.configureTestingModule({
      declarations: [],
      imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        MaterialModule,
        QuickInvoiceComponent
      ],
      providers: [
        { provide: QuickInvoiceService, useValue: quickInvoiceServiceSpy },
        { provide: ProductService, useValue: productServiceSpy },
        { provide: CustomerService, useValue: customerServiceSpy },
        { provide: ToastrService, useValue: toastrServiceSpy },
        { provide: MatDialog, useValue: matDialogSpy }
      ]
    }).compileComponents();

    quickInvoiceService = TestBed.inject(QuickInvoiceService) as jasmine.SpyObj<QuickInvoiceService>;
    productService = TestBed.inject(ProductService) as jasmine.SpyObj<ProductService>;
    customerService = TestBed.inject(CustomerService) as jasmine.SpyObj<CustomerService>;
    toastrService = TestBed.inject(ToastrService) as jasmine.SpyObj<ToastrService>;
    matDialog = TestBed.inject(MatDialog) as jasmine.SpyObj<MatDialog>;

    // Setup default return values
    customerService.Getall.and.returnValue(of([mockCustomer] as any));
    productService.getAllProducts.and.returnValue(of([mockProduct] as any));
    quickInvoiceService.getAllInvoices.and.returnValue(of([mockInvoice] as any));
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(QuickInvoiceComponent);
    component = fixture.componentInstance;
  });

  describe('Initialization', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should load customers on init', () => {
      fixture.detectChanges();
      expect(customerService.Getall).toHaveBeenCalled();
      expect(component.customers.length).toBe(1);
      expect(component.customers[0].name).toBe('John Doe');
    });

    it('should load products on init', () => {
      fixture.detectChanges();
      expect(productService.getAllProducts).toHaveBeenCalled();
      expect(component.products.length).toBe(1);
      expect(component.products[0].productName).toBe('Test Product');
    });

    it('should load invoices on init', () => {
      fixture.detectChanges();
      expect(quickInvoiceService.getAllInvoices).toHaveBeenCalled();
      expect(component.invoices.length).toBe(1);
    });

    it('should initialize with isSavingInvoice false', () => {
      expect(component.isSavingInvoice).toBe(false);
    });

    it('should initialize with isDeletingInvoice false', () => {
      expect(component.isDeletingInvoice).toBe(false);
    });
  });

  describe('Customer Management', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should select customer and set customerId', () => {
      component.selectCustomer(mockCustomer as any);
      expect(component.customerName).toBe('John Doe');
      expect(component.customerId).toBe('1');
    });

    it('should filter customers on search', (done) => {
      const searchTerm = 'John';
      component.onCustomerSearch({ target: { value: searchTerm } });

      setTimeout(() => {
        expect(component.filteredCustomers.length).toBeGreaterThan(0);
        expect(component.filteredCustomers[0].name).toContain('John');
        done();
      }, 350);
    });

    it('should show all customers when search is empty', (done) => {
      component.onCustomerSearch({ target: { value: '' } });

      setTimeout(() => {
        expect(component.filteredCustomers.length).toBe(component.customers.length);
        done();
      }, 350);
    });
  });

  describe('Product Management', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should select product and update item', () => {
      const item = { product: '', productId: '', quantity: 1, rate: 0, total: 0, productName: '' };
      component.selectProduct(mockProduct as any, item as any);

      expect(item.product).toBe('Test Product');
      expect(item.productId).toBe('prod1');
      expect(item.rate).toBe(100);
    });

    it('should filter products on search', () => {
      const item = { 
        product: '', 
        productId: '', 
        quantity: undefined, 
        rate: undefined, 
        total: 0, 
        productName: '',
        filteredProducts: [...component.products]
      };
      component.onProductSearch({ target: { value: 'Test' } }, item);

      expect(item.filteredProducts).toBeDefined();
      expect(item.filteredProducts?.length).toBeGreaterThan(0);
      expect(item.filteredProducts?.[0]?.productName?.toLowerCase?.()).toContain('test');
    });

    it('should add product to items list', () => {
      const initialLength = component.items.length;
      component.addProduct();

      expect(component.items.length).toBe(initialLength + 1);
      expect(component.items[component.items.length - 1].product).toBe('');
      expect(component.items[component.items.length - 1].quantity).toBeUndefined();
      expect(component.items[component.items.length - 1].filteredProducts).toBeDefined();
      expect(component.items[component.items.length - 1].filteredProducts?.length).toBeGreaterThan(0);
    });

    it('should prevent duplicate product selection from dropdown', () => {
      fixture.detectChanges();
      const item1 = { product: '', productId: '', quantity: 1, rate: 0, total: 0, productName: '', filteredProducts: [] };
      const item2 = { product: '', productId: '', quantity: 1, rate: 0, total: 0, productName: '', filteredProducts: [] };
      
      component.items = [item1, item2];
      
      // Select product for first item
      component.selectProduct(mockProduct as any, item1);
      expect(item1.productId).toBe('prod1');
      
      // Try to select same product for second item - should be prevented
      component.selectProduct(mockProduct as any, item2);
      expect(item2.productId).toBeUndefined();
      expect(toastrService.warning).toHaveBeenCalledWith('This product is already added to the invoice');
    });

    it('should prevent duplicate product entry via manual input', () => {
      fixture.detectChanges();
      const item1 = { product: 'Test Product', productId: 'prod1', quantity: 1, rate: 100, total: 100, productName: 'Test Product', filteredProducts: [...component.products] };
      const item2 = { product: '', productId: '', quantity: 1, rate: 0, total: 0, productName: '', filteredProducts: [...component.products] };
      
      component.items = [item1, item2];
      
      // Try to enter same product name in second item
      component.onProductSearch({ target: { value: 'Test Product' } }, item2);
      
      expect(item2.product).toBe('');
      expect(item2.productId).toBeUndefined();
      expect(toastrService.warning).toHaveBeenCalledWith('This product is already added to the invoice');
    });

    it('should detect duplicate products in invoice', () => {
      component.items = [
        { product: 'Item1', productId: '1', quantity: 2, rate: 100, total: 200, productName: 'Item1' },
        { product: 'Item1', productId: '1', quantity: 3, rate: 150, total: 450, productName: 'Item1' }
      ];

      expect(component.hasNoDuplicateProducts()).toBe(false);
    });

    it('should return true when no duplicate products exist', () => {
      component.items = [
        { product: 'Item1', productId: '1', quantity: 2, rate: 100, total: 200, productName: 'Item1' },
        { product: 'Item2', productId: '2', quantity: 3, rate: 150, total: 450, productName: 'Item2' }
      ];

      expect(component.hasNoDuplicateProducts()).toBe(true);
    });
  });

  describe('Calculations', () => {
    it('should calculate line item total correctly', () => {
      const item = { product: 'Test', productId: '1', quantity: 5, rate: 100, total: 0, productName: 'Test' };
      component.calculateTotal(item);

      expect(item.total).toBe(500);
    });

    it('should calculate grand total correctly', () => {
      component.items = [
        { product: 'Item1', productId: '1', quantity: 2, rate: 100, total: 200, productName: 'Item1' },
        { product: 'Item2', productId: '2', quantity: 3, rate: 150, total: 450, productName: 'Item2' }
      ];

      const grandTotal = component.getGrandTotal();
      expect(grandTotal).toBe(650);
    });

    it('should handle decimal rounding correctly', () => {
      const item = { product: 'Test', productId: '1', quantity: 3, rate: 33.33, total: 0, productName: 'Test' };
      component.calculateTotal(item);

      expect(item.total).toBe(99.99);
    });

    it('should return 0 total when quantity or rate is 0', () => {
      const item = { product: 'Test', productId: '1', quantity: 0, rate: 100, total: 0, productName: 'Test' };
      component.calculateTotal(item);

      expect(item.total).toBe(0);
    });
  });

  describe('Validation', () => {
    it('should validate invoice is ready for print', () => {
      component.items = [
        { product: 'Item1', productId: '1', quantity: 2, rate: 100, total: 200, productName: 'Item1' }
      ];

      expect(component.isValidForPrint()).toBe(true);
    });

    it('should return false when items list is empty', () => {
      component.items = [];
      expect(component.isValidForPrint()).toBe(false);
    });

    it('should return false when product name is empty', () => {
      component.items = [
        { product: '', productId: '1', quantity: 2, rate: 100, total: 200, productName: '' }
      ];

      expect(component.isValidForPrint()).toBe(false);
    });

    it('should return false when quantity is 0', () => {
      component.items = [
        { product: 'Item1', productId: '1', quantity: 0, rate: 100, total: 0, productName: 'Item1' }
      ];

      expect(component.isValidForPrint()).toBe(false);
    });

    it('should return false when rate is 0', () => {
      component.items = [
        { product: 'Item1', productId: '1', quantity: 2, rate: 0, total: 0, productName: 'Item1' }
      ];

      expect(component.isValidForPrint()).toBe(false);
    });
  });

  describe('Invoice Operations', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should save new invoice', () => {
      component.customerName = 'John Doe';
      component.customerId = '1';
      component.items = [
        { product: 'Item1', productId: '1', quantity: 2, rate: 100, total: 200, productName: 'Item1' }
      ];

      quickInvoiceService.createInvoice.and.returnValue(of({
        success: true,
        message: 'Invoice saved',
        data: mockInvoice
      } as any));

      component.saveInvoice();

      expect(quickInvoiceService.createInvoice).toHaveBeenCalled();
      expect(toastrService.success).toHaveBeenCalled();
    });

    it('should update existing invoice', () => {
      component.customerName = 'John Doe';
      component.customerId = '1';
      component.selectedInvoiceId = 'inv1';
      component.items = [
        { product: 'Item1', productId: '1', quantity: 2, rate: 100, total: 200, productName: 'Item1' }
      ];

      quickInvoiceService.updateInvoice.and.returnValue(of({
        success: true,
        message: 'Invoice updated'
      }));

      component.saveInvoice();

      expect(quickInvoiceService.updateInvoice).toHaveBeenCalled();
    });

    it('should fail to save without customer', () => {
      component.customerName = '';
      component.items = [
        { product: 'Item1', productId: '1', quantity: 2, rate: 100, total: 200, productName: 'Item1' }
      ];

      component.saveInvoice();

      expect(toastrService.warning).toHaveBeenCalledWith('Please enter or select a customer');
      expect(quickInvoiceService.createInvoice).not.toHaveBeenCalled();
    });

    it('should fail to save with duplicate products', () => {
      component.customerName = 'John Doe';
      component.customerId = '1';
      component.items = [
        { product: 'Item1', productId: '1', quantity: 2, rate: 100, total: 200, productName: 'Item1' },
        { product: 'Item1', productId: '1', quantity: 3, rate: 100, total: 300, productName: 'Item1' }
      ];

      component.saveInvoice();

      expect(toastrService.warning).toHaveBeenCalledWith('Cannot save invoice with duplicate products. Please remove duplicates.');
      expect(quickInvoiceService.createInvoice).not.toHaveBeenCalled();
    });

    it('should load invoice by id', () => {
      quickInvoiceService.getInvoiceById.and.returnValue(of(mockInvoice as any));

      component.loadInvoice('inv1');

      expect(quickInvoiceService.getInvoiceById).toHaveBeenCalledWith('inv1');
      expect(component.selectedInvoiceId).toBe('inv1');
      expect(component.customerName).toBe('John Doe');
    });

    it('should create new invoice with confirmation', () => {
      component.items = [
        { product: 'Item1', productId: '1', quantity: 2, rate: 100, total: 200, productName: 'Item1' }
      ];
      spyOn(window, 'confirm').and.returnValue(true);

      component.newInvoice();

      expect(window.confirm).toHaveBeenCalled();
      expect(component.items.length).toBe(0);
      expect(component.customerName).toBe('');
    });

    it('should cancel new invoice if confirmation is rejected', () => {
      const originalItems = [
        { product: 'Item1', productId: '1', quantity: 2, rate: 100, total: 200, productName: 'Item1' }
      ];
      component.items = [...originalItems];
      spyOn(window, 'confirm').and.returnValue(false);

      component.newInvoice();

      expect(component.items.length).toBe(1);
    });

    it('should delete invoice with confirmation and set loading state', () => {
      spyOn(window, 'confirm').and.returnValue(true);
      quickInvoiceService.deleteInvoice.and.returnValue(of({
        success: true,
        message: 'Invoice deleted'
      }));

      component.deleteInvoiceRecord('inv1');

      expect(component.isDeletingInvoice).toBe(true);
      expect(quickInvoiceService.deleteInvoice).toHaveBeenCalledWith('inv1');
    });

    it('should handle error when deleting invoice', (done) => {
      spyOn(window, 'confirm').and.returnValue(true);
      quickInvoiceService.deleteInvoice.and.returnValue(
        throwError(() => new Error('Delete failed'))
      );

      component.deleteInvoiceRecord('inv1');

      setTimeout(() => {
        expect(toastrService.error).toHaveBeenCalled();
        expect(component.isDeletingInvoice).toBe(false);
        done();
      }, 100);
    });
  });

  describe('Item Management', () => {
    it('should delete item from list', () => {
      component.items = [
        { product: 'Item1', productId: '1', quantity: 2, rate: 100, total: 200, productName: 'Item1' },
        { product: 'Item2', productId: '2', quantity: 3, rate: 150, total: 450, productName: 'Item2' }
      ];

      component.deleteItem(0);

      expect(component.items.length).toBe(1);
      expect(component.items[0].product).toBe('Item2');
    });

    it('should handle string trimming for product name in validation', () => {
      component.items = [
        { product: '   ', productId: '1', quantity: 2, rate: 100, total: 200, productName: '' }
      ];

      expect(component.isValidForPrint()).toBe(false);
    });
  });

  describe('Invoice List Dialog', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should open invoice list dialog', () => {
      matDialog.open.and.returnValue({
        afterClosed: () => of(null)
      } as any);

      component.toggleInvoiceList();

      expect(matDialog.open).toHaveBeenCalled();
    });

    it('should pass performInvoiceAction to dialog', () => {
      matDialog.open.and.returnValue({
        afterClosed: () => of(null)
      } as any);

      component.toggleInvoiceList();

      const callArgs = matDialog.open.calls.mostRecent().args;
      expect((callArgs?.[1] as any)?.data?.performInvoiceAction).toBeDefined();
      expect(typeof (callArgs?.[1] as any)?.data?.performInvoiceAction).toBe('function');
    });
  });

  describe('PDF Generation', () => {
    beforeEach(() => {
      component.customerName = 'John Doe';
      component.items = [
        { product: 'Item1', productId: '1', quantity: 2, rate: 100, total: 200, productName: 'Item1' }
      ];
    });

    it('should generate PDF document', () => {
      const pdf = component['generateInvoicePDF']();
      expect(pdf).toBeDefined();
    });

    it('should not download PDF if invoice is invalid', () => {
      component.items = [];
      spyOn(component, 'isValidForPrint').and.returnValue(false);

      component.downloadPDF();

      expect(toastrService.warning).toHaveBeenCalledWith('Invoice is not valid for download');
    });
  });

  describe('Print Functionality', () => {
    it('should not print if invoice is invalid', () => {
      component.items = [];
      spyOn(component, 'isValidForPrint').and.returnValue(false);

      component.printInvoice();

      expect(toastrService.warning).toHaveBeenCalledWith('Invoice is not valid for printing');
    });

    it('should error if print section not found', () => {
      component.customerName = 'John Doe';
      component.items = [
        { product: 'Item1', productId: '1', quantity: 2, rate: 100, total: 200, productName: 'Item1' }
      ];
      spyOn(component, 'isValidForPrint').and.returnValue(true);
      spyOn(document, 'getElementById').and.returnValue(null);

      component.printInvoice();

      expect(toastrService.error).toHaveBeenCalledWith('Print section not found');
    });
  });

  describe('Cleanup', () => {
    it('should unsubscribe on destroy', () => {
      spyOn(component['destroy$'], 'next');
      spyOn(component['destroy$'], 'complete');

      component.ngOnDestroy();

      expect(component['destroy$'].next).toHaveBeenCalled();
      expect(component['destroy$'].complete).toHaveBeenCalled();
    });
  });

  describe('Constraints and Constants', () => {
    it('should have MAX_QUANTITY constant', () => {
      expect(component.MAX_QUANTITY).toBe(9999);
    });

    it('should have MAX_RATE constant', () => {
      expect(component.MAX_RATE).toBe(999999.99);
    });
  });
});
