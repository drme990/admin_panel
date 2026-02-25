import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Product from '@/models/Product';
import Country from '@/models/Country';
import { convertToMultipleCurrencies } from '@/lib/currency';
import { requireAuth } from '@/lib/auth-middleware';
import { TokenPayload } from '@/lib/jwt';

async function autoPriceHandler(
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
        { success: false, error: 'Product ID is required' },
        { status: 400 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const overrideManual = body.overrideManual === true;

    const product = await Product.findById(params.id);
    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 },
      );
    }

    const countries = await Country.find({ isActive: true }).lean();
    const targetCurrencies = [...new Set(countries.map((c) => c.currencyCode))];

    const baseCurrency = product.baseCurrency || 'SAR';

    for (const size of product.sizes) {
      if (!size.price || size.price <= 0) continue;

      const converted = await convertToMultipleCurrencies(
        size.price,
        baseCurrency,
        targetCurrencies,
      );

      const existingSizePrices = new Map(
        (size.prices || []).map(
          (p: { currencyCode: string; amount: number; isManual: boolean }) => [
            p.currencyCode,
            p,
          ],
        ),
      );

      size.prices = targetCurrencies.map((code) => {
        const existing = existingSizePrices.get(code) as
          | { currencyCode: string; amount: number; isManual: boolean }
          | undefined;
        if (existing && existing.isManual && !overrideManual) {
          return existing;
        }
        return {
          currencyCode: code,
          amount: converted[code] || 0,
          isManual: false,
        };
      });
    }

    await product.save();

    return NextResponse.json({
      success: true,
      data: {
        baseCurrency,
        sizes: product.sizes.map(
          (s: {
            name: { ar: string; en: string };
            price: number;
            prices: {
              currencyCode: string;
              amount: number;
              isManual: boolean;
            }[];
          }) => ({
            name: s.name,
            price: s.price,
            prices: s.prices,
          }),
        ),
      },
    });
  } catch (error) {
    console.error('Error auto-pricing product:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to auto-price product' },
      { status: 500 },
    );
  }
}

export const POST = requireAuth(autoPriceHandler);
