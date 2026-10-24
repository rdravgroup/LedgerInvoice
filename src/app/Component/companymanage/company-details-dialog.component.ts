import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from '../../material.module';
import { Company } from '../../_model/company.model';

interface CompanyDetailField {
  label: string;
  value: string;
}

interface CompanyDetailSection {
  title: string;
  icon: string;
  fields: CompanyDetailField[];
}

@Component({
  selector: 'app-company-details-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  templateUrl: './company-details-dialog.component.html',
  styleUrls: ['./company-details-dialog.component.css']
})
export class CompanyDetailsDialogComponent {
  readonly company: Company;
  printError = '';

  constructor(
    private readonly dialogRef: MatDialogRef<CompanyDetailsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) data: Company
  ) {
    this.company = this.normalizeCompany(data);
  }

  get sections(): CompanyDetailSection[] {
    return [
      {
        title: 'Contact & address',
        icon: 'contact_phone',
        fields: [
          { label: 'Email address', value: this.display(this.company.emailId) },
          { label: 'Primary mobile', value: this.display(this.company.mobileNo) },
          { label: 'Alternate mobile', value: this.display(this.company.alternateMobile) },
          { label: 'Registered address', value: this.display(this.company.addressDetails) },
          { label: 'Country', value: this.display(this.company.countryName) },
          { label: 'Country code', value: this.display(this.company.countryCode) },
          { label: 'State', value: this.display(this.company.stateName) },
          { label: 'State code', value: this.display(this.company.stateCode) }
        ]
      },
      {
        title: 'Tax & bank details',
        icon: 'account_balance',
        fields: [
          { label: 'GST number', value: this.display(this.company.gstNumber) },
          { label: 'Bank name', value: this.display(this.company.bankName) },
          { label: 'Account number', value: this.display(this.company.accountNumber) },
          { label: 'IFSC / routing code', value: this.display(this.company.ifsc) },
          { label: 'Bank address', value: this.display(this.company.accountAddress) }
        ]
      },
      {
        title: 'Invoice & accounting settings',
        icon: 'tune',
        fields: [
          { label: 'Invoice rate mode', value: this.setting(this.company.salesInvoiceRateMode) },
          { label: 'Default product category', value: this.display(this.company.defaultProductCategoryCode) },
          { label: 'Invoice numbering', value: this.setting(this.company.invoiceDisplayNumberMode) },
          { label: 'Invoice number prefix', value: this.display(this.company.invoiceDisplayNumberPrefix) },
          { label: 'Discount mode', value: this.setting(this.company.discountMode) },
          { label: 'Discount type', value: this.setting(this.company.discountType) },
          { label: 'Discount value', value: this.display(this.company.discountValue) },
          { label: 'Number format', value: this.display(this.company.currencyNumberFormat) },
          { label: 'Invoice PDF filename format', value: this.setting(this.company.invoicePdfFileNameFormat) }
        ]
      },
      {
        title: 'Available invoice actions',
        icon: 'receipt_long',
        fields: [
          { label: 'Preview', value: this.enabled(this.company.showActionPreview) },
          { label: 'Download PDF', value: this.enabled(this.company.showActionPdf) },
          { label: 'POS print', value: this.enabled(this.company.showActionPosPrint) },
          { label: 'POS preview', value: this.enabled(this.company.showActionPosPreview) },
          { label: 'Email', value: this.enabled(this.company.showActionEmail) },
          { label: 'WhatsApp', value: this.enabled(this.company.showActionWhatsApp) },
          { label: 'Customer statement', value: this.enabled(this.company.showActionStatement) }
        ]
      },
      {
        title: 'Record information',
        icon: 'history',
        fields: [
          { label: 'Created', value: this.dateValue(this.company.createdDate) },
          { label: 'Last updated', value: this.dateValue(this.company.updatedDate) },
          { label: 'Internal record ID', value: this.display(this.company.uniqueKeyID) }
        ]
      }
    ];
  }

  printDetails(): void {
    this.printError = '';
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      this.printError = 'Printing was blocked by the browser. Allow pop-ups, then try again.';
      return;
    }

    const sectionsHtml = this.sections.map(section => `
      <section>
        <h2>${this.escapeHtml(section.title)}</h2>
        <dl>${section.fields.map(field => `
          <div class="field">
            <dt>${this.escapeHtml(field.label)}</dt>
            <dd>${this.escapeHtml(field.value)}</dd>
          </div>`).join('')}
        </dl>
      </section>`).join('');
    const title = `${this.company.name} - Company details`;
    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>${this.escapeHtml(title)}</title>
          <style>
            @page { size: A4; margin: 16mm; }
            * { box-sizing: border-box; }
            body { margin: 0; color: #172033; font: 13px/1.5 Arial, sans-serif; }
            header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; padding-bottom: 18px; border-bottom: 2px solid #3155a4; }
            h1 { margin: 0 0 5px; color: #18356e; font-size: 25px; }
            .subtitle { color: #64748b; font-size: 12px; }
            .code { padding: 6px 10px; border-radius: 6px; color: #3155a4; background: #eef2ff; font-weight: 700; }
            .status { margin-top: 10px; color: ${this.company.status?.toLowerCase() === 'active' ? '#087443' : '#b42318'}; font-size: 11px; font-weight: 700; text-transform: uppercase; }
            .sections { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; padding-top: 18px; }
            section { break-inside: avoid; padding: 12px 14px; border: 1px solid #dce3ef; border-radius: 9px; }
            h2 { margin: 0 0 10px; color: #3155a4; font-size: 14px; }
            dl { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 14px; margin: 0; }
            .field { min-width: 0; }
            dt { margin-bottom: 2px; color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
            dd { margin: 0; overflow-wrap: anywhere; white-space: pre-wrap; }
            footer { margin-top: 20px; padding-top: 8px; border-top: 1px solid #dce3ef; color: #64748b; font-size: 10px; }
            @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <header>
            <div>
              <h1>${this.escapeHtml(this.company.name)}</h1>
              <div class="subtitle">Company details and configuration</div>
              <div class="status">${this.escapeHtml(this.display(this.company.status))}</div>
            </div>
            <div class="code">${this.escapeHtml(this.company.companyId)}</div>
          </header>
          <main class="sections">${sectionsHtml}</main>
          <footer>Generated on ${this.escapeHtml(new Date().toLocaleString())}</footer>
          <script>window.addEventListener('load', () => setTimeout(() => window.print(), 200));</script>
        </body>
      </html>`);
    printWindow.document.close();
  }

  close(): void {
    this.dialogRef.close();
  }

  private normalizeCompany(source: Company): Company {
    const raw = source as Company & Record<string, unknown>;
    const pick = (...keys: string[]): unknown => {
      for (const key of keys) {
        const value = raw[key];
        if (value !== undefined && value !== null) return value;
      }
      return undefined;
    };
    const text = (...keys: string[]): string | undefined => {
      const value = pick(...keys);
      return value === undefined ? undefined : String(value);
    };
    const boolean = (...keys: string[]): boolean | undefined => {
      const value = pick(...keys);
      if (value === undefined) return undefined;
      if (typeof value === 'boolean') return value;
      return ['true', '1', 'yes', 'y', 'enabled'].includes(String(value).toLowerCase());
    };
    const number = (...keys: string[]): number | undefined => {
      const value = pick(...keys);
      if (value === undefined || value === '') return undefined;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    };

    return {
      companyId: text('companyId', 'CompanyId') || '',
      name: text('name', 'Name') || '',
      status: text('status', 'Status'),
      emailId: text('emailId', 'EmailId', 'email', 'Email'),
      mobileNo: text('mobileNo', 'MobileNo', 'mobile', 'Mobile'),
      alternateMobile: text('alternateMobile', 'AlternateMobile', 'coAltMob', 'CoAltMob'),
      addressDetails: text('addressDetails', 'AddressDetails', 'address', 'Address', 'coAddr', 'CoAddr'),
      countryCode: text('countryCode', 'CountryCode', 'cntryCode', 'CntryCode'),
      countryName: text('countryName', 'CountryName', 'cntryName', 'CntryName'),
      stateCode: text('stateCode', 'StateCode', 'stCode', 'StCode'),
      stateName: text('stateName', 'StateName', 'stName', 'StName'),
      gstNumber: text('gstNumber', 'GstNumber', 'gst', 'GST', 'coGST', 'CoGST'),
      bankName: text('bankName', 'BankName'),
      accountNumber: text('accountNumber', 'AccountNumber', 'accNum', 'AccNum'),
      ifsc: text('ifsc', 'Ifsc', 'IFSC'),
      accountAddress: text('accountAddress', 'AccountAddress', 'accAddr', 'AccAddr'),
      salesInvoiceRateMode: text('salesInvoiceRateMode', 'SalesInvoiceRateMode'),
      defaultProductCategoryCode: text('defaultProductCategoryCode', 'DefaultProductCategoryCode'),
      invoiceDisplayNumberMode: text('invoiceDisplayNumberMode', 'InvoiceDisplayNumberMode'),
      invoiceDisplayNumberPrefix: text('invoiceDisplayNumberPrefix', 'InvoiceDisplayNumberPrefix'),
      discountMode: text('discountMode', 'DiscountMode'),
      discountType: text('discountType', 'DiscountType'),
      discountValue: number('discountValue', 'DiscountValue'),
      currencyNumberFormat: text('currencyNumberFormat', 'CurrencyNumberFormat'),
      invoicePdfFileNameFormat: text('invoicePdfFileNameFormat', 'InvoicePdfFileNameFormat'),
      showActionPreview: boolean('showActionPreview', 'ShowActionPreview'),
      showActionPdf: boolean('showActionPdf', 'ShowActionPdf'),
      showActionPosPrint: boolean('showActionPosPrint', 'ShowActionPosPrint'),
      showActionPosPreview: boolean('showActionPosPreview', 'ShowActionPosPreview'),
      showActionEmail: boolean('showActionEmail', 'ShowActionEmail'),
      showActionWhatsApp: boolean('showActionWhatsApp', 'ShowActionWhatsApp'),
      showActionStatement: boolean('showActionStatement', 'ShowActionStatement'),
      createdDate: text('createdDate', 'CreatedDate'),
      updatedDate: text('updatedDate', 'UpdatedDate'),
      uniqueKeyID: text('uniqueKeyID', 'UniqueKeyID')
    };
  }

  private display(value: unknown): string {
    if (value === undefined || value === null || String(value).trim() === '') return 'Not provided';
    return String(value);
  }

  private enabled(value: boolean | undefined): string {
    return value === undefined ? 'Not provided' : value ? 'Enabled' : 'Disabled';
  }

  private setting(value: string | undefined): string {
    if (!value) return 'Not provided';
    return value.replace(/_/g, ' ').replace(/\b\w/g, character => character.toUpperCase());
  }

  private dateValue(value: string | undefined): string {
    if (!value) return 'Not provided';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[character] || character);
  }
}
