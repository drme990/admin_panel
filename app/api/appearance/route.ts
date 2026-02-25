import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Appearance from '@/models/Appearance';
import { requireAuth } from '@/lib/auth-middleware';
import { logActivity } from '@/lib/logger';
import { TokenPayload } from '@/lib/jwt';

// GET: Fetch appearance settings (public, singleton)
export async function GET() {
  try {
    await dbConnect();
    const appearance = (await Appearance.findOne().lean()) as {
      worksImages?: { row1: string[]; row2: string[] };
    } | null;

    if (!appearance) {
      return NextResponse.json({
        success: true,
        data: { row1: [], row2: [] },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        row1: appearance.worksImages?.row1 ?? [],
        row2: appearance.worksImages?.row2 ?? [],
      },
    });
  } catch (error) {
    console.error('Error fetching appearance:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch appearance settings' },
      { status: 500 },
    );
  }
}

// PUT: Update appearance settings (admin only, singleton upsert)
async function updateAppearanceHandler(
  request: NextRequest,
  context: { user: TokenPayload },
) {
  try {
    await dbConnect();

    const body = await request.json();
    const { worksImages } = body;

    if (
      !worksImages ||
      !Array.isArray(worksImages.row1) ||
      !Array.isArray(worksImages.row2)
    ) {
      return NextResponse.json(
        { success: false, error: 'Invalid worksImages format' },
        { status: 400 },
      );
    }

    const appearance = await Appearance.findOneAndUpdate(
      {},
      { worksImages },
      { new: true, upsert: true, runValidators: true },
    );

    await logActivity({
      userId: context.user.userId,
      userName: context.user.name,
      userEmail: context.user.email,
      action: 'update',
      resource: 'appearance',
      resourceId: 'singleton',
      details: `Updated appearance (${worksImages.row1.length} row1 imgs, ${worksImages.row2.length} row2 imgs)`,
    });

    return NextResponse.json({ success: true, data: appearance });
  } catch (error) {
    console.error('Error updating appearance:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update appearance settings' },
      { status: 500 },
    );
  }
}

export const PUT = requireAuth(updateAppearanceHandler);
