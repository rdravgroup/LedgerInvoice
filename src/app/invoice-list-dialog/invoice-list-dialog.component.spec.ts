import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InvoiceListDialogComponent } from './invoice-list-dialog.component';

describe('InvoiceListDialogComponent', () => {
  let component: InvoiceListDialogComponent;
  let fixture: ComponentFixture<InvoiceListDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InvoiceListDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InvoiceListDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
