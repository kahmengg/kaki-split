// Mock data for Kaki Split frontend prototype

export const CURRENT_USER = {
  id: 'user-1',
  name: 'Alex Chen',
  display_name: 'Alex',
  email: 'alex.chen@gmail.com',
  avatar_url: null,
  avatar_color: '#10b981',
  paynow_number: '+6591234567',
  grabpay_handle: 'alexchen',
  paylah_handle: null,
}

export const USERS = {
  'user-1': CURRENT_USER,
  'user-2': {
    id: 'user-2',
    name: 'Sarah Lim',
    display_name: 'Sarah',
    email: 'sarah.lim@gmail.com',
    avatar_url: null,
    avatar_color: '#8b5cf6',
    paynow_number: '+6598765432',
    grabpay_handle: null,
    paylah_handle: 'sarahlim',
  },
  'user-3': {
    id: 'user-3',
    name: 'Marcus Tan',
    display_name: 'Marcus',
    email: 'marcus.tan@gmail.com',
    avatar_url: null,
    avatar_color: '#f59e0b',
    paynow_number: '+6581234567',
    grabpay_handle: 'marcustan',
    paylah_handle: null,
  },
  'user-4': {
    id: 'user-4',
    name: 'Priya Nair',
    display_name: 'Priya',
    email: 'priya.nair@gmail.com',
    avatar_url: null,
    avatar_color: '#ef4444',
    paynow_number: '+6592345678',
    grabpay_handle: null,
    paylah_handle: null,
  },
  'user-5': {
    id: 'user-5',
    name: 'Jamie Wong',
    display_name: 'Jamie',
    email: 'jamie.wong@gmail.com',
    avatar_url: null,
    avatar_color: '#3b82f6',
    paynow_number: null,
    grabpay_handle: 'jamiew',
    paylah_handle: 'jamiewong',
  },
}

export const GROUPS = [
  {
    id: 'group-1',
    name: 'Bali Trip 🌴',
    created_by: 'user-1',
    invite_code: 'BALI2026',
    base_currency: 'SGD',
      telegramConnected: true,
      telegramGroupName: 'Bali Crew 🌴',

    created_at: '2026-03-01T10:00:00Z',
    member_ids: ['user-1', 'user-2', 'user-3', 'user-4'],
    my_balance: -87.40, // negative = I owe
    total_spent: 1243.80,
    last_activity: '2026-03-27T14:30:00Z',
  },
  {
    id: 'group-2',
    name: 'Roommates 🏠',
    created_by: 'user-2',
    invite_code: 'ROOM88',
    base_currency: 'SGD',
      telegramConnected: false,
      telegramGroupName: null,

    created_at: '2026-01-15T09:00:00Z',
    member_ids: ['user-1', 'user-2', 'user-3'],
    my_balance: 34.20, // positive = I'm owed
    total_spent: 890.50,
    last_activity: '2026-03-26T18:00:00Z',
  },
  {
    id: 'group-3',
    name: 'Tokyo Food Tour 🍣',
    created_by: 'user-1',
    invite_code: 'TOKYO99',
    base_currency: 'SGD',
      telegramConnected: false,
      telegramGroupName: null,

    created_at: '2026-02-10T07:00:00Z',
    member_ids: ['user-1', 'user-5'],
    my_balance: 0,
    total_spent: 456.20,
    last_activity: '2026-02-20T12:00:00Z',
  },
]

