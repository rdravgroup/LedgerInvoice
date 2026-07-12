import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MaterialModule } from '../../material.module';
import { PaymentService, SubscriptionPlan, InitiatePaymentResponse } from '../../_service/payment.service';
import { ToastrService } from 'ngx-toastr';

declare var Razorpay: any;

@Component({
  selector: 'app-payment-widget',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, MatDialogModule, MatProgressSpinnerModule],
  styleUrls: ['./payment-widget.component.css'],
  template: `
<div class="pw-wrap">
  <div class="pw-header">
    <mat-icon>payment</mat-icon>
    <div><h2>Activate Company</h2><p>{{ data.companyName }}</p></div>
    <button mat-icon-button mat-dialog-close class="pw-close"><mat-icon>close</mat-icon></button>
  </div>

  <mat-dialog-content class="pw-body">

    <div class="pw-plans" *ngIf="!initiating && !paid">
      <p class="pw-section-lbl">Select a Plan</p>
      <div class="pw-plan-grid">
        <div *ngFor="let p of plans"
             class="pw-plan"
             [class.pw-plan--sel]="selectedPlan?.planId === p.planId"
             [class.pw-plan--rec]="p.isRecommended"
             (click)="selectedPlan = p">
          <span class="pw-rec-badge" *ngIf="p.isRecommended">Best Value</span>
          <div class="pw-plan-name">{{ p.name }}</div>
          <div class="pw-plan-price">₹{{ p.amount | number }}</div>
          <div class="pw-plan-days">{{ p.durationDays }} days</div>
          <div class="pw-plan-desc">{{ p.description }}</div>
        </div>
      </div>
    </div>

    <div class="pw-loading" *ngIf="initiating">
      <mat-spinner diameter="40"></mat-spinner>
      <p>Opening payment gateway…</p>
    </div>

    <div class="pw-success" *ngIf="paid">
      <mat-icon class="pw-tick">check_circle</mat-icon>
      <h3>Payment Successful!</h3>
      <p>{{ data.companyName }} is now active.</p>
      <p *ngIf="expiry" class="pw-expiry">Valid until {{ expiry | date:'dd MMM yyyy' }}</p>
    </div>

  </mat-dialog-content>

  <mat-dialog-actions class="pw-actions">
    <ng-container *ngIf="!paid">
      <button mat-stroked-button (click)="close()">Cancel</button>
      <button mat-flat-button color="primary"
              [disabled]="!selectedPlan || initiating"
              (click)="pay()">
        <mat-spinner *ngIf="initiating" diameter="18" style="display:inline-block;margin-right:6px"></mat-spinner>
        <span>{{ initiating ? 'Please wait…' : 'Pay ₹' + (selectedPlan?.amount | number) }}</span>
      </button>
    </ng-container>
    <button *ngIf="paid" mat-flat-button color="primary" (click)="close()">
      <mat-icon>check</mat-icon> Done
    </button>
  </mat-dialog-actions>
</div>
`
})
export class PaymentWidgetComponent implements OnInit {
  plans: SubscriptionPlan[] = [];
  selectedPlan: SubscriptionPlan | null = null;
  initiating = false;
  paid = false;
  expiry: Date | null = null;

  constructor(
    private svc: PaymentService,
    private dialogRef: MatDialogRef<PaymentWidgetComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { companyId: string; companyName: string },
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.svc.getPlans().subscribe({
      next: p => { this.plans = p; this.selectedPlan = p.find(x => x.isRecommended) ?? p[0] ?? null; },
      error: () => this.toastr.error('Failed to load plans', 'Error')
    });
  }

  pay(): void {
    if (!this.selectedPlan) return;
    this.initiating = true;
    this.svc.initiatePayment(this.data.companyId, this.selectedPlan.planId).subscribe({
      next: order => this.openRazorpay(order),
      error: err => { this.initiating = false; this.toastr.error(err?.message ?? 'Failed to initiate payment', 'Error'); }
    });
  }

  private openRazorpay(order: InitiatePaymentResponse): void {
    const opts = {
      key:         order.keyId,
      amount:      Math.round(order.amount * 100),
      currency:    order.currency,
      name:        'StoreApp',
      description: order.planName + ' Subscription',
      order_id:    order.gatewayOrderId,
      prefill:     { name: order.companyName, email: order.userEmail, contact: order.userPhone },
      theme:       { color: '#4f46e5' },
      handler:     (resp: any) => this.onSuccess(order, resp),
      modal:       { ondismiss: () => { this.initiating = false; } }
    };
    try {
      const rzp = new Razorpay(opts);
      rzp.on('payment.failed', (r: any) => {
        this.initiating = false;
        this.toastr.error(r?.error?.description ?? 'Payment failed', 'Payment Error');
      });
      rzp.open();
    } catch (e) {
      this.initiating = false;
      this.toastr.error('Razorpay SDK not loaded. Check index.html.', 'Error');
    }
  }

  private onSuccess(order: InitiatePaymentResponse, rzpResp: any): void {
    this.svc.verifyPayment({
      internalPaymentId: order.paymentId,
      gatewayOrderId:    rzpResp.razorpay_order_id,
      gatewayPaymentId:  rzpResp.razorpay_payment_id,
      gatewaySignature:  rzpResp.razorpay_signature
    }).subscribe({
      next: r => {
        this.initiating = false;
        if (r?.success) {
          this.paid = true;
          if (r.accessExpiryDate) this.expiry = new Date(r.accessExpiryDate);
        } else {
          this.toastr.error(r?.message ?? 'Verification failed', 'Error');
        }
      },
      error: () => { this.initiating = false; this.toastr.error('Verification failed. Contact support.', 'Error'); }
    });
  }

  close(): void { this.dialogRef.close(this.paid); }
}
