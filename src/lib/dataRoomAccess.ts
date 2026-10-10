export type DataRoomGrant = {
  id: string; data_room_id: string; grantee_user_id: string | null;
  access_level: string; scope: string; scope_file_ids: string[] | null; scope_folder_ids: string[] | null;
  nda_signed_at: string | null; revoked_at: string | null; expires_at: string | null;
};
export type RoomFile = { id: string; folder_id: string | null; confidentiality: string };
export function activeRoomGrant(grant: DataRoomGrant, userId: string, roomId: string, now: number) {
  if (grant.grantee_user_id !== userId || grant.data_room_id !== roomId || grant.revoked_at) return false;
  if (!["view", "download", "edit", "manage", "admin"].includes(grant.access_level)) return false;
  if (grant.expires_at && (!Number.isFinite(Date.parse(grant.expires_at)) || Date.parse(grant.expires_at) <= now)) return false;
  return true;
}
export function roomFileAllowed(file: RoomFile, grants: DataRoomGrant[], userId: string, roomId: string, ndaSigned: boolean, now = Date.now()) {
  if (file.confidentiality === "public") return true;
  if (!ndaSigned) return false;
  return grants.some((grant) => {
    if (!activeRoomGrant(grant, userId, roomId, now)) return false;
    if (grant.scope === "room") return true;
    if (grant.scope === "file" || grant.scope === "files") return grant.scope_file_ids?.includes(file.id) === true;
    if (grant.scope === "folder" || grant.scope === "folders") return !!file.folder_id && grant.scope_folder_ids?.includes(file.folder_id) === true;
    return false;
  });
}
