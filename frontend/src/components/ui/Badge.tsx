import type { HTMLAttributes } from "react";

type Tone = "default" | "success" | "warning" | "danger";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ tone = "default", className = "", ...props }: BadgeProps) {
  const cls = `badge ${tone !== "default" ? `badge-${tone}` : ""} ${className}`.trim();
  return <span className={cls} {...props} />;
}

export function statusTone(status: string): Tone {
  if (["COMPLETED", "APPROVED", "ACTIVE"].includes(status)) return "success";
  if (["CANCELLED", "REJECTED", "UNFULFILLED", "SUSPENDED"].includes(status)) return "danger";
  if (["PENDING", "PENDING_VERIFICATION", "ASSIGNED", "EN_ROUTE", "ARRIVED", "IN_PROGRESS", "AWAITING_CONFIRMATION"].includes(status)) return "warning";
  return "default";
}
