import { useState, type ComponentType } from 'react';
import { Database, ServerCog } from 'lucide-react';
import ConnectorsPage from '../dashboard/ConnectorsPage';

const AirflowIcon = ({ className }: { className?: string }) => (
  <img
    src="/connectors/service-icon-airflow.png"
    alt="Apache Airflow logo"
    className={`h-5 w-5 object-contain ${className ?? ''}`}
  />
);

const TableauIcon = ({ className }: { className?: string }) => (
  <img
    src="/connectors/service-icon-tableau.png"
    alt="Tableau logo"
    className={`h-5 w-5 object-contain ${className ?? ''}`}
  />
);

const PowerBIIcon = ({ className }: { className?: string }) => (
  <img
    src="/connectors/service-icon-power-bi.png"
    alt="Power BI logo"
    className={`h-5 w-5 object-contain ${className ?? ''}`}
  />
);

interface ConnectorDef {
  key: string;
  name: string;
  description: string;
  category: string;
  icon: ComponentType<{ className?: string }>;
}

const ALL_CONNECTORS: ConnectorDef[] = [
  {
    key: 'snowflake',
    name: 'Snowflake',
    description: 'Create, test, and run extractions for Snowflake',
    category: 'Data warehouse',
    icon: Database,
  },
  {
    key: 'airflow',
    name: 'Apache Airflow',
    description: 'Orchestrate and monitor data pipelines with Airflow.',
    category: 'Orchestration',
    icon: AirflowIcon,
  },
  {
    key: 'tableau',
    name: 'Tableau',
    description: 'Visualize and explore analytics dashboards in Tableau.',
    category: 'Business intelligence',
    icon: TableauIcon,
  },
  {
    key: 'power-bi',
    name: 'Power BI',
    description: 'Deliver self-service BI and reports with Power BI.',
    category: 'Business intelligence',
    icon: PowerBIIcon,
  },
];

const VISIBLE_CONNECTORS: ConnectorDef[] = ALL_CONNECTORS.filter((c) => c.key === 'snowflake');

export default function ConnectorsAdmin() {
  const [selected, setSelected] = useState<ConnectorDef | null>(null);

  if (selected) {
    const SelectedIcon = selected.icon;
    const isSnowflake = selected.key === 'snowflake';
    return (
      <div className="p-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <SelectedIcon className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h1 className="text-lg font-semibold tracking-tight text-foreground">{selected.name}</h1>
                <p className="text-sm text-muted-foreground">{selected.description}</p>
              </div>
            </div>
            <button
              className="inline-flex items-center rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              onClick={() => setSelected(null)}
            >
              Back to connectors
            </button>
          </div>

          {isSnowflake ? (
            <ConnectorsPage />
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-card/40 p-6 text-sm text-muted-foreground">
              <p className="mb-1 font-medium text-foreground">{selected.name} connector</p>
              <p>
                Configuration for this connector is coming soon. For now, you can manage Snowflake connectors from this
                admin area.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Connectors</h1>
            <p className="text-sm text-muted-foreground">
              Connect DuckCode to your data platforms. Configure and manage extraction for each connector.
            </p>
          </div>
          <div className="hidden text-xs text-muted-foreground md:block">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1">
              <ServerCog className="h-3.5 w-3.5" />
              <span className="font-medium uppercase tracking-wide">Admin</span>
              <span className="h-1 w-1 rounded-full bg-border" />
              <span>{VISIBLE_CONNECTORS.length} connector{VISIBLE_CONNECTORS.length === 1 ? '' : 's'}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {VISIBLE_CONNECTORS.map((c) => {
            const Icon = c.icon;
            return (
              <button
                key={c.key}
                onClick={() => setSelected(c)}
                className="group flex h-full flex-col justify-between rounded-xl border border-border bg-card px-4 py-4 text-left transition-colors hover:border-primary/60 hover:bg-accent/5"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium text-foreground">{c.name}</div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{c.description}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="truncate">{c.category} connector</span>
                  <span className="font-medium text-primary group-hover:underline">Configure</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
