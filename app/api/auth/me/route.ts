import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import dbConnect from '@/lib/db';
import User from '@/models/User';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('admin-token')?.value;

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: 'Not authenticated',
        },
        { status: 401 },
      );
    }

    const payload = verifyToken(token);

    if (!payload) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid token',
        },
        { status: 401 },
      );
    }

    await dbConnect();
    const user = await User.findById(payload.userId);

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found',
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          allowedPages: user.allowedPages || [],
        },
      },
    });
  } catch (error) {
    console.error('Error getting current user:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get user',
      },
      { status: 500 },
    );
  }
}
