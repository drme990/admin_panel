# Payment System Documentation

## Overview

The Manasik platform supports **two payment methods**:

1. **Paymob** (existing) - Full checkout flow with quantity selection
2. **Easy Kash** (new) - Direct link payment without checkout page

Admins can choose which payment method to use globally. Based on this selection:

- **Paymob Flow**: Product details → Quantity selector → Checkout page → Paymob payment
- **Easy Kash Flow**: Product details → Direct link to Easy Kash (no quantity selector, no checkout)

### Easy Kash Payment Structure

For Easy Kash, products require **direct payment links**:

- **Full Payment Link** - Pay complete product price
- **Half Payment Link** - Pay 50% of product price
- **Custom Payment Link** - User enters custom amount

### Product Sizes (Optional)

Products can have **optional sizes** (e.g., Small, Medium, Large):

- **0 sizes**: Product has no size variants
- **1+ sizes**: Each size has its own Easy Kash links (full, half, custom)

---

## Architecture

### Data Models

#### 1. Payment Settings Model (`PaymentSettings`)

**Location**: `models/PaymentSettings.ts`

```typescript
export interface IPaymentSettings {
  _id?: string;
  paymentMethod: 'paymob' | 'easykash';
  createdAt?: Date;
  updatedAt?: Date;
}
```

**Schema:**

```typescript
const PaymentSettingsSchema = new mongoose.Schema<IPaymentSettings>(
  {
    paymentMethod: {
      type: String,
      enum: ['paymob', 'easykash'],
      required: true,
      default: 'paymob',
    },
  },
  { timestamps: true }
);
```

**Note**: This is a singleton document (only one record exists). Always use `findOne()` or `findOneAndUpdate()` with upsert.

---

#### 2. Product Model Updates

**Location**: `types/Product.ts` & `models/Product.ts`

**New Interfaces:**

```typescript
// Product size with Easy Kash links
export interface ProductSize {
  _id?: string;
  name: {
    ar: string;
    en: string;
  };
  easykashLinks: {
    fullPayment: string;
    halfPayment: string;
    customPayment: string;
  };
}

// Add to existing Product interface
export interface Product {
  // ... existing fields ...

  // Easy Kash fields
  sizes?: ProductSize[];  // Optional array of product sizes
  easykashLinks?: {        // If no sizes, store links directly on product
    fullPayment: string;
    halfPayment: string;
    customPayment: string;
  };
}
```

**Schema Updates:**

```typescript
// In models/Product.ts

const ProductSizeSchema = new mongoose.Schema({
  name: {
    ar: { type: String, required: true, trim: true },
    en: { type: String, required: true, trim: true },
  },
  easykashLinks: {
    fullPayment: { type: String, trim: true, default: '' },
    halfPayment: { type: String, trim: true, default: '' },
    customPayment: { type: String, trim: true, default: '' },
  },
});

// Add to ProductSchema
const ProductSchema = new mongoose.Schema<IProduct>({
  // ... existing fields ...

  sizes: [ProductSizeSchema],
  easykashLinks: {
    fullPayment: { type: String, trim: true, default: '' },
    halfPayment: { type: String, trim: true, default: '' },
    customPayment: { type: String, trim: true, default: '' },
  },
});
```

**Logic:**

- If `sizes` array exists and has items → use size-specific Easy Kash links
- If `sizes` is empty or undefined → use product-level `easykashLinks`

---

## API Endpoints

### Payment Settings APIs

#### `GET /api/admin/payment-settings`

**Auth**: Required (admin)

Fetches the current payment settings.

**Response:**

```json
{
  "success": true,
  "data": {
    "paymentMethod": "paymob"
  }
}
```

---

#### `PUT /api/admin/payment-settings`

**Auth**: Required (admin)

Updates payment settings. Logs activity.

**Body:**

```json
{
  "paymentMethod": "easykash"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "paymentMethod": "easykash"
  },
  "message": "Payment settings updated successfully"
}
```

