import { useContext } from 'react';
import { ChatContext } from '../context/ChatContext';

/**
 * Custom hook to safely consume the global ChatContext in functional components.
 */
export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
