import { expect, test } from "vitest";
import { sign, verify } from "./hmac";

test("sign matches the standard HMAC-SHA256 test vector", async () => {
  expect(await sign("key", "The quick brown fox jumps over the lazy dog")).toBe(
    "f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8",
  );
});

test("verify accepts only the right body, secret and signature", async () => {
  const signature = await sign("s3cret", '{"a":1}');
  expect(await verify("s3cret", '{"a":1}', signature)).toBe(true);
  expect(await verify("s3cret", '{"a":2}', signature)).toBe(false);
  expect(await verify("other", '{"a":1}', signature)).toBe(false);
  expect(await verify("s3cret", '{"a":1}', null)).toBe(false);
  expect(await verify("s3cret", '{"a":1}', "zz")).toBe(false);
});
