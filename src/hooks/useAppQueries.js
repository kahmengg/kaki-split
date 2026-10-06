import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchActivityPage, fetchDashboardData, fetchGroupData, fetchInsightsData } from '../lib/kakiSplitApi'
import { queryKeys } from '../lib/queryClient'

export function useDashboardData(userId) {
  return useQuery({
    queryKey: queryKeys.dashboard(userId),
    queryFn: () => fetchDashboardData(userId),
    enabled: Boolean(userId),
  })
}

export function useActivityData(userId) {
  return useInfiniteQuery({
    queryKey: queryKeys.activity(userId),
    queryFn: ({ pageParam }) => fetchActivityPage(pageParam),
    initialPageParam: null,
    getNextPageParam: page => page.nextCursor || undefined,
    enabled: Boolean(userId),
    refetchOnWindowFocus: true,
  })
}

export function useGroupData({ groupId, userId }) {
  return useQuery({
    queryKey: queryKeys.group(groupId, userId),
    // TanStack owns the UI cache; an explicit refetch must reach the database.
    queryFn: () => fetchGroupData({ groupId, userId, skipCache: true }),
    enabled: Boolean(groupId && userId),
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
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
      queryClient.invalidateQueries({ queryKey: queryKeys.activity(userId) }),
      invalidateDashboard(userId),
    ])
  }

  return { invalidateDashboard, invalidateGroup }
}
