# Reviewing the first three product improvements

Implemented for review on 6 October 2026. The frontend is available at `http://127.0.0.1:5173/dashboard`. The database migrations have been applied to the configured Kaki Split Supabase project. Frontend and API changes remain local; production has not been deployed.

## 1. Accuracy and trust

- **Home:** an outstanding-balance banner now offers **View group**, accurately describing its navigation action.
- **Group:** the debt banner says you owe a person an amount, without claiming the person sent a reminder.
- **Insights → select a group:** Top expense means largest expense; Most active day counts expenses by Singapore calendar day. A count accompanies the date. Equal ties use the latest expense/day.
- **Spending by member:** describes allocated shares, rather than implying amounts paid. Older records without split rows use the payer and the explanation says so. Chart tooltips use the group currency.

To check: compare a group containing a large older expense and a small newer one. The large expense should be Top expense. Several expenses on an older day should outweigh one expense today when selecting Most active day.

## 2. Expense details and corrections

Open **Home → a group → View details** under an expense.

- All members can inspect the full description, total, payer, recorder, category, split type, allocated shares and saved foreign-currency metadata.
- The expense recorder and group creator see **Edit expense**. Other members see a permission explanation.
- Editing starts with the saved data. Non-equal splits are reconstructed as exact amounts; you can change the split mode.
- Corrections atomically save the ledger and before/after history. Reopen the expense to inspect **Change history**. Corrected rows are marked **corrected**.
- If payments already exist, a warning and confirmation explain that the remaining balances may change. Recorded payments are retained.
- If someone else corrects the expense first, saving the stale revision is rejected. Close and reopen it to load the latest version.
- Keeping the original expense currency retains its saved FX rate. Switching currency obtains a new quote.

For a disposable expense, change its description, payer or allocations; save, then reopen details and expand the new revision. Existing records start without retroactive history. Receipt item-level assignment details were not stored previously, so editing reconstructs per-person amounts rather than individual receipt items. Telegram correction alerts and restoring deleted expenses are outside this change.

## 3. Optional receipt scanning and review

Open **Group → + → Split an itemized receipt (optional)**.

- Manual total entry remains the default; scanning is described as useful for unequal/itemized bills.
- Before upload, the disclosure explains the five-scan allowance, reset time, formats, size limit and Google processing.
- Receipt review lets you correct merchant/description, currency, item names, prices, total, charges and discount before selecting participants.
- Nothing is saved by scanning or assigning items alone; the final expense submission is still required.
- Unreadable receipts count as attempts. Provider/parser service failures return allowance; ten daily requests remain the separate safety limit. A failed allowance refund is reported explicitly.

The review UI is visible locally. End-to-end scanning and the new service-failure refund behavior require deployment of `api/scan-receipt.js` with the server credentials; the plain Vite server does not execute Vercel functions. Database support is already applied. No real receipt was uploaded during verification.

## Verification

All 29 automated regression tests and the production build pass. Checks cover insights selection, FX edit initialization and preservation of legacy accounting totals, correction form submission, detail permissions/history, receipt disclosures and rounding, existing mobile flows and scan quota behavior. Transactional SQL checks cover correction permissions, invalid splits, revision conflicts, payment acknowledgement, history RLS, quota refunds, the request ceiling and refund day boundaries. All SQL fixtures roll back. A real authenticated browser check covered group details, edit initialization, payment warnings, unchanged-form dismissal and the receipt disclosure at 390 px phone width; no real ledger records were edited.

The Supabase advisor reports existing warnings for other public helper functions; those are outside this change. The new quota request table intentionally has RLS without browser policies because only server code may access it. See [the advisor's explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

The original [user story map](PRODUCT_USER_STORY_MAP.md) is a dated review baseline. This document records the implementation changes that supersede its findings for these three issues.
