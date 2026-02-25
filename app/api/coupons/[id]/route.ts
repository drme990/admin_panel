import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Coupon from '@/models/Coupon';
import { requireAuth } from '@/lib/auth-middleware';
import { logActivity } from '@/lib/logger';
import { TokenPayload } from '@/lib/jwt';

async function getCouponHandler(
  request: NextRequest,
  context: { user: TokenPayload; params?: Promise<Record<string, string>> },
) {
  try {
    await dbConnect();
    const params = await context.params;
    const coupon = await Coupon.findById(params?.id).lean();

    if (!coupon) {
      return NextResponse.json(
        { success: false, error: 'Coupon not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: coupon });
  } catch (error) {
    console.error('Error fetching coupon:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch coupon' },
      { status: 500 },
    );
  }
}

async function updateCouponHandler(
  request: NextRequest,
  context: { user: TokenPayload; params?: Promise<Record<string, string>> },
) {
  try {
    await dbConnect();
    const params = await context.params;
    const body = await request.json();

    const coupon = await Coupon.findByIdAndUpdate(params?.id, body, {
      new: true,
      runValidators: true,
    });

    if (!coupon) {
      return NextResponse.json(
        { success: false, error: 'Coupon not found' },
        { status: 404 },
      );
    }

    await logActivity({
      userId: context.user.userId,
      userName: context.user.name,
      userEmail: context.user.email,
      action: 'update',
      resource: 'coupon',
      resourceId: coupon._id.toString(),
      details: `Updated coupon ${coupon.code}`,
    });

    return NextResponse.json({ success: true, data: coupon });
  } catch (error) {
    console.error('Error updating coupon:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update coupon' },
      { status: 500 },
    );
  }
}

async function deleteCouponHandler(
  request: NextRequest,
  context: { user: TokenPayload; params?: Promise<Record<string, string>> },
) {
  try {
    await dbConnect();
    const params = await context.params;
    const coupon = await Coupon.findByIdAndDelete(params?.id);

    if (!coupon) {
      return NextResponse.json(
        { success: false, error: 'Coupon not found' },
        { status: 404 },
      );
    }

    await logActivity({
      userId: context.user.userId,
      userName: context.user.name,
      userEmail: context.user.email,
      action: 'delete',
      resource: 'coupon',
      resourceId: coupon._id.toString(),
      details: `Deleted coupon ${coupon.code}`,
    });

    return NextResponse.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error('Error deleting coupon:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete coupon' },
      { status: 500 },
    );
  }
}

export const GET = requireAuth(getCouponHandler);
export const PUT = requireAuth(updateCouponHandler);
export const DELETE = requireAuth(deleteCouponHandler);
