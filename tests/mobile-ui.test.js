import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { JSDOM } from 'jsdom'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import React, { act } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

// Run interactive components without contacting Auth, receipt APIs, or a database.
const dom = new JSDOM('<!doctype html><html><body><button id="trigger">Open</button><div id="root"></div></body></html>', { url: 'http://localhost/' })
for (const key of ['window', 'document', 'HTMLElement', 'HTMLDialogElement', 'Event', 'MouseEvent', 'localStorage', 'MutationObserver']) globalThis[key] = dom.window[key]
globalThis.IS_REACT_ACT_ENVIRONMENT = true
dom.window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); this.querySelector('button')?.focus() }
dom.window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
const { createRoot } = await import('react-dom/client')
const directory = 'output/ui-tests'
await mkdir(directory, { recursive: true })

async function component(name) {
  const result = await build({
    entryPoints: [`src/${name}.jsx`], bundle: true, write: false, format: 'esm', platform: 'node', packages: 'external',
    plugins: [{ name: 'receipt-test-double', setup(builder) {
      builder.onResolve({ filter: /useReceiptScanner$/ }, () => ({ path: 'scanner', namespace: 'test' }))
      builder.onResolve({ filter: /useAuth$/ }, () => ({ path: 'auth', namespace: 'test' }))
      builder.onResolve({ filter: /useAppQueries$/ }, () => ({ path: 'queries', namespace: 'test' }))
      builder.onResolve({ filter: /useRealtimeRefresh$/ }, () => ({ path: 'realtime', namespace: 'test' }))
      builder.onResolve({ filter: /kakiSplitApi$/ }, () => ({ path: 'api', namespace: 'test' }))
      builder.onResolve({ filter: /\/Toast$/ }, () => ({ path: 'toast', namespace: 'test' }))
      builder.onResolve({ filter: /useTheme$/ }, () => ({ path: 'theme', namespace: 'test' }))
      builder.onLoad({ filter: /.*/, namespace: 'test' }, (args) => ({ contents: {
        scanner: 'export function useReceiptScanner() { return { scanning:false, error:null, quota:null, setError() {}, scanReceipt:async () => null } }',
        auth: 'export const useAuth = () => ({user:{id:"a",email:"alice@example.com"}})',
        queries: 'export const useDashboardData = () => globalThis.__dashboardQuery; export const useGroupData = () => globalThis.__groupQuery; export const useInsightsData = () => globalThis.__insightsQuery; export const useActivityData = () => globalThis.__activityQuery; export const useAppQueryInvalidation = () => ({invalidateGroup:async()=>{},invalidateDashboard:async()=>{}})',
        toast: 'export const useToast = () => globalThis.__showToast || (()=>{})',
        theme: 'export const useTheme = () => ({ theme:"light", toggleTheme(){} })',
        realtime: 'export function useGroupRealtime(){} export function useDashboardRealtime(){}',
        api: 'export async function setGroupMemberRole(input){return globalThis.__setGroupMemberRole(input)} export async function fetchExpenseQuote(input){return globalThis.__fetchExpenseQuote(input)} export async function recordPayment(input){return globalThis.__recordPayment?.(input)} export async function createGroup(){} export async function fetchExpenseHistory(){return globalThis.__expenseHistory || []} export async function setGroupArchived(input){return globalThis.__setGroupArchived(input)} export async function addExpense(){} export async function createTelegramLinkToken(){} export async function deleteGroup(){} export async function deleteGroupActivityItem(){} export async function disconnectTelegramConnection(){} export async function fetchDeletedActivityLogs(){} export async function fetchGroupData(){} export async function fetchTelegramLinkToken(){} export async function updateGroupName(){} export async function updateExpense(){} export async function updateTelegramSettings(){} export async function changePayment(input){return globalThis.__changePayment?.(input)} export async function fetchPaymentHistory(){return globalThis.__paymentHistory || []}',
      }[args.path] }))
    } }],
  })
  const file = `${directory}/${name.replaceAll('/', '-')}.mjs`
  await writeFile(file, result.outputFiles[0].text)
  return (await import(`../${file}`)).default
}
const QuickSplit = await component('pages/QuickSplit')
const ReceiptAssigner = await component('components/ReceiptAssigner')
const BottomSheet = await component('components/BottomSheet')
const Toast = await component('components/Toast')
const BottomNav = await component('components/BottomNav')
const Pay = await component('pages/Pay')
const ExpenseDetails = await component('components/ExpenseDetails')
const TripSummary = await component('pages/TripSummary')
const Activity = await component('pages/Activity')
const Dashboard = await component('pages/Dashboard')
const GroupHome = await component('pages/GroupHome')
const PaymentDetails = await component('components/PaymentDetails')
const SwipeDeleteRow = await component('components/SwipeDeleteRow')
const GroupMembers = await component('components/GroupMembers')
const members = [{ id: 'a', display_name: 'Alice' }, { id: 'b', display_name: 'Bob' }]
let root
test.beforeEach(() => { root = createRoot(document.getElementById('root')) })
test.afterEach(async () => { await act(async () => root.unmount()) })
test.after(async () => { await rm(directory, { recursive: true, force: true }); dom.window.close() })
const render = async (Component, props) => act(async () => root.render(React.createElement(Component, props)))
const click = async (element) => act(async () => element.click())
const input = async (element, value) => act(async () => {
  // Use the native setter so React receives a user-like change event.
  Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(element, value)
  element.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
})
const submit = async () => act(async () => document.querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })))
const button = (text) => [...document.querySelectorAll('button')].find((element) => element.textContent.trim() === text)

