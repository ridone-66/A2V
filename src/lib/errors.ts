/**
 * Erreurs métier typées. Les messages sont destinés à l'utilisateur final
 * (français, compréhensibles) ; les détails techniques restent côté serveur.
 */
export type AppErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "PAYMENT_REQUIRED"
  | "AUCTION_CLOSED"
  | "OUTBID"
  | "NOT_CONFIGURED"
  | "INTERNAL";

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(
    code: AppErrorCode,
    message: string,
    options: { status?: number; fieldErrors?: Record<string, string[]> } = {},
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = options.status ?? defaultStatus(code);
    this.fieldErrors = options.fieldErrors;
  }
}

function defaultStatus(code: AppErrorCode): number {
  switch (code) {
    case "UNAUTHENTICATED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "CONFLICT":
    case "OUTBID":
    case "AUCTION_CLOSED":
      return 409;
    case "VALIDATION":
      return 422;
    case "RATE_LIMITED":
      return 429;
    case "PAYMENT_REQUIRED":
      return 402;
    case "NOT_CONFIGURED":
      return 503;
    default:
      return 500;
  }
}

export function toUserMessage(error: unknown): string {
  if (error instanceof AppError) return error.message;
  return "Une erreur inattendue est survenue. Réessayez dans quelques instants.";
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
