import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock supabaseClient
vi.mock("../../lib/supabaseClient", () => ({
  isSupabaseConfigured: () => false,
  supabase: null,
}));

// Mock useUserRole
vi.mock("../../lib/useUserRole", () => ({
  useUserRole: () => ({
    role: "admin",
    isAdmin: true,
    isClient: false,
    profile: { email: "admin@test.com", role: "admin" },
    allowedProjectIds: null,
    loadingProjects: false,
  }),
}));

// Mock AuthProvider
vi.mock("../AuthProvider", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "admin@test.com" },
    profile: { email: "admin@test.com", role: "admin" },
    loading: false,
    signOut: vi.fn(),
  }),
}));

// Mock dataLayer
vi.mock("../../lib/dataLayer", () => ({
  withRetry: vi.fn(async (fn: () => Promise<void>) => {
    try { await fn(); return { ok: true }; } catch { return { ok: false }; }
  }),
  createProjectInDB: vi.fn().mockResolvedValue(undefined),
  deleteProjectFromDB: vi.fn().mockResolvedValue(undefined),
  fullProjectSync: vi.fn().mockResolvedValue(undefined),
}));

// Mock db
vi.mock("../../lib/db", () => ({
  generateId: () => "test_id_123",
  saveDB: vi.fn(),
  migrateProject: (p: any) => p,
  getLogementNums: (bat: any) => bat.logements || Array.from({ length: bat.nbLogements || 0 }, (_, i) => i + 1),
}));

// Mock computations
vi.mock("../../lib/computations", () => ({
  computeProjectProgress: () => 50,
  computeDetailedProgress: () => ({
    lotProgressInt: [],
    lotProgressExt: [],
    batimentProgress: [],
  }),
  getLogementCounts: () => ({ total: 0, exceptions: 0 }),
}));

// Mock format
vi.mock("../../lib/format", () => ({
  formatMontant: (v: number) => `${v} EUR`,
}));

// Mock constants
vi.mock("../../lib/constants", () => ({
  DEFAULT_LOTS: [],
  DEFAULT_LOTS_INT: [],
  DEFAULT_LOTS_EXT: [],
}));