test('expense draft survives remount and clears only after a successful save', async () => {
  const props = { members, currentUserId: 'a', groupId: 'draft-test', onSubmit: async () => { throw Error('Offline') } }
  try {
    await render(QuickSplit, props)
    await input(document.getElementById('expense-amount'), '24')
    await input(document.getElementById('expense-description'), 'Recovered lunch')
    await act(async () => root.unmount())
    root = createRoot(document.getElementById('root'))
    await render(QuickSplit, props)
    assert.equal(document.getElementById('expense-amount').value, '24')
    assert.equal(document.getElementById('expense-description').value, 'Recovered lunch')
    assert.match(document.body.textContent, /Draft restored/)
    await submit()
    assert.match(document.body.textContent, /Offline/)
    assert.ok(localStorage.getItem('kaki:expense-draft:v1:a:draft-test:new:0'))
    await render(QuickSplit, { ...props, onSubmit: async () => false })
    await submit()
    assert.ok(localStorage.getItem('kaki:expense-draft:v1:a:draft-test:new:0'))
    await render(QuickSplit, { ...props, onSubmit: async () => ({ id: 'saved' }) })
    await submit()
    assert.equal(localStorage.getItem('kaki:expense-draft:v1:a:draft-test:new:0'), null)
  } finally { localStorage.removeItem('kaki:expense-draft:v1:a:draft-test:new:0'); localStorage.removeItem('kaki:expense-request:v1:a:draft-test') }
})

test('creditor can discover payment recording from their group balance', async () => {
  globalThis.__groupQuery = { data: { group:{id:'g',name:'Dinner',base_currency:'SGD',created_by:'b',total_spent:20}, members, usersById:Object.fromEntries(members.map(member=>[member.id,member])), expenses:[],payments:[],smartBalances:[{from:'b',to:'a',amount:10}] } }
  await act(async () => root.render(React.createElement(MemoryRouter,{initialEntries:['/groups/g']},React.createElement(Routes,null,
    React.createElement(Route,{path:'/groups/:id',element:React.createElement(GroupHome)}),
    React.createElement(Route,{path:'/groups/:id/pay',element:React.createElement('p',null,'Incoming payment recording')})))))
  await click(button('Record received payment'))
  assert.match(document.body.textContent,/Incoming payment recording/)
})

test('uncertain payment retries the exact request after reload even when balance is now zero', async () => {
  const calls = []
  let fail = true
  globalThis.__recordPayment = async payload => { calls.push(payload); if (fail) throw new Error('Network request failed'); return { id:'p' } }
  globalThis.__groupQuery = { data: { group:{ id:'g', name:'Dinner', base_currency:'USD', ledger_revision:4 }, smartBalances:[{from:'a',to:'b',amount:10}], usersById:{a:members[0],b:members[1]} } }
  const Wrapper = () => React.createElement(MemoryRouter, {initialEntries:['/groups/g/pay?from=a&to=b&amount=20']}, React.createElement(Routes,null,React.createElement(Route,{path:'/groups/:id/pay',element:React.createElement(Pay)})))
  try {
    await render(Wrapper,{})
    assert.match(document.body.textContent,/balance has changed/)
    await click(button('Record payment · USD 10.00'))
    await click(button('Confirm record'))
    assert.equal(calls.length,1)
    assert.ok(button('Retry original record'))
    await act(async () => root.unmount())
    root = createRoot(document.getElementById('root'))
    globalThis.__groupQuery = { ...globalThis.__groupQuery, data:{ ...globalThis.__groupQuery.data, group:{...globalThis.__groupQuery.data.group,ledger_revision:5}, smartBalances:[] } }
    fail = false
    await render(Wrapper,{})
    await click(button('Retry original record'))
    await click(button('Confirm record'))
    assert.equal(calls.length,2)
    assert.deepEqual(calls[1],calls[0])
    assert.match(document.body.textContent,/Payment recorded/)
    assert.equal(localStorage.getItem('kakisplit:payment-request:a:g:a:b'),null)
  } finally { delete globalThis.__recordPayment; localStorage.removeItem('kakisplit:payment-request:a:g:a:b') }
})

