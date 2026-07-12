export interface Company {
  companyId: string;
  name: string;
  status?: string;
  // UI-only flag to highlight recently updated rows/cards
  _justUpdated?: boolean;
  emailId?: string;
  mobileNo?: string;
  alternateMobile?: string;
  addressDetails?: string;
  countryCode?: string;
  countryName?: string;
  stateCode?: string;
  stateName?: string;
  gstNumber?: string;
  bankName?: string;
  accountNumber?: string;
  ifsc?: string;
  accountAddress?: string;
  createdDate?: string;
  updatedDate?: string;
  uniqueKeyID?: string;
}

export interface MapCompanyCodeRequest {
  companyId: string;
  username: string;
}
