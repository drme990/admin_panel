'use client';

import { useEffect, useState } from 'react';
import Tabs from '@/components/ui/tabs';
import {
  FALLBACK_REF_POSITIONS,
  fetchDefaultRefPositions,
  mergeDefaultRefs,
  type DefaultRefPositions,
} from '@/lib/default-refs';

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
 * Renders: [All] [...defaults + referrals merged by position]
 *
 * The virtual `MNK-D` / `GHD-D` tabs are merged into the referral list
 * at the positions saved via the referrals reorder modal (fetched from
 * /api/referrals/default-order). Until the fetch resolves they sit at
 * their classic positions 0 and 1, right after "All".
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
  const [positions, setPositions] = useState<DefaultRefPositions>(
    FALLBACK_REF_POSITIONS,
  );

  useEffect(() => {
    let cancelled = false;
    fetchDefaultRefPositions().then((next) => {
      if (!cancelled) setPositions(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const merged = mergeDefaultRefs(referrals, positions, (id) => ({
    name: id,
    referralId: id,
  }));

  const options = [
    {
      label: allLabel,
      value: allValue,
      className: BASE_TAB_CLASS,
      activeClassName: ACTIVE_TAB_CLASS,
    },
    ...merged.map((referral) => ({
      label:
        showName && referral.name !== referral.referralId
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