// Mock UI components
vi.mock("../ui/Icon", () => ({ default: ({ name }: any) => <span data-testid={`icon-${name}`} /> }));
vi.mock("../ui/ThemeToggle", () => ({ default: () => <div data-testid="theme-toggle" /> }));
vi.mock("../ui/SyncStatusBadge", () => ({ default: () => <div data-testid="sync-badge" /> }));
vi.mock("../ui/ProgressBar", () => ({ default: ({ value }: any) => <div data-testid="progress-bar">{value}%</div> }));
vi.mock("../ui/Input", () => ({
  default: ({ label, value, onChange, placeholder }: any) => (
    <div>
      <label>{label}<input value={value} onChange={(e: any) => onChange(e.target.value)} placeholder={placeholder} /></label>
    </div>
  ),
}));
vi.mock("../ui/Button", () => ({
  default: ({ children, onClick, disabled, icon, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>{icon && <span>{icon}</span>}{children}</button>
  ),
}));
vi.mock("../ui/Modal", () => ({
  default: ({ open, onClose, title, children }: any) => open ? (
    <div data-testid="modal">
      <h3>{title}</h3>
      <button onClick={onClose}>Close</button>
      {children}
    </div>
  ) : null,
}));

import Dashboard from "../Dashboard";

function makeProject(overrides: any = {}) {
  return {
    id: "p1",
    name: "Project Alpha",
    location: "Paris",
    client: "Client A",
    createdAt: "2026-01-01T00:00:00Z",
    montantTotal: 100000,
    montantExt: 40000,
    montantInt: 60000,
    dateDebutChantier: "2026-02-01",
    dureeTotale: 12,
    dureeExt: 6,
    dureeInt: 8,
    dateDebutInt: "2026-03-01",
    dateDebutExt: "2026-04-01",
    semainesExclues: 0,
    semainesTravaillees: 0,
    batiments: [],
    lots: [],
    lotsInt: [],
    lotsExt: [],
    tracking: { logements: {}, batiments: {} },
    ...overrides,
  };
}

describe("Dashboard", () => {
  const defaultProps = {
    db: { projects: [] as any[] },
    setDb: vi.fn(),
    mode: "local",
    userId: "u1",
    onOpenProject: vi.fn(),
    theme: "light",
    toggleTheme: vi.fn(),
    forceSync: vi.fn(),
    forcePull: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows empty state when no projects", () => {
    render(<Dashboard {...defaultProps} />);
    expect(screen.getByText(/aucun projet pour le moment/i)).toBeInTheDocument();
  });

  it("renders project list when projects exist", () => {
    const db = { projects: [makeProject()] };
    render(<Dashboard {...defaultProps} db={db} />);

    expect(screen.getByText("Project Alpha")).toBeInTheDocument();
    expect(screen.getByText("Paris")).toBeInTheDocument();
  });

  it("renders multiple projects", () => {
    const db = {
      projects: [
        makeProject({ id: "p1", name: "Alpha" }),
        makeProject({ id: "p2", name: "Beta" }),
      ],
    };
    render(<Dashboard {...defaultProps} db={db} />);

    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("opens create project modal when button is clicked", () => {
    render(<Dashboard {...defaultProps} />);

    // There are multiple "Nouveau projet" elements (button in header + button in empty state)
    // Click the first one in the header
    const buttons = screen.getAllByText("Nouveau projet");
    fireEvent.click(buttons[0]);

    expect(screen.getByTestId("modal")).toBeInTheDocument();
  });

  it("calls onOpenProject when a project card is clicked", () => {
    const db = { projects: [makeProject()] };
    render(<Dashboard {...defaultProps} db={db} />);

    fireEvent.click(screen.getByText("Project Alpha"));
    expect(defaultProps.onOpenProject).toHaveBeenCalledWith("p1");
  });

  it("shows KPI cards when projects exist", () => {
    const db = { projects: [makeProject()] };
    render(<Dashboard {...defaultProps} db={db} />);

    // Should show KPI values
    expect(screen.getByText("1")).toBeInTheDocument(); // nbProjects = 1
  });

  it("displays project location and client info", () => {
    const db = {
      projects: [makeProject({ location: "Lyon", client: "Client B" })],
    };
    render(<Dashboard {...defaultProps} db={db} />);

    expect(screen.getByText("Lyon")).toBeInTheDocument();
    expect(screen.getByText("Client B")).toBeInTheDocument();
  });

  it("shows progress bars for projects", () => {
    const db = { projects: [makeProject()] };
    render(<Dashboard {...defaultProps} db={db} />);

    expect(screen.getAllByTestId("progress-bar").length).toBeGreaterThan(0);
  });

  it("renders header with app title", () => {
    render(<Dashboard {...defaultProps} />);
    expect(screen.getByText("Suivi Chantier")).toBeInTheDocument();
  });

  it("shows sync badge and theme toggle", () => {
    render(<Dashboard {...defaultProps} />);
    expect(screen.getByTestId("sync-badge")).toBeInTheDocument();
    expect(screen.getByTestId("theme-toggle")).toBeInTheDocument();
  });

  it("shows admin buttons (Charger demo, Pousser vers cloud, Nouveau projet)", () => {
    render(<Dashboard {...defaultProps} />);
    expect(screen.getAllByText(/charger d/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/pousser vers cloud/i)).toBeInTheDocument();
    expect(screen.getByText(/récupérer du cloud/i)).toBeInTheDocument();
  });

  it("shows empty state create buttons for admin", () => {
    render(<Dashboard {...defaultProps} />);
    expect(screen.getByText(/cr.er un projet/i)).toBeInTheDocument();
  });

  it("displays creation date for projects", () => {
    const db = { projects: [makeProject()] };
    render(<Dashboard {...defaultProps} db={db} />);

    // Date formatting: "01 janv. 2026" or similar
    expect(screen.getByText(/cr..? le/i)).toBeInTheDocument();
  });

  it("shows section title 'Tous les projets' for admin", () => {
    const db = { projects: [makeProject()] };
    render(<Dashboard {...defaultProps} db={db} />);

    expect(screen.getByText("Tous les projets")).toBeInTheDocument();
  });
});
