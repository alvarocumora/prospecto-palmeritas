import { describe, expect, it } from "vitest";
import {
  daysUntilDue,
  dunningStage,
  daysSinceReminder,
  shouldRemind,
  dunningPriority,
} from "./dunning";

const NOW = new Date("2026-07-18T12:00:00Z");

describe("dunning stage", () => {
  it("daysUntilDue: futuro positivo, sin fecha null", () => {
    expect(daysUntilDue(null, NOW)).toBeNull();
    expect(daysUntilDue("2026-07-20", NOW)).toBe(2);
    expect(daysUntilDue("2026-07-10", NOW)).toBeLessThan(0);
  });

  it("clasifica por vencimiento", () => {
    expect(dunningStage(null, NOW)).toBe("scheduled");
    expect(dunningStage("2026-08-30", NOW)).toBe("scheduled"); // lejos
    expect(dunningStage("2026-07-20", NOW)).toBe("upcoming"); // en 2 días
    expect(dunningStage("2026-07-10", NOW)).toBe("overdue"); // 8 días
    expect(dunningStage("2026-05-01", NOW)).toBe("severe"); // +30 días
  });
});

describe("shouldRemind", () => {
  it("no recuerda pagos lejanos", () => {
    expect(shouldRemind({ dueDate: "2026-09-01", lastReminderAt: null }, NOW)).toBe(false);
  });

  it("recuerda próximos a vencer una sola vez", () => {
    expect(shouldRemind({ dueDate: "2026-07-20", lastReminderAt: null }, NOW)).toBe(true);
    // ya recordado → no repite antes de vencer
    expect(shouldRemind({ dueDate: "2026-07-20", lastReminderAt: "2026-07-18" }, NOW)).toBe(false);
  });

  it("vencido: respeta cadencia de 7 días", () => {
    expect(shouldRemind({ dueDate: "2026-07-05", lastReminderAt: null }, NOW)).toBe(true);
    // recordado hace 3 días → aún no
    expect(shouldRemind({ dueDate: "2026-07-05", lastReminderAt: "2026-07-15" }, NOW)).toBe(false);
    // recordado hace 8 días → toca de nuevo
    expect(shouldRemind({ dueDate: "2026-07-05", lastReminderAt: "2026-07-10" }, NOW)).toBe(true);
  });

  it("severo: cadencia más agresiva (4 días)", () => {
    // vencido +30, recordado hace 5 días → toca (cadencia severa 4)
    expect(shouldRemind({ dueDate: "2026-05-01", lastReminderAt: "2026-07-13" }, NOW)).toBe(true);
    // recordado hace 2 días → aún no
    expect(shouldRemind({ dueDate: "2026-05-01", lastReminderAt: "2026-07-16" }, NOW)).toBe(false);
  });

  it("daysSinceReminder", () => {
    expect(daysSinceReminder(null, NOW)).toBeNull();
    expect(daysSinceReminder("2026-07-11", NOW)).toBe(7);
  });
});

describe("dunningPriority", () => {
  it("severo > vencido > próximo > programado", () => {
    const severe = dunningPriority("2026-05-01", NOW);
    const overdue = dunningPriority("2026-07-10", NOW);
    const upcoming = dunningPriority("2026-07-20", NOW);
    const scheduled = dunningPriority("2026-09-01", NOW);
    expect(severe).toBeGreaterThan(overdue);
    expect(overdue).toBeGreaterThan(upcoming);
    expect(upcoming).toBeGreaterThan(scheduled);
  });
});
