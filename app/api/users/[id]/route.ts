import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import { requireAuth } from '@/lib/auth-middleware';
import { logActivity } from '@/lib/logger';
import { TokenPayload } from '@/lib/jwt';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await dbConnect();

    const { id } = await params;
    const user = await User.findById(id).lean();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch user' },
      { status: 500 },
    );
  }
}

async function updateUserHandler(
  request: NextRequest,
  context: {
    user: TokenPayload;
    params?: Promise<Record<string, string>>;
  },
) {
  try {
    await dbConnect();

    const params = await context.params;
    if (!params?.id) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 },
      );
    }
    const id = params.id;
    const body = await request.json();

    // Prevent editing own account via admin panel
    if (id === context.user.userId) {
      return NextResponse.json(
        { success: false, error: 'You cannot edit your own account' },
        { status: 403 },
      );
    }
    const { name, email, password, role, allowedPages } = body;

    const target = await User.findById(id);
    if (!target) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 },
      );
    }

    // Build update object
    const update: Record<string, unknown> = {};
    if (name) update.name = name;
    if (email) update.email = email;
    if (role) update.role = role;
    if (Array.isArray(allowedPages)) update.allowedPages = allowedPages;
    if (password && password.length >= 6) {
      // Let the model pre-save hook hash it
      target.set({ password });
    }
    target.set(update);
    await target.save();

    await logActivity({
      userId: context.user.userId,
      userName: context.user.name,
      userEmail: context.user.email,
      action: 'update',
      resource: 'user',
      resourceId: id,
      details: `Updated user ${target.name} (${target.email})`,
    });

    const updated = await User.findById(id).select('-password').lean();
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update user' },
      { status: 500 },
    );
  }
}

export const PUT = requireAuth(updateUserHandler);

async function deleteUserHandler(
  request: NextRequest,
  context: {
    user: TokenPayload;
    params?: Promise<Record<string, string>>;
  },
) {
  try {
    await dbConnect();

    const params = await context.params;
    if (!params?.id) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 },
      );
    }
    const id = params.id;

    // Prevent self-deletion
    if (id === context.user.userId) {
      return NextResponse.json(
        { success: false, error: 'You cannot delete your own account' },
        { status: 403 },
      );
    }

    const target = await User.findById(id);
    if (!target) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 },
      );
    }

    // Only super_admin can delete super_admin accounts
    if (target.role === 'super_admin' && context.user.role !== 'super_admin') {
      return NextResponse.json(
        {
          success: false,
          error: 'Only super admins can delete super admin accounts',
        },
        { status: 403 },
      );
    }

    const deletedUserName = target.name;
    const deletedUserEmail = target.email;

    await User.findByIdAndDelete(id);

    await logActivity({
      userId: context.user.userId,
      userName: context.user.name,
      userEmail: context.user.email,
      action: 'delete',
      resource: 'user',
      resourceId: id,
      details: `Deleted user ${deletedUserName} (${deletedUserEmail})`,
    });

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete user' },
      { status: 500 },
    );
  }
}

export const DELETE = requireAuth(deleteUserHandler);
