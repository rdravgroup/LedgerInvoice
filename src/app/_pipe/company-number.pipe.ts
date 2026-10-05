import { DecimalPipe } from '@angular/common';
import { Pipe, PipeTransform } from '@angular/core';
import { CompanyNumberFormatService } from '../_service/company-number-format.service';

@Pipe({
  name: 'companyNumber',
  standalone: true,
  pure: false
})
export class CompanyNumberPipe implements PipeTransform {
  private readonly decimalPipe = new DecimalPipe('en-IN');

  constructor(private readonly numberFormat: CompanyNumberFormatService) {}

  transform(value: number | string | null | undefined, digitsInfo = '1.2-2'): string | null {
    return this.decimalPipe.transform(value, digitsInfo, this.numberFormat.locale);
  }
}
