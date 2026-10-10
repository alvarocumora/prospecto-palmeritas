import { describe, expect, it } from "vitest";
import { roomFileAllowed, type DataRoomGrant } from "./dataRoomAccess";
const now = Date.parse("2026-10-09T12:00:00Z");
const grant: DataRoomGrant = {
  id: "g1",
  data_room_id: "room1",
  grantee_user_id: "user1",
  access_level: "view",
  scope: "room",
  scope_file_ids: null,
  scope_folder_ids: null,
  nda_signed_at: "2026-10-08",
  revoked_at: null,
  expires_at: null,
};
const file = { id: "f1", folder_id: "folder1", confidentiality: "confidential" };
const allowed = (grants: DataRoomGrant[], nda = true) =>
  roomFileAllowed(file, grants, "user1", "room1", nda, now);
describe("data room resource authorization", () => {
  it("requires both NDA and permission for confidential files", () => {
    expect(allowed([grant])).toBe(true);
    expect(allowed([grant], false)).toBe(false);
    expect(allowed([])).toBe(false);
  });
  it("denies another user's or another room's grant", () => {
    expect(allowed([{ ...grant, grantee_user_id: "user2" }])).toBe(false);
    expect(allowed([{ ...grant, data_room_id: "room2" }])).toBe(false);
  });
  it.each([
    { revoked_at: "2026-10-09" },
    { expires_at: "2026-10-09T12:00:00Z" },
    { expires_at: "invalid" },
    { scope: "unknown" },
    { access_level: "unknown" },
  ])("denies revoked, expired and malformed grants: %o", (patch) => {
    expect(allowed([{ ...grant, ...patch }])).toBe(false);
  });
  it("limits file and folder grants to their explicit resource scope", () => {
    expect(allowed([{ ...grant, scope: "files", scope_file_ids: ["f1"] }])).toBe(true);
    expect(allowed([{ ...grant, scope: "files", scope_file_ids: ["f2"] }])).toBe(false);
    expect(allowed([{ ...grant, scope: "folders", scope_folder_ids: ["folder1"] }])).toBe(true);
    expect(allowed([{ ...grant, scope: "folders", scope_folder_ids: ["folder2"] }])).toBe(false);
  });
  it("permits public documents without an NDA or grant", () => {
    expect(
      roomFileAllowed({ ...file, confidentiality: "public" }, [], "user1", "room1", false, now),
    ).toBe(true);
  });
});
