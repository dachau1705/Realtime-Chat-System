import { ModelBase } from '@libs/common';

export interface Friendship {
  user_id_1: string;
  user_id_2: string;
  status: 'pending' | 'accepted';
  created_at: Date;
  updated_at: Date;
}

class FriendshipModel extends ModelBase<Friendship> {
  constructor() {
    super('friendships');
  }
}

export const friendshipModel = new FriendshipModel();
