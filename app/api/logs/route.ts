import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import ActivityLog from '@/models/ActivityLog';
import { requireAuth } from '@/lib/auth-middleware';

async function handler(request: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const page = parseInt(searchParams.get('page') || '1');
    const action = searchParams.get('action');
    const resource = searchParams.get('resource');
    const userId = searchParams.get('userId');

    const query: {
      action?: string;
      resource?: string;
      userId?: string;
    } = {};
    if (action) query.action = action;
    if (resource) query.resource = resource;
    if (userId) query.userId = userId;

    const skip = (page - 1) * limit;

    const logs = await ActivityLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await ActivityLog.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: {
        logs,
        pagination: {
          currentPage: page,
          totalPages,
          totalLogs: total,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch activity logs',
      },
      { status: 500 },
    );
  }
}

export const GET = requireAuth(handler);
