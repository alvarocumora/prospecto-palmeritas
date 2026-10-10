import { describe, expect, it } from "vitest";
import { canEnterPath, type AccessContext } from "./workspaceAccess";
const investor: AccessContext = {
  isSuperAdmin: false,
  accountType: "investor",
  unrestricted: false,
  modules: ["capital"],
  projectRole: null,
  hasProjects: false,
};
describe("investor offerings navigation", () => {
  it("allows the capital investor to browse offers without technical project membership", () => {
    expect(canEnterPath("/dashboard/offerings", investor)).toEqual({ allowed: true });
  });
  it("preserves capital module requirements", () => {
    expect(canEnterPath("/dashboard/offerings", { ...investor, modules: [] })).toEqual({
      allowed: false,
      reason: { kind: "plan", module: "capital" },
    });
  });
  it("preserves the restriction on project listing administration", () => {
    expect(canEnterPath("/dashboard/listings", investor)).toEqual({
      allowed: false,
      reason: { kind: "investor" },
    });
  });
});
