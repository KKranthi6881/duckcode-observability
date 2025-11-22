import flowDiagram from '../assets/duckcode-flow.png';

export function DataFlowDiagram() {
  return (
    <div className="relative w-full py-8 px-4 sm:py-12 sm:px-6 lg:py-16 lg:px-8">
      <img 
        src={flowDiagram} 
        alt="DuckCode Data Flow - From data sources (Snowflake, dbt, SQL, Airflow) through DuckCode AI to outputs (Auto Docs, Lineage, Catalog, Team Sync, Cost Savings)"
        className="mx-auto h-auto w-full max-w-7xl object-contain"
      />
    </div>
  );
}

// NOTE: The original animated version with framer-motion and react-xarrows
// has been replaced with a static image for better mobile responsiveness.
// See git history (commit before this change) to restore the animated version if needed.
