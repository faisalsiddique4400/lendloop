import { expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import { setup, signIn } from "./test.setup";

test("store creates a user once", async () => {
  const t = setup();
  const ali = await signIn(t, "Ali");
  expect(await ali.as.mutation(api.users.store, {})).toBe(ali.id);
  expect(await ali.as.query(api.users.me, {})).toMatchObject({
    name: "Ali",
    email: "ali@example.com",
    role: "user",
    trusted: false,
  });
});

test("signed-out callers get null from me and an error from store", async () => {
  const t = setup();
  expect(await t.query(api.users.me, {})).toBeNull();
  await expect(t.mutation(api.users.store, {})).rejects.toThrow("Sign in first");
});

test("only admins mark a neighbor trusted or list neighbors", async () => {
  const t = setup();
  const ali = await signIn(t, "Ali");
  const ada = await signIn(t, "Ada", "admin");
  await expect(ali.as.mutation(api.users.setTrusted, { userId: ali.id, trusted: true })).rejects.toThrow("Admins only");
  await expect(ali.as.query(api.users.list, {})).rejects.toThrow("Admins only");
  await ada.as.mutation(api.users.setTrusted, { userId: ali.id, trusted: true });
  expect(await ada.as.query(api.users.list, {})).toContainEqual({ _id: ali.id, name: "Ali", trusted: true, tools: 0 });
});

test("makeAdmin promotes by email", async () => {
  const t = setup();
  const ali = await signIn(t, "Ali");
  await t.mutation(internal.users.makeAdmin, { email: "ali@example.com" });
  expect(await ali.as.query(api.users.me, {})).toMatchObject({ role: "admin" });
  await expect(t.mutation(internal.users.makeAdmin, { email: "nobody@example.com" })).rejects.toThrow("No user");
  const ada = await signIn(t, "Ada");
  await t.mutation(internal.users.makeAdmin, { email: "ADA@example.com" });
  expect(await ada.as.query(api.users.me, {})).toMatchObject({ role: "admin" });
});
