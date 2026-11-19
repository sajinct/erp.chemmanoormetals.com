import { Component, input } from '@angular/core';
import { QuoteProposal, newProposal } from '../../shared/proposal';
import { UI } from '../../shared/ui';

@Component({
  selector: 'app-proposal-form',
  imports: [UI],
  template: `
    <fieldset [disabled]="disabled()">
      @if (!disabled()) {
        <button mat-stroked-button (click)="applyShutter()">Use sample shutter wording</button>
      }
      <p class="sub">
        Review the specifications, warranty and delivery commitments for this job before issuing.
      </p>
      <div class="form-grid">
        <mat-form-field class="wide"
          ><mat-label>Proposal title</mat-label><input matInput [(ngModel)]="data().title"
        /></mat-form-field>
        @for (f of fields; track f.key) {
          <mat-form-field class="wide"
            ><mat-label>{{ f.label }}</mat-label
            ><textarea matInput rows="3" [(ngModel)]="data()[f.key]"></textarea>
          </mat-form-field>
        }
        <mat-form-field
          ><mat-label>Advance (%) of total including GST</mat-label
          ><input
            matInput
            type="number"
            min="0"
            max="100"
            step="any"
            [(ngModel)]="data().advance_percent"
        /></mat-form-field>
        <mat-form-field
          ><mat-label>Authorised signatory</mat-label
          ><input matInput [(ngModel)]="data().signatory"
        /></mat-form-field>
      </div>
    </fieldset>
  `,
  styles: `
    fieldset {
      border: 0;
      padding: 0;
      margin: 0;
      min-width: 0;
    }
  `,
})
export class ProposalForm {
  readonly data = input.required<QuoteProposal>();
  readonly disabled = input(false);
  protected readonly fields = [
    { key: 'introduction', label: 'Cover letter' },
    { key: 'company_profile', label: 'Company profile' },
    { key: 'scope', label: 'Scope of supply and installation' },
    { key: 'specifications', label: 'Technical specifications' },
    { key: 'site_requirements', label: 'Customer responsibilities and exclusions' },
    { key: 'warranty', label: 'Warranty and maintenance' },
    { key: 'payment_terms', label: 'Payment and delivery terms' },
    { key: 'reference_projects', label: 'Selected projects / references' },
  ] as const;
  protected applyShutter() {
    const p = newProposal(true);
    Object.assign(this.data(), {
      title: p.title,
      specifications: p.specifications,
      warranty: p.warranty,
    });
  }
}
