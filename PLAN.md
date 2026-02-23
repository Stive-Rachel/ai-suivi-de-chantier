# Plan : Afficher les écarts App vs Récap Excel

## Contexte
Le tableau Récap de l'app a des valeurs qui diffèrent du Récap Excel de référence. On veut :
- Rendre les écarts **visuellement évidents** (couleur, icône)
- Au **survol**, afficher un tooltip avec le détail du calcul et la valeur Excel de référence

## Écarts identifiés

| Donnée | App | Excel | Cause |
|--------|-----|-------|-------|
| Montant Ext total | 1 868 408,04 € | 1 884 948,15 € | Lot 7 manquant dans lotsExt (fix migration) |
| % Ext par décomp | Légèrement décalés | Référence | Base Ext différente |
| Avancement global | 25,01% | 23,36% | Formule de pondération différente |
| Lot 6 avancement | 20,54% | 10,71% | Excel utilise une autre méthode de calcul |

## Approche

### 1. Fichier de données de référence Excel (`src/lib/recapExcelRef.js`)

Stocker les valeurs du Récap Excel comme objet de référence :

```js
export const RECAP_EXCEL = {
  totalExt: 1884948.15,
  totalInt: 3494586.01,
  totalGlobal: 5379534.16,
  avancementGlobal: 23.36,
  lots: {
    "1&2": { avParLot: 31.94, montantExt: 714608.30, pctExt: 37.91 },
    "3": { avParLot: 83.42, montantExt: 308477.54, pctExt: 16.37 },
    "4": { avParLot: 11.32, montantExt: 576751.40, pctExt: 31 },
    "5": { avParLot: 34.23 },
    "6": { avParLot: 10.71 },
    "7": { avParLot: 0, montantExt: 16540.11, pctExt: 0.88 },
    "8": { avParLot: 0, montantExt: 268570.80, pctExt: 14.25 },
    "9": { avParLot: 19.73 },
    "10": { avParLot: 18.92 },
  },
  decomps: {
    "anti-termites": { avDecomp: 100, avParLot: 1.96 },
    "dalles": { avDecomp: 100, avParLot: 8.49 },
    "mur de soutènement": { avDecomp: 12.70, avParLot: 1.20 },
    "ravalement de façade": { avDecomp: 13.42, avParLot: 4.63 },
    "restructuration béton extérieur": { avDecomp: 100, avParLot: 9.08 },
    "peinture intérieure": { avDecomp: 18.02, avParLot: 6.45 },
    "restucturation béton intérieure": { avDecomp: 18.47, avParLot: 0.15 },
    "auvent": { avDecomp: 64.29, avParLot: 29.85 },
    "bâtiment": { avDecomp: 100, avParLot: 53.57 },
    "escalier": { avDecomp: 6.10, avParLot: 1.99 },
    "toiture": { avDecomp: 9.17, avParLot: 3.37 },
    "intérieur": { avDecomp: 19.49, avParLot: 5.95 },
    "menuiseries exterieures": { avDecomp: 34.23, avParLot: 34.23 },
    "menuiseries interieures": { avDecomp: 10.71, avParLot: 10.71 },
    "dévoiement": { avDecomp: 0, avParLot: 0 },
    "parking": { avDecomp: 0, avParLot: 0 },
    "plomberie sanitaires": { avDecomp: 19.73, avParLot: 19.73 },
    "electricite": { avDecomp: 18.92, avParLot: 18.92 },
  }
};
```

### 2. Modification de `RecapTab.jsx`

- Importer `RECAP_EXCEL`
- Pour chaque décomposition et chaque sous-total lot, comparer `avancement` et `avParLotDecomp` avec la valeur Excel
- Si l'écart > 0.5%, ajouter la classe `cell-ecart` et un `data-tooltip` explicatif
- Sur le footer total, comparer `globalAvParMontant` vs `RECAP_EXCEL.avancementGlobal`
- Comparer aussi `totalExtGlobal` vs `RECAP_EXCEL.totalExt`

### 3. Nouveaux styles CSS (`index.css`)

```css
/* ─── Écarts Récap Excel ─── */
.cell-ecart {
  color: #e67e22 !important;
  font-weight: 600;
  position: relative;
}
.cell-ecart::before {
  content: "△ ";
  font-size: 9px;
}
```

Orange pour différencier des erreurs (rouge = retard), avec un triangle △ pour signaler un écart.

### 4. Logique d'affichage

Pour chaque cellule d'avancement :
```
Si |valeurApp - valeurExcel| > 0.5 :
  → Classe "cell-ecart"
  → Tooltip : "App: XX.XX%\nExcel: YY.YY%\nÉcart: +Z.ZZ%\n---\nCalcul app: (doneWeighted / totalPondWeighted) × 100"
```

Pour le montant Ext total :
```
Si totalExtGlobal ≠ RECAP_EXCEL.totalExt :
  → Classe "cell-ecart"
  → Tooltip : "App: 1 868 408,04 €\nExcel: 1 884 948,15 €\nÉcart: -16 540,11 € (lot 7 Serrurerie)"
```

## Fichiers modifiés
1. `src/lib/recapExcelRef.js` — **nouveau** (données de référence)
2. `src/components/tabs/RecapTab.jsx` — logique de comparaison + rendu
3. `src/index.css` — styles `.cell-ecart`
