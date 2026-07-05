/**
 * Access tests: verify that unauthenticated (anon) requests cannot read
 * protected rows from drill_holes, sampling_results, or orphan
 * property_listings (project_id IS NULL).
 *
 * These tests hit the live Data API using the publishable/anon key. RLS is
 * the enforcement point — any regression that widens visibility for anon
 * (e.g. re-adding `project_id IS NULL OR ...` in a SELECT policy) will
 * make one of these tests fail.
 */
import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;

const online = Boolean(url && anonKey);
const d = online ? describe : describe.skip;

const anon = online
  ? createClient(url!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    })
  : null;

d("RLS hardening — anonymous access", () => {
  it("drill_holes: anon cannot read any row (project_id NULL is not a bypass)", async () => {
    const { data, error } = await anon!.from("drill_holes").select("id").limit(1);
    // Either policy denies (empty data) or the referenced helper is not
    // executable by anon (permission error). Both prove anon has no read.
    if (error) {
      expect(error.code).toMatch(/42501|PGRST/);
    } else {
      expect(data ?? []).toEqual([]);
    }
  });

  it("sampling_results: anon cannot read any row", async () => {
    const { data, error } = await anon!.from("sampling_results").select("id").limit(1);
    if (error) {
      expect(error.code).toMatch(/42501|PGRST/);
    } else {
      expect(data ?? []).toEqual([]);
    }
  });

  it("property_listings: anon cannot read orphan (project_id IS NULL) listings", async () => {
    const { data, error } = await anon!
      .from("property_listings")
      .select("id,project_id")
      .is("project_id", null)
      .limit(5);
    expect(error).toBeNull();
    expect(data ?? []).toEqual([]);
  });

  it("property_listings: anon can still browse published listings tied to a project", async () => {
    const { data, error } = await anon!
      .from("property_listings")
      .select("id,project_id,is_published")
      .eq("is_published", true)
      .not("project_id", "is", null)
      .limit(1);
    expect(error).toBeNull();
    for (const row of data ?? []) {
      expect(row.project_id).not.toBeNull();
      expect(row.is_published).toBe(true);
    }
  });
});
