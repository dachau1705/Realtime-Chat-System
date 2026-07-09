import { ModelBase } from '@libs/common';

export interface Conversation {
  id: string;
  name?: string | null;
  is_group: boolean;
  avatar_url?: string | null;
  created_at: Date;
  updated_at: Date;
}

class ConversationModel extends ModelBase<Conversation> {
  constructor() {
    super('conversations');
  }
}

export const conversationModel = new ConversationModel();
