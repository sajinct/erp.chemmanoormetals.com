import { Component, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { QuoteCosting, PERFORATED_INPUTS, costingError } from '../../shared/quote-costing';
import { UI } from '../../shared/ui';

@Component({
  selector: 'app-costing-form',
  imports: [UI, DecimalPipe],
  template: `
    <fieldset [disabled]="disabled()">
      <div class="form-grid">
        <mat-form-field
          ><mat-label>Costing model</mat-label>
          <mat-select [(ngModel)]="data().model" [disabled]="disabled()">
            <mat-option value="perforated">Perforated automatic shutter</mat-option>
            <mat-option value="manual">Other products · manual cost build-up</mat-option>
          </mat-select>
        </mat-form-field>
      </div>
      @if (data().model === 'perforated') {
        <p class="sub">
          Includes shutter, automation, powder coating, nylon strips, end caps and rubber seals.
          Rates are saved with this quotation.
        </p>
        <div class="table-wrap">
          <table class="tbl">
            <thead>
              <tr>
                <th>Approved opening</th>
                <th>Width (m)</th>
                <th>Height (m)</th>
                <th>Quantity</th>
              </tr>
            </thead>
            <tbody>
              @for (i of data().openings; track $index) {
                <tr>
                  <td>{{ i.position }}</td>
                  <td>{{ i.width | number: '1.2-3' }}</td>
                  <td>{{ i.height | number: '1.2-3' }}</td>
                  <td>{{ i.qty }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="form-grid assumptions">
          @for (p of mainInputs; track p.key) {
            <mat-form-field
              ><mat-label>{{ p.label }}</mat-label
              ><input matInput type="number" min="0" step="any" [(ngModel)]="data().inputs[p.key]"
            /></mat-form-field>
          }
        </div>
        <details>
          <summary>Labour, overheads and material cost assumptions</summary>
          <div class="form-grid assumptions">
            @for (p of materialInputs; track p.key) {
              <mat-form-field
                ><mat-label>{{ p.label }}</mat-label
                ><input
                  matInput
                  type="number"
                  min="0"
                  step="any"
                  [(ngModel)]="data().inputs[p.key]"
              /></mat-form-field>
            }
          </div>
        </details>
      } @else {
        <p class="sub">
          Enter the actual costs for this job. Profit markup is added before the quotation’s
          discount and GST.
        </p>
        <div class="table-wrap">
          <table class="tbl">
            <thead>
              <tr>
                <th>Cost category / customer description</th>
                <th>Cost (Rs.)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (i of data().costs; track $index) {
                <tr>
                  <td><input aria-label="Cost description" [(ngModel)]="i.description" /></td>
                  <td>
                    <input
                      aria-label="Cost amount"
                      type="number"
                      min="0"
                      step="0.01"
                      [(ngModel)]="i.cost"
                    />
                  </td>
                  <td>
                    @if (!disabled()) {
                      <button
                        mat-icon-button
                        (click)="data().costs.splice($index, 1)"
                        aria-label="Remove cost"
                      >
                        <mat-icon>delete</mat-icon>
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (!disabled()) {
          <button mat-button (click)="data().costs.push({ description: '', cost: 0 })">
            <mat-icon>add</mat-icon>Add cost
          </button>
        }
        <div class="form-grid assumptions">
          <mat-form-field
            ><mat-label>Profit markup (%)</mat-label
            ><input matInput type="number" min="0" step="any" [(ngModel)]="data().markup"
          /></mat-form-field>
        </div>
      }
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
    </fieldset>
  `,
  styles: `
    fieldset {
      border: 0;
      padding: 0;
      margin: 0;
      min-width: 0;
    }
    .assumptions {
      margin-top: 20px;
    }
    summary {
      cursor: pointer;
      font-weight: 600;
      padding: 12px 0;
    }
    input {
      max-width: 100%;
    }
  `,
})
export class CostingForm {
  readonly data = input.required<QuoteCosting>();
  readonly disabled = input(false);
  private readonly primaryKeys: string[] = ['C14', 'C16', 'P146', 'D14', 'C19'];
  protected readonly mainInputs = this.primaryKeys.map((key) =>
    PERFORATED_INPUTS.find((p) => p.key === key)!,
  );
  protected readonly materialInputs = PERFORATED_INPUTS.filter(
    (p) => !this.primaryKeys.includes(p.key),
  );
  protected error() {
    return costingError(this.data());
  }
}
