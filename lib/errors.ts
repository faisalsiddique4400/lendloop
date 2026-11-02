import { ConvexError } from "convex/values";

export function errorText(error: unknown) {
  return error instanceof ConvexError && typeof error.data === "string" ? error.data : "Something went wrong. Try again.";
}
