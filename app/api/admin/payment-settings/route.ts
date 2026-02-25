import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import PaymentSettings from '@/models/PaymentSettings';
import { requireAuth } from '@/lib/auth-middleware';
import { logActivity } from '@/lib/logger';
import { TokenPayload } from '@/lib/jwt';

async function getPaymentSettingsHandler() {
  try {
    await dbConnect();

    let settings = await PaymentSettings.findOne().lean();

    if (!settings) {
      // Create default settings if none exist
      settings = await PaymentSettings.create({ paymentMethod: 'paymob' });
      settings = settings.toObject();
    }

    return NextResponse.json({
      success: true,
      data: {
        paymentMethod: settings.paymentMethod,
      },
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
    const { paymentMethod } = body;

    if (!paymentMethod || !['paymob', 'easykash'].includes(paymentMethod)) {
      return NextResponse.json(
        { success: false, error: 'Invalid payment method' },
        { status: 400 },
      );
    }

    const settings = await PaymentSettings.findOneAndUpdate(
      {},
      { paymentMethod },
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
      details: `Updated payment method to ${paymentMethod}`,
    });

    return NextResponse.json({
      success: true,
      data: {
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
