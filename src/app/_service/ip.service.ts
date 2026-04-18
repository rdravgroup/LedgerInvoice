import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class IpService {
  constructor(private http: HttpClient) {}

  getIPAddress() {
    return this.http.get('https://api64.ipify.org/?format=json').pipe(
      catchError(error => {
        console.error('Error fetching IP:', error);
        return this.http.get('https://ifconfig.me/all.json'); // Alternate API
      })
    );
  }
}