export const roundConfidence = (value: number): number => {
  const bounded = Math.min(1, Math.max(0, value));
  return Math.round(bounded * 100) / 100;
};

export const amountsEqual = (left: number, right: number): boolean =>
  Math.abs(left - right) < 0.01;

export const formatAmount = (amount: number): string => {
  if (Number.isInteger(amount)) {
    return `${amount} BDT`;
  }

  return `${amount.toFixed(2)} BDT`;
};
