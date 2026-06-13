/**
 * Generic API response envelopes used by the FastAPI backend.
 * The backend isn't 100% consistent — some endpoints return a `success`
 * envelope, others return data directly — so callers should still type
 * their specific responses.
 */

export interface ApiEnvelope<T> {
  success: boolean;
  error?: string;
  data?: T;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page?: number;
  limit?: number;
}
