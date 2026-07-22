import { z } from "zod";

// Allow letters (incl. accented), digits, spaces, and common punctuation
// used in Ghanaian place names: - , . ' / & ( )
const LOCATION_PATTERN = /^[\p{L}\p{N}\s\-,.'/&()]+$/u;

export const locationSchema = z
  .string()
  .trim()
  .max(100, { message: "Location must be 100 characters or fewer" })
  .refine((v) => v === "" || v.length >= 2, {
    message: "Location must be at least 2 characters",
  })
  .refine((v) => v === "" || LOCATION_PATTERN.test(v), {
    message: "Location contains invalid characters",
  })
  .refine((v) => !/\s{2,}/.test(v), {
    message: "Location cannot contain consecutive spaces",
  });

/**
 * Returns { ok: true, value } where value is the cleaned string (or null if empty),
 * or { ok: false, error } with a user-facing message.
 */
export function validateLocation(
  raw: string,
): { ok: true; value: string | null } | { ok: false; error: string } {
  // collapse internal whitespace before validating so "Accra   Central"
  // becomes "Accra Central" rather than being rejected.
  const collapsed = raw.replace(/\s+/g, " ");
  const parsed = locationSchema.safeParse(collapsed);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid location" };
  }
  const clean = parsed.data;
  return { ok: true, value: clean === "" ? null : clean };
}