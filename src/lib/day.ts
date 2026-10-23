// Din subah 4 baje reset hota hai (raat ki coding same din mein count hogi)
export const CUTOFF_HOUR = 4;
export const dayKey = (d = new Date()) =>
  new Date(d.getTime() - CUTOFF_HOUR * 3600e3).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
export const addDays = (key: string, n: number) =>
  new Date(new Date(key + "T00:00:00Z").getTime() + n * 86400e3).toISOString().slice(0, 10);
