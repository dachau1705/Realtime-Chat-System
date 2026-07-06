import { type Socket } from 'socket.io-client';
import { type QueryClient } from '@tanstack/react-query';
import { useFeedStore } from '../store/useFeedStore';
import { type Post, type Comment } from './api';

/**
 * Attaches real-time Socket.io listeners for feed events:
 * - NEW_POST: Adds post to the Zustand buffer so the user is notified without layout shifts.
 * - UPDATE_REACTION: Updates the reaction counts of posts already in the React Query cache.
 * - NEW_COMMENT: Increments comment counts for the respective post in the cache.
 */
export function setupFeedSocketListeners(socket: Socket, queryClient: QueryClient, currentUserId?: string) {
  // 1. Receive new post
  socket.on('NEW_POST', (newPost: Post) => {
    // Ignore posts created by the current user (already handled by optimistic updates / mutations)
    if (newPost.user_id === currentUserId) return;

    // Add to Zustand pending buffer so it displays the "X new posts" floating button
    useFeedStore.getState().addPendingPost(newPost);
  });

  // 2. Receive reaction count update
  socket.on('UPDATE_REACTION', (data: { postId: string; reactionCount: number; reactionType?: string | null }) => {
    queryClient.setQueryData(['feed'], (old: any) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((page: Post[]) =>
          page.map((post: Post) => {
            if (post.id === data.postId) {
              return {
                ...post,
                reaction_count: data.reactionCount
              };
            }
            return post;
          })
        ),
      };
    });
  });

  // 3. Receive new comment event
  socket.on('NEW_COMMENT', (comment: Comment) => {
    // Update the comment count for the post in the feed
    queryClient.setQueryData(['feed'], (old: any) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((page: Post[]) =>
          page.map((post: Post) => {
            if (post.id === comment.post_id) {
              return {
                ...post,
                comment_count: post.comment_count + 1
              };
            }
            return post;
          })
        ),
      };
    });

    // Invalidate the post comments query to load the new comment if comments are expanded
    queryClient.invalidateQueries({ queryKey: ['comments', comment.post_id] });
  });

  // Cleanup function to detach socket listeners on unmount
  return () => {
    socket.off('NEW_POST');
    socket.off('UPDATE_REACTION');
    socket.off('NEW_COMMENT');
  };
}
