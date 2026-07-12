import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { ActivationCheckResponse, ValidateVoucherResponse, ApplyVoucherResponse, PlanInfo } from '../../_model/voucher.model';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { MaterialModule } from '../../material.module';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { VoucherService } from '../../_service/voucher.service';
import { PaymentService, InitiatePaymentResponse, PaymentGateway } from '../../_service/payment.service';
import { ToastrService } from 'ngx-toastr';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { LoggerService } from '../../_service/logger.service';
import { Router } from '@angular/router';
import { AuthService } from '../../_service/authentication.service';

declare var Razorpay: any;

type Step = 'loading'|'voucher'|'plan_select'|'payment'|'success'|'error';

@Component({
  selector: 'app-activation-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule,
            MaterialModule, MatDialogModule, MatProgressSpinnerModule],
  templateUrl: './activation-dialog.component.html',
  styleUrls: ['./activation-dialog.component.css']
})
export class ActivationDialogComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  step: Step = 'loading';
  activationInfo?: ActivationCheckResponse;
  selectedPlan?: PlanInfo;
  voucherValidation?: ValidateVoucherResponse;
  selectedGateway: string = '';
  availableGateways: PaymentGateway[] = [];

  voucherCtrl = new FormControl('', [Validators.minLength(3)]);
  validating = false;
  applying   = false;
  paymentInitiating = false;

  successMessage = '';
  accessExpiry?: Date;
  errorMessage  = '';

  constructor(
    private voucherSvc: VoucherService,
    private paymentSvc: PaymentService,
    private dialogRef: MatDialogRef<ActivationDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { companyId?: string; companyName?: string },
    private logger: LoggerService,
    private toastr: ToastrService,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadActivationMode();
  }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  loadActivationMode(): void {
    this.step = 'loading';
    // If no company id provided, show a clear message instead of calling the backend
    if (!this.data?.companyId) {
      this.step = 'error';
      this.errorMessage = 'No company selected. Sign in with the company account or contact support to activate the subscription.';
      try { this.logger?.warn('ActivationDialog', 'loadActivationMode called without companyId', { providedData: this.data }); } catch {}
      return;
    }

    this.voucherSvc.getActivationMode(this.data.companyId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: info => {
          this.activationInfo = info;

          // Fetch plans from backend API instead of relying on activation payload
          this.paymentSvc.getPlans().pipe(takeUntil(this.destroy$)).subscribe({
            next: plans => {
              // Normalize into PlanInfo shape and attach to activationInfo
              this.activationInfo!.plans = (plans || []).map(p => ({
                planId: p.planId, name: p.name, amount: p.amount,
                currency: p.currency, durationDays: p.durationDays,
                description: p.description, isRecommended: p.isRecommended
              }));
              this.selectedPlan = this.activationInfo!.plans.find(p => p.isRecommended) ?? this.activationInfo!.plans[0];
            },
            error: () => {
              // If plans API fails, fall back to whatever activation payload had
              this.selectedPlan = info.plans.find(p => p.isRecommended) ?? info.plans[0];
            }
          });

          // Fetch enabled gateways from backend so user can choose
          this.paymentSvc.getGateways().pipe(takeUntil(this.destroy$)).subscribe({
            next: g => {
              const list = (g || []).filter(x => x.isEnabled);
              if (!list || list.length === 0) {
                // Fallback to common gateways if DB not seeded
                this.availableGateways = [
                  { recId: 1, gatewayName: 'razorpay', displayName: 'Razorpay', isEnabled: true },
                  { recId: 2, gatewayName: 'payu', displayName: 'PayU', isEnabled: true },
                  { recId: 3, gatewayName: 'stripe', displayName: 'Stripe', isEnabled: true }
                ];
              } else {
                this.availableGateways = list;
              }
            },
            error: () => {
              this.availableGateways = [
                { recId: 1, gatewayName: 'razorpay', displayName: 'Razorpay', isEnabled: true },
                { recId: 2, gatewayName: 'payu', displayName: 'PayU', isEnabled: true },
                { recId: 3, gatewayName: 'stripe', displayName: 'Stripe', isEnabled: true }
              ];
            }
          });

          // Always show plan + gateway selector by default (voucher is optional)
          if (info.mode === 'free') {
            this.activateFree();
          } else {
            this.step = 'plan_select';
          }
        },
        error: () => { this.step = 'error'; this.errorMessage = 'Failed to load activation info.'; }
      });
  }

  // ── Free activation (no payment, no voucher) ─────────────────
  activateFree(): void {
    this.applying = true;
    this.voucherSvc.applyVoucher('FREE', this.data.companyId!, 'annual')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: r => { this.applying = false; this.handleApplyResult(r); },
        error: () => { this.applying = false; this.step='error'; this.errorMessage='Activation failed.'; }
      });
  }

  // ── Validate voucher ─────────────────────────────────────────
  validateVoucher(): void {
    if (!this.voucherCtrl.value?.trim()) return;
    this.validating = true;
    this.voucherValidation = undefined;
    const plan = this.selectedPlan?.planId ?? 'annual';
    this.voucherSvc.validateVoucher(this.voucherCtrl.value.trim(), this.data.companyId!, plan)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: r => {
          this.validating = false; this.voucherValidation = r;
          // Voucher validation result updates final amount preview; don't change step — gateway selection remains visible
        },
        error: () => { this.validating = false; this.toastr.error('Validation failed','Error'); }
      });
  }

  // ── Proceed after voucher validated ─────────────────────────
  proceedWithVoucher(): void {
    if (!this.voucherValidation?.isValid) return;
    // Always show plan/payment UI so user can pick gateway and confirm payment (even if ₹0)
    this.step = 'plan_select';
  }

  applyVoucherDirectly(paymentId?: number): void {
    this.applying = true;
    const plan = this.selectedPlan?.planId ?? 'annual';
    this.voucherSvc.applyVoucher(
      this.voucherCtrl.value?.trim() ?? '', this.data.companyId!, plan, paymentId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: r => { this.applying = false; this.handleApplyResult(r); },
        error: () => { this.applying = false; this.toastr.error('Activation failed','Error'); }
      });
  }

  // ── Plan selected → go to payment ────────────────────────────
  proceedToPayment(): void {
    this.step = 'payment';
    this.startPayment();
  }

  startPayment(): void {
    this.paymentInitiating = true;
    // Ensure user selected a payment gateway
    if (!this.selectedGateway || this.selectedGateway.trim() === '') {
      this.paymentInitiating = false;
      this.toastr.error('Please select a payment gateway before proceeding','Payment');
      this.step = 'plan_select';
      return;
    }
    const plan = this.selectedPlan?.planId ?? 'annual';
    // Pass voucher code when present so backend can create order for remaining amount
    const voucherCode = this.voucherCtrl.value?.trim();
    this.paymentSvc.initiatePayment(this.data.companyId!, plan, this.selectedGateway, voucherCode)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: order => {
          this.paymentInitiating = false;
          if (order?.paymentEnabled === false) {
            this.toastr.error('Payments are disabled by administrator. Please use a voucher or contact support.','Payment Disabled');
            this.step = 'plan_select';
            return;
          }

          // If backend indicates voucher-only / zero amount (voucher applied), refresh status and show success
          const gwLower = (order?.gateway ?? '').toLowerCase();
          if (gwLower === 'voucher' || (order?.amount ?? 0) <= 0) {
            this.paymentSvc.getPaymentStatus(this.data.companyId!).pipe(takeUntil(this.destroy$)).subscribe({
              next: st => {
                if (st?.isActive || st?.isPaymentDone) {
                  if (st.accessExpiryDate) this.accessExpiry = new Date(st.accessExpiryDate);
                  this.step = 'success';
                  this.successMessage = 'Activation completed';
                } else {
                  this.toastr.success('Voucher applied — activation pending','Info');
                  this.step = 'plan_select';
                }
              },
              error: () => { this.toastr.error('Failed to confirm activation','Error'); this.step = 'plan_select'; }
            });
            return;
          }
          // store pending internal payment id so callback can verify
          try { sessionStorage.setItem('pendingPaymentInternalId', String(order.paymentId ?? '')); } catch {}

          // Prefer explicit redirect info from backend when provided
          if (order.gatewayRedirectUrl && order.gatewayFields && Object.keys(order.gatewayFields).length > 0) {
            this.submitGatewayForm(order.gatewayRedirectUrl, order.gatewayFields);
            return;
          }

          const gw = (order.gateway ?? '').toLowerCase();

          // Redirect-only gateways (Stripe Checkout) — backend returns a direct URL in gatewayRedirectUrl
          if (order.gatewayRedirectUrl && (!order.gatewayFields || Object.keys(order.gatewayFields).length === 0)) {
            if (gw === 'stripe') {
              // open stripe checkout in a new tab/window
              window.open(order.gatewayRedirectUrl, '_blank');
              this.step = 'plan_select';
              return;
            }
            // generic redirect
            window.location.href = order.gatewayRedirectUrl;
            return;
          }

          if (gw === 'razorpay' || !gw) {
            this.openRazorpay(order);
            return;
          }
          // Fallback: if backend provided a callback url navigate there with payment id
          if (order.callbackUrl) {
            const sep = order.callbackUrl.includes('?') ? '&' : '?';
            window.location.href = `${order.callbackUrl}${sep}paymentId=${encodeURIComponent(String(order.paymentId ?? ''))}&gateway=${encodeURIComponent(order.gateway ?? '')}`;
            return;
          }
          // Default to Razorpay flow if unknown
          this.openRazorpay(order);
        },
        error: err  => {
          this.paymentInitiating = false;
          this.toastr.error(err?.message ?? 'Failed to initiate payment','Error');
          this.step = 'plan_select';
        }
      });
  }

  // Generic form submitter for redirect-based gateways (fields provided by backend)
  private submitGatewayForm(url: string, fields: Record<string,string>): void {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = url;
    for (const k of Object.keys(fields)) {
      const inp = document.createElement('input');
      inp.type = 'hidden'; inp.name = k; inp.value = fields[k] ?? '';
      form.appendChild(inp);
    }
    document.body.appendChild(form);
    form.submit();
  }

  // Legacy PayU handler removed — frontend now relies on backend `gatewayRedirectUrl` + `gatewayFields`.

  private openRazorpay(order: InitiatePaymentResponse): void {
    const opts = {
      key:         order.keyId,
      amount:      Math.round(order.amount * 100),
      currency:    order.currency,
      name:        'StoreApp',
      description: `${order.planName} Subscription`,
      order_id:    order.gatewayOrderId,
      prefill:     { name: order.companyName, email: order.userEmail, contact: order.userPhone },
      theme:       { color: '#4f46e5' },
      handler: (resp: any) => {
        // Verify, then apply voucher if present
        this.verifyAndActivate(order, resp);
      },
      modal: { ondismiss: () => { this.step = 'plan_select'; } }
    };
    try {
      const rzp = new Razorpay(opts);
      rzp.on('payment.failed', (r: any) => {
        this.toastr.error(r?.error?.description ?? 'Payment failed','Payment');
        this.step = 'plan_select';
      });
      rzp.open();
    } catch {
      this.toastr.error('Razorpay not loaded. Check index.html.','Error');
      this.step = 'plan_select';
    }
  }

  private verifyAndActivate(order: InitiatePaymentResponse, rzpResp: any): void {
    this.paymentSvc.verifyPayment({
      internalPaymentId: order.paymentId,
      gatewayOrderId:    rzpResp.razorpay_order_id,
      gatewayPaymentId:  rzpResp.razorpay_payment_id,
      gatewaySignature:  rzpResp.razorpay_signature
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: r => {
        if (r?.success) {
          const hasVoucher = !!(this.voucherCtrl.value?.trim()) && this.voucherValidation?.isValid;
          if (hasVoucher) {
            // Payment done — now apply voucher for additional discount/days
            this.applyVoucherDirectly(Number(order.paymentId));
          } else {
            if (r.accessExpiryDate) this.accessExpiry = new Date(r.accessExpiryDate);
            this.step = 'success';
            this.successMessage = 'Payment successful! Company is now active.';
          }
        } else {
          this.toastr.error(r?.message ?? 'Verification failed','Error');
        }
      },
      error: () => this.toastr.error('Verification failed','Error')
    });
  }

  private handleApplyResult(r: ApplyVoucherResponse): void {
    if (r.success) {
      this.step = 'success';
      this.successMessage = r.message;
      if (r.accessExpiryDate) this.accessExpiry = new Date(r.accessExpiryDate);
    } else {
      this.errorMessage = r.message;
      if (r.finalAmount > 0 && this.activationInfo?.onlinePaymentEnabled) {
        this.step = 'payment';
        this.startPayment();
      } else {
        this.step = 'error';
      }
    }
  }

  close(activated = false): void { this.dialogRef.close(activated); }

  goToLogin(): void {
    try { this.logger?.info('ActivationDialog', 'User requested sign-in from activation dialog', { data: this.data }); } catch {}
    // Close dialog and navigate to login route
    try { this.dialogRef.close(false); } catch {}
    try { this.authService.logout(); } catch {}
    try { this.router.navigate(['/login']); } catch { window.location.href = '/login'; }
  }

  contactSupport(): void {
    try { this.logger?.info('ActivationDialog', 'User requested contact support', { data: this.data }); } catch {}
    const email = 'support@storeapp.com';
    const subject = encodeURIComponent('Activation help - missing company');
    const body = encodeURIComponent(`Company: ${this.data?.companyName ?? 'N/A'}\n\nPlease help with activation.`);
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  }

  get isVoucherMode(): boolean {
    return this.activationInfo?.mode === 'voucher_only'
        || this.activationInfo?.mode === 'voucher_then_payment';
  }
  get showPlanSelect(): boolean {
    return this.step === 'plan_select' || this.step === 'voucher';
  }

  get displayAmount(): number {
    return (this.voucherValidation && this.voucherValidation.isValid)
      ? (this.voucherValidation.finalAmount ?? (this.selectedPlan?.amount ?? 0))
      : (this.selectedPlan?.amount ?? 0);
  }
}
