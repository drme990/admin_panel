import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Product, { IProduct } from '@/models/Product';
import { requireAuth } from '@/lib/auth-middleware';
import { logActivity } from '@/lib/logger';
import { TokenPayload } from '@/lib/jwt';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const page = parseInt(searchParams.get('page') || '1');
    const inStock = searchParams.get('inStock');

    const query: Partial<Pick<IProduct, 'inStock' | 'workAsSacrifice'>> = {};
    if (inStock !== null) {
      query.inStock = inStock === 'true';
    }
    const sacrifice = searchParams.get('sacrifice');
    if (sacrifice === 'true') {
      query.workAsSacrifice = true;
    }

    const skip = (page - 1) * limit;

    const products = await Product.find(query)
      .sort({ displayOrder: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Product.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: {
        products,
        pagination: {
          currentPage: page,
          totalPages,
          totalProducts: total,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch products',
      },
      { status: 500 },
    );
  }
}

async function createProductHandler(
  request: NextRequest,
  context: { user: TokenPayload },
) {
  try {
    await dbConnect();

    const body: Omit<IProduct, '_id' | 'createdAt' | 'updatedAt'> =
      await request.json();

    const { name, baseCurrency, sizes } = body;
    if (!name?.ar || !name?.en || !baseCurrency) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: name.ar, name.en, baseCurrency',
        },
        { status: 400 },
      );
    }
    if (!sizes || !Array.isArray(sizes) || sizes.length < 1) {
      return NextResponse.json(
        {
          success: false,
          error: 'Product must have at least one size',
        },
        { status: 400 },
      );
    }

    const product = await Product.create(body);

    await logActivity({
      userId: context.user.userId,
      userName: context.user.name,
      userEmail: context.user.email,
      action: 'create',
      resource: 'product',
      resourceId: product._id.toString(),
      details: `Created product ${product.name.ar} (${product.baseCurrency})`,
    });

    return NextResponse.json(
      {
        success: true,
        data: product,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create product',
      },
      { status: 500 },
    );
  }
}

export const POST = requireAuth(createProductHandler);