---

#### `GET /api/payment-method`

**Auth**: None (public)

Returns the currently active payment method. Used by frontend to determine flow.

**Response:**

```json
{
  "success": true,
  "data": {
    "paymentMethod": "paymob"
  }
}
```

---

### Product APIs (Updated)

#### `POST /api/products` & `PUT /api/products/[id]`

**Body Updates:**

```json
{
  "name": { "ar": "منتج", "en": "Product" },
  "price": 100,
  "currency": "SAR",
  // ... existing fields ...

  "sizes": [
    {
      "name": { "ar": "صغير", "en": "Small" },
      "easykashLinks": {
        "fullPayment": "https://easykash.com/pay/xxx-full",
        "halfPayment": "https://easykash.com/pay/xxx-half",
        "customPayment": "https://easykash.com/pay/xxx-custom"
      }
    },
    {
      "name": { "ar": "كبير", "en": "Large" },
      "easykashLinks": {
        "fullPayment": "https://easykash.com/pay/yyy-full",
        "halfPayment": "https://easykash.com/pay/yyy-half",
        "customPayment": "https://easykash.com/pay/yyy-custom"
      }
    }
  ],

  // OR if no sizes:
  "easykashLinks": {
    "fullPayment": "https://easykash.com/pay/product-full",
    "halfPayment": "https://easykash.com/pay/product-half",
    "customPayment": "https://easykash.com/pay/product-custom"
  }
}
```

---

## Frontend Changes

### 1. Admin Dashboard - Payment Settings Page

**Location**: `app/admin/payment-settings/page.tsx`

**Features:**

- Radio buttons to select payment method (Paymob / Easy Kash)
- Save button to update settings
- Visual indicator of current active method
- Info text explaining that credentials are configured via environment variables

**UI Structure:**

```tsx
<form>
  <div className="space-y-6">
    <div>
      <h2 className="text-xl font-bold mb-2">Select Payment Method</h2>
      <p className="text-secondary text-sm mb-4">
        Choose which payment gateway to use. API credentials are configured via environment variables.
      </p>
    </div>

    {/* Payment Method Selection */}
    <div className="space-y-3">
      <label className="flex items-center gap-3 border border-stroke rounded-lg p-4 cursor-pointer hover:border-success">
        <input
          type="radio"
          name="paymentMethod"
          value="paymob"
          checked={paymentMethod === 'paymob'}
          onChange={(e) => setPaymentMethod(e.target.value)}
        />
        <div>
          <div className="font-semibold">Paymob</div>
          <div className="text-sm text-secondary">Full checkout with quantity selection</div>
        </div>
      </label>

      <label className="flex items-center gap-3 border border-stroke rounded-lg p-4 cursor-pointer hover:border-success">
        <input
          type="radio"
          name="paymentMethod"
          value="easykash"
          checked={paymentMethod === 'easykash'}
          onChange={(e) => setPaymentMethod(e.target.value)}
        />
        <div>
          <div className="font-semibold">Easy Kash</div>
          <div className="text-sm text-secondary">Direct payment links without checkout</div>
        </div>
      </label>
    </div>

    <Button type="submit" variant="primary">Save Settings</Button>
  </div>
</form>
```

---

### 2. Admin - Product Form Updates

**Location**: `components/admin/product-form.tsx`

**New Sections:**

#### A. Easy Kash Links Section (No Sizes)

```tsx
{/* Easy Kash Links (when no sizes) */}
{!formData.sizes || formData.sizes.length === 0 && (
  <div className="space-y-4">
    <h3>Easy Kash Payment Links</h3>
    <Input
      label="Full Payment Link"
      value={formData.easykashLinks?.fullPayment}
      onChange={(e) => setFormData({
        ...formData,
        easykashLinks: {
          ...formData.easykashLinks,
          fullPayment: e.target.value
        }
      })}
    />
    <Input
      label="Half Payment Link"
      value={formData.easykashLinks?.halfPayment}
      onChange={...}
    />
    <Input
      label="Custom Payment Link"
      value={formData.easykashLinks?.customPayment}
      onChange={...}
    />
  </div>
)}
```

