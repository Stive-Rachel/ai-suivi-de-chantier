export default function FilterBar({ filters, onFilterChange, showEntityFilter = false }) {
  const hasFilters = filters.statusFilter !== "all" || filters.searchText || filters.entitySearch;

  return (
    <div className="filter-bar">
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

      {showEntityFilter && (
        <input
          className="filter-search"
          type="text"
          placeholder="N° logement…"
          value={filters.entitySearch || ""}
          onChange={(e) => onFilterChange({ ...filters, entitySearch: e.target.value })}
          style={{ maxWidth: 120 }}
        />
      )}

      {hasFilters && (
        <button
          className="btn btn-ghost btn-sm filter-clear"
          onClick={() => onFilterChange({ statusFilter: "all", searchText: "", entitySearch: "" })}
        >
          ✕ Effacer
        </button>
      )}
    </div>
  );
}