test('recipient can acknowledge; recorder can void with a reason; other members have neither control', async () => {
  const changes = []
  const payment = {id:'p',group_id:'g',created_by:'b',from_user_id:'b',to_user_id:'a',amount:10,created_at:'2026-10-06T00:00:00Z',revision:0}
  const props = { payment, group:{created_by:'b',base_currency:'SGD'}, usersById:Object.fromEntries(members.map(member=>[member.id,member])), currentUserId:'a', onChange:async change=>changes.push(change) }
  await render(PaymentDetails,props)
  assert.ok(button('Acknowledge receipt'))
  assert.equal(button('Correct a mistaken record'),undefined)
  await click(button('Acknowledge receipt'))
  assert.equal(changes[0].action,'acknowledge')
  await render(PaymentDetails,{...props,currentUserId:'b'})
  assert.equal(button('Acknowledge receipt'),undefined)
  await click(button('Correct a mistaken record'))
  assert.equal(button('Void this record').disabled,true)
  await act(async () => {
    const field=document.getElementById('payment-void-reason')
    Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype,'value').set.call(field,'Wrong amount')
    field.dispatchEvent(new dom.window.Event('input',{bubbles:true}))
  })
  await click(button('Void this record'))
  assert.equal(changes[1].reason,'Wrong amount')
  await render(PaymentDetails,{...props,currentUserId:'c'})
  assert.equal(button('Acknowledge receipt'),undefined)
  assert.equal(button('Correct a mistaken record'),undefined)
  await render(PaymentDetails,{...props,payment:{...payment,voided_at:'2026-10-06',voided_by:'b',void_reason:'Wrong amount'}})
  assert.match(document.body.textContent,/excluded from balances/i)
})

test('Home separates active/archived groups while retaining archived debt in overview', async () => {
  globalThis.__dashboardQuery = { data: { groups: [
    { id: 'g', name: 'Active dinner', member_ids: [], my_balance: 0, total_spent: 0, base_currency: 'SGD', created_at: '2026-10-06T00:00:00Z' },
    { id: 'old', name: 'Archived trip', is_archived: true, member_ids: [], my_balance: -30, total_spent: 60, base_currency: 'USD', created_at: '2026-10-06T00:00:00Z' },
  ], usersById: {} } }
  await act(async () => root.render(React.createElement(MemoryRouter, null, React.createElement(Dashboard))))
  assert.match(document.body.textContent, /USD 30.00/)
  assert.match(document.body.textContent, /Active dinner/)
  assert.doesNotMatch(document.body.textContent, /Archived trip/)
  await click(button('Archived (1)'))
  assert.match(document.body.textContent, /Archived trip/)
  assert.doesNotMatch(document.body.textContent, /Active dinner/)
  assert.match(document.body.textContent, /USD 30.00/)
  assert.equal(button('Archived (1)').getAttribute('aria-pressed'), 'true')
})

test('archive failure allows retry; successful archive can be restored without changing balances', async () => {
  const calls = []
  let fail = true
  globalThis.__setGroupArchived = async payload => { calls.push(payload); if (fail) throw new Error('Offline'); return {} }
  globalThis.__groupQuery = { data: { group: { id: 'g', name: 'Archive test', base_currency: 'SGD', created_by: 'b', total_spent: 20 }, members, usersById: Object.fromEntries(members.map(member => [member.id, member])), expenses: [], payments: [], smartBalances: [{ from: 'a', to: 'b', amount: 10 }] } }
  await act(async () => root.render(React.createElement(MemoryRouter, { initialEntries: ['/groups/g'] }, React.createElement(Routes, null, React.createElement(Route, { path: '/groups/:id', element: React.createElement(GroupHome) })))))
  await click(document.querySelector('[aria-label="Group actions"]'))
  await click(button('Archive group for me'))
  assert.match(document.body.textContent, /Archiving does not settle/)
  await click(button('Archive for me'))
  assert.ok(button('Archive for me'))
  fail = false
  await click(button('Archive for me'))
  assert.equal(document.querySelector('dialog[open]'), null)
  await click(document.querySelector('[aria-label="Group actions"]'))
  await click(button('Restore group to Active'))
  await click(button('Restore to Active'))
  assert.deepEqual(calls.map(call => call.archived), [true, true, false])
  assert.ok(calls.every(call => call.groupId === 'g' && call.userId === 'a'))
  assert.match(document.body.textContent, /SGD 10.00/)
  delete globalThis.__setGroupArchived
})

test('Activity opens the event group and loads older updates; errors do not claim an empty feed', async () => {
  let loaded = 0
  let retried = 0
  globalThis.__dashboardQuery = { data: { groups: [] } }
  globalThis.__activityQuery = { data: { pages: [{ rows: [{ id: 'event:a', group_id: 'g', group_name: 'Dinner group', actor_name: 'Bob', event_type: 'expense_updated', payload: { description: 'Taxi', amount: 20 }, base_currency: 'USD', created_at: '2026-10-06T00:00:00Z' }] }] }, hasNextPage: true, fetchNextPage: () => loaded++, refetch: () => retried++ }
  await act(async () => root.render(React.createElement(MemoryRouter, { initialEntries: ['/activity'] }, React.createElement(Routes, null,
    React.createElement(Route, { path: '/activity', element: React.createElement(Activity) }),
    React.createElement(Route, { path: '/groups/:id', element: React.createElement('p', null, 'Opened event group') })))))
  assert.match(document.body.textContent, /Corrected expense: Taxi/)
  assert.match(document.body.textContent, /USD 20.00/)
  await click(button('Load older activity'))
  assert.equal(loaded, 1)
  await click([...document.querySelectorAll('button')].find(element => element.textContent.includes('Corrected expense: Taxi')))
  assert.match(document.body.textContent, /Opened event group/)
  globalThis.__activityQuery = { error: new Error('offline'), refetch: () => retried++ }
  await act(async () => root.render(React.createElement(MemoryRouter, null, React.createElement(Activity))))
  assert.match(document.querySelector('[role="alert"]').textContent, /Unable to load activity/)
  assert.doesNotMatch(document.body.textContent, /No activity yet/)
  await click(button('Try again'))
  assert.equal(retried, 1)
})

