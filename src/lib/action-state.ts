import { z } from "zod";

/** État standard renvoyé par les Server Actions (compatible useActionState). */
export type ActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  errors?: Record<string, string[]>;
  /** Données non sensibles à renvoyer au formulaire. */
  data?: Record<string, unknown>;
};

export const idleState: ActionState = { status: "idle" };

export function successState(message: string, data?: Record<string, unknown>): ActionState {
  return { status: "success", message, data };
}

export function errorState(message: string, errors?: Record<string, string[]>): ActionState {
  return { status: "error", message, errors };
}

export function zodToFieldErrors(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join(".") : "_form";
    fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
  }
  return fieldErrors;
}