#### B. Product Sizes Section (Dynamic)

```tsx
{/* Product Sizes */}
<div className="space-y-4">
  <div className="flex items-center justify-between">
    <h3>Product Sizes (Optional)</h3>
    <Button
      type="button"
      onClick={() => addSize()}
      variant="outline"
      size="sm"
    >
      <Plus size={16} /> Add Size
    </Button>
  </div>

  {formData.sizes?.map((size, index) => (
    <div key={index} className="border p-4 rounded-lg space-y-3">
      <div className="flex items-center justify-between">
        <h4>Size {index + 1}</h4>
        <Button
          type="button"
          onClick={() => removeSize(index)}
          variant="ghost"
          size="sm"
        >
          <X size={16} />
        </Button>
      </div>

      {/* Size Name */}
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Size Name (Arabic)"
          value={size.name.ar}
          onChange={(e) => updateSize(index, 'name.ar', e.target.value)}
        />
        <Input
          label="Size Name (English)"
          value={size.name.en}
          onChange={(e) => updateSize(index, 'name.en', e.target.value)}
        />
      </div>

      {/* Easy Kash Links for this size */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Easy Kash Links</label>
        <Input
          placeholder="Full Payment Link"
          value={size.easykashLinks.fullPayment}
          onChange={(e) => updateSize(index, 'easykashLinks.fullPayment', e.target.value)}
        />
        <Input
          placeholder="Half Payment Link"
          value={size.easykashLinks.halfPayment}
          onChange={(e) => updateSize(index, 'easykashLinks.halfPayment', e.target.value)}
        />
        <Input
          placeholder="Custom Payment Link"
          value={size.easykashLinks.customPayment}
          onChange={(e) => updateSize(index, 'easykashLinks.customPayment', e.target.value)}
        />
      </div>
    </div>
  ))}
</div>
```

**State Management:**

```tsx
const [formData, setFormData] = useState({
  // ... existing fields ...
  sizes: [],
  easykashLinks: {
    fullPayment: '',
    halfPayment: '',
    customPayment: ''
  }
});

const addSize = () => {
  setFormData({
    ...formData,
    sizes: [
      ...formData.sizes,
      {
        name: { ar: '', en: '' },
        easykashLinks: {
          fullPayment: '',
          halfPayment: '',
          customPayment: ''
        }
      }
    ]
  });
};

const removeSize = (index: number) => {
  setFormData({
    ...formData,
    sizes: formData.sizes.filter((_, i) => i !== index)
  });
};

const updateSize = (index: number, field: string, value: string) => {
  const updatedSizes = [...formData.sizes];
  // Use lodash _.set or manual nested update
  if (field.includes('.')) {
    const [parent, child] = field.split('.');
    if (parent === 'name') {
      updatedSizes[index].name[child] = value;
    } else if (parent === 'easykashLinks') {
      updatedSizes[index].easykashLinks[child] = value;
    }
  }
  setFormData({ ...formData, sizes: updatedSizes });
};
```

---

### 3. Product Details Page Updates

**Location**: `app/products/[id]/product-details-client.tsx`

**Changes Based on Payment Method:**

