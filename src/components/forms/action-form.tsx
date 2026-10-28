"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Alert } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { idleState, type ActionState } from "@/lib/action-state";
import { cn } from "@/lib/utils";

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

const FormStateContext = createContext<{ state: ActionState; pending: boolean }>({
  state: idleState,
  pending: false,
});

export function useFormStateA2V() {
  return useContext(FormStateContext);
}

export function FieldError({ name }: { name: string }) {
  const { state } = useFormStateA2V();
  const errors = state.errors?.[name];
  if (!errors?.length) return null;
  return (
    <p className="mt-1 text-sm text-danger" id={`${name}-error`}>
      {errors[0]}
    </p>
  );
}

export function FieldHint({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-xs text-muted">{children}</p>;
}

function Submit({ label, pendingLabel }: { label: string; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? (pendingLabel ?? "Envoi…") : label}
    </Button>
  );
}

export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel,
  className,
  resetOnSuccess = false,
  hideSubmit = false,
  footer,
  id,
}: {
  action: FormAction;
  children: ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  className?: string;
  resetOnSuccess?: boolean;
  hideSubmit?: boolean;
  footer?: ReactNode;
  id?: string;
}) {
  const [state, formAction, pending] = useActionState(action, idleState);
  const formRef = useRef<HTMLFormElement>(null);
  const fallbackId = useId();

  useEffect(() => {
    if (resetOnSuccess && state.status === "success") formRef.current?.reset();
  }, [resetOnSuccess, state]);

  return (
    <FormStateContext.Provider value={{ state, pending }}>
      <form
        ref={formRef}
        id={id ?? fallbackId}
        action={formAction}
        className={cn("space-y-5", className)}
        noValidate
      >
        {state.status === "error" && state.message ? (
          <Alert tone="danger" title="Action impossible">
            {state.message}
          </Alert>
        ) : null}
        {state.status === "success" && state.message ? (
          <Alert tone="success" title="C'est fait">
            {state.message}
          </Alert>
        ) : null}
        {children}
        {!hideSubmit ? (
          <div className={cn("flex flex-wrap items-center gap-3", pending && "opacity-90")}>
            <Submit label={submitLabel} pendingLabel={pendingLabel} />
            {footer}
          </div>
        ) : footer ? (
          <div>{footer}</div>
        ) : null}
      </form>
    </FormStateContext.Provider>
  );
}
