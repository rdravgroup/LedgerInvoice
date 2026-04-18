import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

/**
 * Test Data Generator Service
 * This service creates sample invoices for testing purposes
 * 
 * Usage:
 * 1. Inject this service in a component
 * 2. Call createSampleInvoices() method
 * 3. Check console for results
 */
@Injectable({
  providedIn: 'root'
})
export class TestDataGeneratorService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Creates three sample invoices with different products and quantities
   */
  async createSampleInvoices() {
    console.log('🚀 Starting sample invoice creation...');
    
    try {
      // First, get available customers and products
      const customers: any = await this.http.get(this.baseUrl + 'Customer/GetAll').toPromise();
      const products: any = await this.http.get(this.baseUrl + 'Product/GetAll').toPromise();

      if (!customers || customers.length === 0) {
        console.error('❌ No customers found. Please create customers first.');
        return;
      }

      if (!products || products.length === 0) {
        console.error('❌ No products found. Please create products first.');
        return;
      }

      console.log(`✅ Found ${customers.length} customers and ${products.length} products`);

      // Create three sample invoices
      const invoice1 = await this.createInvoice1(customers[0], products);
      const invoice2 = await this.createInvoice2(customers[0], products);
      const invoice3 = await this.createInvoice3(customers[0], products);

      console.log('✅ All sample invoices created successfully!');
      console.log('Invoice 1:', invoice1);
      console.log('Invoice 2:', invoice2);
      console.log('Invoice 3:', invoice3);

      return { invoice1, invoice2, invoice3 };
    } catch (error) {
      console.error('❌ Error creating sample invoices:', error);
      throw error;
    }
  }

  /**
   * Invoice 1: Single product with quantity 5
   */
  private async createInvoice1(customer: any, products: any[]) {
    const currentDate = new Date().toISOString();
    const invoiceYear = new Date().getFullYear().toString();

    const invoice = {
      invoiceYear: invoiceYear,
      displayInvNumber: `TEST/${invoiceYear}/001`,
      invoiceDate: currentDate,
      companyId: 'COMP01',
      customerId: customer.uniqueKeyID,
      destination: `${customer.addressDetails || ''}, ${customer.phone || ''}, ${customer.email || ''}, ${customer.name || ''}`,
      dispatchedThrough: 'Test Courier Service',
      deliveryNote: 'Handle with care',
      remark: 'Test Invoice 1 - Single Product',
      totalAmount: 0,
      grandTotalAmount: 0,
      cgstRate: 0,
      sgstRate: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      totalGstAmount: 0,
      createBy: 'TestUser',
      updateBy: 'TestUser',
      createDate: currentDate,
      updateDate: currentDate,
      createIp: 'test',
      updateIp: 'test',
      products: [
        {
          invoiceYear: invoiceYear,
          productId: products[0].uniqueKeyID,
          quantity: 5,
          rateWithoutTax: 0,
          rateWithTax: products[0].rateWithTax || 100,
          amount: 5 * (products[0].rateWithTax || 100),
          createBy: 'TestUser',
          updateBy: 'TestUser',
          createDate: currentDate,
          updateDate: currentDate,
          createIp: 'test',
          updateIp: 'test'
        }
      ]
    };

    invoice.totalAmount = invoice.products[0].amount;
    invoice.grandTotalAmount = invoice.totalAmount;

    console.log('📝 Creating Invoice 1:', invoice.displayInvNumber);
    const result = await this.http.post(this.baseUrl + 'Invoice/Save', invoice).toPromise();
    console.log('✅ Invoice 1 created:', result);
    return result;
  }

  /**
   * Invoice 2: Two products with different quantities
   */
  private async createInvoice2(customer: any, products: any[]) {
    const currentDate = new Date().toISOString();
    const invoiceYear = new Date().getFullYear().toString();

    const product1 = products[0];
    const product2 = products.length > 1 ? products[1] : products[0];

    const item1Amount = 10 * (product1.rateWithTax || 100);
    const item2Amount = 3 * (product2.rateWithTax || 150);
    const totalAmount = item1Amount + item2Amount;

    const invoice = {
      invoiceYear: invoiceYear,
      displayInvNumber: `TEST/${invoiceYear}/002`,
      invoiceDate: currentDate,
      companyId: 'COMP01',
      customerId: customer.uniqueKeyID,
      destination: `${customer.addressDetails || ''}, ${customer.phone || ''}, ${customer.email || ''}, ${customer.name || ''}`,
      dispatchedThrough: 'Express Delivery',
      deliveryNote: 'Urgent delivery required',
      remark: 'Test Invoice 2 - Multiple Products',
      totalAmount: totalAmount,
      grandTotalAmount: totalAmount,
      cgstRate: 0,
      sgstRate: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      totalGstAmount: 0,
      createBy: 'TestUser',
      updateBy: 'TestUser',
      createDate: currentDate,
      updateDate: currentDate,
      createIp: 'test',
      updateIp: 'test',
      products: [
        {
          invoiceYear: invoiceYear,
          productId: product1.uniqueKeyID,
          quantity: 10,
          rateWithoutTax: 0,
          rateWithTax: product1.rateWithTax || 100,
          amount: item1Amount,
          createBy: 'TestUser',
          updateBy: 'TestUser',
          createDate: currentDate,
          updateDate: currentDate,
          createIp: 'test',
          updateIp: 'test'
        },
        {
          invoiceYear: invoiceYear,
          productId: product2.uniqueKeyID,
          quantity: 3,
          rateWithoutTax: 0,
          rateWithTax: product2.rateWithTax || 150,
          amount: item2Amount,
          createBy: 'TestUser',
          updateBy: 'TestUser',
          createDate: currentDate,
          updateDate: currentDate,
          createIp: 'test',
          updateIp: 'test'
        }
      ]
    };

    console.log('📝 Creating Invoice 2:', invoice.displayInvNumber);
    const result = await this.http.post(this.baseUrl + 'Invoice/Save', invoice).toPromise();
    console.log('✅ Invoice 2 created:', result);
    return result;
  }

  /**
   * Invoice 3: Three products with varying quantities
   */
  private async createInvoice3(customer: any, products: any[]) {
    const currentDate = new Date().toISOString();
    const invoiceYear = new Date().getFullYear().toString();

    const product1 = products[0];
    const product2 = products.length > 1 ? products[1] : products[0];
    const product3 = products.length > 2 ? products[2] : products[0];

    const item1Amount = 7 * (product1.rateWithTax || 100);
    const item2Amount = 15 * (product2.rateWithTax || 150);
    const item3Amount = 2 * (product3.rateWithTax || 200);
    const totalAmount = item1Amount + item2Amount + item3Amount;

    const invoice = {
      invoiceYear: invoiceYear,
      displayInvNumber: `TEST/${invoiceYear}/003`,
      invoiceDate: currentDate,
      companyId: 'COMP01',
      customerId: customer.uniqueKeyID,
      destination: `${customer.addressDetails || ''}, ${customer.phone || ''}, ${customer.email || ''}, ${customer.name || ''}`,
      dispatchedThrough: 'Standard Shipping',
      deliveryNote: 'Regular delivery',
      remark: 'Test Invoice 3 - Large Order',
      totalAmount: totalAmount,
      grandTotalAmount: totalAmount,
      cgstRate: 0,
      sgstRate: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      totalGstAmount: 0,
      createBy: 'TestUser',
      updateBy: 'TestUser',
      createDate: currentDate,
      updateDate: currentDate,
      createIp: 'test',
      updateIp: 'test',
      products: [
        {
          invoiceYear: invoiceYear,
          productId: product1.uniqueKeyID,
          quantity: 7,
          rateWithoutTax: 0,
          rateWithTax: product1.rateWithTax || 100,
          amount: item1Amount,
          createBy: 'TestUser',
          updateBy: 'TestUser',
          createDate: currentDate,
          updateDate: currentDate,
          createIp: 'test',
          updateIp: 'test'
        },
        {
          invoiceYear: invoiceYear,
          productId: product2.uniqueKeyID,
          quantity: 15,
          rateWithoutTax: 0,
          rateWithTax: product2.rateWithTax || 150,
          amount: item2Amount,
          createBy: 'TestUser',
          updateBy: 'TestUser',
          createDate: currentDate,
          updateDate: currentDate,
          createIp: 'test',
          updateIp: 'test'
        },
        {
          invoiceYear: invoiceYear,
          productId: product3.uniqueKeyID,
          quantity: 2,
          rateWithoutTax: 0,
          rateWithTax: product3.rateWithTax || 200,
          amount: item3Amount,
          createBy: 'TestUser',
          updateBy: 'TestUser',
          createDate: currentDate,
          updateDate: currentDate,
          createIp: 'test',
          updateIp: 'test'
        }
      ]
    };

    console.log('📝 Creating Invoice 3:', invoice.displayInvNumber);
    const result = await this.http.post(this.baseUrl + 'Invoice/Save', invoice).toPromise();
    console.log('✅ Invoice 3 created:', result);
    return result;
  }

  /**
   * Verify created invoices
   */
  async verifyInvoices() {
    console.log('🔍 Verifying created invoices...');
    try {
      const invoices: any = await this.http.get(this.baseUrl + 'Invoice/InvoiceCompanyCustomerController').toPromise();
      console.log(`✅ Total invoices in system: ${invoices.length}`);
      
      const testInvoices = invoices.filter((inv: any) => 
        inv.invNum && inv.invNum.startsWith('TEST/')
      );
      
      console.log(`✅ Test invoices found: ${testInvoices.length}`);
      testInvoices.forEach((inv: any) => {
        console.log(`  - ${inv.invNum}: ${inv.cuName} - ₹${inv.totalAmt}`);
      });
      
      return testInvoices;
    } catch (error) {
      console.error('❌ Error verifying invoices:', error);
      throw error;
    }
  }
}
