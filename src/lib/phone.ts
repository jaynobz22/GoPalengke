export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  let local = "";
  if (digits.startsWith("63") && digits.length === 12) local = digits.slice(2);
  else if (digits.startsWith("0") && digits.length === 11) local = digits.slice(1);
  else if (digits.startsWith("9") && digits.length === 10) local = digits;
  if (!/^9\d{9}$/.test(local)) return null;
  return `+63${local}`;
}

export function phoneLoginEmail(e164: string) {
  return `${e164.replace(/\D/g, "")}@phone.gopalengke.net`;
}