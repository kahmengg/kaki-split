import React, { useRef, useState } from 'react'
import Avatar from './Avatar'
import { isGroupAdmin } from '../lib/groupPermissions'

export default function GroupMembers({ group, members, currentUserId, onRoleChange, onBusyChange }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inFlight = useRef(false)
  const canManage = isGroupAdmin(group, currentUserId, members)
  const change = async member => {
    if (inFlight.current) return
    const role = member.role === 'admin' ? 'member' : 'admin'
    if (!window.confirm(role === 'admin' ? `Make ${member.display_name} an admin? Admins can edit/delete expenses, void payment records and manage member roles.` : `Remove admin access from ${member.display_name}?`)) return
    inFlight.current = true; setBusy(true); onBusyChange?.(true); setError('')
    try { await onRoleChange({ userId: member.id, role, expectedRole: member.role || 'member' }) }
    catch (failure) { setError(failure.message || 'Unable to change role. Refresh and try again.') }
    finally { inFlight.current = false; setBusy(false); onBusyChange?.(false) }
  }
  return <div className="px-5 py-4 space-y-4">
    <p className="text-sm text-gray-600">Admins can manage roles and correct group activity. The creator keeps ownership and the ability to delete the whole group.</p>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {members.map(member => <div key={member.id} className="flex flex-wrap items-center gap-3 border-b border-gray-100 py-3">
      <Avatar user={member} size="sm" />
      <div className="flex-1 min-w-0"><p className="font-semibold text-gray-900 break-words">{member.display_name}{member.id === currentUserId ? ' (You)' : ''}</p>
        <p className="text-sm text-gray-600">{member.id === group.created_by ? 'Creator' : member.role === 'admin' ? 'Admin' : 'Member'}</p></div>
      {canManage && member.id !== group.created_by && <button type="button" disabled={busy} onClick={() => change(member)}
        className="min-h-11 rounded-xl border border-gray-200 px-3 text-sm font-semibold text-sky-700" aria-label={`${member.role === 'admin' ? 'Remove admin from' : 'Make admin:'} ${member.display_name}`}>{member.role === 'admin' ? 'Remove admin' : 'Make admin'}</button>}
    </div>)}
  </div>
}
