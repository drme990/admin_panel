import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import PaymentSettings from '@/models/PaymentSettings';
import { requireAuth } from '@/lib/auth-middleware';
import { logActivity } from '@/lib/logger';
import { TokenPayload } from '@/lib/jwt';

const VALID_PROJECTS = ['ghadaq', 'manasik'] as const;

async function getPaymentSettingsHandler(request: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const project = searchParams.get('project');

    // If project specified, return single
    if (project) {
      if (
        !VALID_PROJECTS.includes(project as (typeof VALID_PROJECTS)[number])
      ) {
        return NextResponse.json(
          { success: false, error: 'Invalid project name' },
          { status: 400 },
        );
      }

      let settings = await PaymentSettings.findOne({ project }).lean();
      if (!settings) {
        settings = await PaymentSettings.create({
          project,
          paymentMethod: 'paymob',
        });
        settings = settings.toObject();
      }

      return NextResponse.json({
        success: true,
        data: {
          project: settings.project,
          paymentMethod: settings.paymentMethod,
        },
      });
    }

    // Return all projects
    const allSettings = await Promise.all(
      VALID_PROJECTS.map(async (p) => {
        let settings = await PaymentSettings.findOne({ project: p }).lean();
        if (!settings) {
          const created = await PaymentSettings.create({
            project: p,
            paymentMethod: 'paymob',
          });
          settings = created.toObject();
        }
        return {
          project: settings.project,
          paymentMethod: settings.paymentMethod,
        };
      }),
    );

    return NextResponse.json({
      success: true,
      data: allSettings,
    });
  } catch (error) {
    console.error('Error fetching payment settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch payment settings' },
      { status: 500 },
    );
  }
}

async function updatePaymentSettingsHandler(
  request: NextRequest,
  context: { user: TokenPayload },
) {
  try {
    await dbConnect();

    const body = await request.json();
    const { project, paymentMethod } = body;

    if (!project || !VALID_PROJECTS.includes(project)) {
      return NextResponse.json(
        { success: false, error: 'Invalid or missing project name' },
        { status: 400 },
      );
    }

    if (!paymentMethod || !['paymob', 'easykash'].includes(paymentMethod)) {
      return NextResponse.json(
        { success: false, error: 'Invalid payment method' },
        { status: 400 },
      );
    }

    const settings = await PaymentSettings.findOneAndUpdate(
      { project },
      { project, paymentMethod },
      { new: true, upsert: true, runValidators: true },
    );

    // Log activity
    await logActivity({
      userId: context.user.userId,
      userName: context.user.name,
      userEmail: context.user.email,
      action: 'update',
      resource: 'paymentSettings',
      resourceId: settings._id.toString(),
      details: `Updated ${project} payment method to ${paymentMethod}`,
    });

    return NextResponse.json({
      success: true,
      data: {
        project: settings.project,
        paymentMethod: settings.paymentMethod,
      },
      message: 'Payment settings updated successfully',
    });
  } catch (error) {
    console.error('Error updating payment settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update payment settings' },
      { status: 500 },
    );
  }
}

export const GET = requireAuth(getPaymentSettingsHandler);
export const PUT = requireAuth(updatePaymentSettingsHandler);
