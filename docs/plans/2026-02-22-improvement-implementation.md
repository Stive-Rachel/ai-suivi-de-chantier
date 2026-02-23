# Construction Tracker — Plan d'Implementation

## Ref design : `2026-02-22-improvement-plan-design.md`

---

## Agent 1 : Features Metier

### Tache 1.1 : Planning Gantt (priorite haute)
1. Creer `src/components/ui/GanttChart.jsx` — composant SVG generique
   - Props : `tasks[]` (label, start, end, progress, color), `todayLine`, `zoom`
   - Rendu : barres horizontales, axe temps (semaines), ligne aujourd'hui
   - Zoom : semaine / mois via boutons
   - Tooltip au survol
2. Creer `src/components/tabs/GanttTab.jsx`
   - Importer `computeDetailedProgress()` pour les donnees d'avancement
   - Mapper lots -> taches Gantt avec dates calculees depuis `dateDebutChantier` + `dureeTotale`
   - Ajouter dans les tabs de `ProjectView.jsx` (position 9, avant "Tableau de bord")
3. Ajouter champs optionnels `dateDebut`/`dateFin` par lot dans SetupTab ou LotsTab
4. Tester avec donnees BERGEVIN

### Tache 1.2 : Gestion Photos
1. Ajouter migration SQL `project_photos` dans `supabase-schema.sql`
2. Creer `src/components/tabs/PhotosTab.jsx`
   - Upload drag & drop
   - Grid thumbnails par batiment
   - Lightbox au clic
   - Filtres par lot/batiment
3. Ajouter helpers Supabase Storage dans `dataLayer.js`
4. Ajouter onglet "Photos" dans `ProjectView.jsx`

### Tache 1.3 : Export PDF
1. Installer `jspdf` et `html2canvas`
2. Creer `src/lib/pdfExport.js`
   - Template : header projet, KPIs, avancement par lot (barres), recap tableau
   - Fonction `generateProjectPDF(project)`
3. Ajouter bouton dans `ExportTab.jsx`

### Tache 1.4 : Panel Alertes
1. Creer `src/components/ui/AlertPanel.jsx` — slide-over avec liste des `!` et `NOK`
2. Ajouter icone cloche + badge dans le header de `ProjectView.jsx`
3. Clic ouvre le panel avec lien vers la cellule concernee

---

## Agent 2 : UX & Responsive Mobile

### Tache 2.1 : Responsive CSS
1. Ajouter media queries dans `index.css`
   - `@media (max-width: 1023px)` : tablet
   - `@media (max-width: 767px)` : mobile
2. Tabs : scroll horizontal, icones seules sur mobile
3. TrackingGrid : scroll-x avec colonne sticky
4. Dashboard : cards stack vertical
5. Header : compact + hamburger sur mobile
6. Modal : fullscreen sur mobile

### Tache 2.2 : PWA Setup
1. Creer `public/manifest.json` avec icones, theme_color, display standalone
2. Creer `src/sw.js` — cache-first assets, network-first API
3. Enregistrer SW dans `main.jsx`
4. Ajouter meta tags dans `index.html`
5. Tester installation sur Android/iOS

### Tache 2.3 : Mode Offline
1. Creer `src/lib/syncQueue.js`
   - Queue persistee en localStorage
   - Enqueue les operations Supabase quand offline
   - Replay auto au retour en ligne
   - Indicateur etat dans le header
2. Modifier `dataLayer.js` pour intercepter les appels en mode offline
3. Ajouter detection `navigator.onLine` dans `App.jsx`

### Tache 2.4 : Dark Mode
1. Ajouter palette dark dans `:root` overrides
   - `@media (prefers-color-scheme: dark)` par defaut
   - Toggle manuel avec classe `.dark` sur `<html>`
2. Bouton toggle dans le header (icone soleil/lune)
3. Persistence du choix en localStorage
4. Verifier toutes les surfaces : cards, grille, charts, modals

### Tache 2.5 : Quick-Entry Mobile
1. Creer `src/components/QuickEntry.jsx`
   - Selection : batiment -> lot -> decomposition
   - Interface swipe/tap pour statut (X, !, NOK, vide)
   - FAB en bas a droite visible uniquement sur mobile
2. Integrer dans `ProjectView.jsx`

### Tache 2.6 : Navigation
1. Breadcrumbs dans le project header
2. Raccourcis clavier : 1-9 onglets, Esc retour
3. Transitions fade entre onglets

---

## Agent 3 : Qualite & Performance

### Tache 3.1 : Setup TypeScript
1. Installer `typescript` et `@types/react`, `@types/react-dom`
2. Creer `tsconfig.json` strict
3. Mettre a jour `vite.config.js` si necessaire
4. Creer `src/types/index.ts` avec interfaces Project, Batiment, Lot, etc.
5. Renommer progressivement `.jsx` -> `.tsx`, `.js` -> `.ts`
   - Ordre : types -> lib/ -> ui/ -> tabs/ -> composants racine
6. Eliminer tous les `any` implicites

### Tache 3.2 : Tests
1. Installer `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`
2. Configurer vitest dans `vite.config.ts`
3. Ecrire tests :
   - `src/lib/__tests__/computations.test.ts`
   - `src/lib/__tests__/format.test.ts`
   - `src/lib/__tests__/migration.test.ts`
   - `src/components/__tests__/Dashboard.test.tsx`
   - `src/components/__tests__/TrackingGrid.test.tsx`
4. Ajouter script `"test"` dans package.json
5. Viser 70%+ coverage sur `src/lib/`

### Tache 3.3 : Performance
1. Installer `@tanstack/react-virtual`
2. Virtualiser TrackingGrid (lignes uniquement, colonnes en scroll natif)
3. Ajouter `React.memo` sur StatusCell, ProgressBar, ProgressCard, Icon
4. Audit `useMemo`/`useCallback` sur tous les composants
5. Ajouter `rollup-plugin-visualizer` pour analyser le bundle

### Tache 3.4 : CI/CD
1. Creer `.github/workflows/ci.yml` (lint + test + build)
2. Badge status dans README

### Tache 3.5 : Refactoring
1. Creer `src/contexts/ProjectContext.tsx` — state management centralise
2. Hook `useProject(id)` encapsulant load + update + sync
3. Fusionner `db.js` + `dataLayer.js` + `supabaseOps.js` en couche claire
4. Nettoyer les imports circulaires eventuels

### Tache 3.6 : Accessibilite
1. ARIA labels sur boutons icone-only
2. `role="grid"` sur TrackingGrid
3. Focus trap dans Modal
4. Contraste WCAG AA verifie

---

## Ordre de Merge

1. Agent 3 merge -> `main`
2. Agent 1 rebase sur `main`, merge
3. Agent 2 rebase sur `main`, merge

## Verification

Apres chaque merge :
- `npm run lint` passe
- `npm run test` passe
- `npm run build` passe
- Test manuel sur mobile (Chrome DevTools responsive)
