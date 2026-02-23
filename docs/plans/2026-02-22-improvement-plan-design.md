# Construction Tracker — Plan d'Amelioration (3 Agents)

## Date : 2026-02-22

## Contexte

Application de suivi de chantier existante : React 19 + Vite 7 SPA, Supabase (PostgreSQL + Auth), localStorage fallback. 41 fichiers JSX/JS, 10 onglets, design system terracotta "Atelier Blanc". Production-ready, deployee sur Railway.

### Points forts actuels
- Grille de suivi interactive (TrackingGrid, 1921 lignes)
- Calculs d'avancement ponderes par budget
- Export CSV/JSON + import
- Supabase sync + localStorage fallback
- Design system coherent avec variables CSS

### Lacunes identifiees
- Pas de responsive/mobile (inutilisable sur chantier)
- Pas de planning visuel (timeline/Gantt)
- Pas de tests ni TypeScript
- Pas de PWA/offline
- Pas de gestion photos/documents
- Pas de rapports PDF
- TrackingGrid potentiellement lente sur gros projets (pas de virtualisation)

---

## Architecture : 3 Agents Paralleles

### Agent 1 : Features Metier

**Objectif :** Ajouter les fonctionnalites manquantes pour un usage professionnel complet.

#### 1.1 Planning Gantt (priorite n1)

Nouvel onglet "Planning" avec visualisation timeline SVG custom (coherent avec DonutChart/BarChart existants).

**Donnees source :**
- `project.dateDebutChantier`, `dureeTotale`, `dureeExt`, `dureeInt`
- `project.dateDebutInt`, `project.dateDebutExt`
- `project.semainesExclues`, `semainesTravaillees`
- Avancement par lot depuis `computeDetailedProgress()`

**Composants :**
- `src/components/tabs/GanttTab.jsx` — onglet integre dans ProjectView
- `src/components/ui/GanttChart.jsx` — composant SVG reutilisable
- Barres horizontales par lot, colorees selon avancement (vert > 80%, orange 30-80%, rouge < 30%)
- Ligne "aujourd'hui" verticale
- Zoom semaine/mois
- Tooltip au survol avec details avancement

**Modele de donnees :** Pas de nouvelle table Supabase — calcule a partir des donnees existantes + champs optionnels `dateDebut`/`dateFin` par lot (ajout colonne JSONB dans `lots`).

#### 1.2 Gestion Photos/PV

**Composants :**
- `src/components/tabs/PhotosTab.jsx` — galerie par batiment/lot
- Upload via Supabase Storage (bucket `project-photos`)
- Thumbnail grid avec lightbox
- Metadata : date, lot, batiment, description

**Schema Supabase :**
```sql
CREATE TABLE project_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  lot_numero TEXT,
  batiment_id TEXT,
  file_path TEXT NOT NULL,
  description TEXT,
  taken_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID REFERENCES auth.users(id)
);
```

#### 1.3 Rapports PDF

- Generation cote client avec `jsPDF` + `html2canvas`
- Template : en-tete projet, KPIs, avancement par lot (barre), tableau recap
- Bouton "Generer PDF" dans ExportTab
- `src/lib/pdfExport.js`

#### 1.4 Notifications alertes

- Badge dans le header avec compteur `!` + `NOK`
- Panel slide-over listant les alertes par batiment/lot
- Icone cloche dans le project header

**Fichiers crees :**
- `src/components/tabs/GanttTab.jsx`
- `src/components/ui/GanttChart.jsx`
- `src/components/tabs/PhotosTab.jsx`
- `src/lib/pdfExport.js`
- `src/components/ui/AlertPanel.jsx`
- Migration SQL pour `project_photos`

**Fichiers modifies :**
- `src/components/ProjectView.jsx` (ajout onglets Planning, Photos)
- `src/components/tabs/ExportTab.jsx` (bouton PDF)
- `src/components/Dashboard.jsx` (badges alertes)
- `supabase-schema.sql` (table photos)

