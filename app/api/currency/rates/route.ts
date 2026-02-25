import { NextRequest, NextResponse } from 'next/server';
import { convertCurrency, getExchangeRates } from '@/lib/currency';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const base = searchParams.get('base') || 'SAR';
    const target = searchParams.get('target');
    const amount = searchParams.get('amount');

    if (target && amount) {
      const converted = await convertCurrency(parseFloat(amount), base, target);
      return NextResponse.json({
        success: true,
        data: {
          from: base.toUpperCase(),
          to: target.toUpperCase(),
          amount: parseFloat(amount),
          converted,
        },
      });
    }

    const rates = await getExchangeRates(base);

    return NextResponse.json({
      success: true,
      data: {
        base: base.toUpperCase(),
        rates,
      },
    });
  } catch (error) {
    console.error('Error fetching exchange rates:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch exchange rates' },
      { status: 500 },
    );
  }
}
