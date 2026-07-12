import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MaterialModule } from '../../material.module';
import { PaymentService } from '../../_service/payment.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-payment-callback',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  template: `
  <div style="padding:24px">
    <h3>Processing payment...</h3>
    <p *ngIf="message">{{ message }}</p>
    <mat-spinner *ngIf="loading"></mat-spinner>
  </div>
  `
})
export class PaymentCallbackComponent implements OnInit {
  loading = true;
  message = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private paymentSvc: PaymentService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    const qp = this.route.snapshot.queryParamMap;

    const internalFromQuery = qp.get('paymentId') || qp.get('paymentid') || qp.get('payment_id');
    const gatewayOrderId = qp.get('razorpay_order_id') || qp.get('txnid') || qp.get('order_id') || qp.get('gatewayOrderId');
    const gatewayPaymentId = qp.get('razorpay_payment_id') || qp.get('mihpayid') || qp.get('gatewayPaymentId');
    const gatewaySignature = qp.get('razorpay_signature') || qp.get('signature') || qp.get('hash') || qp.get('gatewaySignature');

    const internal = internalFromQuery ?? sessionStorage.getItem('pendingPaymentInternalId');
    if (!internal) {
      this.loading = false;
      this.message = 'Missing payment reference (internal payment id).';
      this.toastr.error(this.message, 'Payment');
      return;
    }

    const payload = {
      internalPaymentId: internal,
      gatewayOrderId: gatewayOrderId ?? undefined,
      gatewayPaymentId: gatewayPaymentId ?? undefined,
      gatewaySignature: gatewaySignature ?? undefined
    } as any;

    this.paymentSvc.verifyPayment(payload).subscribe({
      next: (r) => {
        this.loading = false;
        sessionStorage.removeItem('pendingPaymentInternalId');
        if (r?.success) {
          this.toastr.success('Payment verified — company activated', 'Payment');
          this.router.navigate(['/company']);
        } else {
          this.toastr.error(r?.message ?? 'Verification failed', 'Payment');
          this.router.navigate(['/company']);
        }
      },
      error: (err) => {
        this.loading = false;
        sessionStorage.removeItem('pendingPaymentInternalId');
        this.toastr.error(err?.message ?? 'Verification failed', 'Payment');
        this.router.navigate(['/company']);
      }
    });
  }
}
