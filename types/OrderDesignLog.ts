export interface OrderDesignLogResult {
  productId: string;
  productName?: string;
  success: boolean;
  url?: string;
  templateType?: 'text' | 'image';
  projectId?: string;
  errorCode?: string;
  errorMessage?: string;
}

export type DesignGenTrigger = 'auto_webhook' | 'auto_admin' | 'auto_cron' | 'manual_admin';
export type DesignGenStatus = 'success' | 'partial' | 'failed' | 'skipped';

export interface OrderDesignLog {
  _id: string;
  orderId: string;
  orderNumber: string;
  source?: string;
  orderStatus?: string;
  hasReservationPhoto?: boolean;
  trigger: DesignGenTrigger;
  status: DesignGenStatus;
  totalProducts: number;
  generatedCount: number;
  failedCount: number;
  results: OrderDesignLogResult[];
  triggeredByUserId?: string;
  triggeredByUserName?: string;
  triggeredByUserEmail?: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  error?: string;
  skipReason?: string;
  createdAt: string;
}

export interface OrderDesignLogPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}
