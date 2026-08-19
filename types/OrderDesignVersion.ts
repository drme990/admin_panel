/**
 * Order Design Version — admin panel types.
 *
 * Mirrors the backend's `IOrderDesignVersion` shape (see
 * `backend/lib/models/OrderDesignVersion.ts`). The admin panel only
 * reads versions (via GET /api/admin/design-versions) and triggers
 * restores (via POST /api/admin/design-versions/restore) — it never
 * writes versions directly.
 *
 * See `order-history-enhanced.md` for the full spec.
 */

export type OrderDesignVersionTrigger =
  | 'auto'
  | 'admin_regenerate'
  | 'admin_edit'
  | 'admin_upload'
  | 'admin_restore'
  | 'admin_delete';

export interface OrderDesignVersion {
  _id: string;
  /** Monotonically increasing version number. */
  version: number;
  /** ID of the design-app project (design instance). Metadata only. */
  projectId: string;
  /** Public R2 URL of the immutable archived JPG. */
  archivedUrl: string;
  archivedKey: string;
  /** Layer array (opaque — the admin panel doesn't interpret layers). */
  layers: unknown[];
  canvasWidth: number;
  canvasHeight: number;
  backgroundColor?: string;
  backgroundUri?: string;
  /** Audit: who created this version. */
  userId: string;
  userName: string;
  userRole: string;
  trigger: OrderDesignVersionTrigger;
  /** Unix timestamp (ms) when the version was created. */
  createdAt: number;
  /** Only populated for `admin_restore` events. */
  restoredFromVersion?: number;
  /** Only populated for `admin_delete` events. */
  isDeletedEvent?: boolean;
  /** Stable hash of the design snapshot. */
  designHash: string;
}

export interface DesignVersionHistoryResponse {
  currentVersion: number | null;
  versions: OrderDesignVersion[];
}

export interface RestoreVersionResponse {
  restoredFromVersion: number;
  newVersion: number;
  currentVersion: number;
  url: string;
}
