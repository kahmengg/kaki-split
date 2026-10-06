# Remaining features: changes and test guide

Scope: all six accepted remaining features are implemented. Telegram reminder schedules, settings and new reminder behavior were left unchanged. Guest participants and leaving a group with debt remain deferred as agreed.

## What to see locally

Run `npm run dev` from the project folder and open the URL printed by Vite (usually http://localhost:5173). The frontend/API changes remain local; database migrations are applied to the configured Supabase project.

| Feature | Where | What changed / how to test |
| --- | --- | --- |
| Cross-group Activity | Activity tab | Actual expense additions/corrections, payment records/acknowledgements/voids and deleted logs, with group, actor, amount and time. Tap an entry to open its group. More than 30 entries exposes Load older activity. Errors offer Retry rather than claiming an empty feed. |
| Trip recap | Group → menu → Trip Summary | Recorded expense dates describe the period. Copy text copies without opening Share. Share uses native sharing where supported, with copy fallback. Cancellation stays quiet; errors remain actionable. |
| Payment safeguards and correction | Group balance → Pay / Record received payment; payment → View details | Amounts are checked against the latest simplified balance and ledger snapshot. Partial payments retain remaining debt. The recipient can optionally acknowledge receipt. The recorder or group admin can void a mistake with a reason; the original record/history remains and balances reverse. This records a transfer manually; it does not verify a bank transfer. |
| Expense draft recovery | Group → Add expense | Enter amount, description, payer, participants or custom/itemized splits; close, navigate away or reload, then reopen Add expense. The draft returns for the same account and group on this browser. Discard draft resets it. Extracted receipt fields and assignments recover too; uploaded images are not stored. Successful saves clear the draft; rejected/cancelled saves retain editable entries. |
| Conversion preview | Add expense → amount currency button → choose a currency different from the group's base currency | Before saving, see original total → converted group total, rate, source and quote date. Older/stored quotes carry a notice; unavailable quotes require Retry conversion before saving. The reviewed rate is used for the saved expense. Corrections in the original currency preserve the saved rate and legacy accounting total. Bank/card charges may differ. |
| Personal archive | Group → menu → Archive group for me; Home → Archived | Archive is private to your account. Active/Archived filters show counts. Open an archived group and use Restore group to Active. Shared records stay intact and outstanding archived debt remains in the Home balance overview. |

Use a disposable group when checking saves, partial payments, acknowledgement or voiding. Do not record a payment as a way to initiate a real transfer.

## Interrupted expense saves

Expense creation is one authenticated database transaction: expense, reconciled split rows, activity and the existing alert are saved together. A browser-persisted UUID identifies the attempt. Unknown network responses retain the exact payload and FX quote across reloads; the form locks its details and offers **Retry original expense**. Retrying returns the original result rather than adding another expense or alert, even if the original expense was subsequently deleted. A definitive database rejection unlocks the retained entry for correction. Storage failures block sending a new request when its recovery key cannot be retained.

Normal drafts expire after 30 days. Uncertain submitted requests are kept until their result is resolved. Recovery is device/browser-specific, not cloud synchronization; clearing browser data removes it. Each account/group has a separate draft and request.

For a failure scenario in a disposable group, disconnect the browser network before submitting, restore connectivity, and retry. You should see one expense after confirmation. If the first response arrives but refreshing the group fails, the message still says the expense was saved.

## Verification

- `npm test`: 60 passing tests, including existing mobile flows, exact FX payload/rate propagation and database-consistent half-cent rounding, failure-blocked previews, draft remount/success/cancellation, recovered receipt assignments, uncertain expense retries with the same UUID/quote, payment recovery, archive, Activity and recap sharing.
- `npm run build`: production/PWA build passes.
- Rolled-back Supabase fixtures pass: `tests/activity-feed.sql`, `tests/personal-archive.sql`, `tests/payment-records.sql`, `tests/atomic-expenses.sql`, `tests/expense-corrections.sql`. They cover member/nonmember access, ownership, current payment balance, audit retention, consistent FX/splits, duplicate request rejection and atomic/idempotent saves. No real financial record was created or changed.
- Authenticated browser: real Activity and group navigation; recap/menu; payment details and correction reason form; draft recovery after closing/reloading; foreign-currency preview. At 390px the conversion preview has no horizontal overflow. Mutation/failure paths use fixture/component tests instead of real transfers.
- Mobile screen-reader behavior and a physical-device scan/transfer were not verified. Actual receipt scanning requires the Vercel API and credentials; Vite alone does not execute serverless functions.

## Deployment and database notes

Applied migrations include Activity, personal archive, payment safeguards/audit retention and `20261006094854_atomic_expense_creation.sql`. The request result table is private, has RLS and no browser table grants. Only authenticated, membership-checked RPCs can create requests; anonymous execution is revoked. The public wrappers use invoker security, with private functions handling the validated transaction.

**Deploy the matching frontend before using the production payment flow:** direct browser payment writes are disabled in favor of RPCs. Deploy the API changes too: deleted-item and clear-activity endpoints preserve payment history; existing Telegram balances exclude voided payments. Expense/payment alerts still queue once per record; no reminder schedule or toggle was added or changed. No deployment was performed in this task.

The security advisor reports an intentional informational [RLS-without-policies notice](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) for the private request table: browser roles have no table access and the private transaction function is its only writer. Existing helper-function grants/search-path and leaked-password-protection warnings remain outside this feature scope; see [function grant guidance](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable). The new public expense/payment wrappers do not introduce those warnings.

See [Admin roles and swipe deletion](ADMIN_AND_SWIPE_CHANGES.md) for the latest role permissions and mobile activity controls.
