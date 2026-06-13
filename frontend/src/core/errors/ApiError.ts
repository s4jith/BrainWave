/**
 * Domain-level API error so callers can branch on `status` and `code`
 * without depending on Axios internals.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly detail?: string;
  readonly data?: unknown;

  constructor(params: {
    message: string;
    status: number;
    code?: string;
    detail?: string;
    data?: unknown;
  }) {
    super(params.message);
    this.name = "ApiError";
    this.status = params.status;
    this.code = params.code;
    this.detail = params.detail;
    this.data = params.data;
  }

  static isApiError(error: unknown): error is ApiError {
    return error instanceof ApiError;
  }
}
