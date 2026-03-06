import { useState, useEffect, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import { useUserRole } from "../lib/useUserRole";
import Button from "./ui/Button";
import Modal from "./ui/Modal";

interface Invitation {
  id: string;
  email: string;
  role: string;
  project_ids: string[];
  created_at: string;
  accepted: boolean;
}

export default function InviteUsersPanel({ projects }: { projects: any[] }) {
  const { isAdmin } = useUserRole();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "client">("client");
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchInvitations = useCallback(async () => {
    if (!supabase || !isSupabaseConfigured()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("invitations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setInvitations(data || []);
    } catch (err: any) {
      console.error("Erreur chargement invitations:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim()) {
      setError("L'email est requis.");
      return;
    }

    if (!supabase) {
      setError("Supabase n'est pas configure.");
      return;
    }

    setSubmitting(true);
    try {
      const { error: insertError } = await supabase.from("invitations").insert({
        email: email.trim().toLowerCase(),
        role,
        project_ids: selectedProjects,
      });

      if (insertError) throw insertError;

      setSuccess(`Invitation envoyee a ${email.trim()}.`);
      setEmail("");
      setRole("client");
      setSelectedProjects([]);
      setShowForm(false);
      fetchInvitations();
    } catch (err: any) {
      setError(err?.message || "Erreur lors de la creation de l'invitation.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (inv: Invitation) => {
    if (!supabase) return;
    if (!confirm(`Revoquer l'invitation pour ${inv.email} ?`)) return;

    try {
      const { error } = await supabase
        .from("invitations")
        .delete()
        .eq("id", inv.id);
      if (error) throw error;
      fetchInvitations();
    } catch (err: any) {
      console.error("Erreur revocation:", err);
    }
  };

  const toggleProject = (projectId: string) => {
    setSelectedProjects((prev) =>
      prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId]
    );
  };

  if (!isAdmin) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "var(--text-tertiary)" }}>
        Acces reserve aux administrateurs.
      </div>
    );
  }

  if (!isSupabaseConfigured()) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "var(--text-tertiary)" }}>
        Supabase n'est pas configure. Le systeme d'invitation necessite Supabase.
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 24px", maxWidth: 800 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: "1.1rem", color: "var(--text-primary)" }}>
          Gestion des invitations
        </h3>
        <Button variant="primary" icon="plus" onClick={() => { setShowForm(true); setError(null); setSuccess(null); }}>
          Inviter un utilisateur
        </Button>
      </div>

      {success && (
        <div className="login-success" style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 8, background: "var(--success-bg, #dcfce7)", color: "var(--success-text, #166534)", fontSize: "0.9rem" }}>
          {success}
        </div>
      )}

      {/* Liste des invitations */}
      {loading ? (
        <div style={{ padding: 20, textAlign: "center", color: "var(--text-tertiary)" }}>
          Chargement...
        </div>
      ) : invitations.length === 0 ? (
        <div style={{
          padding: 32,
          textAlign: "center",
          color: "var(--text-tertiary)",
          border: "1px dashed var(--border)",
          borderRadius: 10,
          fontSize: "0.9rem",
        }}>
          Aucune invitation pour le moment.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {invitations.map((inv) => (
            <div
              key={inv.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                borderRadius: 10,
                background: "var(--surface)",
                border: "1px solid var(--border)",
                gap: 12,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.95rem" }}>
                    {inv.email}
                  </span>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: 6,
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      background: inv.role === "admin" ? "var(--accent-bg, #dbeafe)" : "var(--muted-bg, #f3f4f6)",
                      color: inv.role === "admin" ? "var(--accent-text, #1d4ed8)" : "var(--text-secondary)",
                    }}
                  >
                    {inv.role}
                  </span>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: 6,
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      background: inv.accepted ? "var(--success-bg, #dcfce7)" : "var(--warning-bg, #fef9c3)",
                      color: inv.accepted ? "var(--success-text, #166534)" : "var(--warning-text, #854d0e)",
                    }}
                  >
                    {inv.accepted ? "Acceptee" : "En attente"}
                  </span>
                </div>
                {inv.project_ids && inv.project_ids.length > 0 && (
                  <div style={{ marginTop: 4, fontSize: "0.8rem", color: "var(--text-tertiary)" }}>
                    Projets : {inv.project_ids.map((pid) => {
                      const p = projects.find((pr: any) => pr.id === pid);
                      return p ? p.name : pid;
                    }).join(", ")}
                  </div>
                )}
                <div style={{ marginTop: 2, fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
                  {new Date(inv.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                </div>
              </div>
              <Button variant="ghost" size="sm" icon="trash" onClick={() => handleRevoke(inv)}>
                Revoquer
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Modal formulaire d'invitation */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Inviter un utilisateur" width={480}>
        <form onSubmit={handleSubmit} style={{ padding: "16px 20px" }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              Adresse email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nom@entreprise.com"
              required
              className="login-input"
              style={{ width: "100%", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "admin" | "client")}
              className="login-input"
              style={{ width: "100%", boxSizing: "border-box", cursor: "pointer" }}
            >
              <option value="client">Client</option>
              <option value="admin">Administrateur</option>
            </select>
          </div>

          {role === "client" && projects.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                Projets accessibles
              </label>
              <div style={{
                maxHeight: 160,
                overflowY: "auto",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: 8,
              }}>
                {projects.map((p: any) => (
                  <label
                    key={p.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 8px",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontSize: "0.9rem",
                      color: "var(--text-primary)",
                      background: selectedProjects.includes(p.id) ? "var(--accent-bg, #dbeafe)" : "transparent",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedProjects.includes(p.id)}
                      onChange={() => toggleProject(p.id)}
                      style={{ cursor: "pointer" }}
                    />
                    {p.name}
                  </label>
                ))}
              </div>
              {role === "client" && selectedProjects.length === 0 && (
                <div style={{ marginTop: 4, fontSize: "0.8rem", color: "var(--warning-text, #854d0e)" }}>
                  Selectionnez au moins un projet pour un client.
                </div>
              )}
            </div>
          )}

          {error && (
            <div style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 8, background: "var(--error-bg, #fef2f2)", color: "var(--error-text, #dc2626)", fontSize: "0.85rem" }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
            <Button variant="ghost" onClick={() => setShowForm(false)} type="button">
              Annuler
            </Button>
            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? "Envoi..." : "Creer l'invitation"}
            </Button>
          </div>

          <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, background: "var(--muted-bg, #f9fafb)", fontSize: "0.8rem", color: "var(--text-tertiary)", lineHeight: 1.5 }}>
            L'utilisateur invite pourra creer son compte via le lien "Premiere connexion" sur la page de connexion en utilisant cette adresse email.
          </div>
        </form>
      </Modal>
    </div>
  );
}
