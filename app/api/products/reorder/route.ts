import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { requireAuth } from '@/lib/auth-middleware';
import { logActivity } from '@/lib/logger';
import { TokenPayload } from '@/lib/jwt';
import mongoose from 'mongoose';

async function reorderHandler(
  request: NextRequest,
  context: { user: TokenPayload },
) {
  try {
    const conn = await dbConnect();

    const body = await request.json();
    const orders: { id: string; displayOrder: number }[] = body.orders;

    if (!Array.isArray(orders) || orders.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'orders must be a non-empty array of { id, displayOrder }',
        },
        { status: 400 },
      );
    }

    const db = conn.connection.db;
    const collection = db!.collection('products');
    const now = new Date();

    const bulkOps = orders.map((item) => ({
      updateOne: {
        filter: { _id: new mongoose.Types.ObjectId(item.id) },
        update: { $set: { displayOrder: item.displayOrder, updatedAt: now } },
      },
    }));

    const result = await collection.bulkWrite(bulkOps, { ordered: false });

    await logActivity({
      userId: context.user.userId,
      userName: context.user.name,
      userEmail: context.user.email,
      action: 'update',
      resource: 'product',
      details: `Reordered ${result.modifiedCount}/${orders.length} products`,
    });

    return NextResponse.json({
      success: true,
      updated: result.modifiedCount,
    });
  } catch (error) {
    console.error('Error reordering products:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to reorder products' },
      { status: 500 },
    );
  }
}

export const PUT = requireAuth(reorderHandler);
