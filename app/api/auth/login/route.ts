import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import { generateToken } from '@/lib/jwt';
import { logActivity } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 5 attempts per 15 minutes per IP
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const rateLimit = checkRateLimit(`login:${ip}`, {
      maxAttempts: 5,
      windowSeconds: 15 * 60,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many login attempts. Please try again in ${Math.ceil(rateLimit.resetInSeconds / 60)} minutes.`,
          retryAfter: rateLimit.resetInSeconds,
        },
        { status: 429 },
      );
    }

    await dbConnect();

    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        {
          success: false,
          error: 'Email and password are required',
        },
        { status: 400 },
      );
    }

    // Find user with password field
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid credentials',
        },
        { status: 401 },
      );
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid credentials',
        },
        { status: 401 },
      );
    }

    // Generate token
    const token = generateToken({
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      allowedPages: (user.allowedPages ||
        []) as import('@/types/User').AdminPage[],
      createdAt: user.createdAt!,
      updatedAt: user.updatedAt!,
    });

    // Log activity
    await logActivity({
      userId: user._id.toString(),
      userName: user.name,
      userEmail: user.email,
      action: 'login',
      resource: 'auth',
      details: `User ${user.name} logged in`,
    });

    // Create response with cookie
    const response = NextResponse.json({
      success: true,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          allowedPages: user.allowedPages || [],
        },
        token,
      },
    });

    // Set HTTP-only cookie
    response.cookies.set('admin-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Error logging in:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to login',
      },
      { status: 500 },
    );
  }
}
