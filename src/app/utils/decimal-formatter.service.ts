import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root', // Makes the service available everywhere
})
export class DecimalFormatterService {
  // Function to round to 2 decimal places
  roundToTwoDecimal(value: number): number {
    return Math.round(value * 100) / 100;
  }

  // Function to round to 3 decimal places
  roundToThreeDecimal(value: number): number {
    return Math.round(value * 1000) / 1000;
  }

  // Function to restrict input to 3 decimal places in real-time
  restrictDecimals(event: any) {
    let value = event.target.value;
    
    // Allow numbers and one decimal point only
    value = value.replace(/[^0-9.]/g, '');
    
    // Remove extra decimal points (keep only the first one)
    const parts = value.split('.');
    if (parts.length > 2) {
      value = parts[0] + '.' + parts.slice(1).join('');
    }
    
    // Limit to 3 decimal places
    if (value.includes('.')) {
      const [integerPart, decimalPart] = value.split('.');
      if (decimalPart.length > 3) {
        value = integerPart + '.' + decimalPart.substring(0, 3);
      }
    }
    
    event.target.value = value;
  }

  // NEW FUNCTION: Handle when user leaves the input field
  formatOnBlur(event: any) {
    let value = event.target.value.trim();
    
    if (!value) return; // Don't format if empty
    
    // Convert to number and back to remove extra zeros
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      event.target.value = numValue.toString();
    }
  }
  
}
