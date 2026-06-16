import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchDashboardData, fetchGroupData, fetchInsightsData } from '../lib/kakiSplitApi'
import { queryKeys } from '../lib/queryClient'

export function useDashboardData(userId) {
  return useQuery({
    queryKey: queryKeys.dashboard(userId),
    queryFn: () => fetchDashboardData(userId),
    enabled: Boolean(userId),
  })
}

export function useGroupData({ groupId, userId }) {
  return useQuery({
    queryKey: queryKeys.group(groupId, userId),
    queryFn: () => fetchGroupData({ groupId, userId }),
    enabled: Boolean(groupId && userId),
  })
}

export function useInsightsData(groupId, userId) {
  return useQuery({
    queryKey: queryKeys.insights(groupId),
    queryFn: () => fetchInsightsData(groupId),
    enabled: Boolean(groupId && userId),
  })
}

export function useAppQueryInvalidation() {
  const queryClient = useQueryClient()

  const invalidateDashboard = (userId) => {
    if (!userId) return Promise.resolve()
    // Dashboard data is reused by Dashboard, Activity, and InsightsPicker.
    return queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(userId) })
  }

  const invalidateGroup = async ({ groupId, userId }) => {
    if (!groupId) return

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['group', groupId] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.insights(groupId) }),
      invalidateDashboard(userId),
    ])
  }

  return { invalidateDashboard, invalidateGroup }
}
