import { useState } from "react";
import { signInWithPassword, resetPassword } from "../lib/auth";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";

type LoginMode = "login" | "resetPassword" | "firstLogin";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mode, setMode] = useState<LoginMode>("login");

  // First login sub-steps: "check" (enter email) -> "create" (enter password)
  const [firstLoginStep, setFirstLoginStep] = useState<"check" | "create">("check");
  const [invitationFound, setInvitationFound] = useState<{ role: string; email: string } | null>(null);

  const switchMode = (newMode: LoginMode) => {
    setMode(newMode);
    setError(null);
    setSuccess(null);
    setPassword("");
    setPasswordConfirm("");
    setFirstLoginStep("check");
    setInvitationFound(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (mode === "resetPassword") {
        await resetPassword(email);
        setSuccess("Un email de reinitialisation vous a ete envoye.");
        setMode("login");
      } else if (mode === "firstLogin") {
        if (firstLoginStep === "check") {
          // Check if invitation exists
          await handleCheckInvitation();
        } else {
          // Create account
          await handleCreateAccount();
        }
      } else {
        const result = await signInWithPassword(email, password);
        // Vérifier que l'utilisateur a un profil (a été invité)
        const userId = result?.user?.id;
        if (userId && supabase) {
          const { data: profile } = await supabase
            .from("user_profiles")
            .select("role")
            .eq("user_id", userId)
            .single();
          if (!profile) {
            await supabase.auth.signOut();
            throw new Error("Votre compte n'est pas autorisé. Contactez votre administrateur.");
          }
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckInvitation = async () => {
    if (!supabase || !isSupabaseConfigured()) {
      throw new Error("Le service n'est pas disponible.");
    }

    const trimmedEmail = email.trim().toLowerCase();
    const { data, error: queryError } = await supabase
      .from("invitations")
      .select("*")
      .eq("email", trimmedEmail)
      .eq("accepted", false);

    if (queryError) throw queryError;

    if (!data || data.length === 0) {
      throw new Error("Aucune invitation trouvee pour cet email. Contactez votre administrateur.");
    }

    setInvitationFound(data[0]);
    setFirstLoginStep("create");
  };

  const handleCreateAccount = async () => {
    if (!supabase) throw new Error("Le service n'est pas disponible.");

    if (password.length < 8) {
      throw new Error("Le mot de passe doit contenir au moins 8 caractères.");
    }
    if (password !== passwordConfirm) {
      throw new Error("Les mots de passe ne correspondent pas.");
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Vérification côté serveur : seuls les emails invités peuvent s'inscrire
    const { data: invCheck } = await supabase
      .from("invitations")
      .select("id")
      .eq("email", trimmedEmail)
      .eq("accepted", false)
      .limit(1);

    if (!invCheck || invCheck.length === 0) {
      throw new Error("Aucune invitation valide pour cet email.");
    }

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
    });

    if (signUpError) throw signUpError;

    const newUserId = signUpData?.user?.id;
    if (newUserId) {
      // Apply invitation via SECURITY DEFINER function (bypasses RLS)
      await supabase.rpc("apply_invitation", {
        _user_id: newUserId,
        _email: trimmedEmail,
      });
    }

    setSuccess("Compte créé avec succès ! Vous pouvez maintenant vous connecter.");
    setMode("login");
    setPassword("");
    setPasswordConfirm("");
    setFirstLoginStep("check");
    setInvitationFound(null);
  };

  const getTitle = () => {
    switch (mode) {
      case "resetPassword": return "Reinitialiser le mot de passe";
      case "firstLogin": return "Premiere connexion";
      default: return "Connexion";
    }
  };

  const getButtonLabel = () => {
    if (loading) return "Chargement...";
    switch (mode) {
      case "resetPassword": return "Envoyer le lien";
      case "firstLogin":
        return firstLoginStep === "check" ? "Verifier mon invitation" : "Creer mon compte";
      default: return "Se connecter";
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <h1 className="login-title">Suivi de Chantier</h1>
          <p className="login-subtitle">{getTitle()}</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field">
            <label className="login-label" htmlFor="login-email">
              Adresse email
            </label>
            <input
              id="login-email"
              type="email"
              className="login-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nom@entreprise.com"
              required
              autoComplete="email"
              disabled={mode === "firstLogin" && firstLoginStep === "create"}
            />
          </div>

          {/* Login mode: password field */}
          {mode === "login" && (
            <div className="login-field">
              <label className="login-label" htmlFor="login-password">
                Mot de passe
              </label>
              <input
                id="login-password"
                type="password"
                className="login-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Votre mot de passe"
                required
                autoComplete="current-password"
              />
            </div>
          )}

          {/* First login - create step: password + confirm */}
          {mode === "firstLogin" && firstLoginStep === "create" && (
            <>
              {invitationFound && (
                <div style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: "var(--success-bg, #dcfce7)",
                  color: "var(--success-text, #166534)",
                  fontSize: "0.85rem",
                  marginBottom: 12,
                  lineHeight: 1.5,
                }}>
                  Invitation trouvee ! Role : <strong>{invitationFound.role === "admin" ? "Administrateur" : "Client"}</strong>.
                  Creez votre mot de passe pour activer votre compte.
                </div>
              )}
              <div className="login-field">
                <label className="login-label" htmlFor="login-password">
                  Mot de passe
                </label>
                <input
                  id="login-password"
                  type="password"
                  className="login-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Choisissez un mot de passe (min. 8 caracteres)"
                  required
                  autoComplete="new-password"
                />
              </div>
              <div className="login-field">
                <label className="login-label" htmlFor="login-password-confirm">
                  Confirmer le mot de passe
                </label>
                <input
                  id="login-password-confirm"
                  type="password"
                  className="login-input"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="Confirmez votre mot de passe"
                  required
                  autoComplete="new-password"
                />
              </div>
            </>
          )}

          {error && <div className="login-error">{error}</div>}
          {success && <div className="login-success">{success}</div>}

          <button
            type="submit"
            className="login-btn"
            disabled={loading}
          >
            {getButtonLabel()}
          </button>
        </form>

        <div className="login-footer">
          {mode === "login" && (
            <>
              <button
                type="button"
                className="login-link"
                onClick={() => switchMode("resetPassword")}
              >
                Mot de passe oublie ?
              </button>
              <button
                type="button"
                className="login-link"
                onClick={() => switchMode("firstLogin")}
                style={{ marginTop: 6 }}
              >
                Premiere connexion ?
              </button>
            </>
          )}
          {mode === "resetPassword" && (
            <button
              type="button"
              className="login-link"
              onClick={() => switchMode("login")}
            >
              Retour a la connexion
            </button>
          )}
          {mode === "firstLogin" && (
            <button
              type="button"
              className="login-link"
              onClick={() => switchMode("login")}
            >
              Retour a la connexion
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
