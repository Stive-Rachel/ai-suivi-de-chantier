export default function FilterBar({ lots, filters, onFilterChange }) {
  const hasFilters = filters.lotNumero || filters.statusFilter !== "all" || filters.searchText;

  return (
    <div className="filter-bar">
      <select
        className="filter-select"
        value={filters.lotNumero}
        onChange={(e) => onFilterChange({ ...filters, lotNumero: e.target.value })}
      >
        <option value="">Tous les lots</option>
        {lots.map((l) => (
          <option key={l.numero} value={l.numero}>
            Lot {l.numero} — {l.nom}
          </option>
        ))}
      </select>

      <select
        className="filter-select"
        value={filters.statusFilter}
        onChange={(e) => onFilterChange({ ...filters, statusFilter: e.target.value })}
      >
        <option value="all">Tous statuts</option>
        <option value="incomplete">Incomplets</option>
        <option value="complete">Complets</option>
        <option value="alert">Alertes (!)</option>
        <option value="nok">NOK</option>
      </select>

      <input
        className="filter-search"
        type="text"
        placeholder="Rechercher une tâche…"
        value={filters.searchText}
        onChange={(e) => onFilterChange({ ...filters, searchText: e.target.value })}
      />

      {hasFilters && (
        <button
          className="btn btn-ghost btn-sm filter-clear"
          onClick={() => onFilterChange({ lotNumero: "", statusFilter: "all", searchText: "" })}
        >
          ✕ Effacer
        </button>
      )}
    </div>
  );
}
