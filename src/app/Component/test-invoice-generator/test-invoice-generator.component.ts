import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TestDataGeneratorService } from '../../_service/test-data-generator.service';
import { MaterialModule } from '../../material.module';

@Component({
  selector: 'app-test-invoice-generator',
  standalone: true,
  imports: [CommonModule, MaterialModule, RouterLink],
  template: `
    <div class="test-container">
      <mat-card>
        <mat-card-header>
          <mat-card-title>Test Invoice Generator</mat-card-title>
        </mat-card-header>
        
        <mat-card-content>
          <p><strong>Creates 3 sample invoices:</strong></p>
          <ul>
            <li>Invoice 1: Single product (Qty: 5)</li>
            <li>Invoice 2: Two products (Qty: 10, 3)</li>
            <li>Invoice 3: Three products (Qty: 7, 15, 2)</li>
          </ul>

          <div *ngIf="status">
            <p [style.color]="status.type === 'success' ? 'green' : 'red'">
              {{ status.message }}
            </p>
          </div>
        </mat-card-content>

        <mat-card-actions>
          <button mat-raised-button color="primary" 
                  (click)="createInvoices()" 
                  [disabled]="loading">
            {{ loading ? 'Creating...' : 'Create Sample Invoices' }}
          </button>
          
          <button mat-raised-button routerLink="/listinvoice">
            View Invoice List
          </button>
        </mat-card-actions>
      </mat-card>
    </div>
  `,
  styles: [`
    .test-container {
      padding: 20px;
      max-width: 800px;
      margin: 0 auto;
    }
    mat-card-actions {
      display: flex;
      gap: 10px;
      padding: 16px;
    }
  `]
})
export class TestInvoiceGeneratorComponent {
  loading = false;
  status: { type: string; message: string } | null = null;

  constructor(private testDataGenerator: TestDataGeneratorService) {}

  async createInvoices() {
    this.loading = true;
    this.status = { type: 'info', message: 'Creating sample invoices...' };

    try {
      await this.testDataGenerator.createSampleInvoices();
      this.status = { type: 'success', message: '✅ Successfully created 3 sample invoices!' };
    } catch (error: any) {
      this.status = { type: 'error', message: `❌ Error: ${error.message}` };
    } finally {
      this.loading = false;
    }
  }
}
