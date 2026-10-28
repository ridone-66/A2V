"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type Props = {
  endsAt: string;
  status: string;
  compact?: boolean;
  onEnded?: "refresh" | "none";
  className?: string;
};

function diff(target: number) {
  const total = Math.max(0, target - Date.now());
  return {
    total,
    days: Math.floor(total / 86_400_000),
    hours: Math.floor((total % 86_400_000) / 3_600_000),
    minutes: Math.floor((total % 3_600_000) / 60_000),
    seconds: Math.floor((total % 60_000) / 1000),
  };
}

export function Countdown({ endsAt, status, compact = false, onEnded = "refresh", className }: Props) {
  const [time, setTime] = useState<ReturnType<typeof diff> | null>(null);
  const router = useRouter();

  useEffect(() => {
    const target = new Date(endsAt).getTime();
    const tick = () => setTime(diff(target));
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [endsAt]);

  useEffect(() => {
    if (onEnded === "refresh" && time?.total === 0 && ["LIVE", "SCHEDULED"].includes(status)) {
      const timeout = window.setTimeout(() => router.refresh(), 2500);
      return () => window.clearTimeout(timeout);
    }
  }, [onEnded, router, status, time?.total]);

  if (!time) {
    return <span className={cn("tabular-nums text-muted", className)} suppressHydrationWarning>{compact ? "…" : "Calcul du temps restant…"}</span>;
  }

  if (time.total <= 0) {
    return <span className={cn("font-semibold text-brand-700", className)}>Enchère terminée</span>;
  }

  if (compact) {
    return (
      <span className={cn("tabular-nums", className)}>
        {time.days > 0 ? `${time.days} j ` : ""}
        {String(time.hours).padStart(2, "0")} h {String(time.minutes).padStart(2, "0")} min
      </span>
    );
  }

  const cells = [
    { value: time.days, label: "jours" },
    { value: time.hours, label: "heures" },
    { value: time.minutes, label: "min" },
    { value: time.seconds, label: "sec" },
  ];

  return (
    <div className={cn("flex gap-2", className)} aria-live="off">
      {cells.map((cell) => (
        <div key={cell.label} className="min-w-[58px] rounded-xl bg-brand-800 px-2 py-2 text-center text-white">
          <span className="block text-xl font-bold tabular-nums">{String(cell.value).padStart(2, "0")}</span>
          <span className="block text-[10px] uppercase tracking-wide text-brand-200">{cell.label}</span>
        </div>
      ))}
    </div>
  );
}
