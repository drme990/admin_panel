import MultiCurrencyPriceEditor, {
  type CurrencyPrice,
} from '@/components/admin/multi-currency-price-editor';
import Button from '@/components/ui/button';
import Checkbox from '@/components/ui/checkbox';
import Dropdown from '@/components/ui/dropdown';
import Input from '@/components/ui/input';
import Modal from '@/components/ui/modal';
import type { Coupon } from '@/types/Coupon';
import type { Dispatch, SetStateAction, FormEvent } from 'react';

type Country = {
  _id: string;
  code: string;
  currencyCode?: string;
  name: { en: string; ar?: string };
};

interface CouponFormData {
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  fixedPrices: CurrencyPrice[];
  fixedMainCurrency: string;
  fixedBasePrice: number;
  maxDiscountPrices: CurrencyPrice[];
  maxDiscountMainCurrency: string;
  maxDiscountBasePrice: number;
  allowedCountries: string[];
  maxUses: string | number;
  validFrom: string;
  validUntil: string;
  status: 'active' | 'expired' | 'disabled';
  minOrderAmount: string | number;
  description_ar: string;
  description_en: string;
}

interface CouponModalProps {
  showModal: boolean;
  closeModal: () => void;
  t: (key: string) => string;
  editingCoupon: Coupon | null;
  formData: CouponFormData;
  setFormData: Dispatch<SetStateAction<CouponFormData>>;
  countries: Country[];
  allCountryCodes: string[];
  handleSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

const percentageNotMoreThan100 = (value: number) => {
  if (value > 100) {
    return 100;
  } else if (value < 0) {
    return 0;
  }
  return value;
};

export default function CouponModal({
  showModal,
  closeModal,
  t,
  editingCoupon,
  formData,
  setFormData,
  countries,
  allCountryCodes,
  handleSubmit,
}: CouponModalProps) {
  return (
    <Modal
      isOpen={showModal}
      onClose={closeModal}
      title={editingCoupon ? t('editCoupon') : t('addCoupon')}
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex flex-col gap-4 rounded-lg border border-stroke bg-card-bg p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label={t('form.code')}
              value={formData.code}
              onChange={(e) =>
                setFormData({ ...formData, code: e.target.value.toUpperCase() })
              }
              required
            />
            <Dropdown
              label={t('form.type')}
              value={formData.type}
              options={[
                { label: t('form.typePercentage'), value: 'percentage' },
                { label: t('form.typeFixed'), value: 'fixed' },
              ]}
              onChange={(value) =>
                setFormData({
                  ...formData,
                  type: value as 'percentage' | 'fixed',
                })
              }
            />
          </div>

          {formData.type === 'percentage' && (
            <Input
              label={t('form.value')}
              type="number"
              required
              min="0"
              step="0.01"
              max="100"
              value={formData.value || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  value: percentageNotMoreThan100(
                    parseFloat(e.target.value) || 0,
                  ),
                })
              }
            />
          )}
        </div>

        {formData.type === 'fixed' && (
          <div className="space-y-4 rounded-lg border border-stroke bg-card-bg p-4">
            <div>
              <p className="text-sm font-medium text-foreground">
                {t('form.fixedPrices')}
              </p>
            </div>
            <MultiCurrencyPriceEditor
              mainCurrency={formData.fixedMainCurrency}
              basePrice={formData.fixedBasePrice}
              prices={formData.fixedPrices}
              onMainCurrencyChange={(currency) =>
                setFormData({ ...formData, fixedMainCurrency: currency })
              }
              onBasePriceChange={(price) =>
                setFormData({ ...formData, fixedBasePrice: price })
              }
              onChange={(prices) =>
                setFormData({ ...formData, fixedPrices: prices })
              }
            />
          </div>
        )}

        <div className="space-y-4 rounded-lg border border-stroke bg-card-bg p-4">
          <div>
            <p className="text-sm font-medium text-foreground">
              {t('form.maxDiscountAmount')}
            </p>
            <p className="text-xs text-secondary">
              {t('form.maxDiscountAmountHint')}
            </p>
          </div>
          <MultiCurrencyPriceEditor
            mainCurrency={formData.maxDiscountMainCurrency}
            basePrice={formData.maxDiscountBasePrice}
            prices={formData.maxDiscountPrices}
            onMainCurrencyChange={(currency) =>
              setFormData({ ...formData, maxDiscountMainCurrency: currency })
            }
            onBasePriceChange={(price) =>
              setFormData({ ...formData, maxDiscountBasePrice: price })
            }
            onChange={(prices) =>
              setFormData({ ...formData, maxDiscountPrices: prices })
            }
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            label={t('form.validFrom')}
            type="date"
            required
            value={formData.validFrom}
            onChange={(e) =>
              setFormData({ ...formData, validFrom: e.target.value })
            }
          />
          <Input
            label={t('form.validUntil')}
            type="date"
            value={formData.validUntil}
            onChange={(e) =>
              setFormData({ ...formData, validUntil: e.target.value })
            }
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            label={t('form.maxUses')}
            type="number"
            min="1"
            value={formData.maxUses}
            onChange={(e) =>
              setFormData({ ...formData, maxUses: e.target.value })
            }
            placeholder={t('form.unlimited')}
          />
          <Input
            label={t('form.minOrderAmount')}
            type="number"
            min="0"
            step="0.01"
            value={formData.minOrderAmount}
            onChange={(e) =>
              setFormData({ ...formData, minOrderAmount: e.target.value })
            }
          />
        </div>

        <div className="space-y-4 rounded-lg border border-stroke bg-card-bg p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">
              {t('form.allowedCountries')}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setFormData({
                    ...formData,
                    allowedCountries: allCountryCodes,
                  })
                }
              >
                {t('form.selectAllCountries')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setFormData({ ...formData, allowedCountries: [] })
                }
              >
                {t('form.clearCountries')}
              </Button>
            </div>
          </div>
          <p className="text-xs text-secondary">
            {t('form.allowedCountriesHint')}
          </p>
          <div className="max-h-48 overflow-y-auto rounded border border-stroke bg-background p-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {countries.map((country) => {
                const checked = formData.allowedCountries.includes(
                  country.code,
                );

                return (
                  <Checkbox
                    key={country._id}
                    checked={checked}
                    onChange={(nextChecked) => {
                      const current = new Set(formData.allowedCountries);
                      if (nextChecked) {
                        current.add(country.code);
                      } else {
                        current.delete(country.code);
                      }
                      setFormData({
                        ...formData,
                        allowedCountries: Array.from(current),
                      });
                    }}
                    label={`${country.code} • ${country.name.en}`}
                  />
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            label={t('form.descriptionAr')}
            value={formData.description_ar}
            onChange={(e) =>
              setFormData({ ...formData, description_ar: e.target.value })
            }
          />
          <Input
            label={t('form.descriptionEn')}
            value={formData.description_en}
            onChange={(e) =>
              setFormData({ ...formData, description_en: e.target.value })
            }
            dir="ltr"
          />
        </div>

        {editingCoupon && (
          <Dropdown
            label={t('form.status')}
            value={formData.status}
            options={[
              { label: t('status.active'), value: 'active' },
              { label: t('status.disabled'), value: 'disabled' },
              { label: t('status.expired'), value: 'expired' },
            ]}
            onChange={(value) =>
              setFormData({
                ...formData,
                status: value as 'active' | 'expired' | 'disabled',
              })
            }
          />
        )}
      </form>
    </Modal>
  );
}
