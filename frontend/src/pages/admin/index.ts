/**
 * Admin Portal Pages
 * Centralized exports for all admin pages
 */

export { AdminLayout } from './AdminLayout';
export { Dashboard } from './Dashboard';
export { Analytics } from './Analytics';
export { ApiKeys } from './ApiKeys';
export { Members } from './Members';
export { SettingsPage } from './Settings';
export { MetadataExtraction } from './MetadataExtraction';
export { SearchPage } from './Search';
export { AIDocumentation } from './AIDocumentation';
export { default as ConnectorsHub } from './ConnectorsHub';

// Export types for convenience
export type { Organization, Team, TeamType } from '../../types/enterprise';
