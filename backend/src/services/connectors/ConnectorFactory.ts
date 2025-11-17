import { ConnectorType, ConnectorConfig, IConnector } from './IConnector';
import { SnowflakeConnector } from './SnowflakeConnector';
import { AirflowConnector } from './AirflowConnector';
import { TableauConnector } from './TableauConnector';
import { PowerBIConnector } from './PowerBIConnector';

export class ConnectorFactory {
  static create(type: ConnectorType, name: string, config: ConnectorConfig, connectorId?: string, organizationId?: string): IConnector {
    switch (type) {
      case 'snowflake':
        return new SnowflakeConnector(name, config, connectorId, organizationId);
      case 'airflow':
        return new AirflowConnector(name, config);
      case 'tableau':
        return new TableauConnector(name, config);
      case 'power_bi':
        return new PowerBIConnector(name, config);
      default:
        throw new Error(`Unsupported connector type: ${type}`);
    }
  }
}
