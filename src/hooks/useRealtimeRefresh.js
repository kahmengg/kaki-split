import { useEffect, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryClient'
import { clearReadCaches } from '../lib/kakiSplitApi'

const GROUP_TABLES = ['expenses', 'payments', 'activity_events', 'deleted_activity_logs']

function scheduleInvalidation(callback) {
  let timerId = null

  return {
    run() {
      window.clearTimeout(timerId)
      // Batch rapid insert/update bursts so one expense does not spam refetches.
      timerId = window.setTimeout(callback, 350)
    },
    clear() {
      window.clearTimeout(timerId)
    },
  }
}

export function useGroupRealtime({ groupId, userId, enabled = true } = {}) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!enabled || !groupId || !userId) return undefined

    const invalidation = scheduleInvalidation(() => {
      clearReadCaches({ groupId, userId })
      queryClient.invalidateQueries({ queryKey: ['group', groupId] })
      queryClient.invalidateQueries({ queryKey: queryKeys.insights(groupId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(userId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.activity(userId) })
    })

    const channel = supabase
      .channel(`group-realtime:${groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'groups', filter: `id=eq.${groupId}` }, () => {
        invalidation.run()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members', filter: `group_id=eq.${groupId}` }, () => {
        invalidation.run()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_user_preferences', filter: `user_id=eq.${userId}` }, () => {
        invalidation.run()
      })

    for (const table of GROUP_TABLES) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `group_id=eq.${groupId}` }, () => {
        invalidation.run()
      })
    }

    channel.subscribe()

    return () => {
      invalidation.clear()
      supabase.removeChannel(channel)
    }
  }, [enabled, groupId, queryClient, userId])
}

export function useDashboardRealtime({ userId, groups = [], enabled = true } = {}) {
  const queryClient = useQueryClient()
  const groupIds = useMemo(() => groups.map((group) => group.id).filter(Boolean), [groups])
  const groupIdKey = groupIds.join(',')

  useEffect(() => {
    if (!enabled || !userId) return undefined

    const invalidation = scheduleInvalidation(() => {
      clearReadCaches({ userId })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(userId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.activity(userId) })
    })

    const channel = supabase
      .channel(`dashboard-realtime:${userId}:${groupIdKey || 'empty'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members', filter: `user_id=eq.${userId}` }, () => {
        invalidation.run()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_user_preferences', filter: `user_id=eq.${userId}` }, () => {
        invalidation.run()
      })

    for (const groupId of groupIds) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'groups', filter: `id=eq.${groupId}` }, () => {
        invalidation.run()
      })

      for (const table of GROUP_TABLES) {
        channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `group_id=eq.${groupId}` }, () => {
          invalidation.run()
        })
      }
    }

    channel.subscribe()

    return () => {
      invalidation.clear()
      supabase.removeChannel(channel)
    }
  }, [enabled, groupIdKey, groupIds, queryClient, userId])
}
