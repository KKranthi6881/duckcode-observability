import { ConnectorType, ConnectorConfig, IConnector } from './IConnector';
import { SnowflakeConnector } from './SnowflakeConnector';

export class ConnectorFactory {
  static create(type: ConnectorType, name: string, config: ConnectorConfig, connectorId?: string, organizationId?: string): IConnector {
    switch (type) {
      case 'snowflake':
        return new SnowflakeConnector(name, config, connectorId, organizationId);
      default:
        throw new Error(`Unsupported connector type: ${type}`);
    }
  }
}