```tsx
'use client';

import { useState, useEffect } from 'react';
import { Product } from '@/types/Product';

export default function ProductDetailsClient({ product }: { product: Product }) {
  const [paymentMethod, setPaymentMethod] = useState<'paymob' | 'easykash'>('paymob');
  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState<number | null>(null);

  // Fetch current payment method
  useEffect(() => {
    fetch('/api/payment-method')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setPaymentMethod(data.data.paymentMethod);
        }
      });
  }, []);

  // Render for Paymob (existing flow)
  if (paymentMethod === 'paymob') {
    return (
      <div>
        {/* Existing content: Image, title, price, description */}

        {/* Quantity Selector */}
        <div className="flex items-center gap-4">
          <Button onClick={() => setQuantity(q => q + 1)}>
            <Plus />
          </Button>
          <span>{quantity}</span>
          <Button onClick={() => setQuantity(q => Math.max(1, q - 1))}>
            <Minus />
          </Button>
        </div>

        {/* Pay Now Button → Checkout Page */}
        <Button href={`/checkout?product=${product._id}&qty=${quantity}`}>
          Pay Now
        </Button>
      </div>
    );
  }

  // Render for Easy Kash (new flow)
  if (paymentMethod === 'easykash') {
    const hasSizes = product.sizes && product.sizes.length > 0;

    return (
      <div>
        {/* Existing content: Image, title, price, description */}

        {/* Size Selection (if product has sizes) */}
        {hasSizes && (
          <div className="space-y-3">
            <h3>Select Size</h3>
            <div className="flex gap-2">
              {product.sizes.map((size, index) => (
                <Button
                  key={index}
                  variant={selectedSize === index ? 'primary' : 'outline'}
                  onClick={() => setSelectedSize(index)}
                >
                  {locale === 'ar' ? size.name.ar : size.name.en}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Easy Kash Payment Options */}
        <div className="space-y-2">
          <h3>Choose Payment Option</h3>

          {/* Get links based on size or product level */}
          {(() => {
            const links = hasSizes && selectedSize !== null
              ? product.sizes[selectedSize].easykashLinks
              : product.easykashLinks;

            if (!links) return <p>No payment links available</p>;

            return (
              <>
                <Button
                  href={links.fullPayment}
                  variant="primary"
                  target="_blank"
                  disabled={hasSizes && selectedSize === null}
                >
                  Full Payment
                </Button>
                <Button
                  href={links.halfPayment}
                  variant="outline"
                  target="_blank"
                  disabled={hasSizes && selectedSize === null}
                >
                  Half Payment (50%)
                </Button>
                <Button
                  href={links.customPayment}
                  variant="outline"
                  target="_blank"
                  disabled={hasSizes && selectedSize === null}
                >
                  Custom Amount
                </Button>
              </>
            );
          })()}
        </div>

        {hasSizes && selectedSize === null && (
          <p className="text-error text-sm">Please select a size first</p>
        )}
      </div>
    );
  }

  return null;
}
```

---

### 4. Checkout Page Behavior

**Location**: `app/checkout/page.tsx`

**Logic:**

- If payment method is **Easy Kash**, redirect to home or show "Payment links available on product page"
- Only render checkout form if payment method is **Paymob**

```tsx
export default function CheckoutPage() {
  const [paymentMethod, setPaymentMethod] = useState<string>('paymob');

  useEffect(() => {
    fetch('/api/payment-method')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setPaymentMethod(data.data.paymentMethod);
        }
      });
  }, []);

  // Redirect if Easy Kash is active
  if (paymentMethod === 'easykash') {
    return (
      <Container>
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-warning mx-auto mb-4" />
          <h2>Direct Payment Active</h2>
          <p>Please use the payment links on the product page.</p>
          <Button href="/products">Browse Products</Button>
        </div>
      </Container>
    );
  }

  // Show normal checkout for Paymob
  return (
    <form onSubmit={handleSubmit}>
      {/* Existing checkout form */}
    </form>
  );
}
```

---

## Admin Sidebar Update

**Location**: `app/admin/layout.tsx`

**Add Payment Settings to Navigation:**

```tsx
const navItems = [
  { key: 'dashboard', href: '/admin', icon: LayoutDashboard },
  { key: 'products', href: '/admin/products', icon: Package },
  { key: 'orders', href: '/admin/orders', icon: ShoppingCart },
  { key: 'coupons', href: '/admin/coupons', icon: Ticket },

  // Add Payment Settings
  { key: 'paymentSettings', href: '/admin/payment-settings', icon: CreditCard },

  { key: 'countries', href: '/admin/countries', icon: Globe },
  { key: 'users', href: '/admin/users', icon: Users },
  { key: 'referrals', href: '/admin/referrals', icon: UserRoundPlus },
  { key: 'activityLogs', href: '/admin/logs', icon: FileText },
];
```

