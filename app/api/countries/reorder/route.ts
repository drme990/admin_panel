import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Country from '@/models/Country';
import { requireAuth } from '@/lib/auth-middleware';
import { logActivity } from '@/lib/logger';
import { TokenPayload } from '@/lib/jwt';

// PUT: Reorder countries (admin only)
// Body: { orderedIds: string[] } — array of active country _id values in desired order
// Also sets sortOrder = null for ALL countries NOT in the list (inactive cleanup)
// Returns the full updated country list
async function reorderHandler(
  request: NextRequest,
  context: { user: TokenPayload },
) {
  try {
    await dbConnect();
    const body = await request.json();
    const { orderedIds } = body;

    if (!Array.isArray(orderedIds)) {
      return NextResponse.json(
        { success: false, error: 'orderedIds array is required' },
        { status: 400 },
      );
    }

    if (orderedIds.length > 0) {
      // Set contiguous 0-based sortOrder for the ordered active countries
      const bulkOps = orderedIds.map((id: string, index: number) => ({
        updateOne: {
          filter: { _id: id },
          update: { $set: { sortOrder: index } },
        },
      }));
      await Country.bulkWrite(bulkOps);
    }

    // Nullify sortOrder for ALL countries NOT in the ordered list
    await Country.updateMany(
      { _id: { $nin: orderedIds } },
      { $set: { sortOrder: null } },
    );

    // Return full updated list via find().lean() for consistent _id serialization
    const countries = await Country.find({})
      .sort({ sortOrder: 1, 'name.ar': 1 })
      .lean();

    await logActivity({
      userId: context.user.userId,
      userName: context.user.name,
      userEmail: context.user.email,
      action: 'update',
      resource: 'country',
      resourceId: 'bulk',
      details: `Reordered ${orderedIds.length} countries`,
    });

    return NextResponse.json({
      success: true,
      message: 'Countries reordered successfully',
      data: countries,
    });
  } catch (error) {
    console.error('Error reordering countries:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to reorder countries' },
      { status: 500 },
    );
  }
}

export const PUT = requireAuth(reorderHandler);
