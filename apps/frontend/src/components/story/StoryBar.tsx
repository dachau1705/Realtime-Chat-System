import React, { useRef, useState, useEffect } from 'react';
import { StoryCard } from './StoryCard';
import { useChat } from '../../hooks/useChat';
import { useStoriesQuery, useCreateStoryMutation } from '../../hooks/useStoriesQuery';
import { uploadMedia, type Story } from '../../services/api';

export function StoryBar() {
  const { token, currentUser, showToast } = useChat();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const [activeStory, setActiveStory] = useState<Story | null>(null);

  // 1. Fetch stories from React Query hook
  const { data: stories = [], isLoading } = useStoriesQuery(token || '');
  const createStoryMutation = useCreateStoryMutation(token || '');

  // 2. Navigation & scroll handlers
  const updateArrows = () => {
    const el = scrollContainerRef.current;
    if (el) {
      setShowLeftArrow(el.scrollLeft > 5);
      setShowRightArrow(el.scrollLeft < el.scrollWidth - el.clientWidth - 5);
    }
  };

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) {
      el.addEventListener('scroll', updateArrows);
      // Run on init
      updateArrows();
    }
    return () => el?.removeEventListener('scroll', updateArrows);
  }, [stories]);

  const handleScroll = (direction: 'left' | 'right') => {
    const el = scrollContainerRef.current;
    if (el) {
      const scrollAmount = direction === 'left' ? -350 : 350;
      el.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // 3. Create Story Upload triggers
  const handleCreateStoryClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showToast('Error', 'File exceeds 10MB limit', true);
      return;
    }

    try {
      showToast('Uploading', 'Uploading story media to cloud...', false);
      const uploadRes = await uploadMedia(token || '', file);
      
      showToast('Publishing', 'Creating story...', false);
      await createStoryMutation.mutateAsync(uploadRes.url);
      
      showToast('Success', 'Story published successfully!', false);
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to publish story', true);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 4. Story Viewer navigation logic
  const currentIndex = activeStory ? stories.findIndex(s => s.id === activeStory.id) : -1;

  const handleNextStory = () => {
    if (currentIndex >= 0 && currentIndex < stories.length - 1) {
      setActiveStory(stories[currentIndex + 1]);
    } else {
      setActiveStory(null);
    }
  };

  const handlePrevStory = () => {
    if (currentIndex > 0) {
      setActiveStory(stories[currentIndex - 1]);
    }
  };

  useEffect(() => {
    if (!activeStory) return;

    const timer = setTimeout(() => {
      handleNextStory();
    }, 5000); // Instagram/Facebook style: 5 second auto-advance

    return () => clearTimeout(timer);
  }, [activeStory, currentIndex, stories]);

  return (
    <div 
      className="stories-wrapper"
      style={{
        position: 'relative',
        width: '100%',
        margin: '0 0 16px 0',
        display: 'flex',
        alignItems: 'center'
      }}
    >
      {/* Hidden File input for story upload */}
      <input 
        type="file" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        accept="image/*" 
        onChange={handleFileChange} 
      />

      {/* Left Navigation Arrow */}
      {showLeftArrow && (
        <button
          onClick={() => handleScroll('left')}
          style={{
            position: 'absolute',
            left: '8px',
            zIndex: 5,
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'var(--panel-bg)',
            border: '1px solid var(--panel-border)',
            color: 'var(--text-main)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            transition: 'background 0.2s, transform 0.2s',
          }}
          className="story-nav-btn"
          aria-label="Scroll left"
        >
          <i className="fa-solid fa-chevron-left" style={{ fontSize: '14px' }}></i>
        </button>
      )}

      {/* Horizontal Scroll Area */}
      <div 
        ref={scrollContainerRef}
        className="stories-scroll-container"
        style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          scrollBehavior: 'smooth',
          width: '100%',
          padding: '4px 0',
        }}
      >
        {/* Current user's create-story card */}
        <StoryCard 
          story={{ id: 'me', username: 'Create Story', thumbnailUrl: '', userAvatar: null, userId: '', createdAt: '' }} 
          isCreateCard={true} 
          currentUserAvatar={currentUser?.avatar_url}
          onClick={handleCreateStoryClick}
        />

        {/* Stories list loading state/fallback */}
        {isLoading ? (
          <div style={{ display: 'flex', gap: '8px' }}>
            {[1, 2, 3].map((n) => (
              <div 
                key={n} 
                style={{ 
                  width: '112px', 
                  height: '200px', 
                  borderRadius: '12px', 
                  background: 'var(--panel-bg)', 
                  border: '1px solid var(--panel-border)',
                  opacity: 0.15 
                }} 
              />
            ))}
          </div>
        ) : (
          stories.map((story) => (
            <StoryCard 
              key={story.id} 
              story={story} 
              onClick={() => setActiveStory(story)}
            />
          ))
        )}
      </div>

      {/* Right Navigation Arrow */}
      {showRightArrow && (
        <button
          onClick={() => handleScroll('right')}
          style={{
            position: 'absolute',
            right: '8px',
            zIndex: 5,
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'var(--panel-bg)',
            border: '1px solid var(--panel-border)',
            color: 'var(--text-main)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            transition: 'background 0.2s, transform 0.2s',
          }}
          className="story-nav-btn"
          aria-label="Scroll right"
        >
          <i className="fa-solid fa-chevron-right" style={{ fontSize: '14px' }}></i>
        </button>
      )}

      {/* 5. Premium Active Story Viewer Modal */}
      {activeStory && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            backdropFilter: 'blur(20px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
          }}
          onClick={() => setActiveStory(null)}
        >
          {/* Close button top right */}
          <button 
            onClick={(e) => { e.stopPropagation(); setActiveStory(null); }}
            style={{
              position: 'absolute',
              top: '24px',
              right: '24px',
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              cursor: 'pointer',
              fontSize: '18px',
              transition: 'background 0.2s'
            }}
          >
            <i className="fa-solid fa-xmark"></i>
          </button>

          {/* Left Navigation Arrow */}
          {currentIndex > 0 && (
            <button 
              onClick={(e) => { e.stopPropagation(); handlePrevStory(); }}
              style={{
                position: 'absolute',
                left: '24px',
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: '50%',
                width: '48px',
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                cursor: 'pointer',
                fontSize: '20px',
                transition: 'background 0.2s'
              }}
            >
              <i className="fa-solid fa-chevron-left"></i>
            </button>
          )}

          {/* Center Story Container */}
          <div 
            style={{
              width: '100%',
              maxWidth: '420px',
              height: '90vh',
              maxHeight: '720px',
              borderRadius: '16px',
              overflow: 'hidden',
              position: 'relative',
              background: '#0c0f1d',
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Info Bar */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              padding: '20px 20px 40px',
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)',
              zIndex: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              {/* Progress Bar */}
              <div style={{
                height: '3px',
                background: 'rgba(255,255,255,0.25)',
                width: '100%',
                borderRadius: '2px',
                overflow: 'hidden'
              }}>
                <div 
                  key={activeStory.id} // Forces re-render of progress bar animation on story change
                  style={{
                    height: '100%',
                    background: 'var(--primary)',
                    animation: 'storyProgress 5s linear forwards'
                  }} 
                />
              </div>

              {/* User Meta info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img 
                  src={activeStory.userAvatar || 'https://via.placeholder.com/150'} 
                  alt={activeStory.username}
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    border: '2px solid white',
                    objectFit: 'cover'
                  }}
                />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 650, fontSize: '14px', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                    {activeStory.username}
                  </span>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                    {new Date(activeStory.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>

            {/* Story Image */}
            <img 
              src={activeStory.thumbnailUrl} 
              alt="Story Content"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                zIndex: 1
              }}
            />
          </div>

          {/* Right Navigation Arrow */}
          {currentIndex < stories.length - 1 && (
            <button 
              onClick={(e) => { e.stopPropagation(); handleNextStory(); }}
              style={{
                position: 'absolute',
                right: '24px',
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: '50%',
                width: '48px',
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                cursor: 'pointer',
                fontSize: '20px',
                transition: 'background 0.2s'
              }}
            >
              <i className="fa-solid fa-chevron-right"></i>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