test('recap Copy never opens native Share, while Share uses the same text', async () => {
  const shared = []
  const copied = []
  const notices = []
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  globalThis.__showToast = (...args) => notices.push(args)
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
    share: async payload => shared.push(payload), clipboard: { writeText: async text => copied.push(text) },
  } })
  globalThis.__insightsQuery = { isLoading: false, data: { group: { id: 'g', name: 'Weekend', base_currency: 'SGD' }, members, totalSpend: 20, expenses: [{ created_at: '2025-01-01T00:00:00Z' }], byCategory: [] } }
  try {
    await act(async () => root.render(React.createElement(MemoryRouter, { initialEntries: ['/groups/g/summary'] }, React.createElement(Routes, null, React.createElement(Route, { path: '/groups/:id/summary', element: React.createElement(TripSummary) })))))
    assert.match(document.body.textContent, /Recorded: 1 Jan 2025/)
    assert.ok(document.querySelector('[aria-label="Back to group"]'))
    await click(button('Copy text'))
    assert.equal(shared.length, 0)
    assert.equal(copied.length, 1)
    await click(button('Share'))
    assert.equal(shared[0].text, copied[0])
    navigator.share = undefined
    await click(button('Share'))
    assert.equal(copied.length, 2)
    navigator.share = async () => { throw Object.assign(new Error('cancel'), { name: 'AbortError' }) }
    await click(button('Share'))
    assert.equal(notices.filter(([, type]) => type === 'error').length, 0)
    navigator.share = async () => { throw new Error('failed') }
    await click(button('Share'))
    assert.match(notices.at(-1)[0], /Try Copy text/)
  } finally {
    if (original) Object.defineProperty(globalThis, 'navigator', original)
    else delete globalThis.navigator
    delete globalThis.__showToast
  }
})

test('expense defaults show labels, group currency, and collapsed advanced controls', async () => {
  await render(QuickSplit, { members, currentUserId: 'a', baseCurrency: 'USD', onSubmit() {} })
  assert.equal(document.querySelector('label[for="expense-amount"]').textContent, 'Amount')
  assert.ok(document.querySelector('[aria-label="Change currency, currently USD"]'))
  assert.equal(document.getElementById('custom-split').hidden, true)
  assert.equal(document.querySelector('[role="alert"]'), null)
  assert.notEqual(document.activeElement.id, 'expense-amount')
  await click(button('Customize split'))
  assert.equal(document.getElementById('custom-split').hidden, false)
})

test('editing starts with the saved payer and allocations and submits a correction', async () => {
  let payload
  let draft
  await render(QuickSplit, { members, currentUserId: 'a', baseCurrency: 'SGD', initialValues: {
    amount: '20', description: 'Taxi', paidBy: 'b', category: 'transport', currency: 'SGD',
    splitType: 'exact', splitMembers: ['a', 'b'], splitValues: { a: '8', b: '12' },
  }, onDraftChange: (value) => { draft = value }, onSubmit: async (value) => { payload = value } })
  assert.equal(document.getElementById('expense-amount').value, '20')
  assert.equal(document.getElementById('expense-description').value, 'Taxi')
  assert.equal(document.querySelector('[data-paid-by="b"]').getAttribute('aria-pressed'), 'true')
  assert.match(document.querySelector('button[type="submit"]').textContent, /Save correction/)
  assert.equal(draft.dirty, false)
  await input(document.getElementById('expense-description'), 'Airport taxi')
  assert.equal(draft.dirty, true)
  await submit()
  assert.equal(payload.description, 'Airport taxi')
  assert.equal(payload.paid_by, 'b')
  assert.deepEqual(payload.split_values, { a: '8.00', b: '12.00' })
})

test('receipt rounding never charges a member who was not assigned an item', async () => {
  let payload
  await render(ReceiptAssigner, { members: [...members, { id: 'c', display_name: 'Cara' }], receipt: { total: 1.01, currency: 'SGD', tax: 0.01, items: [{ id: 'food', name: 'Food', amount: 1 }] }, onConfirm: (value) => { payload = value }, onCancel() {} })
  await click(document.querySelector('[aria-label="Alice, Food"]'))
  await click(document.querySelector('[aria-label="Bob, Food"]'))
  await click(button('Use these splits'))
  assert.equal(payload.splits.find((value) => value.memberId === 'c').amount, 0)
  assert.equal(payload.splits.reduce((sum, value) => sum + Math.round(value.amount * 100), 0), 101)
})

test('receipt scanning remains optional and explains allowance before upload', async () => {
  await render(QuickSplit, { members, currentUserId: 'a', onSubmit() {} })
  const disclosure = [...document.querySelectorAll('summary')].find((element) => element.textContent.includes('itemized receipt'))
  assert.ok(disclosure)
  assert.equal(disclosure.parentElement.open, false)
  assert.match(disclosure.parentElement.textContent, /Service failures do not use/)
  assert.match(disclosure.parentElement.textContent, /Google/)
})

