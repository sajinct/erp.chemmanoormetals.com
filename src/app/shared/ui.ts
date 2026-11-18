import { DatePipe } from '@angular/common';
import { Component, Pipe, PipeTransform, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { Option, labelOf } from '../core/models';
import { money } from './messaging';
import { paginate } from './pagination';

@Component({
  selector: 'app-table-pager',
  imports: [MatIconModule],
  template: `
    <nav class="table-footer" aria-label="Table pagination">
      <span aria-live="polite"
        >{{ pager().start() }}–{{ pager().end() }} of {{ total() }} records</span
      >
      <span class="spacer"></span><span>Page {{ pager().page() }} of {{ pager().pages() }}</span>
      <button
        type="button"
        [disabled]="pager().page() === 1"
        (click)="pager().previous()"
        aria-label="Previous page"
      >
        <mat-icon>chevron_left</mat-icon>
      </button>
      <button
        type="button"
        [disabled]="pager().page() === pager().pages()"
        (click)="pager().next()"
        aria-label="Next page"
      >
        <mat-icon>chevron_right</mat-icon>
      </button>
    </nav>
  `,
})
export class TablePager {
  readonly pager = input.required<ReturnType<typeof paginate>>();
  readonly total = input.required<number>();
}

/** {{ lead.status | label: STATUSES }} */
@Pipe({ name: 'label' })
export class LabelPipe implements PipeTransform {
  transform(value: string | null | undefined, list: Option[]): string {
    return labelOf(list, value);
  }
}

/** {{ quote.total | inr }} -> 1,25,000.00 */
@Pipe({ name: 'inr' })
export class InrPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return money(value);
  }
}

/** Everything the feature screens commonly need, in one import. */
export const UI = [
  TablePager,
  FormsModule,
  RouterLink,
  DatePipe,
  LabelPipe,
  InrPipe,
  MatButtonModule,
  MatCardModule,
  MatDialogModule,
  MatFormFieldModule,
  MatIconModule,
  MatInputModule,
  MatSelectModule,
] as const;
