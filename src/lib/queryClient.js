import { QueryClient } from '@tanstack/react-query'

export const queryKeys = {
  dashboard: (userId) => ['dashboard', userId],
  activity: (userId) => ['activity', userId],
  group: (groupId, userId) => ['group', groupId, userId || 'all'],
  insights: (groupId) => ['insights', groupId],
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})
