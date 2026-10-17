import { describe, expect, test } from "bun:test";
import { authenticatePhonePassword, PHONE_LOGIN_ERROR } from "./phone-login.server";
import { normalizePhone, phoneLoginEmail } from "./phone";

describe("existing email accounts can sign in by their registered phone", () => {
  for (const phone of ["09690188293", "+639690188293", "9690188293"]) {
    test(`normalizes ${phone} and authenticates against the registered email`, async () => {
      const session = { access_token: "test-session" };
      const result = await authenticatePhonePassword(phone, "test-password", {
        findLoginEmail: async (normalized) => {
          expect(normalized).toBe("+639690188293");
          return "jdabblogger@gmail.com";
        },
        verifyPassword: async (email, password) => {
          expect(email).toBe("jdabblogger@gmail.com");
          expect(password).toBe("test-password");
          return session;
        },
      });
      expect(result).toEqual(session);
    });
  }

  test("phone-created accounts still use their registered synthetic email", async () => {
    expect(phoneLoginEmail("+639690188293")).toBe("639690188293@phone.gopalengke.net");
    const result = await authenticatePhonePassword("09690188293", "test-password", {
      findLoginEmail: async () => phoneLoginEmail("+639690188293"),
      verifyPassword: async (email) => email === "639690188293@phone.gopalengke.net" ? "session" : null,
    });
    expect(result).toBe("session");
  });

  test("wrong passwords cannot return a session or expose the registered email", async () => {
    await expect(authenticatePhonePassword("09690188293", "wrong", {
      findLoginEmail: async () => "jdabblogger@gmail.com",
      verifyPassword: async () => null,
    })).rejects.toThrow(PHONE_LOGIN_ERROR);
  });

  test("unknown phones use the same error and never authenticate", async () => {
    let called = false;
    await expect(authenticatePhonePassword("09690188293", "test-password", {
      findLoginEmail: async () => null,
      verifyPassword: async () => { called = true; return "session"; },
    })).rejects.toThrow(PHONE_LOGIN_ERROR);
    expect(called).toBe(false);
  });

  test("invalid numbers cannot reach account lookup", async () => {
    expect(normalizePhone("123")).toBeNull();
    let called = false;
    await expect(authenticatePhonePassword("123", "test-password", {
      findLoginEmail: async () => { called = true; return "email"; },
      verifyPassword: async () => "session",
    })).rejects.toThrow(PHONE_LOGIN_ERROR);
    expect(called).toBe(false);
  });
});