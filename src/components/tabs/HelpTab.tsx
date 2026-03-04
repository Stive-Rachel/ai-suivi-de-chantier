import { useState } from "react";

const SECTIONS = [
  {
    id: "overview",
    title: "Présentation générale",
    icon: "📋",
    content: [
      {
        q: "Qu'est-ce que Suivi Chantier ?",
        a: "Suivi Chantier est une application web de suivi d'avancement de projets de construction. Elle permet de gérer les bâtiments, lots, décompositions et de suivre l'avancement des travaux intérieurs (logements) et extérieurs (bâtiments) en temps réel.",
      },
      {
        q: "Comment fonctionne la sauvegarde ?",
        a: "Toutes les données sont automatiquement sauvegardées dans le navigateur (localStorage). Si vous êtes connecté à Supabase (mode cloud), les données sont également synchronisées en ligne pour un accès multi-appareil.",
      },
      {
        q: "L'application fonctionne-t-elle hors ligne ?",
        a: "Oui. L'application est une PWA (Progressive Web App) installable. Les données sont sauvegardées localement et synchronisées dès que la connexion est rétablie.",
      },
    ],
  },
  {
    id: "setup",
    title: "1. Configuration du projet",
    icon: "⚙️",
    content: [
      {
        q: "Comment créer un projet ?",
        a: "Depuis l'écran d'accueil, cliquez sur « Nouveau projet ». Renseignez le nom, la localisation, le client, et les dates clés (début de chantier, début travaux intérieurs, date de livraison).",
      },
      {
        q: "Quelles sont les dates importantes ?",
        a: "• Date début chantier : début global du projet\n• Date début INT : début des travaux intérieurs (utilisée pour le planning cibles logements)\n• Date livraison : date de fin prévisionnelle\n\nCes dates influencent le planning Gantt et les calculs de retard.",
      },
    ],
  },
  {
    id: "batiments",
    title: "2. Bâtiments & Logements",
    icon: "🏗️",
    content: [
      {
        q: "Comment configurer les bâtiments ?",
        a: "Dans l'onglet « Bâtiments », ajoutez chaque bâtiment avec son nom et le nombre de logements. Vous pouvez spécifier les numéros de logements individuellement (ex: 101, 102, 201…) ou laisser l'application les générer automatiquement.",
      },
      {
        q: "Que sont les exceptions de logements ?",
        a: "Les exceptions permettent d'exclure certains logements du suivi (ex: logements annulés ou non livrables). Dans Suivi INT, cliquez sur le bouton d'exception dans l'en-tête de colonne d'un logement pour le basculer. Les logements exclus sont barrés et ne sont plus comptés dans les calculs d'avancement.",
      },
    ],
  },
  {
    id: "lots",
    title: "3. Lots & Décompositions",
    icon: "📁",
    content: [
      {
        q: "Comment sont organisés les lots ?",
        a: "Chaque lot (ex: Lot 1&2 — Gros Œuvre) possède un montant marché global, puis est décomposé en sous-lots intérieurs (INT) et extérieurs (EXT). Chaque sous-lot contient des étapes de décomposition (les tâches à cocher dans la grille de suivi).",
      },
      {
        q: "Comment ajouter des décompositions ?",
        a: "Dans l'onglet « Lots », cliquez sur le nombre dans la colonne « Déc. Ext » ou « Déc. Int » pour ouvrir la modale de décomposition. Vous pouvez :\n• Ajouter une nouvelle décomposition (groupe d'étapes)\n• Ajouter des étapes dans une décomposition existante\n• Renommer une étape (cliquez dessus, modifiez, puis cliquez ailleurs)\n• Supprimer une étape ou une décomposition entière",
      },
      {
        q: "Comment fonctionne la pondération ?",
        a: "Chaque ligne de la grille de suivi a une pondération (colonne Pond.) qui détermine son poids dans le calcul d'avancement du lot. Par défaut : 1. Augmentez la pondération pour les tâches plus importantes.",
      },
    ],
  },
  {
    id: "tracking",
    title: "4. Grilles de suivi (INT / EXT)",
    icon: "✅",
    content: [
      {
        q: "Comment fonctionne la grille de suivi ?",
        a: "La grille affiche les décompositions en lignes et les entités (logements ou bâtiments) en colonnes. Cliquez sur une cellule pour changer son statut :\n• — (vide) : pas commencé\n• EC : en cours\n• X : terminé",
      },
      {
        q: "Comment filtrer et rechercher ?",
        a: "Utilisez la barre de filtres en haut :\n• Filtre par statut : Tous, En cours, Terminé, Non commencé\n• Recherche : tapez le nom d'une décomposition\n• Les colonnes sont triables (cliquez sur les en-têtes)\n• Vous pouvez masquer/afficher des colonnes via le bouton engrenage",
      },
      {
        q: "Comment fonctionne le tri ?",
        a: "Cliquez sur l'en-tête d'une colonne pour trier. Un premier clic trie en ordre croissant (▲), un second en ordre décroissant (▼). Les symboles ⇕ indiquent les colonnes triables.",
      },
      {
        q: "Comment redimensionner les colonnes ?",
        a: "Survolez la bordure droite d'un en-tête de colonne — un trait apparaît. Glissez-le pour ajuster la largeur.",
      },
    ],
  },
  {
    id: "recap",
    title: "5. Récapitulatifs & Avancement",
    icon: "📊",
    content: [
      {
        q: "Quel est la différence entre Récap, Récap Av. et Avancement ?",
        a: "• Récap : vue d'ensemble par lot, montre le nombre de tâches faites vs total\n• Récap Av. : récapitulatif de l'avancement pondéré par lot et par bâtiment\n• Avancement : vue détaillée avec barres de progression par lot (INT et EXT séparés)",
      },
      {
        q: "Comment lire les pourcentages ?",
        a: "• Av. (avancement) : pourcentage de cellules « X » sur le total pour cette décomposition\n• Av/Lot : contribution pondérée de cette décomposition au lot global\n• Les couleurs indiquent l'état :\n  🟢 Vert : ≥ 75%\n  🟡 Orange : ≥ 35%\n  🔴 Rouge : < 35%",
      },
    ],
  },
  {
    id: "planning",
    title: "6. Planning & Cibles logements",
    icon: "📅",
    content: [
      {
        q: "Comment fonctionne le Gantt ?",
        a: "L'onglet « Planning » affiche un diagramme de Gantt basé sur les dates de début/fin de chaque lot. Configurez les dates dans l'onglet Configuration pour que le Gantt se remplisse automatiquement.",
      },
      {
        q: "Qu'est-ce que Cibles Logements ?",
        a: "L'onglet « Cibles Log. » permet de définir un objectif cumulé de logements terminés par semaine. L'application compare automatiquement vos cibles avec le nombre réel de logements 100% terminés.\n\nUn logement est considéré terminé quand TOUTES ses décompositions dans TOUS les lots intérieurs ont le statut « X ».",
      },
      {
        q: "Comment définir les cibles ?",
        a: "Cliquez sur une cellule dans la colonne « Nb logements cible (cumul) » pour saisir votre objectif. Utilisez Tab pour passer à la semaine suivante. Le bouton « Ajouter des semaines » étend le tableau de 4 semaines.",
      },
    ],
  },
  {
    id: "photos",
    title: "7. Photos",
    icon: "📷",
    content: [
      {
        q: "Comment ajouter des photos ?",
        a: "Dans l'onglet « Photos », cliquez sur « Ajouter des photos » ou glissez-déposez des images. Vous pouvez associer chaque photo à un bâtiment et ajouter une description.",
      },
    ],
  },
  {
    id: "export",
    title: "8. Export",
    icon: "📥",
    content: [
      {
        q: "Quels formats d'export sont disponibles ?",
        a: "L'onglet « Export » permet de générer un PDF récapitulatif du projet incluant les données d'avancement, les récapitulatifs par lot et les graphiques.",
      },
    ],
  },
  {
    id: "dashboard",
    title: "9. Tableau de bord",
    icon: "📈",
    content: [
      {
        q: "Que montre le tableau de bord ?",
        a: "Le tableau de bord offre une vue synthétique avec :\n• KPIs principaux (avancement global, nb logements, nb bâtiments)\n• Graphiques d'avancement INT vs EXT par bâtiment\n• Barres de progression par lot\n• Indicateurs de retard",
      },
    ],
  },
  {
    id: "shortcuts",
    title: "Raccourcis clavier",
    icon: "⌨️",
    content: [
      {
        q: "Quels raccourcis sont disponibles ?",
        a: "• Touches 1 à 9 : accès direct aux onglets (1 = Configuration, 2 = Bâtiments, etc.)\n• Touche 0 : accès au 10ème onglet\n• Tab : dans les cibles logements, passe à la semaine suivante\n• Entrée : valide la saisie en cours\n• Échap : annule la saisie en cours",
      },
    ],
  },
  {
    id: "tips",
    title: "Conseils & bonnes pratiques",
    icon: "💡",
    content: [
      {
        q: "Workflow recommandé",
        a: "1. Configurez le projet (nom, dates, client)\n2. Ajoutez les bâtiments et logements\n3. Créez les lots avec leurs montants\n4. Configurez les décompositions INT et EXT pour chaque lot\n5. Remplissez la grille de suivi au fur et à mesure\n6. Définissez les cibles hebdomadaires pour le planning\n7. Consultez les récapitulatifs et le tableau de bord",
      },
      {
        q: "Performances",
        a: "• L'application est optimisée pour fonctionner même avec des projets de grande taille (100+ logements, 20+ lots)\n• Les onglets lourds (Dashboard, Récap, Avancement) sont chargés à la demande\n• Utilisez le mode sombre pour réduire la fatigue visuelle sur chantier",
      },
      {
        q: "Précision des calculs",
        a: "Les calculs d'avancement sont effectués côté client. Des écarts mineurs peuvent exister avec des fichiers Excel externes en raison de différences d'arrondi ou de méthode de pondération. Vérifiez toujours les données avant usage officiel.",
      },
    ],
  },
];

