# Kaki Split: user story map and feature review

Reviewed: 5 October 2026. Scope: current local source, including the recent mobile UI changes.

## What this document is for

Use this to answer: **Can someone complete their shared-expense journey, understand what happened, and recover when something goes wrong?**

A **user story map** organizes features around the user's journey. A **feature inventory** records what exists. A **UX review** evaluates how well it supports the journey. This document combines all three. A PRD (product requirements document) would be useful later when specifying a particular change; it is not necessary to understand the current product. See Atlassian's explanations of [story mapping](https://www.atlassian.com/agile/product-management/story-mapping) and [user stories](https://www.atlassian.com/agile/project-management/user-stories).

This is a source-based product review, not usability research or confirmation that production integrations work. **Present** means there is an implementation; **Limited** means the implementation has a material constraint; **Proposed** means a suggested addition. The fit assessments are hypotheses to test with users. No application code was changed for this document.

## Product purpose and users

**Product promise:** Help friends share costs fairly, understand who owes whom, and settle with less coordination.

| User perspective | Main need | What success looks like |
| --- | --- | --- |
| Organizer / group creator | Set up a shared space and bring friends into it | Everyone joins the correct group and understands its currency |
| Member recording an expense | Record what was paid and who benefits | A correct split without unnecessary taps |
| Member who owes money | Understand and clear their balance | Correct recipient, amount, currency, and remaining balance |
| Member owed money | Know what to collect | Understand outstanding balances without misleading reminders |
| Returning member | Catch up quickly | Identify the relevant group and recent changes |

These are perspectives, not five separate account roles. One person can occupy several. The creator has additional deletion controls; some other group settings are available to members.

## The journey map

| Stage | User's question | Existing support | Main gap |
| --- | --- | --- | --- |
| 1. Get started | What is this app, and how do I join? | Google sign-in; invitation links | Invite does not preview the group before automatic joining |
| 2. Set up the group | Who is sharing, and in what currency? | Group creation, base currency, invite link, rename | Explain base currency at selection; clarify group permissions |
| 3. Record spending | Who paid, who participated, and how much? | Equal, exact, percentage, shared items, receipt scan, foreign currency | Corrections and interrupted drafts need a clearer recovery path |
| 4. Understand the result | Is the split correct, and what do I owe? | Group activity, balances, original/base amount display | More inspectable expense detail and FX explanation |
| 5. Settle | How do I pay and tell the group? | Suggested settlements, partial payments, PayNow QR, manual record | Recording is not bank verification; stale amounts and retries need validation |
| 6. Stay informed | What changed, and who needs a reminder? | Home, Activity, Telegram alerts/reminders | Activity and reminder labels overpromise their actual behavior |
| 7. Wrap up / manage | What did we spend, and can I leave? | Insights, recap route, deletion logs, account/group deletion | Recap discoverability; no visible leave/archive flow |

## Feature inventory and user stories

Read each story as: **As a [person], I want [capability], so that [benefit].** The review column is an assessment, not an assertion that the suggested change already exists. Replace `:id` with a group ID in page URLs.

### Getting started and setting up a group

| ID | User story | Where to see it | Current behavior / fit |
| --- | --- | --- | --- |
| S01 | As a new user, I want to sign in quickly so that I can join my friends. | `/login` | Present: Google sign-in. Simple entry; people without a suitable Google account have no alternative sign-in UI. |
| S02 | As an invited friend, I want my invitation preserved through sign-in so that I arrive in the right group. | `/join/:inviteCode` | Present: saves the pending invitation and joins after authentication. Limited: authenticated visitors automatically join without a group preview or explicit confirmation. |
| S03 | As an organizer, I want to create a named group so that related expenses stay together. | Home `/dashboard` → **+** | Present: group name and base currency. The Home creation action opens group creation directly. |
| S04 | As an organizer, I want a common accounting currency so that mixed-currency spending produces understandable balances. | Create group → currency selection | Present: group currency options SGD, USD, EUR, AUD, MYR, IDR. Explain its effect before creation; no visible later currency-change control. |
| S05 | As a member, I want to invite friends so that we share the same records. | Group `/groups/:id` → invite / group menu | Present: copies a join link. This is a link-led flow; a standalone manual invite-code entry screen was not found. |
| S06 | As a member, I want to recognize and rename my group so that I can find it later. | Home group cards; Group → **Edit group name** | Present: group members can rename; it is not creator-only. Make shared setting permissions clear. |

### Creating and splitting expenses

| ID | User story | Where to see it | Current behavior / fit |
| --- | --- | --- | --- |
| S07 | As a member, I want to add an expense within the selected group so that I cannot accidentally target another group. | Group → **+** | Present: opens Add Expense directly. Group subpages route back with the expense form open. Activity/Profile/global Insights use an Add chooser and group picker. |
| S08 | As a member, I want to enter an amount and description so that everyone understands the charge. | Add Expense | Present: prominent amount and description, validation, inline save failure. Good default path; verify with a real phone keyboard and long descriptions. |
| S09 | As a member, I want to choose the actual payer so that balances reflect who funded the expense. | Add Expense → **Paid by** | Present: selects a group member; the person recording and the payer may differ. Explain that distinction when needed. |
| S10 | As a member, I want to include only participants so that absent friends are not charged. | Add Expense → **Split between** | Present: participant selection and equal-share preview. Check that exclusions remain obvious when customizing. |
| S11 | As a member, I want to split equally so that ordinary meals are quick to record. | Add Expense, default split | Present: equal split. Strong core fit; cent rounding should remain understandable. |
| S12 | As a member, I want exact allocations so that unequal purchases are fair. | Add Expense → **Customize split** → Exact | Present: per-person amounts with shortfall/overage feedback. Allocation must reconcile with the total. |
| S13 | As a member, I want percentage allocations so that agreed proportions are supported. | Add Expense → Customize split → Percentage | Present: percentage split. Useful advanced option; verify total percentages and rounded results in review scenarios. |
| S14 | As a member, I want to assign shared items so that people pay for what they consumed. | Exact split → shared-item controls; receipt assignment | Present: item allocation with selected participants. Higher complexity; show the final per-person result clearly. |
| S15 | As a traveler, I want to enter the receipt currency so that I do not convert manually. | Add Expense → currency selector | Present: nine supported currencies, defaulting to group currency. Before saving, original/base totals, rate, source and quote date are shown. Older/stored quotes carry a notice; failed quotes block saving. The reviewed quote is used on save; original-currency corrections preserve the saved rate. Manual bank-rate entry remains outside scope. |
| S16 | As a member, I want to categorize expenses so that spending patterns are useful later. | Add Expense → optional details | Present: food, transport, accommodation, activities, other. Optional detail appropriately sits behind the main flow. |
| S17 | As a member, I want to scan a receipt so that item entry is faster. | Add Expense → optional receipt scan | Present, integration-dependent: editable merchant, items, totals and assignments with discrepancy review. Five processing attempts per account per Singapore day; unreadable images use an attempt, provider/parser failures return allowance. Manual entry remains available; Vite alone does not execute the scan API. |
| S18 | As a member, I want to avoid losing unfinished work so that interruptions do not make me start over. | Add Expense → close / reload / retry | Present: account/group-scoped drafts on this browser, including custom/shared splits and extracted receipt review. Normal drafts expire after 30 days. Unknown submitted saves retain the same UUID/payload/quote until resolved and retry atomically without duplication. Successful saves clear the draft; rejected/cancelled saves retain entries. No cross-device synchronization. |
| S19 | As a member, I want to correct a mistaken expense so that the ledger remains fair. | Expense → View details → Edit expense | Present: recorder/admin can correct the payer, amount, description, category, currency and allocations with revision checks and before/after history. Existing payments require confirmation. Other members can inspect details/history. Restoring deleted expenses remains outside scope. |

### Reviewing balances and settling

| ID | User story | Where to see it | Current behavior / fit |
| --- | --- | --- | --- |
| S20 | As a returning member, I want a balance overview so that I know where attention is needed. | Home `/dashboard` | Present: group cards and overview separated by currency. Good: unrelated currencies are not added into one meaningless total. |
| S21 | As a group member, I want clear settlement suggestions so that we need fewer transfers. | Group → **Your balances** | Present: simplified debtor/creditor balances, Pay actions, settled state. Explain that the suggested recipient can differ from the original payer because debts are netted. |
| S22 | As a member, I want to inspect expense and payment history so that I can check my balance. | Group → Activity → expense/payment details | Present: chronological expenses/payments, personal shares and original/base currency toggle. Details expose recorder, timestamp, allocations/FX or payment acknowledgement/void status and audited changes. Search/date filtering remains outside scope. |
| S23 | As a debtor, I want to pay the correct person so that I clear the right debt. | Group balance → Pay `/groups/:id/pay` | Present: payment details, copy/share support and SGD PayNow QR when a number is available. This does not itself execute or verify a bank transfer. |
| S24 | As a debtor, I want to record a partial payment so that the remaining debt stays accurate. | Pay → partial amount | Present: positive amount in group currency, checked against the current simplified balance and ledger snapshot in the database. Stale snapshots and overpayments are rejected. |
| S25 | As a payer or recipient, I want to record a completed payment so that the group ledger updates. | Group balance → Pay / Record received payment; payment → View details | Present: explicitly manual recording, atomic payment/activity/alert, browser-persisted request ID for uncertain retries, and optional recipient-only receipt acknowledgement. The recorder or admin can void a mistake with a reason, retained change history, and balance reversal. No bank verification is claimed. |
| S26 | As a creditor, I want friends to find my PayNow details so that reimbursement is easy. | `/profile` → PayNow number; Pay screen | Present: profile phone details used for SGD QR payments. Missing details and non-SGD groups require a clear alternative transfer path. |
| S27 | As a member, I want mistaken records corrected with accountability so that I can understand changes. | Expense → View details; payment → View details; menu → deleted logs | Present: recorder/admin corrections; mistaken payments are voided with a reason and retained audit history. Creator/admin expense deletion keeps deleted logs for one month. Whole-group deletion removes history for everyone. |

### Updates, insights and group lifecycle

| ID | User story | Where to see it | Current behavior / fit |
| --- | --- | --- | --- |
| S28 | As a returning member, I want recent updates across groups so that I can catch up. | `/activity` | Present: a paginated timeline of expense additions/corrections, payments and deleted logs, with group, actor, amount and time. Tap an entry to open its group. Older records without creation events appear once via a legacy fallback. Deleted logs expire after one month. |
| S29 | As a creditor, I want to remind a debtor so that I do not chase manually. | Home outstanding banner → **Nudge** | Limited: Nudge currently navigates to the group; it does not send a reminder. The group debt banner is derived from balances, not a verified reminder event. |
| S30 | As a group member, I want expense/payment alerts in our chat so that updates reach us naturally. | Group menu → **Connect Telegram** | Present, integration-dependent: link code, bot connection, expense/payment notification toggles, disconnect. Verify bot setup and delivery in the deployed environment. |
| S31 | As a group member, I want scheduled debt reminders so that settlement needs less coordination. | Telegram settings; bot `/alerts` commands | Present, integration-dependent: reminders plus chat commands for time, interval and timezone. UI says daily at midnight, but configured cron runs at 09:00 UTC every two calendar days. Delivery promises require reconciliation with actual scheduling. |
| S32 | As a member, I want to understand spending patterns so that I can reflect on the trip. | Insights `/insights` → choose group → `/groups/:id/insights` | Present: total, member shares, categories, charts. “Spend by person” primarily means allocated shares, not money paid. “Top expense” selects the latest expense; “Most active day” selects the latest expense date rather than the busiest day. |
| S33 | As a member, I want to share a recap so that friends can remember the trip. | Group menu → Trip Summary `/groups/:id/summary` | Present: text recap with currency, total, expense/member count and recorded expense period. Copy text copies independently; Share uses native sharing or falls back to copying. Recorded dates describe ledger entries, not inferred travel dates. |
| S34 | As a member, I want to archive a finished group so that Home stays relevant. | Group menu → Archive group for me; Home → Archived | Present: account-specific archive/restore, with shared history and debt preserved. Balance overview includes archived debt. Leaving a group remains deferred pending debt rules. |
| S35 | As a creator, I want to delete an unwanted group so that its records are removed. | Group menu → **Delete group** | Present: creator-only destructive action with confirmation, affects everyone. Not equivalent to leaving or personal archiving. |

### Personal settings and access

| ID | User story | Where to see it | Current behavior / fit |
| --- | --- | --- | --- |
| S36 | As a member, I want a recognizable name/photo so that others identify me correctly. | `/profile` | Present: display name, avatar upload/removal, Save changes. Verify that upload versus saved profile state is clear. |
| S37 | As a user, I want a comfortable appearance so that the app works in different lighting. | Theme toggle on supported pages | Present: light/dark appearance. Review contrast in both themes rather than relying on the light theme alone. |
| S38 | As a user with access needs, I want operable controls so that I can complete the same journeys. | Navigation, forms, sheets, notifications | Present improvements: named controls, form labels, focus styles, native dialogs, larger targets, reduced motion and announced toasts. Full accessibility remains unverified; some Insights/Summary icon buttons lack accessible names. |
| S39 | As a frequent mobile user, I want quick access from my home screen so that recording is convenient. | Browser installation; app update prompt | Present: installable PWA, static asset caching, Update now / Later; Android Capacitor project. Expense data, sign-in and scanning require internet. Installation and native distribution need device/deployment verification. |
| S40 | As a user, I want help and policy information so that I understand the service. | Profile support; `/terms`, `/privacy`, `/account-deletion`, `/child-safety` | Present: support email and public information pages. Existence of policy pages does not confirm implementation compliance. |
| S41 | As a user, I want to sign out or delete my account so that I control my access and personal data. | Profile → sign out / delete account | Present: deletion confirmation explains removal of login/personal details while existing shared expenses remain. Test how former members are represented and how group ownership is handled. |

## Currency: the rule users should understand

**Expense currency describes the purchase; base currency describes the group's accounting.**

Example: a group uses SGD. A member enters MYR 100. If the selected conversion quote is 0.30 SGD per MYR, the app saves SGD 30 for balances; an equal split between two people is SGD 15 each. MYR 100 and the conversion metadata remain associated with the expense. Later exchange-rate changes do not automatically reprice that saved expense. Payments and insights use the group's base currency.

The rate can come from cached/stored quotes or provider fallbacks. It is not guaranteed to equal a bank/card rate. A useful future review screen would show the original total, converted total, rate and date before saving, including a warning when a fallback quote is old. This example is illustrative, not a live exchange-rate quote.

## Prioritized review findings (historical)

The accepted implementation is now covered by [the remaining-feature test guide](REMAINING_FEATURES.md) and [the first-three change guide](FIRST_THREE_CHANGES.md). The findings below record the original review rationale; they are not a list of still-missing features. Telegram reminder changes, guest participants, debt-aware leaving and manual bank-rate entry remain deferred.

Priority means recommended order, not a confirmed engineering severity. Address trust and core recovery before expanding the feature set.

| Priority | Finding and user impact | Recommended outcome | Acceptance check |
| --- | --- | --- | --- |
| 1 | Insights labels claim calculations the code does not perform. Users can draw incorrect conclusions. | Compute largest expense and busiest day correctly, or rename them to latest expense / latest expense date. Label member figures as allocated spending. Pass group currency to chart tooltips. | A smaller newest expense must not become the largest; a day with more expenses must win the busiest-day calculation. Non-SGD tooltips must retain the correct currency. |
| 1 | Nudge only navigates; balance-derived copy claims another member is reminding the user. | Rename to View group and use neutral debt copy, or implement an explicit reminder action with delivery state. | No wording claims a person sent a reminder unless a real reminder event exists. |
| 1 | Telegram timing promise differs from the cron configuration. | Agree a supported schedule; align UI, stored settings, dispatcher and deployment trigger. | A configured reminder arrives within the promised window in the intended timezone; expense/payment alert latency is also measured. |
| 1 | Correcting an expense requires creator deletion and recreation. | Specify edit permissions and an auditable correction path; consider undo for accidental deletion. | A member can understand how to fix the wrong payer, total or participants without silently rewriting shared history. |
| 1 | A successful ledger record can be mistaken for verified payment. | Keep explicit manual-record wording; validate current balances and duplicate-safe retries. | Recording does not claim bank verification; a network retry cannot create two payments; changed balances are handled clearly. |
| 2 | FX result and fallback age are not obvious before commitment. | Show a conversion preview and rate/date; decide whether manual actual-rate entry is needed. | A traveler can explain how the original amount became the settlement amount before saving. |
| 2 | Draft protection does not cover reload/navigation/app termination. | Recover a local draft or clearly warn before supported exit paths. | An interrupted expense can be resumed without duplicate saving. Define device-only versus cross-device scope. |
| 2 | Activity's description suggests an event feed. | Rename the screen to match group summaries, or create a real event list with group context. | A user can identify which expense/payment changed and open its group with one clear action. |
| 2 | Trip Summary is difficult to discover and Copy text can open Share. | Add a visible group entry; separate copy from share; label text/image output accurately. | Both actions work as labeled on devices with and without native sharing. The recap period is accurate. |
| 2 | Accessibility improvements are incomplete and have not been tested on devices. | Audit complete journeys with keyboard, screen reader, zoom, both themes and a mobile keyboard. | Every actionable icon has a name; focus remains visible; errors are announced; no field or submit action is hidden by the keyboard. |
| 3 | Invite automatic joining and broad member settings may surprise users. | Consider a safe invite preview and document who can change shared settings. | Users know which group they are joining and who can rename/configure/delete it. |
| 3 | Finished groups accumulate, but deletion affects everyone. | Introduce personal archive first if clutter is observed; specify leaving with debt separately. | Hiding a group does not remove other members' records or change balances. |

Items involving payment retries, ownership after account deletion, production schedules and access controls need focused validation; this review does not establish an exploit or prove the integrations are broken in production.

## Walkthroughs to evaluate whether the features make sense

Use test accounts and fictional receipts. These are **acceptance scenarios to run**, not reported passing tests.

| Scenario | Steps / expected outcome | Stories exercised |
| --- | --- | --- |
| Ordinary dinner | Create SGD group; invite a second account; add SGD 60 paid by A, split equally. B sees SGD 30 owed. B records SGD 10, then SGD 20; balance clears and history remains understandable. | S01–S03, S05, S07–S11, S20–S25 |
| Unequal participation | Three members; one did not attend. Exclude them, then assign unequal amounts to the other two. Allocations reconcile; absent member owes nothing. | S09–S14 |
| Overseas trip | SGD group; save a MYR expense. Check original and converted totals, shares and rate metadata. Enter another currency; all group settlement figures remain SGD. | S04, S15, S20–S24 |
| Receipt uncertainty | Scan a fictional receipt with shared food, charges and a discount. Correct extraction and resolve any total discrepancy; compare with manual entry. Exhaust quota and confirm manual entry remains usable. | S12, S14, S17 |
| Mistake and interruption | Use wrong payer, then attempt to correct. Fail a save, dismiss a dirty form, reload with a draft, and retry after a slow response. Document what is preserved and what requires recovery. | S08, S18, S19, S25, S27 |
| Returning user | With several groups, find the latest changed expense from Activity. Try Nudge and ask what the user expects it to do. | S20, S22, S28, S29 |
| Trip recap | Create a large old expense and small new expense on different days; inspect Insights labels. Find Trip Summary without typing its URL; try copy and share on a phone. | S32, S33 |
| Chat notifications | Link a test Telegram group; toggle each alert type, set a reminder time/interval, record expense/payment and check actual delivery time. | S30, S31 |
| Mobile accessibility | Complete dinner entry and settlement at a narrow viewport, 200% zoom, with keyboard only and a screen reader; repeat in dark mode and with reduced motion. | S07–S13, S23–S25, S38 |
| Group lifecycle | Compare regular-member and creator menus. Delete an item and inspect its log. Test account deletion using disposable accounts, including a creator with outstanding balances. | S06, S27, S34, S35, S41 |

For each walkthrough record: **completed? confusing step? incorrect result? recovery possible? improvement worth making?** Observe a few people unfamiliar with the app before assuming a feature is intuitive. Ask “What do you expect this button to do?” before they tap, rather than explaining it first.

## Decisions to make before adding more features

1. Is the primary audience Singapore meals, overseas trips, or both? This affects FX transparency, PayNow emphasis and receipt complexity.
2. Who may correct expenses and configure chat notifications: everyone, recorder, payer, or creator? Make permissions intentional and understandable.
3. Is payment recording sufficient, or do users need recipient acknowledgement? Bank verification is a separate product capability.
4. Does Activity need to be a true event feed, or is a group overview enough?
5. Is archiving needed more than new analytics? Test recurring-group users before prioritizing it.
6. Should invitation links grant immediate membership, or preview and confirm first? Consider forwarded links and invite revocation as future access decisions.

## Practical next steps and measures

Start with one small backlog covering the priority-1 findings, then validate the dinner and overseas-trip journeys. You do not need a new project-management tool to start: story IDs and GitHub issues are enough. For implementation, turn one story into explicit acceptance criteria and a focused technical plan.

Useful measures, if collected with appropriate privacy controls: first-group/first-expense completion, time to save an ordinary expense, validation failures, scan-to-confirm success, duplicate records, and settlement-record completion. Choose a baseline through observation; no targets or current performance figures are assumed here. Avoid recording receipt contents, phone numbers or expense descriptions in analytics.

The project already uses TanStack Query for shared data fetching/caching and lazy routes. A meaningful next quality tool is automated accessibility checking (for example [axe-core](https://www.deque.com/axe/core-documentation/) integrated with browser tests), combined with actual phone/screen-reader walkthroughs. Automated checks alone cannot establish usability or full accessibility. Production error reporting would also help distinguish user confusion from failed saves or unavailable integrations.

## Evidence and maintenance

Main evidence: [routes](../src/App.jsx), [Home](../src/pages/Dashboard.jsx), [navigation](../src/components/BottomNav.jsx), [invitation flow](../src/pages/JoinInvite.jsx), [group screen](../src/pages/GroupHome.jsx), [expense form](../src/pages/QuickSplit.jsx), [receipt assignment](../src/components/ReceiptAssigner.jsx), [payments](../src/pages/Pay.jsx), [profile](../src/pages/Profile.jsx), [Activity](../src/pages/Activity.jsx), [Insights](../src/pages/Insights.jsx), [Trip Summary](../src/pages/TripSummary.jsx), [FX and insights calculations](../src/lib/kakiSplitApi.js), [member rename permission](../api/groups/update-name.js), [receipt quota API](../api/scan-receipt.js), [deployment schedule](../vercel.json), and [installation/integration documentation](../README.md).

Keep this map current when behavior changes. Update the affected story, page location and constraints; do not mark a proposed feature Present until implemented. Keep delivery verification and user-research results separate from source observations. Existing security findings live in [SECURITY_AUDIT.md](SECURITY_AUDIT.md); this document does not replace a security review.
