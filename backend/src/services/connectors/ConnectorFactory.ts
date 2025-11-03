import { ConnectorType, ConnectorConfig, IConnector } from './IConnector';
import { SnowflakeConnector } from './SnowflakeConnector';

export class ConnectorFactory {
  static create(type: ConnectorType, name: string, config: ConnectorConfig): IConnector {
    switch (type) {
      case 'snowflake':
        return new SnowflakeConnector(name, config);
      default:
        throw new Error(`Unsupported connector type: ${type}`);
    }
  }
}
