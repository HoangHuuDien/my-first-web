const TZ = "Asia/Ho_Chi_Minh";

/** @returns {{ day: string, startIso: string, endIso: string }} */
export function vnDayBounds(dateInput) {
  const ref = dateInput
    ? new Date(dateInput + "T12:00:00+07:00")
    : new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(ref);
  const y = parts.find((p) => p.type === "year").value;
  const m = parts.find((p) => p.type === "month").value;
  const d = parts.find((p) => p.type === "day").value;
  const day = `${y}-${m}-${d}`;
  const startIso = new Date(`${day}T00:00:00+07:00`).toISOString();
  const endIso = new Date(`${day}T23:59:59.999+07:00`).toISOString();
  return { day, startIso, endIso };
}

export function hoursAgoIso(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}
