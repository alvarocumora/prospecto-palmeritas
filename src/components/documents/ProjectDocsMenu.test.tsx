import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectDocsMenu } from "./ProjectDocsMenu";

const mocks = vi.hoisted(() => ({ download: vi.fn(), error: vi.fn(), success: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("sonner", () => ({
  toast: { loading: () => "job", error: mocks.error, success: mocks.success, message: vi.fn() },
}));
vi.mock("@/lib/pdf/generateProjectDoc", () => ({ downloadProjectDoc: mocks.download }));
vi.mock("@/components/ui/dropdown-menu", () => {
  const Container = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  return {
    DropdownMenu: Container,
    DropdownMenuContent: Container,
    DropdownMenuLabel: Container,
    DropdownMenuSeparator: () => null,
    DropdownMenuTrigger: Container,
    DropdownMenuItem: ({
      children,
      onSelect,
    }: {
      children: React.ReactNode;
      onSelect: () => void;
    }) => <button onClick={onSelect}>{children}</button>,
  };
});

describe("ProjectDocsMenu asynchronous exports", () => {
  it("reports builder failures and releases the export button for retry", async () => {
    const build = vi.fn().mockRejectedValue(new Error("Fuente no disponible"));
    render(<ProjectDocsMenu build={build} />);
    fireEvent.click(screen.getByText(/marco NI 43-101/));
    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith("Fuente no disponible", { id: "job" }),
    );
    expect(screen.getByRole("button", { name: /Descargar documentos/ })).toBeEnabled();
    expect(mocks.download).not.toHaveBeenCalled();
  });

  it("prevents overlapping exports while an asynchronous model is loading", async () => {
    let resolve!: (value: null) => void;
    const build = vi.fn(
      () =>
        new Promise<null>((done) => {
          resolve = done;
        }),
    );
    render(<ProjectDocsMenu build={build} />);
    fireEvent.click(screen.getByText(/marco NI 43-101/));
    fireEvent.click(screen.getByText(/marco JORC 2012/));
    expect(build).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /Generando documento/ })).toBeDisabled();
    resolve(null);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Descargar documentos/ })).toBeEnabled(),
    );
  });
});
