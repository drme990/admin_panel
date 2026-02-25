import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Coupon from '@/models/Coupon';
import { requireAuth } from '@/lib/auth-middleware';
import { logActivity } from '@/lib/logger';
import { TokenPayload } from '@/lib/jwt';

async function getCouponsHandler(request: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const page = parseInt(searchParams.get('page') || '1');
    const status = searchParams.get('status');

    const query: Record<string, string> = {};
    if (status) query.status = status;

    const skip = (page - 1) * limit;

    const coupons = await Coupon.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Coupon.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: {
        coupons,
        pagination: {
          currentPage: page,
          totalPages,
          totalCoupons: total,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching coupons:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch coupons' },
      { status: 500 },
    );
  }
}

async function createCouponHandler(
  request: NextRequest,
  context: { user: TokenPayload },
) {
  try {
    await dbConnect();

    const body = await request.json();
    const { code, type, value } = body;

    if (!code || !type || value === undefined) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: code, type, value',
        },
        { status: 400 },
      );
    }

    // Check duplicate
    const existing = await Coupon.findOne({
      code: code.toUpperCase().trim(),
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Coupon code already exists' },
        { status: 400 },
      );
    }

    const coupon = await Coupon.create({
      ...body,
      code: code.toUpperCase().trim(),
      createdBy: context.user.userId,
    });

    await logActivity({
      userId: context.user.userId,
      userName: context.user.name,
      userEmail: context.user.email,
      action: 'create',
      resource: 'coupon',
      resourceId: coupon._id.toString(),
      details: `Created coupon ${coupon.code} (${coupon.type}: ${coupon.value})`,
    });

    return NextResponse.json({ success: true, data: coupon }, { status: 201 });
  } catch (error) {
    console.error('Error creating coupon:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create coupon' },
      { status: 500 },
    );
  }
}

export const GET = requireAuth(getCouponsHandler);
export const POST = requireAuth(createCouponHandler);
