import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface UserProfile {
  username?: string;
  name?: string;
  phone?: string;
  address?: string;
  email?: string;
}

@Injectable({ providedIn: 'root' })
export class UserProfileService {
  private name$ = new BehaviorSubject<string | null>(localStorage.getItem('userName'));
  private phone$ = new BehaviorSubject<string | null>(localStorage.getItem('userPhone'));
  private address$ = new BehaviorSubject<string | null>(localStorage.getItem('userAddress'));
  private email$ = new BehaviorSubject<string | null>(localStorage.getItem('userEmail'));

  getName(): string | null {
    return this.name$.getValue();
  }

  setName(value: string): void {
    localStorage.setItem('userName', value);
    this.name$.next(value);
  }

  getPhone(): string | null {
    return this.phone$.getValue();
  }

  setPhone(value: string): void {
    localStorage.setItem('userPhone', value);
    this.phone$.next(value);
  }

  getAddress(): string | null {
    return this.address$.getValue();
  }

  setAddress(value: string): void {
    localStorage.setItem('userAddress', value);
    this.address$.next(value);
  }

  getEmail(): string | null {
    return this.email$.getValue();
  }

  setEmail(value: string): void {
    localStorage.setItem('userEmail', value);
    this.email$.next(value);
  }

  getProfile(): UserProfile {
    return {
      username: localStorage.getItem('username') || undefined,
      name: this.getName() || undefined,
      phone: this.getPhone() || undefined,
      address: this.getAddress() || undefined,
      email: this.getEmail() || undefined,
    };
  }

  clearProfile(): void {
    localStorage.removeItem('userName');
    localStorage.removeItem('userPhone');
    localStorage.removeItem('userAddress');
    localStorage.removeItem('userEmail');
    this.name$.next(null);
    this.phone$.next(null);
    this.address$.next(null);
    this.email$.next(null);
  }
}