---

## Translation Keys

Add to `messages/en.json` and `messages/ar.json`:

```json
{
  "admin": {
    "paymentSettings": {
      "title": "Payment Settings",
      "description": "Choose which payment gateway to use. API credentials are configured via environment variables.",
      "selectMethod": "Select Payment Method",
      "paymob": "Paymob",
      "paymobDesc": "Full checkout with quantity selection",
      "easykash": "Easy Kash",
      "easykashDesc": "Direct payment links without checkout",
      "saveSettings": "Save Settings",
      "settingsSaved": "Payment settings saved successfully"
    },
    "products": {
      "sizes": "Product Sizes",
      "addSize": "Add Size",
      "removeSize": "Remove Size",
      "sizeNameAr": "Size Name (Arabic)",
      "sizeNameEn": "Size Name (English)",
      "easykashLinks": "Easy Kash Payment Links",
      "fullPaymentLink": "Full Payment Link",
      "halfPaymentLink": "Half Payment Link",
      "customPaymentLink": "Custom Payment Link",
      "noSizes": "This product has no size variants",
      "selectSize": "Select Size"
    }
  },
  "productDetails": {
    "selectSize": "Select Size",
    "choosePayment": "Choose Payment Option",
    "fullPayment": "Full Payment",
    "halfPayment": "Half Payment (50%)",
    "customPayment": "Custom Amount",
    "selectSizeFirst": "Please select a size first",
    "noLinksAvailable": "No payment links available"
  }
}
```

Arabic translations:

```json
{
  "admin": {
    "paymentSettings": {
      "title": "إعدادات الدفع",
      "description": "اختر بوابة الدفع المراد استخدامها. يتم تكوين بيانات الاعتماد عبر متغيرات البيئة.",
      "selectMethod": "اختر طريقة الدفع",
      "paymob": "باي موب",
      "paymobDesc": "صفحة دفع كاملة مع اختيار الكمية",
      "easykash": "إيزي كاش",
      "easykashDesc": "روابط دفع مباشرة بدون صفحة دفع",
      "saveSettings": "حفظ الإعدادات",
      "settingsSaved": "تم حفظ إعدادات الدفع بنجاح"
    },
    "products": {
      "sizes": "مقاسات المنتج",
      "addSize": "إضافة حجم",
      "removeSize": "حذف الحجم",
      "sizeNameAr": "اسم الحجم (عربي)",
      "sizeNameEn": "اسم الحجم (إنجليزي)",
      "easykashLinks": "روابط الدفع عبر إيزي كاش",
      "fullPaymentLink": "رابط الدفع الكامل",
      "halfPaymentLink": "رابط نصف الدفع",
      "customPaymentLink": "رابط المبلغ المخصص",
      "noSizes": "هذا المنتج ليس له مقاسات",
      "selectSize": "اختر الحجم"
    }
  },
  "productDetails": {
    "selectSize": "اختر الحجم",
    "choosePayment": "اختر طريقة الدفع",
    "fullPayment": "الدفع الكامل",
    "halfPayment": "نصف الدفع (50%)",
    "customPayment": "مبلغ مخصص",
    "selectSizeFirst": "الرجاء اختيار الحجم أولاً",
    "noLinksAvailable": "لا توجد روابط دفع متاحة"
  }
}
```

---

## Implementation Checklist

### Phase 1: Database & Models

- [ ] Create `models/PaymentSettings.ts` with schema
- [ ] Create `types/PaymentSettings.ts` interface
- [ ] Update `types/Product.ts` to add `ProductSize` interface and `sizes` + `easykashLinks`
- [ ] Update `models/Product.ts` schema to include `sizes` and `easykashLinks`
- [ ] Run database migration or seed initial payment settings document

