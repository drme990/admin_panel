import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User, { IUser } from '@/models/User';
import { requireAuth } from '@/lib/auth-middleware';
import { logActivity } from '@/lib/logger';
import { TokenPayload } from '@/lib/jwt';

async function getUsersHandler(request: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const page = parseInt(searchParams.get('page') || '1');
    const role = searchParams.get('role');

    const query: Partial<Pick<IUser, 'role'>> = {};
    if (role && (role === 'admin' || role === 'super_admin')) {
      query.role = role;
    }

    const skip = (page - 1) * limit;

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await User.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: page,
          totalPages,
          totalUsers: total,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch users',
      },
      { status: 500 },
    );
  }
}

export const GET = requireAuth(getUsersHandler);

async function createUserHandler(
  request: NextRequest,
  context: { user: TokenPayload },
) {
  try {
    await dbConnect();

    const body: Omit<IUser, '_id' | 'createdAt' | 'updatedAt'> =
      await request.json();

    const { name, email, password, role } = body;
    if (!name || !email || !password || !role) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: name, email, password, role',
        },
        { status: 400 },
      );
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: 'Email already exists',
        },
        { status: 409 },
      );
    }

    const user = await User.create(body);

    await logActivity({
      userId: context.user.userId,
      userName: context.user.name,
      userEmail: context.user.email,
      action: 'create',
      resource: 'user',
      resourceId: user._id.toString(),
      details: `Created user ${user.name} (${user.email})`,
    });

    const userObj = user.toObject();
    const userResponse: Omit<typeof userObj, 'password'> = userObj;

    return NextResponse.json(
      {
        success: true,
        data: userResponse,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create user',
      },
      { status: 500 },
    );
  }
}

export const POST = requireAuth(createUserHandler);
