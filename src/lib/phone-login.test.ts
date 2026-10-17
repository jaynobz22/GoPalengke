import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { authenticatePhonePassword, PHONE_LOGIN_ERROR } from "./phone-login.server";
import { normalizePhone, phoneLoginEmail } from "./phone";

describe("existing email accounts can sign in by their registered phone", () => {
  for (const phone of ["09690188293", "+639690188293", "9690188293"]) {
    test(`normalizes ${phone} and authenticates against the registered email`, async () => {
      const session = { access_token: "test-session" };
      const result = await authenticatePhonePassword(phone, "test-password", {
        findLoginEmail: async (normalized) => {
          assert.equal(normalized, "+639690188293");
          return "jdabblogger@gmail.com";
        },
        verifyPassword: async (email, password) => {
          assert.equal(email, "jdabblogger@gmail.com");
          assert.equal(password, "test-password");
          return session;
        },
      });
      assert.deepEqual(result, session);
    });
  }

  test("phone-created accounts still use their registered synthetic email", async () => {
    assert.equal(phoneLoginEmail("+639690188293"), "639690188293@phone.gopalengke.net");
    const result = await authenticatePhonePassword("09690188293", "test-password", {
      findLoginEmail: async () => phoneLoginEmail("+639690188293"),
      verifyPassword: async (email) => email === "639690188293@phone.gopalengke.net" ? "session" : null,
    });
    assert.equal(result, "session");
  });

  test("wrong passwords cannot return a session or expose the registered email", async () => {
    await assert.rejects(authenticatePhonePassword("09690188293", "wrong", {
      findLoginEmail: async () => "jdabblogger@gmail.com",
      verifyPassword: async () => null,
    }), { message: PHONE_LOGIN_ERROR });
  });

  test("unknown phones use the same error and never authenticate", async () => {
    let called = false;
    await assert.rejects(authenticatePhonePassword("09690188293", "test-password", {
      findLoginEmail: async () => null,
      verifyPassword: async () => { called = true; return "session"; },
    }), { message: PHONE_LOGIN_ERROR });
    assert.equal(called, false);
  });

  test("invalid numbers cannot reach account lookup", async () => {
    assert.equal(normalizePhone("123"), null);
    let called = false;
    await assert.rejects(authenticatePhonePassword("123", "test-password", {
      findLoginEmail: async () => { called = true; return "email"; },
      verifyPassword: async () => "session",
    }), { message: PHONE_LOGIN_ERROR });
    assert.equal(called, false);
  });
});