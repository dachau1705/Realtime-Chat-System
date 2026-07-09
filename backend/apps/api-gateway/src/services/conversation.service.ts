import * as conversationRepo from '../repositories/conversation.repository';
import { redisService } from '../config/services';
import { logger } from '@libs/common';

export async function getConversations(userId: string) {
  const conversations = await conversationRepo.getUserConversations(userId);

  const enrichedConversations = await Promise.all(
    conversations.map(async (c: any) => {
      if (c.is_group) {
        return { ...c, is_online: false };
      }
      
      const otherUserId = c.member_ids?.[0];
      if (!otherUserId) {
        return { ...c, is_online: false };
      }

      try {
        const presence = await redisService.getUserPresence(otherUserId);
        return {
          ...c,
          is_online: presence?.status === 'online'
        };
      } catch (err) {
        logger.warn('Failed to fetch user presence from Redis', { userId: otherUserId, error: (err as Error).message });
        return { ...c, is_online: false };
      }
    })
  );

  return enrichedConversations;
}

export async function createConversation(
  name: string | null,
  isGroup: boolean,
  memberIds: string[],
  currentUserId: string
) {
  const uniqueMemberIds = Array.from(new Set([...memberIds, currentUserId]));

  // Deduplicate 1-1 conversations
  if (!isGroup && uniqueMemberIds.length === 2) {
    const existing = await conversationRepo.checkExisting1to1Conversation(uniqueMemberIds[0], uniqueMemberIds[1]);
    if (existing) {
      return { ...existing, memberIds: uniqueMemberIds };
    }
  }

  const conversation = await conversationRepo.createConversationTransaction(
    name,
    isGroup,
    uniqueMemberIds,
    null // avatarUrl
  );

  // Broadcast new_conversation event
  try {
    await redisService.publish('chat:events', {
      type: 'new_conversation',
      data: {
        ...conversation,
        memberIds: uniqueMemberIds
      }
    });
  } catch (redisErr) {
    logger.error('Failed to publish new_conversation event to Redis', { error: (redisErr as Error).message });
  }

  return conversation;
}

export async function getMessages(
  conversationId: string,
  currentUserId: string,
  limit: number,
  before?: string,
  beforeId?: string
) {
  const isMember = await conversationRepo.verifyConversationMembership(conversationId, currentUserId);
  if (!isMember) {
    throw new Error('You are not authorized to view messages in this conversation');
  }

  return await conversationRepo.getConversationMessages(conversationId, limit, before, beforeId);
}

export async function markAsRead(conversationId: string, currentUserId: string) {
  const isMember = await conversationRepo.verifyConversationMembership(conversationId, currentUserId);
  if (!isMember) {
    throw new Error('You are not authorized to access this conversation');
  }

  await conversationRepo.markConversationMessagesAsRead(conversationId, currentUserId);

  // Broadcast to Redis
  try {
    await redisService.publish('chat:events', {
      type: 'receipt',
      data: {
        conversation_id: conversationId,
        message_id: 'all',
        user_id: currentUserId,
        status: 'seen'
      }
    });
  } catch (redisErr) {
    logger.error('Failed to publish bulk read receipt to Redis', { error: (redisErr as Error).message });
  }

  return { message: 'Conversation messages marked as read' };
}
