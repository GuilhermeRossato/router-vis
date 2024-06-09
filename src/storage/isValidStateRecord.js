export function isValidStateRecord(rec) {
  if (
    !rec ||
    typeof rec !== "object" ||
    !rec["time"] ||
    typeof rec["time"] !== "number"
  ) {
    return false;
  }
  if (rec["time"] < 0 || isNaN(rec["time"])) {
    return false;
  }
  return true;
}
