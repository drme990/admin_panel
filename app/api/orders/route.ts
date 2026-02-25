import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Order from '@/models/Order';
import { requireAuth } from '@/lib/auth-middleware';

// GET: Fetch all orders (admin only)
async function getOrdersHandler(request: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const page = parseInt(searchParams.get('page') || '1');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const referralId = searchParams.get('referralId');

    const query: Record<string, unknown> = {};
    if (status) {
      query.status = status;
    }
    if (referralId) {
      query.referralId = referralId;
    }
    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { 'billingData.email': { $regex: search, $options: 'i' } },
        { 'billingData.fullName': { $regex: search, $options: 'i' } },
        { 'billingData.phone': { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Order.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: {
        orders,
        pagination: {
          currentPage: page,
          totalPages,
          totalOrders: total,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch orders' },
      { status: 500 },
    );
  }
}

export const GET = requireAuth(getOrdersHandler);