test('expense details show allocations and history; ordinary members cannot edit', async () => {
  globalThis.__expenseHistory = [{ id: 'h', actor_user_id: 'b', revision: 1, created_at: '2026-10-05T01:00:00Z',
    before_snapshot: { expense: { description: 'Lunch', amount: 20, paid_by: 'b' }, splits: [] },
    after_snapshot: { expense: { description: 'Dinner', amount: 30, paid_by: 'b' }, splits: [] } }]
  const expense = { id: 'e', description: 'Dinner', amount: 30, paid_by: 'b', created_by: 'b', revision: 1, splits: [{ user_id: 'a', amount: 12 }, { user_id: 'b', amount: 18 }] }
  const props = { expense, group: { created_by: 'b', base_currency: 'SGD' }, members, usersById: Object.fromEntries(members.map(value => [value.id, value])), currentUserId: 'a', onSave() {} }
  await render(ExpenseDetails, props)
  assert.match(document.body.textContent, /SGD 12.00/)
  assert.match(document.body.textContent, /Bob/)
  assert.match(document.body.textContent, /Lunch/)
  assert.equal(button('Edit expense'), undefined)
  await render(ExpenseDetails, { ...props, currentUserId: 'b' })
  await click(button('Edit expense'))
  assert.equal(document.getElementById('expense-description').value, 'Dinner')
})

test('equal split submits once, while participant controls never submit the form', async () => {
  const payloads = []
  await render(QuickSplit, { members, currentUserId: 'a', onSubmit: async (payload) => payloads.push(payload) })
  await input(document.getElementById('expense-amount'), '24')
  await input(document.getElementById('expense-description'), 'Dinner')
  await click(button('Customize split'))
  assert.equal(payloads.length, 0)
  await submit()
  assert.equal(payloads.length, 1)
  assert.equal(payloads[0].amount, 24)
  assert.equal(payloads[0].description, 'Dinner')
  assert.equal(payloads[0].split_type, 'equal')
  assert.deepEqual(payloads[0].split_members, ['a', 'b'])
})

test('invalid submission focuses the missing field and provides actionable feedback', async () => {
  let called = false
  await render(QuickSplit, { members, currentUserId: 'a', onSubmit: () => { called = true } })
  await submit()
  assert.equal(document.activeElement.id, 'expense-amount')
  assert.match(document.querySelector('[role="alert"]').textContent, /valid amount/)
  await input(document.getElementById('expense-amount'), '10')
  await submit()
  assert.equal(document.activeElement.id, 'expense-description')
  assert.match(document.querySelector('[role="alert"]').textContent, /description/)
  assert.equal(called, false)
})

test('exact split explains the remaining allocation and announces selections', async () => {
  await render(QuickSplit, { members, currentUserId: 'a', onSubmit() {} })
  await input(document.getElementById('expense-amount'), '20')
  await input(document.getElementById('expense-description'), 'Dinner')
  await click(button('Customize split'))
  await click(button('Exact'))
  assert.equal(button('Exact').getAttribute('aria-pressed'), 'true')
  await input(document.querySelector('[aria-label="Alice, amount"]'), '5')
  await submit()
  assert.match(document.getElementById('expense-feedback').textContent, /Allocate SGD 5.00 more/)
})

test('receipt differences require acknowledgement and preview matches submitted amounts', async () => {
  let payload
  await render(ReceiptAssigner, { members, receipt: { total: 15, currency: 'SGD', items: [{ id: 'meal', name: 'Meal', amount: 10 }] }, onConfirm: (value) => { payload = value }, onCancel() {} })
  await click(document.querySelector('[aria-label="Alice, Meal"]'))
  assert.equal(button('Use these splits').disabled, true)
  assert.match(document.body.textContent, /differs.*SGD 5.00/)
  await click(document.querySelector('input[type="checkbox"]'))
  assert.equal(button('Use these splits').disabled, false)
  await click(button('Use these splits'))
  assert.equal(payload.splits.find((split) => split.memberId === 'a').amount, 15)
  assert.equal(payload.amount, 15)
})

test('sheet checks draft dismissal, labels its dialog, and restores focus', async () => {
  let closed = 0
  let allowClose = false
  const trigger = document.getElementById('trigger')
  trigger.focus()
  const props = { isOpen: true, title: 'Add Expense', onClose: () => closed++, confirmClose: () => allowClose, children: React.createElement('input', { 'aria-label': 'Test field' }) }
  await render(BottomSheet, props)
  const dialog = document.querySelector('dialog[open]')
  assert.equal(document.getElementById(dialog.getAttribute('aria-labelledby')).textContent, 'Add Expense')
  await act(async () => dialog.dispatchEvent(new Event('cancel', { cancelable: true })))
  assert.equal(closed, 0)
  allowClose = true
  await click(document.querySelector('[aria-label="Close dialog"]'))
  assert.equal(closed, 1)
  await render(BottomSheet, { ...props, isOpen: false })
  assert.equal(document.activeElement, trigger)
  assert.equal(document.body.style.overflow, '')
})

