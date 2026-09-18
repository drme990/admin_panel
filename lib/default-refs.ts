/**
 * Virtual default referral codes (MNK-D / GHD-D).
 *
 * They aren't Referral documents — their position inside the shared
 * referral filter is stored in the backend `Setting` collection under
 * the `defaultRefFilterOrder` key and edited through the referrals
 * reorder modal.
 */

export const DEFAULT_REF_IDS = ['MNK-D', 'GHD-D'] as const;

export type DefaultRefId = (typeof DEFAULT_REF_IDS)[number];

export type DefaultRefPositions = Record<DefaultRefId, number>;

export const FALLBACK_REF_POSITIONS: DefaultRefPositions = {
  'MNK-D': 0,
  'GHD-D': 1,
};

export function isDefaultRefId(id: string): id is DefaultRefId {
  return id === 'MNK-D' || id === 'GHD-D';
}

export function defaultRefAppId(id: DefaultRefId): 'manasik' | 'ghadaq' {
  return id === 'GHD-D' ? 'ghadaq' : 'manasik';
}

export async function fetchDefaultRefPositions(): Promise<DefaultRefPositions> {
  try {
    const res = await fetch('/api/referrals/default-order', {
      cache: 'no-store',
    });
    const data = await res.json();
    const positions = data?.data?.positions;
    if (data?.success && positions) {
      return {
        'MNK-D':
          typeof positions['MNK-D'] === 'number'
            ? positions['MNK-D']
            : FALLBACK_REF_POSITIONS['MNK-D'],
        'GHD-D':
          typeof positions['GHD-D'] === 'number'
            ? positions['GHD-D']
            : FALLBACK_REF_POSITIONS['GHD-D'],
      };
    }
  } catch {
    // Fall back to the classic order on any failure.
  }
  return { ...FALLBACK_REF_POSITIONS };
}

/**
 * Insert the two default-ref pseudo entries into an already-sorted
 * referral list at their stored absolute positions. Positions are the
 * indices the reorder modal assigned them in the combined list.
 */
export function mergeDefaultRefs<T extends { referralId: string }>(
  items: T[],
  positions: DefaultRefPositions,
  build: (id: DefaultRefId) => T,
): T[] {
  const result = items.filter((item) => !isDefaultRefId(item.referralId));
  const entries = DEFAULT_REF_IDS.map((id) => ({
    id,
    pos: positions[id] ?? 0,
  })).sort((a, b) => a.pos - b.pos);

  for (const entry of entries) {
    const index = Math.min(Math.max(0, entry.pos), result.length);
    result.splice(index, 0, build(entry.id));
  }

  return result;
}
