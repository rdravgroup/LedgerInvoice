export interface NormalizedSubscriptionState {
  hasSubscription: boolean;
  isActive: boolean;
  status: string;
  raw?: any;
}

export function normalizeSubscriptionStatus(resp: any): NormalizedSubscriptionState {
  const raw = resp?.data ?? resp;
  const subscription = raw && typeof raw === 'object' ? raw : null;
  if (!subscription) {
    return { hasSubscription: false, isActive: false, status: '' };
  }

  const status = (subscription.SubscriptionStatus ?? subscription.subscriptionStatus ?? '').toString().trim().toLowerCase();
  return {
    hasSubscription: true,
    isActive: status === 'active',
    status,
    raw: subscription
  };
}

export function isPaymentRequiredResponse(resp: any): boolean {
  if (!resp) return false;
  const errorMessage = (resp.errorMessage ?? resp.ErrorMessage ?? resp.message ?? resp.Message ?? '').toString().toLowerCase();
  const body = resp.data ?? resp.body ?? null;
  const requiresPayment = !!(body && (body.requiresPayment || body.requires_payment));
  return errorMessage === 'payment_required' || requiresPayment;
}

export function isAlreadyInTargetStatusMessage(resp: any): boolean {
  if (!resp) return false;
  const message = (resp.errorMessage ?? resp.ErrorMessage ?? resp.message ?? resp.Message ?? '').toString().toLowerCase();
  return message.includes('already active') || message.includes('already inactive');
}
