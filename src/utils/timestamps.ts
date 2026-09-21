/** Swaps the calendar date of an ISO timestamp, keeping its time-of-day. */
export const withDatePart = (iso: string, yyyyMmDd: string): string =>
  `${yyyyMmDd}T${iso.split("T")[1] || "12:00:00.000Z"}`;
