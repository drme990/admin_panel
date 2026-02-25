import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Product from '@/models/Product';
import { requireAuth } from '@/lib/auth-middleware';
import { logActivity } from '@/lib/logger';
import { TokenPayload } from '@/lib/jwt';
import mongoose from 'mongoose';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await dbConnect();

    const { id } = await params;
    const product = await Product.findById(id).lean();

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch product' },
      { status: 500 },
    );
  }
}

async function updateProductHandler(
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
        { success: false, error: 'Product ID is required' },
        { status: 400 },
      );
    }
    const id = params.id;
    const body = await request.json();

    const product = await Product.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    });

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 },
      );
    }

    await logActivity({
      userId: context.user.userId,
      userName: context.user.name,
      userEmail: context.user.email,
      action: 'update',
      resource: 'product',
      resourceId: id,
      details: `Updated product ${product.name.ar}`,
      metadata: body,
    });

    return NextResponse.json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update product' },
      { status: 500 },
    );
  }
}

async function deleteProductHandler(
  request: NextRequest,
  context: {
    user: TokenPayload;
    params?: Promise<Record<string, string>>;
  },
) {
  try {
    const conn = await dbConnect();

    const params = await context.params;
    if (!params?.id) {
      return NextResponse.json(
        { success: false, error: 'Product ID is required' },
        { status: 400 },
      );
    }
    const id = params.id;
    const product = await Product.findById(id);

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 },
      );
    }

    const deletedProductName = product.name.ar;

    await Product.findByIdAndDelete(id);

    // Re-normalize displayOrder for remaining products using native driver
    const remaining = await Product.find()
      .sort({ displayOrder: 1, createdAt: -1 })
      .select('_id')
      .lean();
    if (remaining.length > 0) {
      const now = new Date();
      const collection = conn.connection.db!.collection('products');
      const bulkOps = remaining.map((p, i) => ({
        updateOne: {
          filter: { _id: new mongoose.Types.ObjectId(p._id!.toString()) },
          update: { $set: { displayOrder: i, updatedAt: now } },
        },
      }));
      await collection.bulkWrite(bulkOps, { ordered: false });
    }

    await logActivity({
      userId: context.user.userId,
      userName: context.user.name,
      userEmail: context.user.email,
      action: 'delete',
      resource: 'product',
      resourceId: id,
      details: `Deleted product ${deletedProductName}`,
    });

    return NextResponse.json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete product' },
      { status: 500 },
    );
  }
}

export const PUT = requireAuth(updateProductHandler);
export const DELETE = requireAuth(deleteProductHandler);
