import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchStories, createStory, type Story } from '../services/api';

/**
 * React Query hook to fetch active stories.
 */
export function useStoriesQuery(token: string) {
  return useQuery<Story[]>({
    queryKey: ['stories'],
    queryFn: () => fetchStories(token),
    enabled: !!token,
    staleTime: 1000 * 60 * 5, // Cache is fresh for 5 minutes
  });
}

/**
 * Mutation hook to publish a new story.
 */
export function useCreateStoryMutation(token: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (mediaUrl: string) => createStory(token, mediaUrl),
    onSuccess: () => {
      // Invalidate the stories query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['stories'] });
    },
  });
}