test('notifications announce errors and have a dismiss action', async () => {
  let closed = false
  await render(Toast, { type: 'error', message: 'Could not save. Try again.', onClose: () => { closed = true } })
  assert.match(document.querySelector('[role="alert"]').textContent, /Could not save/)
  await click(document.querySelector('[aria-label="Dismiss notification"]'))
  assert.equal(closed, true)
})

test('failed expense submission preserves the draft and offers a retry', async () => {
  await render(QuickSplit, { members, currentUserId: 'a', onSubmit: async () => { throw new Error('Connection failed.') } })
  await input(document.getElementById('expense-amount'), '24')
  await input(document.getElementById('expense-description'), 'Dinner')
  await submit()
  assert.match(document.querySelector('[role="alert"]').textContent, /Connection failed.*entries are kept/)
  assert.equal(document.getElementById('expense-description').value, 'Dinner')
  assert.equal(document.querySelector('button[type="submit"]').disabled, false)
})

test('Add from Profile selects a group and opens its expense flow', async () => {
  globalThis.__dashboardQuery = { data: { groups: [{ id: 'g', name: 'Dinner group' }] }, isLoading: false }
  let destination
  const Location = () => { destination = useLocation(); return null }
  const Wrapper = () => React.createElement(MemoryRouter, { initialEntries: ['/profile'] }, React.createElement(BottomNav), React.createElement(Location))
  await render(Wrapper, {})
  await click(document.querySelector('[aria-label="Add expense or create group"]'))
  assert.ok(document.querySelector('dialog[open]'))
  await click(button('Add expense'))
  await click(button('Dinner group'))
  assert.equal(destination.pathname, '/groups/g')
  assert.equal(destination.state.openExpense, true)
})

test('Home plus directly opens group creation without an action chooser', async () => {
  let opened = 0
  const Wrapper = () => React.createElement(MemoryRouter, { initialEntries: ['/dashboard'] }, React.createElement(BottomNav, { onFABPress: () => opened++ }))
  await render(Wrapper, {})
  await click(document.querySelector('nav button:nth-child(3)'))
  assert.equal(opened, 1)
  assert.equal(document.querySelector('dialog[open]'), null)
  assert.ok(document.querySelector('nav [aria-label="Create group"]'))
})

test('Group plus directly opens expense creation without a create-group option', async () => {
  let opened = 0
  const Wrapper = () => React.createElement(MemoryRouter, { initialEntries: ['/groups/g'] }, React.createElement(BottomNav, { groupId: 'g', onFABPress: () => opened++ }))
  await render(Wrapper, {})
  await click(document.querySelector('nav button:nth-child(3)'))
  assert.equal(opened, 1)
  assert.equal(document.querySelector('dialog[open]'), null)
  assert.ok(document.querySelector('nav [aria-label="Add expense"]'))
})

test('Add from Activity opens group creation rather than only returning Home', async () => {
  globalThis.__dashboardQuery = { data: { groups: [] }, isLoading: false }
  let destination
  const Location = () => { destination = useLocation(); return null }
  const Wrapper = () => React.createElement(MemoryRouter, { initialEntries: ['/activity'] }, React.createElement(BottomNav), React.createElement(Location))
  await render(Wrapper, {})
  await click(document.querySelector('[aria-label="Add expense or create group"]'))
  await click(button('Create group'))
  assert.equal(destination.pathname, '/dashboard')
  assert.equal(destination.state.openNewGroup, true)
})

test('partial payment stays editable at zero and blocks amounts above the balance', async () => {
  globalThis.__groupQuery = { isLoading: false, data: { group: { id: 'g', name: 'Trip', base_currency: 'USD', ledger_revision: 0 }, smartBalances: [{from:'a',to:'b',amount:20}], usersById: { a: members[0], b: { ...members[1], paynow_number: '91234567' } } } }
  const Wrapper = () => React.createElement(MemoryRouter, { initialEntries: ['/groups/g/pay?from=a&to=b&amount=20'] }, React.createElement(Routes, null, React.createElement(Route, { path: '/groups/:id/pay', element: React.createElement(Pay) })))
  await render(Wrapper, {})
  assert.match(document.body.textContent, /USD 20.00/)
  assert.doesNotMatch(document.body.textContent, /Scan with any Singapore banking app/)
  await click(button('Pay partial amount'))
  const field = document.getElementById('partial-payment')
  assert.ok(field)
  await input(field, '0')
  assert.match(document.getElementById('partial-feedback').textContent, /greater than zero/)
  await input(field, '25')
  assert.match(document.getElementById('partial-feedback').textContent, /cannot exceed/)
  assert.equal([...document.querySelectorAll('button')].find((element) => element.textContent.startsWith('Record payment')).disabled, true)
})


