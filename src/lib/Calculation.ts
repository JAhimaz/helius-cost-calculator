import { SelectedMethod } from "@/components/types";

export type CostBreakdown = {
  perMinute: number;
  perHour: number;
  perDay: number;
  perWeek: number;
  perMonth: number;
  perYear: number;
};

const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const DAYS_PER_WEEK = 7;
const DAYS_PER_MONTH = 30;
const DAYS_PER_YEAR = 365;

export function getMethodCreditsPerCall(method: SelectedMethod): number {
  if (!method.isPerMB) {
    return method.methodCost;
  }

  const usageMb = method.mb ?? 0;
  const unitMb = method.mbUnit ?? 0;

  if (usageMb <= 0 || unitMb <= 0) {
    return 0;
  }

  // Example: if 0.1 MB costs 3 credits, then 5 MB costs (5 / 0.1) * 3 = 150 credits.
  return (usageMb / unitMb) * method.methodCost;
}

export function getMethodCreditsPerDay(method: SelectedMethod): number {
  const callsPerDay =
    method.callFrequency === "minute"
      ? method.callRate * MINUTES_PER_HOUR * HOURS_PER_DAY
      : method.callRate;

  return getMethodCreditsPerCall(method) * callsPerDay;
}

export function calculateTotalCosts(selectedMethods: SelectedMethod[]): CostBreakdown {
  const perDay = selectedMethods.reduce((total, method) => {
    return total + getMethodCreditsPerDay(method);
  }, 0);

  const perHour = perDay / HOURS_PER_DAY;
  const perMinute = perHour / MINUTES_PER_HOUR;
  const perWeek = perDay * DAYS_PER_WEEK;
  const perMonth = perDay * DAYS_PER_MONTH;
  const perYear = perDay * DAYS_PER_YEAR;

  return {
    perMinute,
    perHour,
    perDay,
    perWeek,
    perMonth,
    perYear,
  };
}
