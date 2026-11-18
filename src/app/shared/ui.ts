import { DatePipe } from '@angular/common';
import { Pipe, PipeTransform } from '@angular/core';
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