### Phase 2: API Endpoints

- [ ] Create `app/api/admin/payment-settings/route.ts` (GET, PUT)
- [ ] Create `app/api/payment-method/route.ts` (GET - public)
- [ ] Update `app/api/products/route.ts` to handle `sizes` and `easykashLinks` fields
- [ ] Update `app/api/products/[id]/route.ts` for PUT operations

### Phase 3: Admin Panel

- [ ] Create `app/admin/payment-settings/page.tsx`
  - Payment method selection (radio buttons)
  - Info text about environment variables
  - Save functionality with toast notifications
- [ ] Update `app/admin/layout.tsx` to add Payment Settings nav item
- [ ] Update `components/admin/product-form.tsx`:
  - Add sizes array management (add, remove, update)
  - Add Easy Kash links inputs (per size or product-level)
  - Conditional rendering based on sizes array

### Phase 4: Frontend Flow

- [ ] Update `app/products/[id]/product-details-client.tsx`:
  - Fetch active payment method on mount
  - Conditional render: Paymob flow vs Easy Kash flow
  - Easy Kash: Size selection + payment option buttons
  - Disable buttons if size not selected (when applicable)
- [ ] Update `app/checkout/page.tsx`:
  - Fetch payment method
  - Show message/redirect if Easy Kash is active
  - Only render form for Paymob

### Phase 5: Translations

- [ ] Add all translation keys to `messages/en.json`
- [ ] Add all translation keys to `messages/ar.json`
- [ ] Verify RTL/LTR rendering for new components

### Phase 6: Testing

- [ ] Test payment settings page (switch between Paymob/Easy Kash)
- [ ] Test product create/edit with:
  - No sizes (product-level Easy Kash links)
  - 1 size
  - Multiple sizes
  - Remove sizes
- [ ] Test product details page:
  - Paymob mode: quantity + checkout button
  - Easy Kash mode (no sizes): 3 payment buttons
  - Easy Kash mode (with sizes): size selection + payment buttons
- [ ] Test checkout page redirect when Easy Kash is active
- [ ] Verify mobile responsiveness
- [ ] Test both AR and EN locales

### Phase 7: Documentation & Deployment

- [ ] Update main README.md with payment system info
- [ ] Update environment variables documentation
- [ ] Create admin guide for setting up Easy Kash links
- [ ] Deploy to staging
- [ ] Final production deployment

---

## Security Considerations

1. **Payment Settings Access**: Only admin users should access `/api/admin/payment-settings`
2. **Environment Variables**: All payment gateway credentials (API keys, secrets) must be stored in `.env` file
   - Paymob: `PAYMOB_SECRET_KEY`, `PAYMOB_PUBLIC_KEY`, `PAYMOB_INTEGRATION_ID`, `PAYMOB_HMAC_SECRET`
   - Easy Kash: Add required keys as needed (e.g., `EASYKASH_API_KEY`, `EASYKASH_MERCHANT_ID`)
3. **Link Validation**: Validate Easy Kash URLs (must be HTTPS, valid domain)
4. **External Links**: Always open Easy Kash links in new tab (`target="_blank"`)
5. **Activity Logging**: Log all payment settings changes

---

## Future Enhancements

1. **Multiple Payment Providers**: Support both Paymob + Easy Kash simultaneously
2. **Provider-Specific Products**: Some products use Paymob, others use Easy Kash
3. **Link Analytics**: Track clicks on Easy Kash payment links
4. **Dynamic Link Generation**: Auto-generate Easy Kash links via API integration
5. **Webhook Integration**: Handle Easy Kash payment callbacks (if supported)

---

## Support

For questions or issues during implementation:

- Check existing patterns in `docs/MULTI_CURRENCY_PRICING.md`
- Review Paymob integration in `lib/paymob.ts`
- Refer to product form component for state management examples
- See referral system docs for similar API patterns

---

**Last Updated**: February 17, 2026
