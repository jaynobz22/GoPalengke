import { normalizePhone } from "./phone";

export const PHONE_LOGIN_ERROR = "Mali ang email/cellphone o password.";

// Account identifiers stay server-side; only a password-validated session returns.
export async function authenticatePhonePassword<T>(
  rawPhone: string,
  password: string,
  dependencies: {
    findLoginEmail: (e164: string) => Promise<string | null>;
    verifyPassword: (email: string, password: string) => Promise<T | null>;
  },
): Promise<T> {
  const phone = normalizePhone(rawPhone);
  if (!phone) throw new Error(PHONE_LOGIN_ERROR);
  const email = await dependencies.findLoginEmail(phone);
  if (!email) throw new Error(PHONE_LOGIN_ERROR);
  const session = await dependencies.verifyPassword(email, password);
  if (!session) throw new Error(PHONE_LOGIN_ERROR);
  return session;
}