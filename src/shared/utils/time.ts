export const minutesBetween = (leftIso: string, rightIso: string): number => {
  const left = Date.parse(leftIso);
  const right = Date.parse(rightIso);

  if (Number.isNaN(left) || Number.isNaN(right)) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.abs(left - right) / 60000;
};

export const transactionHourUtc = (isoTimestamp: string): number | null => {
  const date = new Date(isoTimestamp);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.getUTCHours();
};
