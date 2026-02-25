import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Referral from '@/models/Referral';
import { requireAuth } from '@/lib/auth-middleware';
import { logActivity } from '@/lib/logger';
import { TokenPayload } from '@/lib/jwt';

// GET: Fetch all referrals with pagination
async function getReferralsHandler(request: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const page = parseInt(searchParams.get('page') || '1');
    const search = searchParams.get('search');

    const query: Record<string, unknown> = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { referralId: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;

    const referrals = await Referral.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Referral.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: {
        referrals,
        pagination: {
          currentPage: page,
          totalPages,
          totalReferrals: total,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching referrals:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch referrals' },
      { status: 500 },
    );
  }
}

// POST: Create a new referral
async function createReferralHandler(
  request: NextRequest,
  context: { user: TokenPayload },
) {
  try {
    await dbConnect();

    const body = await request.json();
    const { name, referralId, phone } = body;

    if (!name || !referralId || !phone) {
      return NextResponse.json(
        { success: false, error: 'Name, referralId, and phone are required' },
        { status: 400 },
      );
    }

    // Check if referralId already exists
    const existing = await Referral.findOne({ referralId });
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Referral ID already exists' },
        { status: 400 },
      );
    }

    const referral = await Referral.create({ name, referralId, phone });

    await logActivity({
      userId: context.user.userId,
      userName: context.user.name,
      userEmail: context.user.email,
      action: 'create',
      resource: 'referral',
      resourceId: referral._id.toString(),
      details: `Created referral: ${name} (${referralId})`,
    });

    return NextResponse.json(
      { success: true, data: referral },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error creating referral:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create referral' },
      { status: 500 },
    );
  }
}

export const GET = requireAuth(getReferralsHandler);
export const POST = requireAuth(createReferralHandler);
