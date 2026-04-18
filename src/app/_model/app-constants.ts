export const APP_CONSTANTS = {
  DEFAULT_COMPANY_ID: 'COMP01',
  INVOICE_YEAR: new Date().getFullYear().toString(),
  
  RESPONSE_STATUS: {
    PASS: 'pass',
    FAIL: 'fail'
  },
  
  PAGINATION: {
    DEFAULT_PAGE_SIZE: 10,
    PAGE_SIZE_OPTIONS: [5, 10, 20, 50]
  },
  
  VALIDATION_MESSAGES: {
    REQUIRED_FIELD: 'This field is required',
    INVALID_EMAIL: 'Please enter a valid email address',
    INVALID_PHONE: 'Please enter a valid phone number',
    MIN_LENGTH: 'Minimum length not met',
    MAX_LENGTH: 'Maximum length exceeded'
  }
};
