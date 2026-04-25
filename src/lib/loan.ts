import type { LoanConfig } from "./types/database";

export interface LoanPaymentResult {
  interest: number;
  principal: number;
  extraPrincipal: number;
  totalPayment: number;
  newBalance: number;
}

/**
 * Returns the number of days in the month that paymentDate falls in.
 */
function daysInMonth(date: Date): number {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * Compute a single loan payment given the current balance, loan config, and payment date.
 *
 * Interest is calculated as: balance * (annual_rate / 365) * days_in_month
 *
 * Loan types:
 * - interest_only: pay only the interest each period
 * - amortizing: standard amortizing payment (fixed total, split between interest and principal)
 * - fixed_principal: fixed principal amount each period plus interest
 */
export function computeLoanPayment(
  balance: number,
  config: LoanConfig,
  paymentDate: Date
): LoanPaymentResult {
  if (balance <= 0) {
    return { interest: 0, principal: 0, extraPrincipal: 0, totalPayment: 0, newBalance: 0 };
  }

  const dailyRate = config.annual_rate / 365;
  const days = daysInMonth(paymentDate);
  const interest = Math.round(balance * dailyRate * days * 100) / 100;

  let principal = 0;

  switch (config.loan_type) {
    case "interest_only": {
      // No principal reduction, just interest
      principal = 0;
      break;
    }

    case "amortizing": {
      // Standard amortization formula for monthly payment
      // M = P * [r(1+r)^n] / [(1+r)^n - 1]
      // where r = monthly rate, n = remaining term months
      const monthlyRate = config.annual_rate / 12;
      const n = config.term_months ?? 360; // default 30-year

      if (monthlyRate === 0) {
        principal = balance / n;
      } else {
        const payment = balance * (monthlyRate * Math.pow(1 + monthlyRate, n)) /
          (Math.pow(1 + monthlyRate, n) - 1);
        principal = Math.round((payment - interest) * 100) / 100;
      }

      // Ensure we don't pay more principal than the balance
      if (principal < 0) principal = 0;
      break;
    }

    case "fixed_principal": {
      // Fixed principal = balance / term_months, plus interest
      const termMonths = config.term_months ?? 360;
      principal = Math.round((balance / termMonths) * 100) / 100;
      break;
    }
  }

  // Apply extra principal, but don't exceed remaining balance
  const extraPrincipal = Math.min(config.extra_principal, Math.max(0, balance - principal));
  const totalPrincipal = Math.min(principal + extraPrincipal, balance);
  const totalPayment = Math.round((interest + totalPrincipal) * 100) / 100;
  const newBalance = Math.round((balance - totalPrincipal) * 100) / 100;

  return {
    interest,
    principal: Math.min(principal, balance),
    extraPrincipal: Math.round(extraPrincipal * 100) / 100,
    totalPayment,
    newBalance: Math.max(0, newBalance),
  };
}
