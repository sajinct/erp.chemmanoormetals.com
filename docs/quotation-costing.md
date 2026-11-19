# Quotation costing and proposal update

## Confirmed scope

All draft quotations now use cost build-up rather than a catalogue selling rate multiplied by a measurement quantity. Perforated automatic shutters use the supplied workbook's arithmetic, including its internal 60% × 2% charge. Gates, pergolas and other products use manually entered cost categories and profit markup until their own costing models are supplied. Existing issued quotations retain their stored amounts; revising an older quotation requires configuring its costing.

## Reference analysis

The proposal reference has five sections: cover letter, company profile and scope, commercial details and measurements, technical requirements and exclusions, and payment/delivery with project references. Its opening is 3.63 m × 2.85 m (111.32 sq ft under the workbook's 10.76 conversion). It states 18% GST additional, 3-day validity, 60% advance and final payment on installation.

The workbook has one sheet, 802 populated cells and 462 formulas. Independent evaluation of all 421 numeric cached formula results reproduced the saved values. The remaining formulas include text links and nine `#REF!` display references at O73:Q75. Those errors do not feed the pricing total.

### Price reconciliation

| Customer component | Workbook saved 3 × 3 m case | Workbook at proposal dimensions | Sample proposal |
| --- | ---: | ---: | ---: |
| Shutter / screen and guides | 55,072.71 | 57,654.36 | 56,519.80 |
| Automation | 23,172.23 | 23,782.70 | 23,782.70 |
| Powder coating | 7,590.43 | 8,719.68 | 8,719.68 |
| Nylon strips | 1,717.11 | 1,680.05 | 1,680.05 |
| End caps | 168.30 | 168.30 | 168.30 |
| Rubber seals | 1,956.50 | 2,027.45 | 2,027.45 |
| Total before customer GST | 89,677.28 | 94,032.54 | 92,897.97 |

The PDF's base shutter price differs from the supplied workbook. Five other components match when rounded to two decimals. The selected policy is to follow the supplied Excel, not force a match to the older PDF. The workbook-based total at the proposal dimensions is 110,958.40 including 18% GST. Its 60% advance is 66,575.04 and balance is 44,383.36.

## Calculation flow

- Approved openings are converted to metres and retained in the quotation snapshot. Quantity repeats each opening. New measurement entry also supports metres.
- Area uses width × height × quantity × 10.76, preserving the spreadsheet conversion rather than substituting an exact physical conversion.
- Bottom length: width − 0.03 m. Guide-channel length: height − 0.30 m. Slat count: channel length / 0.076 + 2.6. Screen length: bottom length × slat count. Shaft length: width − 0.07 m. Bracing quantity: (width − 0.60) / 0.80 + 1.8.
- Material consumption, handling allowances and rates follow rows 100–116 and 144–166. Office, production, installation, travel and input handling-tax costs follow rows 118–133 and 183–213.
- Profit at I134 applies the C19 percentage to I133 plus automation, coating, nylon, end caps and seals. It is markup on cost, not gross margin. The fixed profit target at D19 is not used by the source total.
- I136 retains the exact source calculation: 2% of 60% of I135 + I147 + I152 + I157 + I163 + I166. In particular, this formula uses nylon labour I157, whereas profit uses total nylon I158. This difference is preserved intentionally.
- Customer GST is applied separately to the selling subtotal after discount. The internal workbook charge is a cost component, not a substitute for the customer GST line.
- Calculation carries full precision. Customer component lines round to paise. If their sum differs from the rounded Excel grand total, an explicit rounding-adjustment line reconciles it.

The static arithmetic implementation is `src/app/shared/perforated-workbook.ts`. It contains only the numeric pricing dependency graph; it does not execute Excel, use `eval`, import employee names, or store the workbook. Payroll-derived daily costs and office allocation are editable aggregate assumptions, not a replacement payroll module. Changing these aggregates deliberately sets that quotation's cost assumptions; it does not recalculate employee payroll. Site-inspection travel still recalculates from distance, as in the workbook.

## Source issues retained or excluded

- O73:Q75 are broken measurement-display references and are excluded from the app's measurement table.
- J73 points to J82 rather than J81. The app renders the approved opening records directly.
- Only the first input opening row has calculation formulas in this saved workbook. The app applies the same geometry rules to every approved opening and quantity, without the worksheet's 16-row limit.
- The source uses fractional slat/consumable quantities and inconsistent-looking allowance applications. These have not been rounded up or silently corrected.
- The brochure mentions extra charges below 100 sq ft, but the workbook contains no explicit minimum-100-sq-ft billing formula. No unsupported surcharge has been invented.
- The two AC1000 labels and the unused fixed profit target are not used to infer new motor-selection or margin rules. The model defaults to the source's 600 kg motor purchase cost, which staff can review and override.

## Application integration

1. Create a quotation from a final measurement. Perforated projects start with the workbook model. Other projects start with empty manual cost categories, which must be completed before saving or issuing.
2. Review distance, travel hours, motor cost, coating rate and markup. Expand the other cost assumptions when required. These are quote-specific snapshots, so catalogue selling rates no longer drive quotations.
3. Review editable proposal sections, scope, technical specifications, warranty, customer responsibilities, selected projects, advance percentage and signatory. The sample wording is a starting point; it remains editable per job.
4. Save the draft. One database transaction saves structured snapshots and customer lines, recomputes totals from those lines and checks the caller's role. Revision checks prevent saving over a newer draft and prevent issuing a PDF after another user changes its costing.
5. Issue the proposal. PDF files continue to upload to the private Supabase Storage bucket. The database holds structured text/numeric costing data and the Storage path, not PDF/Excel file contents. Internal cost details are excluded from the customer PDF.

Keep version-1 calculation rules available when adding future model versions. New rates can be entered per quotation today; a shared, effective-dated rate-master screen is a useful later enhancement. Further product-specific workbooks can become additional costing models without returning to flat selling rates.

## Rollout and checks

Apply `supabase/migrations/20261119000001_quote_costing_proposals.sql` before deploying the updated front end (`npx supabase db push --remote`). It adds quote snapshots, revision tracking and the transactional save RPC. It changes the original 15-day starter validity to 3 days and updates only the known starter 50%-advance sentence; other validity values and commercial wording are preserved. Existing quotation dates and issued totals are not rewritten.

Checks include independent Excel reference results, altered dimensions, quantities, travel, manual costing, rounding, invalid inputs, customer-PDF confidentiality, server totals, rollback, stale revisions, issued-quote locks and role access. GitHub deployment now runs `npm run test:quote-costing` in addition to the existing checks.

This implementation is prepared locally as v1.3.0. Deployment is a separate action.
