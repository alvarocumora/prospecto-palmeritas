import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route } from "@/routes/auth";
import { publicUrl } from "@/lib/publicUrl";

const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  reset: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signInWithPassword: mocks.signIn,
      signUp: mocks.signUp,
      resetPasswordForEmail: mocks.reset,
    },
  },
}));

async function renderAuth(path: string) {
  const root = createRootRoute();
  const auth = createRoute({
    getParentRoute: () => root,
    path: "/auth",
    validateSearch: Route.options.validateSearch,
    component: Route.options.component,
  });
  const router = createRouter({
    routeTree: root.addChildren([auth]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  await router.load();
  render(<RouterProvider router={router} />);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("acceso de Geocapitals", () => {
  it("abre el login para una simulación y deja revisar la contraseña", async () => {
    mocks.signIn.mockResolvedValue({ data: { session: {} }, error: null });
    await renderAuth("/auth?intent=investor&next=%2Fterminal%2Fcholqui");
    expect(await screen.findByRole("heading", { name: "Inicia sesión" })).toBeInTheDocument();

    const password = screen.getByLabelText("Contraseña");
    fireEvent.change(screen.getByLabelText("Correo electrónico"), {
      target: { value: "persona@example.com" },
    });
    fireEvent.change(password, { target: { value: "Contraseña1" } });
    fireEvent.click(screen.getByRole("button", { name: "Mostrar contraseña" }));
    expect(password).toHaveAttribute("type", "text");
    fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
    await waitFor(() =>
      expect(mocks.signIn).toHaveBeenCalledWith({
        email: "persona@example.com",
        password: "Contraseña1",
      }),
    );
  });

  it("valida el correo y enfoca el campo al solicitar recuperación", async () => {
    await renderAuth("/auth");
    fireEvent.click(await screen.findByRole("button", { name: "¿Olvidaste tu contraseña?" }));
    expect(screen.getByRole("alert")).toHaveTextContent("El email es obligatorio.");
    expect(screen.getByLabelText("Correo electrónico")).toHaveFocus();
    expect(mocks.reset).not.toHaveBeenCalled();
  });

  it("respeta un enlace directo a registro", async () => {
    await renderAuth("/auth?mode=signup&intent=investor");
    expect(await screen.findByRole("heading", { name: "Crea tu cuenta" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre completo")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Inicia sesión" }));
    expect(screen.queryByLabelText("Nombre completo")).not.toBeInTheDocument();
  });
  it("envía el destino original en el enlace de confirmación del registro", async () => {
    const next = "/terminal/cholqui?tab=simulador&amount=15000&currency=USD&instrument=equity";
    mocks.signUp.mockResolvedValue({ data: { session: null }, error: null });
    await renderAuth(`/auth?mode=signup&intent=investor&next=${encodeURIComponent(next)}`);
    fireEvent.change(await screen.findByLabelText("Nombre completo"), {
      target: { value: "Persona Ejemplo" },
    });
    fireEvent.change(screen.getByLabelText("Correo electrónico"), {
      target: { value: "persona@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "Contraseña1" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Confirma tu cuenta");
    expect(mocks.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ emailRedirectTo: publicUrl(next) }),
      }),
    );
  });
});
