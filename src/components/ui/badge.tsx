import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "brand" | "neutral" | "success" | "danger" | "warning" | "info";

const tones: Record<Tone, string> = {
  brand: "bg-brand-100 text-brand-800 border-brand-200",
  neutral: "bg-gray-100 text-gray-700 border-gray-200",
  success: "bg-green-50 text-green-800 border-green-200",
  danger: "bg-red-50 text-red-700 border-red-200",
  warning: "bg-amber-50 text-amber-800 border-amber-200",
  info: "bg-sky-50 text-sky-800 border-sky-200",
};

export function Badge({
  children,
  tone = "brand",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status, label }: { status: string; label: string }) {
  const tone: Tone =
    ["FINALIZED", "DELIVERED", "SUCCEEDED", "ACTIVE", "PAID", "SOLD", "EARNED"].includes(status)
      ? "success"
      : ["CANCELLED", "REFUNDED", "FAILED", "DEFAULTED", "EXPIRED", "LOST", "DAMAGED", "DISPUTED"].includes(status)
        ? "danger"
        : ["PENDING_PAYMENT", "PENDING", "TRIALING", "RESERVE_NOT_MET", "OPEN", "UNDER_REVIEW", "PAYMENT_FAILED"].includes(status)
          ? "warning"
          : ["SHIPPED", "IN_TRANSIT", "PREPARING", "LABEL_CREATED", "HANDED_OVER"].includes(status)
            ? "info"
            : "brand";
  return <Badge tone={tone}>{label}</Badge>;
}
