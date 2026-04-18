export interface Country {
  countryCode: string;
  countryName: string;
  isActive: boolean;
}

export interface State {
  stateCode: string;
  stateName: string;
  countryCode: string;
  isActive: boolean;
}
