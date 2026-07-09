import { ModelBase } from '@libs/common';

export interface Post {
  id: string;
  user_id: string;
  content?: string | null;
  media_urls?: string[];
  visibility: 'public' | 'friends' | 'private';
  allowed_user_ids?: string[];
  blocked_user_ids?: string[];
  created_at: Date;
  updated_at: Date;
}

class PostModel extends ModelBase<Post> {
  constructor() {
    super('posts');
  }
}

export const postModel = new PostModel();
