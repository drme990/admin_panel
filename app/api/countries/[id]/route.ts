import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Country from '@/models/Country';
import { requireAuth } from '@/lib/auth-middleware';
import { logActivity } from '@/lib/logger';
import { TokenPayload } from '@/lib/jwt';

// GET: Fetch single country
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await dbConnect();
    const { id } = await params;
    const country = await Country.findById(id).lean();

    if (!country) {
      return NextResponse.json(
        { success: false, error: 'Country not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: country });
  } catch (error) {
    console.error('Error fetching country:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch country' },
      { status: 500 },
    );
  }
}

// PUT: Update country (admin)
async function updateCountryHandler(
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
        { success: false, error: 'Country ID is required' },
        { status: 400 },
      );
    }

    const body = await request.json();
    const country = await Country.findByIdAndUpdate(params.id, body, {
      new: true,
      runValidators: true,
    });

    if (!country) {
      return NextResponse.json(
        { success: false, error: 'Country not found' },
        { status: 404 },
      );
    }

    await logActivity({
      userId: context.user.userId,
      userName: context.user.name,
      userEmail: context.user.email,
      action: 'update',
      resource: 'product',
      resourceId: params.id,
      details: `Updated country ${country.name.ar} (${country.code})`,
    });

    return NextResponse.json({ success: true, data: country });
  } catch (error) {
    console.error('Error updating country:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update country' },
      { status: 500 },
    );
  }
}

// DELETE: Delete country (admin)
async function deleteCountryHandler(
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
        { success: false, error: 'Country ID is required' },
        { status: 400 },
      );
    }

    const country = await Country.findByIdAndDelete(params.id);

    if (!country) {
      return NextResponse.json(
        { success: false, error: 'Country not found' },
        { status: 404 },
      );
    }

    await logActivity({
      userId: context.user.userId,
      userName: context.user.name,
      userEmail: context.user.email,
      action: 'delete',
      resource: 'product',
      resourceId: params.id,
      details: `Deleted country ${country.name.ar} (${country.code})`,
    });

    return NextResponse.json({
      success: true,
      message: 'Country deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting country:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete country' },
      { status: 500 },
    );
  }
}

export const PUT = requireAuth(updateCountryHandler);
export const DELETE = requireAuth(deleteCountryHandler);
