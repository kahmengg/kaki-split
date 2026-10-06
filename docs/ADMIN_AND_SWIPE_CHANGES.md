# Admin roles and swipe deletion

Open a group locally, then its top-right menu → **Manage members**. The creator and existing admins can use **Make admin** or **Remove admin**, with confirmation. Members see a read-only **Group members** list. Existing members must join through the invite flow first: guest participants without accounts are still deferred.

| Action | Who can do it |
| --- | --- |
| Grant/revoke admin for an existing member | Creator or admin |
| Change the creator's ownership role | Nobody through this screen |
| Edit an expense | Its recorder, creator or admin |
| Delete an expense | Creator or admin |
| Void a mistaken payment, with a reason | Its recorder, creator or admin |
| Acknowledge receiving a payment | Its recipient only |
| Delete the entire group | Creator only |

In **Group → Activity**, swipe an expense left to reveal **Delete**, then tap it to open confirmation. Right swipe only closes an open row. Swiping alone never deletes. There is no extra action button or button below the row. Keyboard users focus the row and press Left Arrow to reveal the action; Escape closes it and returns focus. Vertical scrolling remains native. Eligible payment entries now swipe too, revealing **Delete** and opening the reason form to void the payment with retained history. Voided records retain their history and are excluded from balances.

Admin privileges include managing other admins. Removing an admin does not remove their membership. Role changes are audited, and the database rejects self-promotion by regular members. Expense deletion checks the revision, writes the deleted log and removes the expense in one transaction. Deleted logs retain the existing one-month expiry; they are not an undo feature.

Test permission changes in a disposable group with a second account: promote it, verify it can edit/delete an expense recorded by the creator, then revoke it and check that access disappears. The creator remains protected. No actual member role or financial record was altered for verification.

Verification includes component gesture/keyboard/role tests, caller-JWT API tests, rolled-back database permission fixtures and a production build. Live browser checks cover the management sheet and deletion reveal at 390px. Physical-device gesture and screen-reader checks remain unverified.

The database migrations are applied to the configured Supabase project. Frontend/API changes are local and require deployment for the hosted app.
