'use client';

import Tabs from '@/components/ui/tabs';

const BASE_TAB_CLASS =
  'border border-stroke text-foreground/80 hover:bg-background hover:text-foreground';
const ACTIVE_TAB_CLASS = 'bg-foreground text-background shadow-sm';

/** Minimal shape needed by the filter — works with any Referral-like type */
export interface ReferralFilterItem {
  name: string;
  referralId: string;
  filterOrder?: number;
}

export interface ReferralFilterProps {
  /** Current selected referral value */
  value: string;
  /** Called when the user picks a referral */
  onChange: (value: string) => void;
  /** Referrals list (should already be sorted by the API) */
  referrals: ReferralFilterItem[];
  /** Label for the "All" tab */
  allLabel: string;
  /** Value for the "All" tab (default: empty string) */
  allValue?: string;
  /** Extra className for the Tabs wrapper */
  className?: string;
  /** Tab size */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show the referral name in the label (default: true) */
  showName?: boolean;
}

/**
 * Shared referral filter tabs.
 *
 * Renders: [All] [MNK-D] [GHD-D] [...referrals sorted by filterOrder]
 *
 * The `MNK-D` and `GHD-D` tabs are always first (after "All"),
 * then the referrals follow in the order returned by the API
 * (sorted by `filterOrder` ascending, then `createdAt` descending).
 */
export default function ReferralFilter({
  value,
  onChange,
  referrals,
  allLabel,
  allValue = '',
  className,
  size,
  showName = true,
}: ReferralFilterProps) {
  const options = [
    {
      label: allLabel,
      value: allValue,
      className: BASE_TAB_CLASS,
      activeClassName: ACTIVE_TAB_CLASS,
    },
    {
      label: 'MNK-D',
      value: 'MNK-D',
      className: BASE_TAB_CLASS,
      activeClassName: ACTIVE_TAB_CLASS,
    },
    {
      label: 'GHD-D',
      value: 'GHD-D',
      className: BASE_TAB_CLASS,
      activeClassName: ACTIVE_TAB_CLASS,
    },
    ...referrals.map((referral) => ({
      label: showName
        ? `${referral.name} (${referral.referralId})`
        : referral.referralId,
      value: referral.referralId,
      className: BASE_TAB_CLASS,
      activeClassName: ACTIVE_TAB_CLASS,
    })),
  ];

  return (
    <div className="overflow-x-auto pb-1">
      <Tabs<string>
        value={value}
        options={options}
        onChange={onChange}
        className={className ?? 'min-w-max'}
        size={size}
      />
    </div>
  );
}