test('foreign expense previews the reviewed quote and submits that exact rate; quote failures block saving', async () => {
  const initialValues = { amount: '20', description: 'Taxi', category: 'transport', paidBy: 'a', splitMembers: ['a', 'b'], splitType: 'equal', splitValues: {}, currency: 'USD' }
  const quote = { fromCurrency:'USD', toCurrency:'SGD', rate:1.3, source:'frankfurter', asOfDate:'2020-01-01', fallback:true }
  globalThis.__fetchExpenseQuote = async () => quote
  let payload
  await render(QuickSplit, { members, currentUserId:'a', initialValues, onSubmit:async value => { payload = value } })
  assert.match(document.body.textContent, /SGD 26.00/)
  assert.match(document.body.textContent, /2020-01-01/)
  assert.match(document.body.textContent, /older or stored quote/)
  await submit()
  assert.deepEqual(payload.reviewedQuote, quote)
  await act(async () => root.unmount())
  root = createRoot(document.getElementById('root'))
  payload = null
  globalThis.__fetchExpenseQuote = async () => { throw Error('Quote offline') }
  await render(QuickSplit, { members, currentUserId:'a', initialValues, onSubmit:async value => { payload = value } })
  assert.match(document.body.textContent, /Quote offline/)
  await submit()
  assert.equal(payload, null)
  assert.ok(button('Retry conversion'))
  delete globalThis.__fetchExpenseQuote
})


test('uncertain expense retries its exact UUID and quote after remount, without fetching a replacement quote', async () => {
  const calls = []
  let fail = true
  let quoteCalls = 0
  globalThis.__fetchExpenseQuote = async () => { quoteCalls++; return {fromCurrency:'USD',toCurrency:'SGD',rate:1.3,source:'fixture',asOfDate:'2026-10-06'} }
  const props = { members, currentUserId:'a', groupId:'uncertain-expense', onSubmit:async value => { calls.push(value); if (fail) throw Error('Network failed'); return {id:'e'} } }
  try {
    await render(QuickSplit,props)
    await input(document.getElementById('expense-amount'),'20')
    await input(document.getElementById('expense-description'),'Taxi')
    await click(document.querySelector('[aria-label="Change currency, currently SGD"]'))
    await click(button('USD'))
    await submit()
    assert.ok(button('Retry original expense'))
    assert.equal(document.getElementById('expense-description').matches(':disabled'),true)
    assert.equal(button('Discard draft').disabled,true)
    await act(async () => root.unmount())
    root=createRoot(document.getElementById('root'))
    fail=false
    await render(QuickSplit,props)
    await submit()
    assert.equal(calls.length,2)
    assert.deepEqual(calls[1],calls[0])
    assert.equal(quoteCalls,1)
    assert.equal(localStorage.getItem('kaki:expense-request:v1:a:uncertain-expense'),null)
  } finally {
    localStorage.removeItem('kaki:expense-request:v1:a:uncertain-expense')
    localStorage.removeItem('kaki:expense-draft:v1:a:uncertain-expense:new:0')
    delete globalThis.__fetchExpenseQuote
  }
})


test('a definite expense rejection unlocks retained fields for correction', async () => {
  const props = { members, currentUserId:'a', groupId:'rejected-expense', onSubmit:async () => { throw Object.assign(Error('Choose current group members'),{definitelyRejected:true}) } }
  try {
    await render(QuickSplit,props)
    await input(document.getElementById('expense-amount'),'20')
    await input(document.getElementById('expense-description'),'Dinner')
    await submit()
    assert.equal(document.getElementById('expense-description').matches(':disabled'),false)
    assert.equal(localStorage.getItem('kaki:expense-request:v1:a:rejected-expense'),null)
    assert.equal(document.getElementById('expense-description').value,'Dinner')
  } finally { localStorage.removeItem('kaki:expense-draft:v1:a:rejected-expense:new:0') }
})

test('receipt review assignments recover inside an interrupted expense draft', async () => {
  const receipt={total:20,currency:'SGD',items:[{id:'food',name:'Food',amount:20}]}
  const key='kaki:expense-draft:v1:a:receipt-draft:new:0'
  localStorage.setItem(key,JSON.stringify({version:1,savedAt:Date.now(),draft:{amount:'20',description:'Receipt',currency:'SGD',splitMembers:['a','b'],splitValues:{},sharedItems:[],receiptData:receipt,showAssigner:true}}))
  const props={members,currentUserId:'a',groupId:'receipt-draft',onSubmit(){}}
  try {
    await render(QuickSplit,props)
    await click(document.querySelector('[aria-label="Bob, Food"]'))
    await act(async () => root.unmount())
    root=createRoot(document.getElementById('root'))
    await render(QuickSplit,props)
    assert.equal(document.querySelector('[aria-label="Bob, Food"]').getAttribute('aria-pressed'),'true')
    assert.equal(JSON.parse(localStorage.getItem(key)).draft.receiptReview.assignments.food[0],'b')
  } finally {localStorage.removeItem(key)}
})


