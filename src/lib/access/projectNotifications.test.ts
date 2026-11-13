import { describe, expect, it } from "vitest";
import {
  isActiveProjectInvitation,
  isSignedTechnicalReport,
  mayNotifyProject,
  resolveProjectNotificationRecipients,
} from "./projectNotifications";

describe("Project notification authorization", () => {
  it("permits owners and administrators, never read-only project members", () => {
    expect(mayNotifyProject("owner")).toBe(true);
    expect(mayNotifyProject("admin")).toBe(true);
    for (const role of ["viewer", "geologist", "project_manager", "external_consultant", null]) {
      expect(mayNotifyProject(role)).toBe(false);
    }
    expect(mayNotifyProject("viewer", true)).toBe(true);
  });

  it("rejects accepted, revoked, expired and malformed invitations", () => {
    const now = new Date("2026-10-23T12:00:00Z");
    expect(isActiveProjectInvitation("pending", "2026-10-24T12:00:00Z", now)).toBe(true);
    for (const status of ["accepted", "revoked", "expired", null]) {
      expect(isActiveProjectInvitation(status, "2026-10-24T12:00:00Z", now)).toBe(false);
    }
    expect(isActiveProjectInvitation("pending", "2026-10-22T12:00:00Z", now)).toBe(false);
    expect(isActiveProjectInvitation("pending", "not-a-date", now)).toBe(false);
  });

  it("does not announce unsigned drafts or approval without signature evidence", () => {
    expect(isSignedTechnicalReport("signed", "2026-10-23")).toBe(true);
    expect(isSignedTechnicalReport("published", "2026-10-23")).toBe(true);
    for (const status of ["draft", "qp_review", "approved", "archived", null]) {
      expect(isSignedTechnicalReport(status, "2026-10-23")).toBe(false);
    }
    expect(isSignedTechnicalReport("signed", null)).toBe(false);
    expect(isSignedTechnicalReport("signed", "not-a-date")).toBe(false);
  });

  it("limits report notifications to project member addresses and deduplicates recipients", () => {
    const roster = ["Owner@Example.com", "technical@example.com"];
    expect(resolveProjectNotificationRecipients(undefined, roster)).toEqual([
      "owner@example.com",
      "technical@example.com",
    ]);
    expect(
      resolveProjectNotificationRecipients(
        [" TECHNICAL@example.com ", "technical@example.com"],
        roster,
      ),
    ).toEqual(["technical@example.com"]);
    expect(() =>
      resolveProjectNotificationRecipients(["outsider@example.com"], roster),
    ).toThrow("Destinatarios no autorizados");
    expect(() => resolveProjectNotificationRecipients([], roster)).toThrow();
    expect(() => resolveProjectNotificationRecipients(undefined, [])).toThrow();
  });

  it("fails closed if too many recipients are requested", () => {
    const emails = Array.from({ length: 51 }, (_, i) => `person-${i}@example.com`);
    expect(() => resolveProjectNotificationRecipients(emails, emails)).toThrow();
  });
});