export default function HelpTab() {
  const [activeSection, setActiveSection] = useState("overview");
  const [expandedQ, setExpandedQ] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const currentSection = SECTIONS.find((s) => s.id === activeSection);

  // Filter sections/questions by search
  const filteredSections = search.trim()
    ? SECTIONS.map((s) => ({
        ...s,
        content: s.content.filter(
          (item) =>
            item.q.toLowerCase().includes(search.toLowerCase()) ||
            item.a.toLowerCase().includes(search.toLowerCase())
        ),
      })).filter((s) => s.content.length > 0)
    : null;

  return (
    <div className="help-tab" style={{ animation: "slideInUp 0.4s ease both" }}>
      {/* Search bar */}
      <div className="help-search">
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ opacity: 0.4 }}>
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          placeholder="Rechercher dans l'aide..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="help-search-input"
        />
        {search && (
          <button className="help-search-clear" onClick={() => setSearch("")}>
            &times;
          </button>
        )}
      </div>

      {search.trim() ? (
        /* Search results mode */
        <div className="help-search-results">
          {filteredSections && filteredSections.length > 0 ? (
            filteredSections.map((section) => (
              <div key={section.id} className="help-search-group">
                <h3 className="help-search-group-title">
                  <span>{section.icon}</span> {section.title}
                </h3>
                {section.content.map((item, idx) => (
                  <div key={idx} className="help-faq-item help-faq-open">
                    <div className="help-faq-q">{item.q}</div>
                    <div className="help-faq-a">{item.a}</div>
                  </div>
                ))}
              </div>
            ))
          ) : (
            <div className="help-empty">
              Aucun résultat pour « {search} »
            </div>
          )}
        </div>
      ) : (
        /* Normal navigation mode */
        <div className="help-layout">
          {/* Sidebar nav */}
          <nav className="help-nav">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                className={`help-nav-item ${activeSection === s.id ? "active" : ""}`}
                onClick={() => { setActiveSection(s.id); setExpandedQ(null); }}
              >
                <span className="help-nav-icon">{s.icon}</span>
                <span className="help-nav-label">{s.title}</span>
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className="help-content">
            {currentSection && (
              <>
                <h2 className="help-section-title">
                  <span>{currentSection.icon}</span> {currentSection.title}
                </h2>
                <div className="help-faq-list">
                  {currentSection.content.map((item, idx) => {
                    const qKey = `${currentSection.id}-${idx}`;
                    const isOpen = expandedQ === qKey;
                    return (
                      <div
                        key={idx}
                        className={`help-faq-item ${isOpen ? "help-faq-open" : ""}`}
                      >
                        <button
                          className="help-faq-q"
                          onClick={() => setExpandedQ(isOpen ? null : qKey)}
                        >
                          {item.q}
                          <span className="help-faq-chevron">{isOpen ? "−" : "+"}</span>
                        </button>
                        {isOpen && (
                          <div className="help-faq-a">{item.a}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="help-footer">
        <p>
          Suivi Chantier v1.0 — Application de suivi d'avancement de chantier
        </p>
        <p style={{ fontSize: 11, marginTop: 4 }}>
          Données sauvegardées localement. Mode cloud disponible avec Supabase.
        </p>
      </div>
    </div>
  );
}
