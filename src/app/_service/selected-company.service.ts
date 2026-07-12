import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * Centralised company selection store.
 *
 * Persists the selected company ID to localStorage so it survives page refreshes.
 * Emits changes as an Observable so all tenant-scoped components can react reactively.
 *
 * Role semantics:
 *   - regular / admin  : company is fixed from the JWT; SelectedCompanyService may still
 *                        hold it for consistency but it is never overridden.
 *   - super_admin       : must select a company; selection is the effective scope.
 *   - super_duper_admin : selection is optional for filtering; no selection = all companies.
 */
@Injectable({ providedIn: 'root' })
export class SelectedCompanyService {
  private readonly storageKey = 'selectedCompanyId';

  private selected$ = new BehaviorSubject<string | null>(
    localStorage.getItem(this.storageKey) || null
  );

  /** Observable — emits whenever the selected company changes (or is cleared). */
  public selectedCompanyId$ = this.selected$.asObservable();

  /** Returns the currently selected company ID (null if none selected). */
  getSelectedCompanyId(): string | null {
    return this.selected$.getValue();
  }

  /**
   * Sets the active company ID.
   * Passing null or empty string clears the selection.
   */
  setSelectedCompanyId(id: string | null): void {
    if (id) {
      localStorage.setItem(this.storageKey, id);
      this.selected$.next(id);
    } else {
      localStorage.removeItem(this.storageKey);
      this.selected$.next(null);
    }
  }

  /**
   * Clears the stored company selection.
   * Called on logout so the next user's session starts fresh.
   */
  clear(): void {
    localStorage.removeItem(this.storageKey);
    this.selected$.next(null);
  }
}
