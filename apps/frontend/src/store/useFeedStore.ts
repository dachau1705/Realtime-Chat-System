import { create } from 'zustand';
import { type Post } from '../services/api';

interface FeedState {
  isDarkMode: boolean;
  onlineUsers: string[]; // List of user IDs currently active
  pendingNewPosts: Post[]; // Buffered posts received from Socket.io waiting to be pushed
  toggleDarkMode: () => void;
  setOnlineUsers: (userIds: string[]) => void;
  addOnlineUser: (userId: string) => void;
  removeOnlineUser: (userId: string) => void;
  addPendingPost: (post: Post) => void;
  clearPendingPosts: () => void;
}

export const useFeedStore = create<FeedState>((set) => ({
  // Initialize dark mode from localStorage or system theme
  isDarkMode: localStorage.getItem('theme') === 'dark' || 
    (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches),
  onlineUsers: [],
  pendingNewPosts: [],

  toggleDarkMode: () => set((state) => {
    const nextMode = !state.isDarkMode;
    localStorage.setItem('theme', nextMode ? 'dark' : 'light');
    if (nextMode) {
      document.body.classList.add('dark');
      document.documentElement.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
      document.documentElement.classList.remove('dark');
    }
    return { isDarkMode: nextMode };
  }),

  setOnlineUsers: (userIds) => set({ onlineUsers: userIds }),

  addOnlineUser: (userId) => set((state) => ({
    onlineUsers: state.onlineUsers.includes(userId) ? state.onlineUsers : [...state.onlineUsers, userId]
  })),

  removeOnlineUser: (userId) => set((state) => ({
    onlineUsers: state.onlineUsers.filter((id) => id !== userId)
  })),

  addPendingPost: (post) => set((state) => {
    // Avoid duplicates
    const alreadyExists = state.pendingNewPosts.some((p) => p.id === post.id);
    if (alreadyExists) return state;
    return { pendingNewPosts: [post, ...state.pendingNewPosts] };
  }),

  clearPendingPosts: () => set({ pendingNewPosts: [] })
}));
