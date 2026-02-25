import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Referral from '@/models/Referral';
import { requireAuth } from '@/lib/auth-middleware';
import { logActivity } from '@/lib/logger';
import { TokenPayload } from '@/lib/jwt';

// GET: Fetch a single referral by ID
async function getReferralHandler(
  request: NextRequest,
  context: { user: TokenPayload; params?: Promise<Record<string, string>> },
) {
  try {
    await dbConnect();
    const params = await context.params;
    const id = params?.id;

    const referral = await Referral.findById(id).lean();
    if (!referral) {
      return NextResponse.json(
        { success: false, error: 'Referral not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: referral });
  } catch (error) {
    console.error('Error fetching referral:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch referral' },
      { status: 500 },
    );
  }
}

// PUT: Update a referral
async function updateReferralHandler(
  request: NextRequest,
  context: { user: TokenPayload; params?: Promise<Record<string, string>> },
) {
  try {
    await dbConnect();
    const params = await context.params;
    const id = params?.id;
    const body = await request.json();
    const { name, referralId, phone } = body;

    // Check if referralId is taken by another referral
    if (referralId) {
      const existing = await Referral.findOne({
        referralId,
        _id: { $ne: id },
      });
      if (existing) {
        return NextResponse.json(
          { success: false, error: 'Referral ID already exists' },
          { status: 400 },
        );
      }
    }

    const referral = await Referral.findByIdAndUpdate(
      id,
      { name, referralId, phone },
      { new: true, runValidators: true },
    );

    if (!referral) {
      return NextResponse.json(
        { success: false, error: 'Referral not found' },
        { status: 404 },
      );
    }

    await logActivity({
      userId: context.user.userId,
      userName: context.user.name,
      userEmail: context.user.email,
      action: 'update',
      resource: 'referral',
      resourceId: id,
      details: `Updated referral: ${referral.name} (${referral.referralId})`,
    });

    return NextResponse.json({ success: true, data: referral });
  } catch (error) {
    console.error('Error updating referral:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update referral' },
      { status: 500 },
    );
  }
}

// DELETE: Delete a referral
async function deleteReferralHandler(
  request: NextRequest,
  context: { user: TokenPayload; params?: Promise<Record<string, string>> },
) {
  try {
    await dbConnect();
    const params = await context.params;
    const id = params?.id;

    const referral = await Referral.findByIdAndDelete(id);
    if (!referral) {
      return NextResponse.json(
        { success: false, error: 'Referral not found' },
        { status: 404 },
      );
    }

    await logActivity({
      userId: context.user.userId,
      userName: context.user.name,
      userEmail: context.user.email,
      action: 'delete',
      resource: 'referral',
      resourceId: id,
      details: `Deleted referral: ${referral.name} (${referral.referralId})`,
    });

    return NextResponse.json({
      success: true,
      message: 'Referral deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting referral:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete referral' },
      { status: 500 },
    );
  }
}

export const GET = requireAuth(getReferralHandler);
export const PUT = requireAuth(updateReferralHandler);
export const DELETE = requireAuth(deleteReferralHandler);
