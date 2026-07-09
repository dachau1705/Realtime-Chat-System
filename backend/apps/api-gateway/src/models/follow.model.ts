import { ModelBase } from '@libs/common';

export interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: Date;
}

class FollowModel extends ModelBase<Follow> {
  constructor() {
    super('follows');
  }
}

export const followModel = new FollowModel();
