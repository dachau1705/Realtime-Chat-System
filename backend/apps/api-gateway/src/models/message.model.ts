import { ModelBase } from '@libs/common';

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  client_message_id: string;
  type: 'text' | 'image' | 'sticker';
  media_url?: string | null;
  created_at: Date;
}

class MessageModel extends ModelBase<Message> {
  constructor() {
    super('messages');
  }
}

export const messageModel = new MessageModel();
