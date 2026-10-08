import { describe, expect, it, vi } from "vitest";
import { requireOperationManager, type OperationAccessClient } from "./access.server";

function clientFor(owner: string | null, staff: unknown = false, error: unknown = null) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: owner === null ? null : { id: "operation-b", created_by: owner },
    error,
  });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  const rpc = vi.fn().mockResolvedValue({ data: staff, error });
  const client = { from, rpc } as unknown as OperationAccessClient;
  return { client, from, select, eq, rpc };
}

describe("operation signature management access", () => {
  it("allows the operation creator", async () => {
    const { client, eq, rpc } = clientFor("owner");
    await expect(requireOperationManager(client, "operation-b", "owner")).resolves.toBeUndefined();
    expect(eq).toHaveBeenCalledWith("id", "operation-b");
    expect(rpc).toHaveBeenCalledWith("is_gc_staff", { _user_id: "owner" });
  });

  it("allows staff explicitly recognized by the database", async () => {
    const { client } = clientFor("other-owner", true);
    await expect(requireOperationManager(client, "operation-b", "staff")).resolves.toBeUndefined();
  });

  it("denies a user who does not manage the target operation", async () => {
    const { client } = clientFor("tenant-b-owner");
    await expect(requireOperationManager(client, "operation-b", "tenant-a-reader")).rejects.toThrow(
      "Sin permiso",
    );
  });

  it("does not interpret truthy non-boolean values as staff", async () => {
    const { client } = clientFor("other-owner", "true");
    await expect(requireOperationManager(client, "operation-b", "reader")).rejects.toThrow(
      "Sin permiso",
    );
  });

  it("denies a missing operation even for staff", async () => {
    const { client } = clientFor(null, true);
    await expect(requireOperationManager(client, "operation-b", "staff")).rejects.toThrow(
      "Sin permiso",
    );
  });

  it("denies lookup errors even for the creator", async () => {
    const { client } = clientFor("owner", true, { message: "unavailable" });
    await expect(requireOperationManager(client, "operation-b", "owner")).rejects.toThrow(
      "No se pudo verificar",
    );
  });

  it("rejects missing identifiers before any database query", async () => {
    const { client, from, rpc } = clientFor("owner");
    await expect(requireOperationManager(client, null, "owner")).rejects.toThrow("Sin permiso");
    await expect(requireOperationManager(client, "operation-b", "")).rejects.toThrow("Sin permiso");
    expect(from).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
});
