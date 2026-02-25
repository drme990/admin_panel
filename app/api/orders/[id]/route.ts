import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Order from '@/models/Order';
import { requireAuth } from '@/lib/auth-middleware';
import { TokenPayload } from '@/lib/jwt';

// GET: Fetch single order (admin only)
async function getOrderHandler(
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
        { success: false, error: 'Order ID is required' },
        { status: 400 },
      );
    }

    const order = await Order.findById(params.id).lean();

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    console.error('Error fetching order:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch order' },
      { status: 500 },
    );
  }
}

// PUT: Update order status (admin only)
async function updateOrderHandler(
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
        { success: false, error: 'Order ID is required' },
        { status: 400 },
      );
    }

    const body = await request.json();

    // Only allow specific fields to be updated
    const allowedUpdates: Record<string, unknown> = {};
    if (body.status) allowedUpdates.status = body.status;
    if (body.notes !== undefined) allowedUpdates.notes = body.notes;

    const order = await Order.findByIdAndUpdate(params.id, allowedUpdates, {
      new: true,
      runValidators: true,
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    console.error('Error updating order:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update order' },
      { status: 500 },
    );
  }
}

export const GET = requireAuth(getOrderHandler);
export const PUT = requireAuth(updateOrderHandler);
