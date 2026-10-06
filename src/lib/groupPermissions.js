export function isGroupAdmin(group, userId, members = []) {
  if (!userId) return false
  if (group?.created_by === userId) return true
  const member = Array.isArray(members) ? members.find(item => item.id === userId) : members[userId]
  return member?.role === 'admin'
}
