import React, { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useChat } from '../../hooks/useChat';
import { useFeedQuery } from '../../hooks/useFeedQuery';
import { useFeedStore } from '../../store/useFeedStore';
import { setupFeedSocketListeners } from '../../services/feedSocket';
import { PostCard } from '../post/PostCard';
import { CreatePostBox } from '../post/CreatePostBox';
import { StoryBar } from '../story/StoryBar';
import { type Post } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';

// A wrapper component that only renders its child when it enters the viewport root margin.
// Acts as a lightweight virtualization wrapper for items of dynamic height in React 19.
const LazyRenderWrapper = ({ children, height = '350px' }: { children: React.ReactNode; height?: string }) => {
  const [isIntersecting, setIsIntersecting] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsIntersecting(true);
          // Once it has intersected, we can keep it rendered (or un-render it if we want full virtualization).
          // For Facebook-style feed, caching the rendered state prevents component re-mount flickering.
        }
      },
      { rootMargin: '400px' } // Pre-render 400px before scroll target reaches viewport
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={containerRef} style={{ minHeight: isIntersecting ? 'auto' : height }}>
      {isIntersecting ? children : (
        <div style={{
          height,
          background: 'var(--panel-bg)',
          borderRadius: '16px',
          border: '1px solid var(--panel-border)',
          opacity: 0.15,
          marginBottom: '16px'
        }} className="post-card-skeleton" />
      )}
    </div>
  );
};

export function FeedContainer() {
  const { t } = useLanguage();
  const { token, socket, currentUser } = useChat();
  const queryClient = useQueryClient();
  const observerTargetRef = useRef<HTMLDivElement>(null);

  const pendingPosts = useFeedStore((state) => state.pendingNewPosts);
  const clearPending = useFeedStore((state) => state.clearPendingPosts);

  // Load feed using infinite scrolling query hook
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch
  } = useFeedQuery(token || '');

  // 1. Listen to Realtime Events via Socket.io
  useEffect(() => {
    if (!socket) return;
    const cleanup = setupFeedSocketListeners(socket, queryClient, currentUser?.id);
    return () => {
      cleanup();
    };
  }, [socket, queryClient, currentUser?.id]);

  // 2. Infinite Scroll Trigger using Intersection Observer
  useEffect(() => {
    if (isLoading || isError || !hasNextPage) return;

    const handleObserver = (entries: IntersectionObserverEntry[]) => {
      const target = entries[0];
      if (target.isIntersecting && !isFetchingNextPage) {
        fetchNextPage();
      }
    };

    const observer = new IntersectionObserver(handleObserver, {
      rootMargin: '100px', // Trigger fetch slightly before reaching the bottom
    });

    if (observerTargetRef.current) {
      observer.observe(observerTargetRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [hasNextPage, isFetchingNextPage, isLoading, isError, fetchNextPage]);

  // Flatten the multi-page data array
  const posts = data?.pages.flatMap((page: Post[]) => page) || [];

  // Prepend real-time received posts to the main feed when clicked
  const handleLoadPending = () => {
    queryClient.setQueryData(['feed'], (old: any) => {
      if (!old) return old;
      const updatedPages = [...old.pages];
      if (updatedPages.length > 0) {
        // Prepend pending posts to the beginning of the first page array
        updatedPages[0] = [...pendingPosts, ...updatedPages[0]];
      } else {
        updatedPages[0] = pendingPosts;
      }
      return { ...old, pages: updatedPages };
    });
    
    // Clear pending queue & scroll smoothly back to top of feed
    clearPending();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="feed-container" style={{ width: '100%', maxWidth: '620px', position: 'relative' }}>
      {/* Stories list */}
      <StoryBar />

      {/* Post creation card */}
      <CreatePostBox />

      {/* Realtime Floating notification badge */}
      {pendingPosts.length > 0 && (
        <div style={{
          position: 'sticky',
          top: '72px',
          zIndex: 10,
          display: 'flex',
          justifyContent: 'center',
          pointerEvents: 'none',
          marginBottom: '12px'
        }}>
          <button
            onClick={handleLoadPending}
            style={{
              pointerEvents: 'auto',
              background: 'var(--primary)',
              color: 'white',
              border: 'none',
              borderRadius: '24px',
              padding: '10px 20px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              animation: 'bounceIn 0.3s ease-out'
            }}
            className="new-posts-floating-btn"
          >
            <i className="fa-solid fa-arrow-up"></i>
            <span>{t('feed.newPostsAvailable').replace('{count}', String(pendingPosts.length))}</span>
          </button>
        </div>
      )}

      {/* Main Feed timeline */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="post-card-skeleton" style={{ height: '250px', background: 'var(--panel-bg)', borderRadius: '16px', opacity: 0.1 }} />
          <div className="post-card-skeleton" style={{ height: '350px', background: 'var(--panel-bg)', borderRadius: '16px', opacity: 0.1 }} />
        </div>
      ) : isError ? (
        <div style={{
          background: 'var(--panel-bg)',
          border: '1px solid var(--panel-border)',
          borderRadius: '16px',
          padding: '24px',
          textAlign: 'center',
          color: 'var(--error)'
        }}>
          <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '32px', marginBottom: '8px' }}></i>
          <div>{t('feed.syncFailed')}</div>
          <button onClick={() => refetch()} className="primary-btn" style={{ width: 'auto', marginTop: '12px', padding: '6px 16px' }}>
            {t('feed.retrySync')}
          </button>
        </div>
      ) : posts.length === 0 ? (
        <div style={{
          background: 'var(--panel-bg)',
          border: '1px solid var(--panel-border)',
          borderRadius: '16px',
          padding: '40px',
          textAlign: 'center',
          color: 'var(--text-muted)'
        }}>
          <i className="fa-solid fa-earth-americas" style={{ fontSize: '36px', opacity: '0.4', marginBottom: '12px', display: 'block' }}></i>
          <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>{t('feed.feedEmpty')}</div>
          <div>{t('feed.feedEmptyDesc')}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {posts.map((post) => (
            <LazyRenderWrapper key={post.id} height={post.media_urls.length > 0 ? '450px' : '220px'}>
              <PostCard post={post} />
            </LazyRenderWrapper>
          ))}

          {/* Observer Target element at bottom */}
          <div ref={observerTargetRef} style={{ height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '12px 0' }}>
            {isFetchingNextPage && (
              <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '6px' }}></i>
                {t('feed.syncOlder')}
              </div>
            )}

            {!hasNextPage && posts.length > 0 && (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', opacity: 0.5 }}>
                {t('feed.caughtUp')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
