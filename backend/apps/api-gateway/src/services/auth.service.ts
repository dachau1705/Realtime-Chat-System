import jwt from 'jsonwebtoken';
import { hashPassword, comparePassword } from '../helpers/crypto.helper';
import * as userRepo from '../repositories/user.repository';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-123456';

export async function register(username: string, email: string, password: string) {
  const passwordHash = await hashPassword(password);
  const user = await userRepo.createUser(username, email, passwordHash);

  const token = jwt.sign(
    { userId: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  return { token, user };
}

export async function login(username: string, password: string) {
  const user = await userRepo.findUserByUsername(username);
  if (!user) {
    throw new Error('Invalid username or password');
  }

  const isPasswordValid = await comparePassword(password, user.password_hash);
  if (!isPasswordValid) {
    throw new Error('Invalid username or password');
  }

  const token = jwt.sign(
    { userId: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      avatar_url: user.avatar_url
    }
  };
}
