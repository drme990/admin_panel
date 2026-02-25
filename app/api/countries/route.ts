import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Country from '@/models/Country';
import { requireAuth } from '@/lib/auth-middleware';
import { logActivity } from '@/lib/logger';
import { TokenPayload } from '@/lib/jwt';

// GET: Fetch all countries (public)
export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') !== 'false';

    const query = activeOnly ? { isActive: true } : {};
    const countries = await Country.find(query).sort({ 'name.ar': 1 }).lean();

    return NextResponse.json({
      success: true,
      data: countries,
    });
  } catch (error) {
    console.error('Error fetching countries:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch countries' },
      { status: 500 },
    );
  }
}

// POST: Create country (admin only)
async function createCountryHandler(
  request: NextRequest,
  context: { user: TokenPayload },
) {
  try {
    await dbConnect();

    const body = await request.json();
    const { code, name, currencyCode, currencySymbol, flagEmoji, isActive } =
      body;

    if (!code || !name?.ar || !name?.en || !currencyCode || !currencySymbol) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Missing required fields: code, name.ar, name.en, currencyCode, currencySymbol',
        },
        { status: 400 },
      );
    }

    // Check for duplicate
    const existing = await Country.findOne({
      code: code.toUpperCase(),
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Country with this code already exists' },
        { status: 409 },
      );
    }

    const country = await Country.create({
      code: code.toUpperCase(),
      name,
      currencyCode: currencyCode.toUpperCase(),
      currencySymbol,
      flagEmoji: flagEmoji || '',
      isActive: isActive !== false,
    });

    await logActivity({
      userId: context.user.userId,
      userName: context.user.name,
      userEmail: context.user.email,
      action: 'create',
      resource: 'product',
      resourceId: country._id.toString(),
      details: `Created country ${country.name.ar} (${country.code})`,
    });

    return NextResponse.json({ success: true, data: country }, { status: 201 });
  } catch (error) {
    console.error('Error creating country:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create country' },
      { status: 500 },
    );
  }
}

export const POST = requireAuth(createCountryHandler);
