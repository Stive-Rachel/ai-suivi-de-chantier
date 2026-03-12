import { useMemo } from "react";
import { computeProjectProgress, computeDetailedProgress, getLogementCounts } from "../../lib/computations";
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
  const logCounts = getLogementCounts(project);
  const nbLog = logCounts.total;
  const nbLogActive = logCounts.active;
  const nbLogExc = logCounts.exceptions;

  const exceptions = project.exceptions || {};

  // INT/EXT weighted averages
  const totalMontantInt = lotProgressInt.reduce((s, lp) => s + lp.montant, 0);
  const avgInt = totalMontantInt > 0
    ? lotProgressInt.reduce((s, lp) => s + (lp.montant / totalMontantInt) * lp.progress, 0)
    : 0;
  const totalMontantExt = lotProgressExt.reduce((s, lp) => s + lp.montant, 0);
  const avgExt = totalMontantExt > 0
    ? lotProgressExt.reduce((s, lp) => s + (lp.montant / totalMontantExt) * lp.progress, 0)
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

  // Count logements fully done (all INT tasks completed for that logement)
  const logementsDone = useMemo(() => {
    const intLots = project.lotsInt || [];
    const trackingLog = project.tracking?.logements || {};
    if (intLots.length === 0) return 0;

    // Build list of all task keys
    const taskKeys = [];
    for (const lot of intLots) {
      for (const decomp of lot.decompositions) {
        taskKeys.push(`${lot.trackPrefix || lot.numero}-${decomp}`);
      }
    }
    if (taskKeys.length === 0) return 0;

    let done = 0;
    for (const bat of project.batiments) {
      for (const num of getLogementNums(bat)) {
        const eId = `${bat.id}_log_${num}`;
        if (exceptions[eId]) continue;
        const allDone = taskKeys.every((key) => {
          const status = trackingLog[key]?.[eId]?.status;
          return status === "X" || status === "N/A";
        });
        if (allDone) done++;
      }
    }
    return done;
  }, [project, exceptions]);

  const donutColor = avgProgress >= 75 ? "var(--success)" : avgProgress >= 40 ? "var(--warning)" : "var(--danger)";

  return (
    <div className="dashboard-tab">
      {/* KPI summary row */}
      <div className="dtab-kpi-row">
        <div className="dtab-kpi">
          <Icon name="chart" size={16} />
          <div>
            <span className="dtab-kpi-value">{avgProgress.toFixed(2)}%</span>
            <span className="dtab-kpi-label">Global</span>
          </div>
        </div>
        <div className="dtab-kpi">
          <Icon name="home" size={16} />
          <div>
            <span className="dtab-kpi-value">{avgInt.toFixed(2)}%</span>
            <span className="dtab-kpi-label">Intérieur</span>
          </div>
        </div>
        <div className="dtab-kpi">
          <Icon name="building" size={16} />
          <div>
            <span className="dtab-kpi-value">{avgExt.toFixed(2)}%</span>
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
            <span className="dtab-kpi-value">
              {nbLogExc > 0 ? `${nbLogActive}/${nbLog}` : nbLog}
            </span>
            <span className="dtab-kpi-label">
              {nbLog > 1 ? "Logements" : "Logement"}
              {nbLogExc > 0 && ` (${nbLogExc} exc.)`}
            </span>
          </div>
        </div>
        <div className="dtab-kpi">
          <Icon name="check" size={16} />
          <div>
            <span className="dtab-kpi-value" style={{ color: "var(--success)" }}>{logementsDone}</span>
            <span className="dtab-kpi-label">Terminés</span>
          </div>
        </div>
        <div className="dtab-kpi">
          <Icon name="alert" size={16} />
          <div>
            <span className="dtab-kpi-value" style={{ color: "var(--danger)" }}>{nbLogActive - logementsDone}</span>
            <span className="dtab-kpi-label">Non terminés</span>
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
          <h4 className="chart-card-title">Logements terminés</h4>
          <div className="chart-card-body chart-center">
            <MultiDonut
              size={150}
              strokeWidth={14}
              segments={[
                { value: logementsDone, color: "var(--success)", label: "Terminés" },
                { value: nbLogActive - logementsDone, color: "var(--border-default)", label: "Non terminés" },
              ].filter((s) => s.value > 0)}
            >
              <span className="donut-chart-value">
                {nbLogActive > 0 ? ((logementsDone / nbLogActive) * 100).toFixed(1) : 0}%
              </span>
              <span className="donut-chart-label">terminés</span>
            </MultiDonut>
            <div className="chart-legend">
              <span className="chart-legend-item">
                <span className="chart-legend-dot" style={{ background: "var(--success)" }} />
                {logementsDone} terminés
              </span>
              <span className="chart-legend-item">
                <span className="chart-legend-dot" style={{ background: "var(--border-default)" }} />
                {nbLogActive - logementsDone} non terminés
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Horizontal bars — lots INT & EXT side by side */}
      {(intBars.length > 0 || extBars.length > 0) && (
        <div className="charts-row charts-row-bars">
          {intBars.length > 0 && (
            <div className="chart-card">
              <h4 className="chart-card-title">Avancement par lot — Intérieur</h4>
              <div className="chart-card-body">
                <HorizontalBarChart data={intBars} height={18} />
              </div>
            </div>
          )}
          {extBars.length > 0 && (
            <div className="chart-card">
              <h4 className="chart-card-title">Avancement par lot — Extérieur</h4>
              <div className="chart-card-body">
                <HorizontalBarChart data={extBars} height={18} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Vertical bars — buildings — full width */}
      {buildingBars.length > 0 && (
        <div className="chart-card">
          <h4 className="chart-card-title">Avancement par bâtiment (INT / EXT)</h4>
          <div className="chart-card-body">
            <VerticalBarChart data={buildingBars} barHeight={200} />
          </div>
        </div>
      )}
    </div>
  );
}
