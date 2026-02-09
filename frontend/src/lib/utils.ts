import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

import { formatDistanceToNow, differenceInSeconds } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatRelativeTime(date: Date | null | string): string {
  if (!date) return "";

  const d = typeof date === 'string' ? new Date(date) : date;

  // Return "just now" for timestamps less than 10 seconds ago
  if (differenceInSeconds(new Date(), d) < 10) {
    return "just now";
  }

  return formatDistanceToNow(d, { addSuffix: true });
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount)
}
