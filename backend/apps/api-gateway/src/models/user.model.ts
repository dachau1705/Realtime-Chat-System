import { ModelBase } from '@libs/common';

export interface User {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  full_name?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  cover_url?: string | null;
  bio?: string | null;
  privacy_is_public: boolean;
  created_at: Date;
  updated_at: Date;
}

class UserModel extends ModelBase<User> {
  constructor() {
    super('users');
  }
}

export const userModel = new UserModel();
