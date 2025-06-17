import React, { useState } from 'react';
import { DashboardLayout } from './DashboardLayout';
import { LineageGraph } from './components/charts/LineageGraph';
import { Table, Database, Clock, Users, BarChart2, FileText, Network, Info } from 'lucide-react';
// Sample table metadata
const tableData = {
  id: 'raw_customer',
  name: 'raw_customer',
  type: 'source',
  description: 'Raw customer data from CRM system',
  schema: 'public',
  database: 'raw',
  owner: 'data_ingest',
  lastUpdated: '2023-07-15',
  rowCount: 125487,
  columns: [{
    name: 'customer_id',
    type: 'INTEGER',
    isPrimaryKey: true,
    description: 'Unique identifier for customers',
    nullPercentage: 0,
    distinctCount: 125487,
    samples: ['1001', '1002', '1003']
  }
  // ... more columns
  ],
  sampleData: [{
    customer_id: '1001',
    first_name: 'John',
    last_name: 'Doe',
    email: 'john.doe@example.com',
    created_at: '2023-01-15T10:30:00Z'
  }
  // ... more sample rows
  ]
};
export function TableDetails() {
  const [activeTab, setActiveTab] = useState('overview');
  return <DashboardLayout>
      <div className="space-y-6">
        {/* Table Header */}
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center space-x-3">
              <Table className="h-6 w-6 text-[#2AB7A9]" />
              <h1 className="text-2xl font-bold text-white">
                {tableData.name}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-700 text-slate-300">
                {tableData.schema}
              </span>
            </div>
            <p className="mt-2 text-slate-400">{tableData.description}</p>
          </div>
          <div className="flex space-x-3">
            <button className="px-3 py-2 bg-slate-700 rounded-md text-sm text-slate-300 hover:bg-slate-600">
              <FileText className="h-4 w-4" />
            </button>
            <button className="px-3 py-2 bg-[#2AB7A9] rounded-md text-sm text-white hover:bg-[#2AB7A9]/90">
              Query Table
            </button>
          </div>
        </div>
        {/* Table Metadata Cards */}
        <div className="grid grid-cols-4 gap-6">
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Database</p>
                <p className="text-lg font-medium text-white mt-1">
                  {tableData.database}
                </p>
              </div>
              <Database className="h-5 w-5 text-slate-600" />
            </div>
          </div>
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Row Count</p>
                <p className="text-lg font-medium text-white mt-1">
                  {tableData.rowCount.toLocaleString()}
                </p>
              </div>
              <BarChart2 className="h-5 w-5 text-slate-600" />
            </div>
          </div>
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Last Updated</p>
                <p className="text-lg font-medium text-white mt-1">
                  {tableData.lastUpdated}
                </p>
              </div>
              <Clock className="h-5 w-5 text-slate-600" />
            </div>
          </div>
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Owner</p>
                <p className="text-lg font-medium text-white mt-1">
                  {tableData.owner}
                </p>
              </div>
              <Users className="h-5 w-5 text-slate-600" />
            </div>
          </div>
        </div>
        {/* Tabs */}
        <div className="border-b border-slate-700">
          <nav className="flex -mb-px">
            {['overview', 'columns', 'lineage', 'sample', 'usage'].map(tab => <button key={tab} className={`px-6 py-3 text-sm font-medium border-b-2 ${activeTab === tab ? 'border-[#2AB7A9] text-[#2AB7A9]' : 'border-transparent text-slate-400 hover:text-slate-300'}`} onClick={() => setActiveTab(tab)}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>)}
          </nav>
        </div>
        {/* Tab Content */}
        <div className="bg-slate-800 rounded-lg border border-slate-700">
          {activeTab === 'overview' && <div className="p-6">{/* Overview content */}</div>}
          {activeTab === 'columns' && <div className="p-6">{/* Columns content */}</div>}
          {activeTab === 'lineage' && <div className="p-6 h-[600px]">
              <LineageGraph />
            </div>}
          {activeTab === 'sample' && <div className="p-6">{/* Sample data content */}</div>}
          {activeTab === 'usage' && <div className="p-6">{/* Usage statistics content */}</div>}
        </div>
      </div>
    </DashboardLayout>;
}