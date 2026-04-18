import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CreateInvoiceUITestService } from '../../_service/create-invoice-ui-test.service';
import { MaterialModule } from '../../material.module';

@Component({
  selector: 'app-ui-test-runner',
  standalone: true,
  imports: [CommonModule, MaterialModule, RouterLink],
  template: `
    <div class="test-container">
      <mat-card>
        <mat-card-header>
          <mat-card-title>CreateInvoice UI Test Suite</mat-card-title>
        </mat-card-header>
        
        <mat-card-content>
          <div class="info-box">
            <h3>Test Coverage:</h3>
            <ul>
              <li>Load customers and products</li>
              <li>Create invoice with single product</li>
              <li>Create invoice with multiple products</li>
              <li>Validation tests</li>
              <li>Calculation tests</li>
              <li>Edit invoice functionality</li>
            </ul>
          </div>

          <div *ngIf="running" class="progress-section">
            <p>Running tests... Please wait</p>
          </div>

          <div *ngIf="testResults.length > 0" class="results-section">
            <h3>Results: {{ passedTests }}/{{ totalTests }} Passed ({{ successRate }}%)</h3>
            
            <div *ngFor="let result of testResults" class="test-result">
              <mat-icon [color]="result.passed ? 'primary' : 'warn'">
                {{ result.passed ? 'check_circle' : 'error' }}
              </mat-icon>
              <span>{{ result.test }}: {{ result.message }}</span>
            </div>
          </div>

          <div *ngIf="error" class="error-section">
            <p>{{ error }}</p>
          </div>
        </mat-card-content>

        <mat-card-actions>
          <button mat-raised-button color="primary" 
                  (click)="runTests()" 
                  [disabled]="running">
            {{ running ? 'Running...' : 'Run Tests' }}
          </button>
          
          <button mat-raised-button routerLink="/listinvoice">
            View Invoices
          </button>
        </mat-card-actions>
      </mat-card>
    </div>
  `,
  styles: [`
    .test-container { padding: 20px; max-width: 1000px; margin: 0 auto; }
    .info-box { background: #f5f5f5; padding: 15px; border-radius: 4px; margin-bottom: 20px; }
    .progress-section { margin: 20px 0; text-align: center; }
    .results-section { margin: 20px 0; }
    .test-result { display: flex; align-items: center; gap: 10px; margin: 10px 0; }
    .error-section { color: red; margin: 20px 0; }
    mat-card-actions { display: flex; gap: 10px; padding: 16px; }
  `]
})
export class UITestRunnerComponent {
  running = false;
  testResults: any[] = [];
  error: string = '';

  constructor(private testService: CreateInvoiceUITestService) {}

  async runTests() {
    this.running = true;
    this.error = '';
    this.testResults = [];

    try {
      const result = await this.testService.runCompleteTest();
      this.testResults = result.results;
      if (!result.success) {
        this.error = 'Some tests failed. Check results.';
      }
    } catch (error: any) {
      this.error = `Test failed: ${error.message}`;
      this.testResults = this.testService.getTestResults();
    } finally {
      this.running = false;
    }
  }

  get totalTests(): number { return this.testResults.length; }
  get passedTests(): number { return this.testResults.filter(r => r.passed).length; }
  get failedTests(): number { return this.testResults.filter(r => !r.passed).length; }
  get successRate(): string {
    if (this.totalTests === 0) return '0';
    return ((this.passedTests / this.totalTests) * 100).toFixed(1);
  }
}