export const EXPENSES = {
  'group-1': [
    {
      id: 'exp-1',
      group_id: 'group-1',
      description: 'Dinner at Sardine',
      amount: 248.00,
      original_amount: null,
      original_currency: null,
      exchange_rate: null,
      paid_by: 'user-2',
      split_type: 'equal',
      category: 'food',
      created_by: 'user-2',
      created_at: '2026-03-27T14:30:00Z',

      splits: [
        { user_id: 'user-1', amount: 62.00, is_settled: false },
        { user_id: 'user-2', amount: 62.00, is_settled: true },
        { user_id: 'user-3', amount: 62.00, is_settled: false },
        { user_id: 'user-4', amount: 62.00, is_settled: false },
      ],
    },
    {
      id: 'exp-2',
      group_id: 'group-1',
      description: 'Villa deposit',
      amount: 600.00,
      original_amount: null,
      original_currency: null,
      exchange_rate: null,
      paid_by: 'user-1',
      split_type: 'equal',
      category: 'accommodation',
      created_by: 'user-1',
      created_at: '2026-03-26T10:00:00Z',

      splits: [
        { user_id: 'user-1', amount: 150.00, is_settled: true },
        { user_id: 'user-2', amount: 150.00, is_settled: false },
        { user_id: 'user-3', amount: 150.00, is_settled: false },
        { user_id: 'user-4', amount: 150.00, is_settled: false },
      ],
    },
    {
      id: 'exp-3',
      group_id: 'group-1',
      description: 'Grab to airport',
      amount: 34.50,
      original_amount: null,
      original_currency: null,
      exchange_rate: null,
      paid_by: 'user-3',
      split_type: 'equal',
      category: 'transport',
      created_by: 'user-3',
      created_at: '2026-03-25T07:00:00Z',

      splits: [
        { user_id: 'user-1', amount: 8.63, is_settled: false },
        { user_id: 'user-2', amount: 8.63, is_settled: false },
        { user_id: 'user-3', amount: 8.62, is_settled: true },
        { user_id: 'user-4', amount: 8.62, is_settled: false },
      ],
    },
    {
      id: 'exp-4',
      group_id: 'group-1',
      description: 'Surf lessons',
      amount: 180.00,
      original_amount: 2160000,
      original_currency: 'IDR',
      exchange_rate: 12000,
      paid_by: 'user-4',
      split_type: 'equal',
      category: 'activities',
      created_by: 'user-4',
      created_at: '2026-03-24T09:00:00Z',

      splits: [
        { user_id: 'user-1', amount: 45.00, is_settled: false },
        { user_id: 'user-2', amount: 45.00, is_settled: false },
        { user_id: 'user-3', amount: 45.00, is_settled: false },
        { user_id: 'user-4', amount: 45.00, is_settled: true },
      ],
    },
    {
      id: 'exp-5',
      group_id: 'group-1',
      description: 'Bintang beers 🍺',
      amount: 28.80,
      original_amount: 345600,
      original_currency: 'IDR',
      exchange_rate: 12000,
      paid_by: 'user-2',
      split_type: 'equal',
      category: 'food',
      created_by: 'user-2',
      created_at: '2026-03-23T20:00:00Z',

      splits: [
        { user_id: 'user-1', amount: 7.20, is_settled: false },
        { user_id: 'user-2', amount: 7.20, is_settled: true },
        { user_id: 'user-3', amount: 7.20, is_settled: false },
        { user_id: 'user-4', amount: 7.20, is_settled: false },
      ],
    },
    {
      id: 'exp-6',
      group_id: 'group-1',
      description: 'Airfare (SQ)',
      amount: 152.50,
      original_amount: null,
      original_currency: null,
      exchange_rate: null,
      paid_by: 'user-1',
      split_type: 'exact',
      category: 'transport',
      created_by: 'user-1',
      created_at: '2026-03-01T12:00:00Z',

      splits: [
        { user_id: 'user-1', amount: 38.00, is_settled: true },
        { user_id: 'user-2', amount: 38.00, is_settled: true },
        { user_id: 'user-3', amount: 38.50, is_settled: true },
        { user_id: 'user-4', amount: 38.00, is_settled: true },
      ],
    },
  ],
  'group-2': [
    {
      id: 'exp-7',
      group_id: 'group-2',
      description: 'March utilities',
      amount: 178.50,
      original_amount: null,
      original_currency: null,
      exchange_rate: null,
      paid_by: 'user-1',
      split_type: 'equal',
      category: 'other',
      created_by: 'user-1',
      created_at: '2026-03-15T09:00:00Z',

      splits: [
        { user_id: 'user-1', amount: 59.50, is_settled: true },
        { user_id: 'user-2', amount: 59.50, is_settled: false },
        { user_id: 'user-3', amount: 59.50, is_settled: false },
      ],
    },
    {
      id: 'exp-8',
      group_id: 'group-2',
      description: 'NTUC groceries',
      amount: 94.30,
      original_amount: null,
      original_currency: null,
      exchange_rate: null,
      paid_by: 'user-2',
      split_type: 'equal',
      category: 'food',
      created_by: 'user-2',
      created_at: '2026-03-20T11:00:00Z',

      splits: [
        { user_id: 'user-1', amount: 31.43, is_settled: false },
        { user_id: 'user-2', amount: 31.44, is_settled: true },
        { user_id: 'user-3', amount: 31.43, is_settled: false },
      ],
    },
  ],
  'group-3': [
    {
      id: 'exp-9',
      group_id: 'group-3',
      description: 'Tsukiji breakfast',
      amount: 62.40,
      original_amount: 6900,
      original_currency: 'JPY',
      exchange_rate: 110.58,
      paid_by: 'user-1',
      split_type: 'equal',
      category: 'food',
      created_by: 'user-1',
      created_at: '2026-02-15T07:30:00Z',

      splits: [
        { user_id: 'user-1', amount: 31.20, is_settled: true },
        { user_id: 'user-5', amount: 31.20, is_settled: true },
      ],
    },
  ],
}

