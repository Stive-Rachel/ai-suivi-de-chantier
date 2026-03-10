import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Mock supabaseClient
vi.mock("../../lib/supabaseClient", () => ({
  isSupabaseConfigured: () => false,
  supabase: null,
}));

// Mock auth
vi.mock("../../lib/auth", () => ({
  signInWithPassword: vi.fn(),
  resetPassword: vi.fn(),
}));

import LoginPage from "../LoginPage";
import { signInWithPassword, resetPassword } from "../../lib/auth";

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders login form with email and password fields", () => {
    render(<LoginPage />);

    expect(screen.getByLabelText(/adresse email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/mot de passe/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /se connecter/i })).toBeInTheDocument();
  });

  it("renders the title 'Suivi de Chantier'", () => {
    render(<LoginPage />);
    expect(screen.getByText("Suivi de Chantier")).toBeInTheDocument();
  });

  it("shows error on failed login", async () => {
    vi.mocked(signInWithPassword).mockRejectedValue(new Error("Invalid credentials"));

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/adresse email/i), {
      target: { value: "test@test.com" },
    });
    fireEvent.change(screen.getByLabelText(/mot de passe/i), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /se connecter/i }));

    await waitFor(() => {
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
    });
  });

  it("switches to reset password mode", () => {
    render(<LoginPage />);

    fireEvent.click(screen.getByText(/mot de passe oubli/i));

    expect(screen.getByText(/reinitialiser le mot de passe/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /envoyer le lien/i })).toBeInTheDocument();
  });

  it("switches to first login mode", () => {
    render(<LoginPage />);

    // Click the "Premiere connexion ?" link button
    const firstLoginBtn = screen.getByRole("button", { name: /premiere connexion/i });
    fireEvent.click(firstLoginBtn);

    expect(screen.getByRole("button", { name: /verifier mon invitation/i })).toBeInTheDocument();
  });

  it("switches back to login from reset password mode", () => {
    render(<LoginPage />);

    fireEvent.click(screen.getByText(/mot de passe oubli/i));
    fireEvent.click(screen.getByText(/retour a la connexion/i));

    expect(screen.getByRole("button", { name: /se connecter/i })).toBeInTheDocument();
  });

  it("switches back to login from first login mode", () => {
    render(<LoginPage />);

    fireEvent.click(screen.getByText(/premiere connexion/i));
    fireEvent.click(screen.getByText(/retour a la connexion/i));

    expect(screen.getByRole("button", { name: /se connecter/i })).toBeInTheDocument();
  });

  it("shows loading state while submitting", async () => {
    let resolveLogin: () => void;
    vi.mocked(signInWithPassword).mockImplementation(
      () => new Promise((resolve) => { resolveLogin = () => resolve(null); })
    );

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/adresse email/i), {
      target: { value: "test@test.com" },
    });
    fireEvent.change(screen.getByLabelText(/mot de passe/i), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /se connecter/i }));

    // Button should show loading text
    expect(screen.getByText("Chargement...")).toBeInTheDocument();

    // Resolve the promise to finish
    resolveLogin!();
    await waitFor(() => {
      expect(screen.queryByText("Chargement...")).not.toBeInTheDocument();
    });
  });

  it("clears error when switching modes", () => {
    render(<LoginPage />);

    // Switch to reset mode then back
    fireEvent.click(screen.getByText(/mot de passe oubli/i));

    // The error state should be cleared on mode switch
    const errorDiv = document.querySelector(".login-error");
    expect(errorDiv).toBeNull();
  });

  it("handles reset password submission", async () => {
    vi.mocked(resetPassword).mockResolvedValue(null);

    render(<LoginPage />);
    fireEvent.click(screen.getByText(/mot de passe oubli/i));

    fireEvent.change(screen.getByLabelText(/adresse email/i), {
      target: { value: "test@test.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /envoyer le lien/i }));

    await waitFor(() => {
      expect(screen.getByText(/email de reinitialisation/i)).toBeInTheDocument();
    });
  });

  it("shows Connexion as default subtitle", () => {
    render(<LoginPage />);
    expect(screen.getByText("Connexion")).toBeInTheDocument();
  });

  it("shows Reinitialiser subtitle in reset mode", () => {
    render(<LoginPage />);
    fireEvent.click(screen.getByText(/mot de passe oubli/i));
    expect(screen.getByText(/reinitialiser le mot de passe/i)).toBeInTheDocument();
  });
});