**Dependances :** `jspdf`, `html2canvas`

---

### Agent 2 : UX & Responsive Mobile

**Objectif :** Rendre l'app utilisable sur le chantier (tablet/phone) et ameliorer l'experience globale.

#### 2.1 Responsive Mobile

**Breakpoints :**
- `>= 1024px` : desktop (actuel)
- `768-1023px` : tablet (grille scrollable, sidebar collapses)
- `< 768px` : mobile (stack vertical, navigation bottom-bar)

**Modifications CSS dans `index.css` :**
- Tabs : scroll horizontal sur mobile, icones seules sur < 768px
- TrackingGrid : scroll horizontal avec premiere colonne sticky
- Dashboard : cards en colonne sur mobile
- Header : compact sur mobile, hamburger menu
- Modal : fullscreen sur mobile

#### 2.2 PWA

**Fichiers :**
- `public/manifest.json` — nom, icones, theme_color (#C2613A), display standalone
- `src/sw.js` — service worker avec cache-first pour assets, network-first pour API
- Enregistrement dans `main.jsx`

**Capabilities :** Installation ecran d'accueil, chargement offline des assets, splash screen.

#### 2.3 Mode Offline Ameliore

- `src/lib/syncQueue.js` — file d'attente pour les operations Supabase en cas de deconnexion
- Detection online/offline via `navigator.onLine` + event listeners
- Indicateur visuel dans le header (badge "offline" / "sync en cours")
- Replay automatique de la queue au retour en ligne
- Conflits : last-write-wins (suffisant pour usage mono-utilisateur)

#### 2.4 Dark Mode

Variables CSS alternatives dans `index.css` :
```css
@media (prefers-color-scheme: dark) {
  :root { /* dark overrides */ }
}
```
+ Toggle manuel dans le header avec persistence localStorage.

#### 2.5 Quick-Entry Mobile

- Interface simplifiee pour pointer les statuts sur le terrain
- Selection batiment -> lot -> decomposition -> swipe pour statut (X, !, NOK)
- `src/components/QuickEntry.jsx`
- Accessible depuis un FAB (floating action button) sur mobile

#### 2.6 Navigation

- Breadcrumbs dans le project header
- Raccourcis clavier (1-9 pour changer d'onglet, Esc pour retour)
- Transitions CSS entre onglets (fade-in)

**Fichiers crees :**
- `public/manifest.json`
- `src/sw.js`
- `src/lib/syncQueue.js`
- `src/components/QuickEntry.jsx`

**Fichiers modifies :**
- `src/index.css` (media queries, dark mode, animations)
- `src/App.css` (responsive overrides)
- `src/main.jsx` (SW registration)
- `src/App.jsx` (online/offline state)
- `src/components/ProjectView.jsx` (breadcrumbs, raccourcis)
- `src/components/ui/Tabs.jsx` (responsive)
- `src/components/ui/Modal.jsx` (fullscreen mobile)
- `src/components/Dashboard.jsx` (responsive cards)

**Dependances :** aucune

---

### Agent 3 : Qualite & Performance

**Objectif :** Poser les fondations pour la maintenabilite et la scalabilite.

#### 3.1 Migration TypeScript

- Renommer tous les `.jsx` -> `.tsx` et `.js` -> `.ts`
- Ajouter `tsconfig.json` avec `strict: true`
- Interfaces principales :

```typescript
interface Project {
  id: string;
  name: string;
  location: string;
  client: string;
  // ... tous les champs
  batiments: Batiment[];
  lots: Lot[];
  lotsInt: LotDecomp[];
  lotsExt: LotDecomp[];
  tracking: TrackingData;
}

interface Batiment { id: string; name: string; nbLogements: number; logements?: number[]; }
interface Lot { numero: string; nom: string; montantMarche: number; }
interface LotDecomp { numero: string; nom: string; nomDecomp?: string; trackPrefix?: string; montant: number; decompositions: string[]; }
interface TrackingData { logements: TrackingMap; batiments: TrackingMap; }
type TrackingMap = Record<string, Record<string, { status: string }>>;
```

#### 3.2 Tests

- **Framework :** Vitest + React Testing Library + jsdom
- **Tests unitaires :**
  - `src/lib/__tests__/computations.test.ts` — calculs d'avancement
  - `src/lib/__tests__/format.test.ts` — formatage montants
  - `src/lib/__tests__/migration.test.ts` — migrations data
- **Tests composants :**
  - `src/components/__tests__/TrackingGrid.test.tsx` — rendu grille, click cellule
  - `src/components/__tests__/Dashboard.test.tsx` — creation projet
- **Coverage cible :** 70%+ sur `src/lib/`

#### 3.3 Optimisation Performances

- **Virtualisation TrackingGrid** — `@tanstack/react-virtual` pour ne rendre que les lignes visibles
- **React.memo** sur StatusCell, ProgressBar, ProgressCard
- **useMemo/useCallback** audit sur tous les composants
- **Code splitting** — deja en place avec `lazy()`, verifier que les chunks sont raisonnables
- **Bundle analysis** — `rollup-plugin-visualizer` pour identifier les gros modules

#### 3.4 CI/CD

`.github/workflows/ci.yml` :
```yaml
on: [push, pull_request]
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npm run build
```

#### 3.5 Refactoring Architecture

- Extraire le state management dans un Context dedie (`ProjectContext`)
- Centraliser les operations Supabase (actuellement reparties entre `dataLayer.js`, `supabaseOps.js`, `db.js`)
- Hook `useProject(id)` qui encapsule load + update + sync

#### 3.6 Accessibilite

- ARIA labels sur tous les boutons icone-only
- `role="grid"` + `role="gridcell"` sur TrackingGrid
- Focus management dans Modal
- Contraste couleurs verifie (WCAG AA)

**Fichiers crees :**
- `tsconfig.json`
- `src/types/index.ts`
- `src/__tests__/` (5+ fichiers test)
- `.github/workflows/ci.yml`

**Fichiers modifies :** tous (rename + types)

**Dependances :** `typescript`, `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `@tanstack/react-virtual`, `rollup-plugin-visualizer`

---

## Strategie d'Execution

### Worktrees Git Isoles

Chaque agent travaille dans un worktree git separe :
- `agent-1-features` (branche `feature/metier-improvements`)
- `agent-2-ux` (branche `feature/ux-responsive`)
- `agent-3-quality` (branche `feature/quality-typescript`)

### Ordre de Merge

1. **Agent 3 (Qualite)** merge en premier — TypeScript + tests posent les fondations
2. **Agent 1 (Features)** merge ensuite — nouvelles features
3. **Agent 2 (UX)** merge en dernier — CSS/responsive s'adapte au code final

### Risques et Mitigations

| Risque | Mitigation |
|--------|-----------|
| Conflits de merge entre agents | Worktrees isoles, merge sequentiel, zones de code distinctes |
| Agent 3 (TS) touche tous les fichiers | Merge en premier, autres agents rebase dessus |
| PWA complexe | Version minimale (manifest + cache assets), iteration ulterieure |
| jsPDF bundle size | Import dynamique, lazy-load |
| Virtualisation casse le layout | Tests manuels apres integration |

---

## Criteres de Succes

- [ ] Gantt visible et interactif avec donnees du projet BERGEVIN
- [ ] App utilisable sur tablet (1024px) et mobile (375px)
- [ ] PWA installable avec mode offline basique
- [ ] Dark mode fonctionnel
- [ ] 100% TypeScript strict sans `any`
- [ ] Coverage tests > 70% sur `src/lib/`
- [ ] CI passe (lint + tests + build)
- [ ] Bundle size < 500KB gzipped
- [ ] Lighthouse Performance > 90
