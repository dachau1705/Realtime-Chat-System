import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchFeed, reactToPost, createPost, deletePost, type Post } from '../services/api';

// Hook to load the news feed using Infinite Query with cursor-based pagination
export function useFeedQuery(token: string) {
  return useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: ({ pageParam }) => fetchFeed(token, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      // The API returns an array of posts. The oldest post's timestamp serves as the cursor
      return lastPage && lastPage.length > 0 ? lastPage[lastPage.length - 1].created_at : undefined;
    },
    staleTime: 1000 * 60 * 3, // Cache is fresh for 3 minutes
  });
}

// Mutation to reaction/like toggling with Optimistic Updates
export function useLikeMutation(token: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, reactionType }: { postId: string; reactionType: string | null }) =>
      reactToPost(token, postId, reactionType),

    onMutate: async ({ postId, reactionType }) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['feed'] });

      // Snapshot the previous cache value
      const previousFeed = queryClient.getQueryData(['feed']);

      // Optimistically update the cache
      queryClient.setQueryData(['feed'], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page: Post[]) =>
            page.map((post: Post) => {
              if (post.id === postId) {
                const isReacting = reactionType !== null;
                const prevHasReacted = post.has_reacted;
                let diff = 0;
                if (isReacting && !prevHasReacted) diff = 1;
                if (!isReacting && prevHasReacted) diff = -1;

                return {
                  ...post,
                  has_reacted: isReacting,
                  reaction_type: reactionType,
                  reaction_count: Math.max(0, post.reaction_count + diff),
                };
              }
              return post;
            })
          ),
        };
      });

      // Return context containing previous feed data for rollback
      return { previousFeed };
    },

    onError: (_err, _variables, context) => {
      // Rollback to previous state on error
      if (context?.previousFeed) {
        queryClient.setQueryData(['feed'], context.previousFeed);
      }
    },

    onSettled: () => {
      // Revalidate cache to sync with database
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}

// Mutation to create a post with Optimistic Updates
export function useCreatePostMutation(token: string, currentUser: any) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ content, mediaUrls }: { content: string; mediaUrls: string[] }) =>
      createPost(token, content, mediaUrls),

    onMutate: async ({ content, mediaUrls }) => {
      await queryClient.cancelQueries({ queryKey: ['feed'] });
      const previousFeed = queryClient.getQueryData(['feed']);

      // Mock an optimistic post object
      const tempId = `temp-${Date.now()}`;
      const optimisticPost: Post = {
        id: tempId,
        user_id: currentUser?.id || 'current-user',
        content: content,
        media_urls: mediaUrls,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        username: currentUser?.username || 'me',
        full_name: currentUser?.full_name || currentUser?.username || 'Me',
        avatar_url: currentUser?.avatar_url || null,
        comment_count: 0,
        reaction_count: 0,
        has_reacted: false,
        reaction_type: null,
      };

      // Prepend optimistic post to page 0
      queryClient.setQueryData(['feed'], (old: any) => {
        if (!old) return old;
        const updatedPages = [...old.pages];
        if (updatedPages.length > 0) {
          updatedPages[0] = [optimisticPost, ...updatedPages[0]];
        } else {
          updatedPages[0] = [optimisticPost];
        }
        return { ...old, pages: updatedPages };
      });

      return { previousFeed };
    },

    onError: (_err, _variables, context) => {
      if (context?.previousFeed) {
        queryClient.setQueryData(['feed'], context.previousFeed);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}

// Mutation to delete a post with Optimistic Updates
export function useDeletePostMutation(token: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => deletePost(token, postId),

    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: ['feed'] });
      const previousFeed = queryClient.getQueryData(['feed']);

      // Filter out the deleted post optimistically
      queryClient.setQueryData(['feed'], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page: Post[]) =>
            page.filter((post: Post) => post.id !== postId)
          ),
        };
      });

      return { previousFeed };
    },

    onError: (_err, _variables, context) => {
      if (context?.previousFeed) {
        queryClient.setQueryData(['feed'], context.previousFeed);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}
