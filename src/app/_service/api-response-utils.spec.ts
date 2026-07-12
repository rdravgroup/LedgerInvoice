import { isAlreadyInTargetStatusMessage, isPaymentRequiredResponse, normalizeSubscriptionStatus } from './api-response-utils';

describe('api-response-utils', () => {
  it('detects payment-required responses', () => {
    expect(isPaymentRequiredResponse({ errorMessage: 'payment_required' })).toBeTrue();
    expect(isPaymentRequiredResponse({ data: { requiresPayment: true } })).toBeTrue();
    expect(isPaymentRequiredResponse({ message: 'Subscription expired' })).toBeFalse();
  });

  it('detects already-active or already-inactive status responses', () => {
    expect(isAlreadyInTargetStatusMessage({ errorMessage: 'Company is already active.' })).toBeTrue();
    expect(isAlreadyInTargetStatusMessage({ ErrorMessage: 'Company is already inactive.' })).toBeTrue();
    expect(isAlreadyInTargetStatusMessage({ message: 'Something else failed' })).toBeFalse();
  });

  it('normalizes subscription state from a variety of payloads', () => {
    expect(normalizeSubscriptionStatus({ data: { subscriptionStatus: 'active' } })).toEqual(jasmine.objectContaining({
      hasSubscription: true,
      isActive: true,
      status: 'active'
    }));

    expect(normalizeSubscriptionStatus({ data: null })).toEqual(jasmine.objectContaining({
      hasSubscription: false,
      isActive: false,
      status: ''
    }));
  });
});
