import { cookies } from 'next/headers';
import { verifyToken } from './jwt';
import { User } from '@/types/User';
import dbConnect from './db';
import UserModel from '@/models/User';

export async function getCurrentUser(): Promise<User | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin-token')?.value;

    if (!token) return null;

    const payload = verifyToken(token);
    if (!payload) return null;

    await dbConnect();
    const user = await UserModel.findById(payload.userId).select('-password');

    if (!user) return null;

    return {
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt || new Date(),
      updatedAt: user.updatedAt || new Date(),
    };
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser();
  return user !== null;
}