test('only left swipe reveals delete, with a fully concealed closed action and native vertical scroll', async () => {
  let deletes=0
  await render(SwipeDeleteRow,{canDelete:true,label:'Dinner',onDelete:()=>deletes++,children:React.createElement('p',null,'Dinner')})
  const row=document.querySelector('.touch-pan-y')
  assert.equal(document.querySelector('[aria-label="Delete Dinner"]').style.visibility,'hidden')
  const pointer=async (type,x,y)=>act(async()=>row.dispatchEvent(new dom.window.MouseEvent(type,{bubbles:true,clientX:x,clientY:y,button:0})))
  await pointer('pointerdown',200,100); await pointer('pointermove',190,160); await pointer('pointerup',190,160)
  assert.match(row.style.transform,/0px/)
  await pointer('pointerdown',200,100); await pointer('pointermove',90,105); await pointer('pointerup',90,105)
  assert.match(row.style.transform,/-88px/)
  assert.equal(deletes,0)
  assert.equal(document.querySelector('[aria-label="Delete Dinner"]').tabIndex,0)
  await click(document.querySelector('[aria-label="Delete Dinner"]'))
  assert.equal(deletes,1)
  await pointer('pointerdown',90,100); await pointer('pointermove',200,105); await pointer('pointerup',200,105)
  assert.match(row.style.transform,/translateX\(0px\)/)
  assert.equal(document.querySelector('[aria-label="Delete Dinner"]').style.visibility,'hidden')
  assert.equal(deletes,1)
  assert.equal(document.querySelector('[aria-label="Actions for Dinner"]'),null)
  const group=document.querySelector('[role="group"]')
  await act(async()=>group.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true})))
  assert.equal(document.activeElement,document.querySelector('[aria-label="Delete Dinner"]'))
  await act(async()=>document.activeElement.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})))
  assert.match(row.style.transform,/0px/)
  assert.equal(document.activeElement,group)
  await render(SwipeDeleteRow,{canDelete:false,label:'Dinner',children:React.createElement('p',null,'Dinner')})
  assert.equal(document.querySelector('[aria-label="Delete Dinner"]'),null)
})

test('group activity exposes swipe actions for upper payments and lower expenses without mutating records', async () => {
  globalThis.__groupQuery = { data: { group:{id:'g',name:'Trip',base_currency:'SGD',created_by:'a',total_spent:20}, members,
    usersById:Object.fromEntries(members.map(member=>[member.id,member])), smartBalances:[],
    expenses:[{id:'e',description:'Dinner',amount:20,created_by:'b',paid_by:'b',splits:[],created_at:'2026-10-05T00:00:00Z'}],
    payments:[{id:'p',amount:5,from_user_id:'a',to_user_id:'b',created_by:'b',created_at:'2026-10-06T00:00:00Z'}] } }
  let mutations=0
  globalThis.__changePayment=async()=>{mutations++}
  await act(async()=>root.render(React.createElement(MemoryRouter,{initialEntries:['/groups/g']},React.createElement(Routes,null,
    React.createElement(Route,{path:'/groups/:id',element:React.createElement(GroupHome)})))))
  const reveal=async row=>{
    for (const [type,x] of [['pointerdown',200],['pointermove',90],['pointerup',90]]) {
      await act(async()=>row.dispatchEvent(new dom.window.MouseEvent(type,{bubbles:true,clientX:x,clientY:100,button:0})))
    }
  }
  assert.equal(document.querySelectorAll('.touch-pan-y').length,2)
  await reveal(document.querySelectorAll('.touch-pan-y')[0])
  await click(document.querySelector('[aria-label="Delete Payment recorded"]'))
  assert.ok(document.getElementById('payment-void-reason'))
  assert.equal(mutations,0)
  await click(document.querySelector('[aria-label="Close dialog"]'))
  await reveal(document.querySelectorAll('.touch-pan-y')[1])
  await click(document.querySelector('[aria-label="Delete Dinner"]'))
  assert.match(document.body.textContent,/Delete Dinner\?/)
})

test('admins can grant member roles while the creator stays protected; failures retain retry controls', async () => {
  const originalConfirm=window.confirm
  window.confirm=()=>true
  let calls=[]
  const people=[{...members[0],role:'admin'},{...members[1],role:'member'},{id:'owner',display_name:'Creator',role:'owner'}]
  const props={group:{created_by:'owner'},members:people,currentUserId:'a',onRoleChange:async value=>{calls.push(value);throw Error('Role update failed')}}
  try {
    await render(GroupMembers,props)
    assert.equal(document.querySelector('[aria-label="Make admin: Creator"]'),null)
    await click(document.querySelector('[aria-label="Make admin: Bob"]'))
    assert.deepEqual(calls[0],{userId:'b',role:'admin',expectedRole:'member'})
    assert.match(document.body.textContent,/Role update failed/)
    assert.equal(document.querySelector('[aria-label="Make admin: Bob"]').disabled,false)
    await render(GroupMembers,{...props,currentUserId:'b'})
    assert.equal(button('Make admin'),undefined)
  } finally {window.confirm=originalConfirm}
})

test('delegated admin can correct another recorder expense and payment record', async () => {
  const people=members.map(member=>({...member,role:member.id==='a'?'admin':'member'}))
  const users=Object.fromEntries(people.map(member=>[member.id,member]))
  const group={created_by:'owner',base_currency:'SGD'}
  await render(ExpenseDetails,{expense:{id:'e',description:'Dinner',amount:20,created_by:'b',paid_by:'b',split_type:'equal',original_currency:'SGD',splits:[],revision:0},group,members:people,usersById:users,currentUserId:'a',onSave(){}})
  assert.ok(button('Edit expense'))
  await act(async()=>root.unmount()); root=createRoot(document.getElementById('root'))
  await render(PaymentDetails,{payment:{id:'p',amount:5,from_user_id:'b',to_user_id:'owner',created_by:'b'},group,usersById:users,currentUserId:'a',onChange(){}})
  assert.ok(button('Correct a mistaken record'))
  assert.equal(button('Acknowledge receipt'),undefined)
})
