import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IdCards } from './id-cards';

describe('IdCards', () => {
  let component: IdCards;
  let fixture: ComponentFixture<IdCards>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IdCards],
    }).compileComponents();

    fixture = TestBed.createComponent(IdCards);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
