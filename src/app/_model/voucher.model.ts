export interface VoucherResponse {
  voucherId: number;
  voucherCode: string;
  voucherType: string;        // 'activation'|'discount'|'free_trial' — kept as string for API compat
  discountType: string;       // 'percent'|'flat'|'free_days'
  discountValue: number;
  freeDays: number;
  planRestriction?: string;
  maxUses: number;
  usedCount: number;
  remainingUses: number;
  isActive: boolean;
  isEnabled: boolean;
  isExpired: boolean;
  isUsable: boolean;
  expiryDate?: string;
  description?: string;
  notes?: string;
  createdDate: string;
  createdBy?: string;
  updatedDate?: string;
  recentUsages: VoucherUsageSummary[];
}
export interface VoucherUsageSummary {
  usageId: number;
  companyId: string;
  companyName?: string;
  usedByUsername?: string;
  usedDate: string;
  discountApplied: number;
  finalAmount: number;
  activationMode: string;
  accessExpiryDate?: string;
}
export interface ValidateVoucherResponse {
  isValid: boolean;
  message: string;
  voucherCode: string;
  voucherType: string;
  discountType: string;
  discountValue: number;
  freeDays: number;
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
  bonusDays: number;
  totalDays: number;
  requiresPayment: boolean;
  description?: string;
}
export interface ApplyVoucherResponse {
  success: boolean;
  message: string;
  companyId: string;
  companyStatus: string;
  accessExpiryDate?: string;
  activationMode: string;
  finalAmount: number;
}
export interface ActivationCheckResponse {
  companyId: string;
  companyName: string;
  onlinePaymentEnabled: boolean;
  voucherRequired: boolean;
  mode: string;               // kept as string — avoids TS2322
  instructions: string;
  plans: PlanInfo[];
}
export interface PlanInfo {
  planId: string;
  name: string;
  amount: number;
  currency: string;
  durationDays: number;
  description: string;
  isRecommended: boolean;
}
export interface PaymentConfigResponse {
  onlinePaymentEnabled: boolean;
  voucherRequired: boolean;
  planAnnualPrice: number;
  planMonthlyPrice: number;
  planTrialPrice: number;
  planAnnualDays: number;
  planMonthlyDays: number;
  planTrialDays: number;
  maxVoucherUses: number;
  allConfigs: ConfigKeyValue[];
}
export interface ConfigKeyValue {
  id: number;
  configKey: string;
  configValue: string;
  displayLabel?: string;
  dataType: string;
  isActive: boolean;
  description?: string;
}
