import { useMemo } from "react";
import { computeProjectProgress, computeDetailedProgress } from "../../lib/computations";
import { getLogementNums } from "../../lib/db";
import DonutChart, { MultiDonut } from "../ui/DonutChart";
import { HorizontalBarChart, VerticalBarChart } from "../ui/BarChart";
import Icon from "../ui/Icon";

export default function DashboardTab({ project }) {
  const { lotProgressInt, lotProgressExt, batimentProgress } = useMemo(
    () => computeDetailedProgress(project),
    [project]
  );

  const avgProgress = computeProjectProgress(project);

  const nbBat = project.batiments.length;
  const nbLog = project.batiments.reduce((s, b) => s + getLogementNums(b).length, 0);

  // Status distribution
  const statusStats = useMemo(() => {
    let done = 0, alerts = 0, noks = 0, empty = 0;
    for (const trackType of ["logements", "batiments"]) {
      const t = project.tracking?.[trackType] || {};
      for (const rowKey of Object.keys(t)) {
        if (rowKey.startsWith("_")) continue;
        for (const [entityId, cell] of Object.entries(t[rowKey])) {
          if (entityId.startsWith("_")) continue;
          const s = cell?.status;
          if (s === "X") done++;
          else if (s === "!") alerts++;
          else if (s === "NOK") noks++;
          else empty++;
        }
      }
    }
    return { done, alerts, noks, empty, total: done + alerts + noks + empty };
  }, [project.tracking]);

  // INT/EXT averages
  const avgInt = lotProgressInt.length > 0
    ? lotProgressInt.reduce((s, lp) => s + lp.progress, 0) / lotProgressInt.length
    : 0;
  const avgExt = lotProgressExt.length > 0
    ? lotProgressExt.reduce((s, lp) => s + lp.progress, 0) / lotProgressExt.length
    : 0;

  // INT lots bar data
  const intBars = lotProgressInt.map((lp) => ({
    label: lp.shortLot || lp.lot,
    value: lp.progress,
    color: lp.progress >= 75 ? "var(--success)" : lp.progress >= 40 ? "var(--warning)" : "var(--danger)",
  }));

  // EXT lots bar data
  const extBars = lotProgressExt.map((lp) => ({
    label: lp.shortLot || lp.lot,
    value: lp.progress,
    color: lp.progress >= 75 ? "var(--success)" : lp.progress >= 40 ? "var(--warning)" : "var(--danger)",
  }));

  // Building bars data
  const buildingBars = batimentProgress.map((bp) => ({
    label: bp.name.replace("Bâtiment ", "Bât "),
    values: [
      { value: bp.int, color: "var(--accent)", label: "INT" },
      { value: bp.ext, color: "var(--info)", label: "EXT" },
    ],
  }));

  const donutColor = avgProgress >= 75 ? "var(--success)" : avgProgress >= 40 ? "var(--warning)" : "var(--danger)";

  return (
    <div className="dashboard-tab">
      {/* KPI summary row */}
      <div className="dtab-kpi-row">
        <div className="dtab-kpi">
          <Icon name="chart" size={16} />
          <div>
            <span className="dtab-kpi-value">{avgProgress.toFixed(1)}%</span>
            <span className="dtab-kpi-label">Global</span>
          </div>
        </div>
        <div className="dtab-kpi">
          <Icon name="home" size={16} />
          <div>
            <span className="dtab-kpi-value">{avgInt.toFixed(1)}%</span>
            <span className="dtab-kpi-label">Intérieur</span>
          </div>
        </div>
        <div className="dtab-kpi">
          <Icon name="building" size={16} />
          <div>
            <span className="dtab-kpi-value">{avgExt.toFixed(1)}%</span>
            <span className="dtab-kpi-label">Extérieur</span>
          </div>
        </div>
        <div className="dtab-kpi">
          <Icon name="building" size={16} />
          <div>
            <span className="dtab-kpi-value">{nbBat}</span>
            <span className="dtab-kpi-label">{nbBat > 1 ? "Bâtiments" : "Bâtiment"}</span>
          </div>
        </div>
        <div className="dtab-kpi">
          <Icon name="home" size={16} />
          <div>
            <span className="dtab-kpi-value">{nbLog}</span>
            <span className="dtab-kpi-label">{nbLog > 1 ? "Logements" : "Logement"}</span>
          </div>
        </div>
      </div>

      {/* Donuts row */}
      <div className="charts-row charts-row-donuts">
        <div className="chart-card">
          <h4 className="chart-card-title">Avancement global</h4>
          <div className="chart-card-body chart-center">
            <DonutChart
              value={avgProgress}
              size={150}
              strokeWidth={14}
              color={donutColor}
              label="Avancement"
            />
          </div>
        </div>

        <div className="chart-card">
          <h4 className="chart-card-title">Répartition des statuts</h4>
          <div className="chart-card-body chart-center">
            <MultiDonut
              size={150}
              strokeWidth={14}
              segments={[
                { value: statusStats.done, color: "var(--success)", label: "Fait" },
                { value: statusStats.alerts, color: "var(--warning)", label: "Alerte" },
                { value: statusStats.noks, color: "var(--danger)", label: "NOK" },
                { value: statusStats.empty, color: "var(--border-default)", label: "Vide" },
              ].filter((s) => s.value > 0)}
            >
              <span className="donut-chart-value">{statusStats.total}</span>
              <span className="donut-chart-label">cellules</span>
            </MultiDonut>
            <div className="chart-legend">
              {statusStats.done > 0 && (
                <span className="chart-legend-item">
                  <span className="chart-legend-dot" style={{ background: "var(--success)" }} />
                  {statusStats.done} fait
                </span>
              )}
              {statusStats.alerts > 0 && (
                <span className="chart-legend-item">
                  <span className="chart-legend-dot" style={{ background: "var(--warning)" }} />
                  {statusStats.alerts} alertes
                </span>
              )}
              {statusStats.noks > 0 && (
                <span className="chart-legend-item">
                  <span className="chart-legend-dot" style={{ background: "var(--danger)" }} />
                  {statusStats.noks} NOK
                </span>
              )}
              {statusStats.empty > 0 && (
                <span className="chart-legend-item">
                  <span className="chart-legend-dot" style={{ background: "var(--border-default)" }} />
                  {statusStats.empty} vide
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Horizontal bars — lots INT */}
      {intBars.length > 0 && (
        <div className="chart-card">
          <h4 className="chart-card-title">Avancement par lot — Intérieur</h4>
          <div className="chart-card-body">
            <HorizontalBarChart data={intBars} height={18} />
          </div>
        </div>
      )}

      {/* Horizontal bars — lots EXT */}
      {extBars.length > 0 && (
        <div className="chart-card">
          <h4 className="chart-card-title">Avancement par lot — Extérieur</h4>
          <div className="chart-card-body">
            <HorizontalBarChart data={extBars} height={18} />
          </div>
        </div>
      )}

      {/* Vertical bars — buildings */}
      {buildingBars.length > 0 && (
        <div className="chart-card">
          <h4 className="chart-card-title">Avancement par bâtiment (INT / EXT)</h4>
          <div className="chart-card-body">
            <VerticalBarChart data={buildingBars} barHeight={160} />
          </div>
        </div>
      )}
    </div>
  );
}