// Smart balance computation for group-1
export const SMART_BALANCES = {
  'group-1': [
    { from: 'user-1', to: 'user-2', amount: 87.40 },
    { from: 'user-3', to: 'user-2', amount: 62.83 },
    { from: 'user-4', to: 'user-1', amount: 22.82 },
  ],
  'group-2': [
    { from: 'user-2', to: 'user-1', amount: 28.07 },
    { from: 'user-3', to: 'user-1', amount: 59.50 },
  ],
  'group-3': [],
}

export const CATEGORIES = [
  { id: 'food', icon: '🍜', label: 'Food' },
  { id: 'transport', icon: '🚗', label: 'Transport' },
  { id: 'accommodation', icon: '🏠', label: 'Stay' },
  { id: 'activities', icon: '🏄', label: 'Activities' },
  { id: 'other', icon: '📦', label: 'Other' },
]

export const CURRENCIES = [
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
]

export function formatMoney(amount, currency = 'SGD') {
  return `${currency} ${Number(amount).toFixed(2)}`
}

export function timeAgo(dateStr) {
  const now = new Date()
  const date = new Date(dateStr)
  const diff = Math.floor((now - date) / 1000)

  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return date.toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })
}

export function getCategoryIcon(category) {
  return CATEGORIES.find(c => c.id === category)?.icon || '📦'
}

export function getUserInitials(user) {
  if (!user) return '?'
  return (user.display_name || user.name || 'U').slice(0, 2).toUpperCase()
}

// Spend insights data for group-1
export const INSIGHTS_DATA = {
  'group-1': {
    totalSpend: 1243.80,
    byPerson: [
      { name: 'Sarah', amount: 276.80, color: '#8b5cf6' },
      { name: 'Alex', amount: 752.50, color: '#10b981' },
      { name: 'Marcus', amount: 34.50, color: '#f59e0b' },
      { name: 'Priya', amount: 180.00, color: '#ef4444' },
    ],
    byCategory: [
      { name: 'Food', value: 276.80, color: '#10b981', icon: '🍜' },
      { name: 'Stay', value: 600.00, color: '#3b82f6', icon: '🏠' },
      { name: 'Transport', value: 187.00, color: '#f59e0b', icon: '🚗' },
      { name: 'Activities', value: 180.00, color: '#8b5cf6', icon: '🏄' },
    ],
    topExpense: { description: 'Villa deposit', amount: 600.00, paid_by: 'user-1', date: '26 Mar' },
    mostActiveDay: '24 Mar',
  },
}
