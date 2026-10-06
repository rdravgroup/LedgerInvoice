import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ToastrModule } from 'ngx-toastr';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { ListinvoiceComponent } from './listinvoice.component';

describe('ListinvoiceComponent', () => {
  let component: ListinvoiceComponent;
  let fixture: ComponentFixture<ListinvoiceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ListinvoiceComponent,
        HttpClientTestingModule,
        RouterTestingModule,
        ToastrModule.forRoot(),
        BrowserAnimationsModule
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ListinvoiceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('defaults the date range to the current assessment year', () => {
    const today = new Date();
    const startYear = today.getMonth() < 3 ? today.getFullYear() - 1 : today.getFullYear();

    expect(component.fromDate).toEqual(new Date(startYear, 3, 1));
    expect(component.toDate).toEqual(new Date(startYear + 1, 2, 31));
  });

  it('offers all requested page sizes', () => {
    expect(component.pageSizeOptions).toEqual([10, 20, 50, 100, 200, 500, 1000]);
  });

  it('applies the selected range when Run is clicked', () => {
    spyOn(component, 'LoadInvoice');
    component.fromDate = new Date(2025, 3, 1);
    component.toDate = new Date(2026, 2, 31);

    component.runDateFilter();

    expect(component.appliedFromDate).toBe('2025-04-01');
    expect(component.appliedToDate).toBe('2026-03-31');
    expect(component.LoadInvoice).toHaveBeenCalled();
    expect(component.dateRangeError).toBe('');
  });

  it('rejects a reversed date range', () => {
    spyOn(component, 'LoadInvoice');
    component.fromDate = new Date(2026, 2, 31);
    component.toDate = new Date(2025, 3, 1);

    component.runDateFilter();

    expect(component.LoadInvoice).not.toHaveBeenCalled();
    expect(component.dateRangeError).toBe('From Date must be on or before To Date.');
  });
});
