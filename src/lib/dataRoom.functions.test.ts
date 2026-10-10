import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDataRoomDownloadUrl, listDataRoomFiles, signNdaAndGrantAccess } from "./dataRoom.functions";
const state = vi.hoisted(() => {
  const signedUrl = vi.fn(async () => ({ data: { signedUrl: "https://example.com/private" }, error: null }));
  const grant = { id: "g1", data_room_id: "room1", grantee_user_id: "user1", access_level: "view", scope: "room", scope_file_ids: null as string[] | null, scope_folder_ids: null as string[] | null, nda_signed_at: "2026-10-08", revoked_at: null as string | null, expires_at: null as string | null };
  const value = { grants: [grant], nda: true, published: true, signedUrl, writes: [] as string[] };
  const files = [{ id: "f1", data_room_id: "room1", folder_id: "folder1", confidentiality: "confidential", file_name: "Private assays", storage_path: "private/assays.pdf", size_bytes: 10, mime_type: "application/pdf", created_at: "2026-10-08" }, { id: "f2", data_room_id: "room1", folder_id: "folder1", confidentiality: "public", file_name: "Public summary", storage_path: "public/summary.pdf", size_bytes: 10, mime_type: "application/pdf", created_at: "2026-10-08" }];
  function from(table: string) {
    function response(single = false) {
      let data: unknown = [];
      if (table === "property_listings") data = { id: "listing1", title: "Project", owner_user_id: "owner", project_id: "project1", is_published: value.published };
      if (table === "data_rooms") data = { id: "room1" };
      if (table === "project_members") data = null;
      if (table === "data_room_folders") data = [{ id: "folder1", name: "01 - Geología" }];
      if (table === "property_deal_inquiries") data = { id: "inquiry1", nda_signed_at: value.nda ? "2026-10-08" : null };
      if (table === "data_room_access_grants") data = value.grants;
      if (table === "data_room_files") data = single ? files[0] : files;
      return { data, error: null };
    }
    const query: object = new Proxy({}, { get: (_target, key) => {
      if (key === "then") return (resolve: (result: ReturnType<typeof response>) => unknown) => Promise.resolve(response()).then(resolve);
      if (key === "maybeSingle" || key === "single") return () => Promise.resolve(response(true));
      if (key === "insert" || key === "upsert") return () => { value.writes.push(table); return query; };
      return () => query;
    } });
    return query;
  }
  return { value, grant, sb: { from, rpc: vi.fn(async () => ({ error: null })), storage: { from: () => ({ createSignedUrl: signedUrl }) } } };
});
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const builder = { middleware: () => builder, inputValidator: () => builder, handler: (fn: unknown) => fn };
  return builder;
} }));
vi.mock("@/lib/access/roleMiddleware", () => ({ requireCapitalRole: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: state.sb }));
type Input = { data: { listingId: string; fileId?: string; signature?: string }; context: { userId: string } };
const invokeDownload = getDataRoomDownloadUrl as unknown as (input: Input) => Promise<unknown>;
const invokeList = listDataRoomFiles as unknown as (input: Input) => Promise<Array<{ id: string; file_path: string }>>;
const invokeNda = signNdaAndGrantAccess as unknown as (input: Input) => Promise<unknown>;
const input: Input = { data: { listingId: "listing1", fileId: "f1" }, context: { userId: "user1" } };
beforeEach(() => {
  state.value.grants = [{ ...state.grant }];
  state.value.nda = true;
  state.value.published = true;
  state.value.signedUrl.mockClear();
  state.value.writes.length = 0;
});
describe("data room handlers enforce permissions for direct calls", () => {
  it("does not return confidential metadata or storage paths without a grant", async () => {
    state.value.grants = [];
    const rows = await invokeList(input);
    expect(rows.map((row) => row.id)).toEqual(["f2"]);
    expect(rows[0].file_path).toBe("");
  });
  it("denies a new signed URL for a revoked grant despite an existing NDA", async () => {
    state.value.grants[0].revoked_at = "2026-10-09";
    await expect(invokeDownload(input)).rejects.toThrow("permiso");
    expect(state.value.signedUrl).not.toHaveBeenCalled();
  });
  it("does not recreate revoked access by signing the NDA again", async () => {
    state.value.grants[0].revoked_at = "2026-10-09";
    await expect(invokeNda({ ...input, data: { listingId: "listing1", signature: "user@example.com" } })).rejects.toThrow("revocado");
    expect(state.value.writes).not.toContain("data_room_access_grants");
    expect(state.value.writes).not.toContain("property_deal_inquiries");
  });
  it("allows a valid grant and preserves owner access to unpublished rooms", async () => {
    await expect(invokeDownload(input)).resolves.toEqual({ url: "https://example.com/private" });
    state.value.grants = [];
    state.value.nda = false;
    state.value.published = false;
    await expect(invokeDownload({ ...input, context: { userId: "owner" } })).resolves.toEqual({ url: "https://example.com/private" });
  });
  it("rejects unpublished opportunities for ordinary investors", async () => {
    state.value.published = false;
    await expect(invokeDownload(input)).rejects.toThrow("publicado");
    expect(state.value.signedUrl).not.toHaveBeenCalled();
  });
});
