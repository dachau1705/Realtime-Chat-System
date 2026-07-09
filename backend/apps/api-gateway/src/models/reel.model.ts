import { ModelBase } from '@libs/common';

export interface Reel {
  id: string;
  user_id: string;
  video_url: string;
  thumbnail_url?: string;
  caption?: string | null;
  likes_count: number;
  comments_count: number;
  created_at: Date;
  updated_at: Date;
}

class ReelModel extends ModelBase<Reel> {
  constructor() {
    super('reels');
  }
}

export const reelModel = new ReelModel();
