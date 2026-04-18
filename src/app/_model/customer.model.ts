export interface customer {
  recId?: number;
  uniqueKeyID: string;
  name: string;
  customer_company: string;
  email: string;
  emailId?: string;
  phone: string;
  mobileNo: string;
  alternateMobile?: string;
  isActive: boolean;
  addressDetails: string;
  createDate?: string;
  updateDate?: string;
  createIp?: string;
  updateIp?: string;
  countryCode?: string;
  countryName?: string;
  stateCode?: string;
  stateName?: string;
  gst_number?: string;
  companyId?: string;
  statusname?: string;
}