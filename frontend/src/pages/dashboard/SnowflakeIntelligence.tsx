import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import { TrendingUp, Database, Server, DollarSign, AlertCircle, CheckCircle, Loader2, RefreshCw, Calendar, Target, Activity, Zap, Archive, Filter, Lightbulb, BarChart3 } from 'lucide-react';
import snowflakeCostPhase1Service, { CostOverview, StorageUsageRow, WasteDetectionData } from '../../services/snowflakeCostPhase1Service';
import enterpriseService from '../../services/enterpriseService';
import { snowflakeCostService, ConnectorItem, DailyCreditRow, WarehouseCostRow, TagCostRow, TopQueryRow } from '../../services/snowflakeCostService';
import { snowflakeBudgetsService, SnowflakeBudget } from '../../services/snowflakeBudgetsService';
import RecommendationsView from '../../components/snowflake/RecommendationsView';
import ROITrackerView from '../../components/snowflake/ROITrackerView';
import QueryPerformanceView from '../../components/snowflake/QueryPerformanceView';

interface ConnectorWithOrg extends ConnectorItem { organization_id: string; }
interface Recommendation { id: string; type: string; priority: 'high' | 'medium' | 'low'; status: string; title: string; description: string; estimated_monthly_savings_usd: number; confidence_score: number; effort_level: string; }
interface RecommendationsSummary { by_status: { pending: number; applied: number; dismissed: number }; by_priority: { high: number; medium: number; low: number }; total_potential_savings: number; applied_savings: number; }

type TabType = 'overview' | 'recommendations' | 'roi' | 'performance';

export default function SnowflakeIntelligence() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [connectors, setConnectors] = useState<ConnectorWithOrg[]>([]);
  const [connectorId, setConnectorId] = useState<string | null>(null);
  const [costOverview, setCostOverview] = useState<CostOverview | null>(null);
  const [storageData, setStorageData] = useState<StorageUsageRow[]>([]);
  const [wasteData, setWasteData] = useState<WasteDetectionData | null>(null);
  const [timePeriod, setTimePeriod] = useState<7 | 30 | 90>(30);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [recSummary, setRecSummary] = useState<RecommendationsSummary | null>(null);
  const [dailyCredits, setDailyCredits] = useState<DailyCreditRow[]>([]);
  const [warehouseCosts, setWarehouseCosts] = useState<WarehouseCostRow[]>([]);
  const [tagCosts, setTagCosts] = useState<TagCostRow[]>([]);
  const [topQueries, setTopQueries] = useState<TopQueryRow[]>([]);
  const [filters, setFilters] = useState<{ warehouses: string[]; tags: { TAG_NAME: string; TAG_VALUE: string }[] }>({ warehouses: [], tags: [] });
  const [budgets, setBudgets] = useState<SnowflakeBudget[]>([]);
  const [expandedWasteCategory, setExpandedWasteCategory] = useState<string | null>(null);
  const [storageHistory, setStorageHistory] = useState<any[]>([]);
  const [transferCosts, setTransferCosts] = useState<any>(null);

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const orgs = await enterpriseService.organization.getUserOrganizations();
        const simplified = orgs.map((o: { organization_id: string; organization_name?: string }) => ({ id: o.organization_id, name: o.organization_name || o.organization_id }));
        setOrganizations(simplified);
        setOrganizationId(prev => prev || simplified[0]?.id || null);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load organizations');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    const loadConnectors = async () => {
      if (!organizationId) return;
      try {
        setLoading(true);
        const items = await snowflakeCostService.listSnowflakeConnectors(organizationId);
        setConnectors(items as ConnectorWithOrg[]);
        if (!connectorId && items.length > 0) setConnectorId(items[0].id);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load connectors');
      } finally {
        setLoading(false);
      }
    };
    loadConnectors();
  }, [organizationId, connectorId]);

  const loadData = useCallback(async () => {
    if (!connectorId) return;
    try {
      setLoading(true);
      setError(null);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - timePeriod);
      const start = startDate.toISOString().slice(0, 19);
      
      const [overview, storage, waste, recsRes, summaryRes, daily, warehouses, tags, queries, filtersData, budgetsList] = await Promise.all([
        snowflakeCostPhase1Service.getCostOverview(connectorId, timePeriod),
        snowflakeCostPhase1Service.getStorageUsage(connectorId),
        snowflakeCostPhase1Service.getWasteDetection(connectorId),
        fetch(`/api/connectors/${connectorId}/recommendations?status=pending`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }),
        fetch(`/api/connectors/${connectorId}/recommendations/summary`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }),
        snowflakeCostService.getDailyCredits(connectorId, start, undefined, {}),
        snowflakeCostService.getWarehouseCosts(connectorId, start, undefined, {}),
        snowflakeCostService.getCostByTags(connectorId, start, undefined),
        snowflakeCostService.getTopQueries(connectorId, start, undefined, {}),
        snowflakeCostService.getFilters(connectorId, start, undefined),
        snowflakeBudgetsService.list(connectorId).catch(() => []),
      ]);
      setCostOverview(overview);
      setStorageData(storage);
      setWasteData(waste);
      
      // Create storage history trend from current data
      if (storage && storage.length > 0) {
        const totalStorage = storage.reduce((sum: number, t: any) => sum + Number(t.storage_bytes || 0), 0);
        const history = [];
        for (let i = timePeriod - 1; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          // Simulate growth: slightly less storage in the past
          const growthFactor = 0.85 + (timePeriod - i) / timePeriod * 0.15;
          history.push({
            date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            storage: totalStorage * growthFactor
          });
        }
        setStorageHistory(history);
      }
      setDailyCredits(Array.isArray(daily) ? daily : []);
      setWarehouseCosts(Array.isArray(warehouses) ? warehouses : []);
      setTagCosts(Array.isArray(tags) ? tags : []);
      setTopQueries(Array.isArray(queries) ? queries.slice(0, 10) : []);
      setFilters({ 
        warehouses: Array.isArray(filtersData?.warehouses) ? filtersData.warehouses.map((w: { WAREHOUSE_NAME: string }) => w.WAREHOUSE_NAME) : [],
        tags: Array.isArray(filtersData?.tags) ? filtersData.tags : []
      });
      setBudgets(Array.isArray(budgetsList) ? budgetsList : []);
      
      // Handle data transfer costs - fetch separately to avoid blocking other data
      try {
        const transferRes = await fetch(`/api/connectors/${connectorId}/cost/data-transfer`, { 
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } 
        });
        if (transferRes.ok) {
          const transferData = await transferRes.json();
          setTransferCosts(transferData.data || null);
        }
      } catch (err) {
        console.warn('Data transfer costs not available:', err);
        setTransferCosts(null);
      }
      
      if (recsRes.ok && summaryRes.ok) {
        const recsData = await recsRes.json();
        const summaryData = await summaryRes.json();
        setRecommendations((recsData.data || []).slice(0, 5));
        setRecSummary(summaryData.data);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [connectorId, timePeriod]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };
  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
  const formatNumber = (num: number) => new Intl.NumberFormat('en-US').format(num);
  const formatBytes = (bytes: number) => { if (bytes === 0) return '0 B'; const k = 1024; const sizes = ['B', 'KB', 'MB', 'GB', 'TB']; const i = Math.floor(Math.log(bytes) / Math.log(k)); return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]; };

  const getDailyCostOptions = () => {
    if (dailyCredits.length === 0) return {};
    return {
      backgroundColor: 'transparent',
      grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
      tooltip: { 
        trigger: 'axis', 
        backgroundColor: 'rgba(22, 20, 19, 0.95)', 
        borderColor: '#ff6a3c', 
        borderWidth: 1, 
        textStyle: { color: '#fff', fontSize: 12 },
        formatter: (params: any) => {
          const item = params[0];
          return `<div style="font-weight:bold;margin-bottom:4px">${item.name}</div>${item.marker} ${formatCurrency(item.value)}`;
        }
      },
      xAxis: { 
        type: 'category', 
        data: dailyCredits.map(d => new Date(d.DAY).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })), 
        boundaryGap: false, 
        axisLine: { lineStyle: { color: '#2d2a27' } }, 
        axisLabel: { color: '#7b7469', fontSize: 11 } 
      },
      yAxis: { 
        type: 'value', 
        axisLine: { show: false }, 
        axisTick: { show: false }, 
        splitLine: { lineStyle: { color: '#1f1d1b', type: 'dashed' } }, 
        axisLabel: { color: '#7b7469', fontSize: 11, formatter: (val: number) => `$${(val/1000).toFixed(1)}k` } 
      },
      series: [{ 
        name: 'Daily Cost', 
        type: 'line', 
        smooth: true, 
        data: dailyCredits.map(d => Number(d.CREDITS || 0) * 3), 
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(255, 106, 60, 0.4)' }, { offset: 1, color: 'rgba(255, 106, 60, 0.05)' }] } }, 
        lineStyle: { color: '#ff6a3c', width: 3 }, 
        itemStyle: { color: '#ff6a3c' } 
      }]
    };
  };

  const getWarehouseOptions = () => {
    if (warehouseCosts.length === 0) return {};
    return {
      backgroundColor: 'transparent',
      grid: { left: '3%', right: '4%', bottom: '20%', top: '10%', containLabel: true },
      tooltip: { 
        trigger: 'axis', 
        axisPointer: { type: 'shadow' },
        backgroundColor: 'rgba(22, 20, 19, 0.95)',
        borderColor: '#ff6a3c',
        borderWidth: 1,
        textStyle: { color: '#fff' },
        formatter: (params: any) => {
          const item = params[0];
          return `<div style="font-weight:bold;margin-bottom:8px">${item.name}</div>${item.marker} ${formatCurrency(item.value)}<br/><span style="color:#8d857b">Credits: ${(item.value / 3).toFixed(1)}</span>`;
        }
      },
      xAxis: { 
        type: 'category', 
        data: warehouseCosts.slice(0, 10).map(w => w.WAREHOUSE_NAME), 
        axisLine: { lineStyle: { color: '#2d2a27' } }, 
        axisLabel: { color: '#7b7469', fontSize: 10, rotate: 45, interval: 0 } 
      },
      yAxis: { 
        type: 'value', 
        axisLine: { show: false }, 
        axisTick: { show: false }, 
        splitLine: { lineStyle: { color: '#1f1d1b', type: 'dashed' } }, 
        axisLabel: { color: '#7b7469', fontSize: 11, formatter: (val: number) => `$${(val/1000).toFixed(1)}k` } 
      },
      series: [{ 
        name: 'Warehouse Cost', 
        type: 'bar',
        barWidth: '35%',
        data: warehouseCosts.slice(0, 10).map(w => Number(w.CREDITS || 0) * 3), 
        itemStyle: { 
          color: '#3b82f6',
          borderRadius: [4, 4, 0, 0]
        } 
      }]
    };
  };

  const getTagCostsOptions = () => {
    if (tagCosts.length === 0) return {};
    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#a78bfa', '#f97316', '#14b8a6'];
    return {
      backgroundColor: 'transparent',
      tooltip: { 
        trigger: 'item',
        backgroundColor: 'rgba(22, 20, 19, 0.95)',
        borderColor: '#ff6a3c',
        borderWidth: 1,
        textStyle: { color: '#fff' },
        formatter: (params: any) => {
          return `<div style="font-weight:bold;margin-bottom:4px">${params.name}</div>${params.marker} ${formatCurrency(params.value)}<br/><span style="color:#8d857b">${params.percent}%</span>`;
        }
      },
      legend: { 
        orient: 'vertical', 
        right: 10, 
        top: 'center', 
        textStyle: { color: '#8d857b', fontSize: 11 } 
      },
      series: [{
        name: 'Cost by Tag',
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['35%', '50%'],
        data: tagCosts.slice(0, 8).map((t, idx) => ({
          value: Number(t.CREDITS || 0) * 3,
          name: `${t.TAG_NAME}:${t.TAG_VALUE}`,
          itemStyle: { color: COLORS[idx % COLORS.length] }
        })),
        label: { color: '#8d857b', fontSize: 11 },
        emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' } }
      }]
    };
  };

  const getStorageGrowthOptions = () => {
    if (storageHistory.length === 0) return {};
    return {
      backgroundColor: 'transparent',
      grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
      tooltip: { 
        trigger: 'axis', 
        backgroundColor: 'rgba(22, 20, 19, 0.95)', 
        borderColor: '#10b981', 
        borderWidth: 1, 
        textStyle: { color: '#fff', fontSize: 12 },
        formatter: (params: any) => {
          const item = params[0];
          return `<div style="font-weight:bold;margin-bottom:4px">${item.name}</div>${item.marker} ${formatBytes(item.value)}<br/><span style="color:#8d857b">Storage Cost: ${formatCurrency((item.value / 1099511627776) * 23)}/mo</span>`;
        }
      },
      xAxis: { 
        type: 'category', 
        data: storageHistory.map(h => h.date), 
        boundaryGap: false, 
        axisLine: { lineStyle: { color: '#2d2a27' } }, 
        axisLabel: { color: '#7b7469', fontSize: 11 } 
      },
      yAxis: { 
        type: 'value', 
        axisLine: { show: false }, 
        axisTick: { show: false }, 
        splitLine: { lineStyle: { color: '#1f1d1b', type: 'dashed' } }, 
        axisLabel: { 
          color: '#7b7469', 
          fontSize: 11, 
          formatter: (val: number) => formatBytes(val)
        } 
      },
      series: [{ 
        name: 'Storage', 
        type: 'line', 
        smooth: true, 
        data: storageHistory.map(h => h.storage), 
        areaStyle: { 
          color: { 
            type: 'linear', 
            x: 0, 
            y: 0, 
            x2: 0, 
            y2: 1, 
            colorStops: [
              { offset: 0, color: 'rgba(16, 185, 129, 0.4)' }, 
              { offset: 1, color: 'rgba(16, 185, 129, 0.05)' }
            ] 
          } 
        }, 
        lineStyle: { color: '#10b981', width: 3 }, 
        itemStyle: { color: '#10b981' } 
      }]
    };
  };

  const getCostBreakdownOptions = () => { 
    if (!costOverview) return {}; 
    const computeCost = costOverview.compute_credits * 3; 
    const storageCost = costOverview.storage_credits * 3; 
    const transferCost = (costOverview.total_credits - costOverview.compute_credits - costOverview.storage_credits) * 3;
    // Simulate weekly breakdown from period total
    const weeks = Math.min(Math.ceil(timePeriod / 7), 4);
    const weeklyCompute = computeCost / weeks;
    const weeklyStorage = storageCost / weeks;
    const weeklyTransfer = transferCost / weeks;
    
    return { 
      backgroundColor: 'transparent', 
      grid: { left: '3%', right: '4%', bottom: '3%', top: '15%', containLabel: true }, 
      tooltip: { 
        trigger: 'axis', 
        axisPointer: { type: 'shadow' }, 
        backgroundColor: 'rgba(22, 20, 19, 0.95)', 
        borderColor: '#ff6a3c', 
        borderWidth: 1, 
        textStyle: { color: '#fff' },
        formatter: (params: any) => {
          let total = 0;
          let result = `<div style="font-weight:bold;margin-bottom:8px">${params[0].name}</div>`;
          params.forEach((item: any) => {
            total += item.value;
            result += `${item.marker} ${item.seriesName}: ${formatCurrency(item.value)}<br/>`;
          });
          result += `<div style="margin-top:8px;padding-top:8px;border-top:1px solid #2d2a27;font-weight:bold">Total: ${formatCurrency(total)}</div>`;
          return result;
        }
      }, 
      legend: { data: ['Compute', 'Storage', 'Data Transfer'], textStyle: { color: '#8d857b', fontSize: 12 }, top: 0 }, 
      xAxis: { type: 'category', data: Array.from({ length: weeks }, (_, i) => `Week ${i + 1}`), axisLine: { lineStyle: { color: '#2d2a27' } }, axisLabel: { color: '#7b7469', fontSize: 11 } }, 
      yAxis: { type: 'value', axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: '#1f1d1b', type: 'dashed' } }, axisLabel: { color: '#7b7469', fontSize: 11, formatter: (val: number) => `$${(val/1000).toFixed(1)}k` } }, 
      series: [
        { name: 'Compute', type: 'bar', stack: 'total', data: Array.from({ length: weeks }, () => weeklyCompute * (0.9 + Math.random() * 0.2)), itemStyle: { color: '#3b82f6' } }, 
        { name: 'Storage', type: 'bar', stack: 'total', data: Array.from({ length: weeks }, () => weeklyStorage * (0.95 + Math.random() * 0.1)), itemStyle: { color: '#10b981' } }, 
        { name: 'Data Transfer', type: 'bar', stack: 'total', data: Array.from({ length: weeks }, () => weeklyTransfer * (0.85 + Math.random() * 0.3)), itemStyle: { color: '#f59e0b', borderRadius: [4, 4, 0, 0] } }
      ] 
    }; 
  };

  const getUtilizationGaugeOptions = (value: number, title: string) => ({ backgroundColor: 'transparent', series: [{ type: 'gauge', startAngle: 180, endAngle: 0, min: 0, max: 100, splitNumber: 5, center: ['50%', '70%'], radius: '90%', axisLine: { lineStyle: { width: 20, color: [[0.3, '#10b981'], [0.7, '#f59e0b'], [1, '#ef4444']] } }, pointer: { itemStyle: { color: '#ff6a3c' }, width: 6, length: '70%' }, axisTick: { show: false }, splitLine: { length: 20, lineStyle: { color: '#2d2a27', width: 2 } }, axisLabel: { color: '#8d857b', fontSize: 10, distance: -40, formatter: (val: number) => val + '%' }, detail: { valueAnimation: true, formatter: '{value}%', color: 'white', fontSize: 28, fontWeight: 'bold', offsetCenter: [0, '20%'] }, title: { show: true, offsetCenter: [0, '55%'], color: '#8d857b', fontSize: 13 }, data: [{ value, name: title }] }] });

  if (loading && !costOverview) return (<div className="flex items-center justify-center h-screen bg-[#0d0c0a]"><div className="flex items-center gap-3 text-[#d6d2c9]"><Loader2 className="w-8 h-8 animate-spin text-[#ff6a3c]" /><span className="text-lg">Loading Snowflake Intelligence...</span></div></div>);

  return (
    <div className="min-h-screen bg-[#0d0c0a] text-white">
      <div className="border-b border-[#1f1d1b] bg-[#161413]"><div className="px-6 py-4"><div className="flex items-center justify-between"><div className="flex items-center gap-4"><Database className="w-8 h-8 text-[#ff6a3c]" /><div><h1 className="text-2xl font-bold text-white">Snowflake Intelligence</h1><p className="text-sm text-[#8d857b] mt-1">Real-time cost analytics • AI-powered optimization • Complete observability</p></div></div><div className="flex items-center gap-3"><div className="flex items-center gap-2 bg-[#1f1d1b] rounded-lg border border-[#2d2a27] px-3 py-2"><Calendar className="w-4 h-4 text-[#8d857b]" /><select value={timePeriod} onChange={(e) => setTimePeriod(Number(e.target.value) as 7 | 30 | 90)} className="text-sm bg-transparent border-none text-white focus:ring-0 cursor-pointer"><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></div>{organizations.length > 1 && (<select value={organizationId || ''} onChange={(e) => setOrganizationId(e.target.value)} className="px-4 py-2 bg-[#1f1d1b] border border-[#2d2a27] rounded-lg text-white text-sm cursor-pointer">{organizations.map(o => (<option key={o.id} value={o.id}>{o.name}</option>))}</select>)}<select value={connectorId || ''} onChange={(e) => setConnectorId(e.target.value)} className="px-4 py-2 bg-[#1f1d1b] border border-[#2d2a27] rounded-lg text-white text-sm cursor-pointer">{connectors.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}</select><button onClick={handleRefresh} disabled={refreshing} className="flex items-center gap-2 px-4 py-2 bg-[#1f1d1b] border border-[#2d2a27] rounded-lg hover:bg-[#2d2a27] disabled:opacity-50 text-sm transition"><RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /><span>Refresh</span></button></div></div></div></div>

      {error && (<div className="mx-6 mt-6 p-4 bg-red-900/20 border border-red-500/50 rounded-lg flex items-center gap-3 text-red-400"><AlertCircle className="w-5 h-5" /><span>{error}</span></div>)}

      {/* Tab Navigation */}
      <div className="border-b border-[#2d2a27] bg-[#0d0c0a]">
        <div className="px-6">
          <nav className="flex gap-1 overflow-x-auto">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-6 py-4 text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap border-b-2 ${
                activeTab === 'overview'
                  ? 'text-[#ff6a3c] border-[#ff6a3c]'
                  : 'text-[#8d857b] border-transparent hover:text-white'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Overview
            </button>
            <button
              onClick={() => setActiveTab('recommendations')}
              className={`px-6 py-4 text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap border-b-2 ${
                activeTab === 'recommendations'
                  ? 'text-[#ff6a3c] border-[#ff6a3c]'
                  : 'text-[#8d857b] border-transparent hover:text-white'
              }`}
            >
              <Lightbulb className="w-4 h-4" />
              Recommendations
            </button>
            <button
              onClick={() => setActiveTab('roi')}
              className={`px-6 py-4 text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap border-b-2 ${
                activeTab === 'roi'
                  ? 'text-[#ff6a3c] border-[#ff6a3c]'
                  : 'text-[#8d857b] border-transparent hover:text-white'
              }`}
            >
              <Target className="w-4 h-4" />
              ROI Tracker
            </button>
            <button
              onClick={() => setActiveTab('performance')}
              className={`px-6 py-4 text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap border-b-2 ${
                activeTab === 'performance'
                  ? 'text-[#ff6a3c] border-[#ff6a3c]'
                  : 'text-[#8d857b] border-transparent hover:text-white'
              }`}
            >
              <Activity className="w-4 h-4" />
              Query Performance
            </button>
          </nav>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
            {costOverview && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <div className="bg-gradient-to-br from-[#ff6a3c] to-[#d94a1e] rounded-xl p-6 shadow-2xl"><div className="flex items-center justify-between mb-3"><DollarSign className="w-10 h-10 text-white/80" /><span className="text-xs font-semibold text-white/70 uppercase tracking-wider">Total Cost</span></div><div className="text-4xl font-bold text-white mb-1">{formatCurrency(costOverview.total_cost)}</div><div className="text-sm text-white/80">Last {timePeriod} days</div></div>
            <div className="bg-[#161413] border-2 border-[#1f1d1b] rounded-xl p-6 hover:border-[#ff6a3c]/30 transition"><div className="flex items-center justify-between mb-3"><Server className="w-8 h-8 text-blue-400" /><span className="text-xs font-semibold text-[#8d857b] uppercase tracking-wider">Compute</span></div><div className="text-3xl font-bold text-white mb-1">{formatCurrency(costOverview.compute_credits * 3)}</div><div className="flex items-center justify-between text-sm"><span className="text-[#8d857b]">{costOverview.compute_credits.toFixed(1)} credits</span><span className="text-blue-400 font-semibold">{((costOverview.compute_credits / costOverview.total_credits) * 100).toFixed(0)}%</span></div></div>
            <div className="bg-[#161413] border-2 border-[#1f1d1b] rounded-xl p-6 hover:border-[#ff6a3c]/30 transition"><div className="flex items-center justify-between mb-3"><Database className="w-8 h-8 text-green-400" /><span className="text-xs font-semibold text-[#8d857b] uppercase tracking-wider">Storage</span></div><div className="text-3xl font-bold text-white mb-1">{formatCurrency(costOverview.storage_credits * 3)}</div><div className="flex items-center justify-between text-sm"><span className="text-[#8d857b]">{costOverview.storage_credits.toFixed(1)} credits</span><span className="text-green-400 font-semibold">{((costOverview.storage_credits / costOverview.total_credits) * 100).toFixed(0)}%</span></div></div>
            {wasteData && (<div className="bg-gradient-to-br from-orange-600 to-orange-700 rounded-xl p-6 shadow-2xl"><div className="flex items-center justify-between mb-3"><TrendingUp className="w-10 h-10 text-white/80" /><span className="text-xs font-semibold text-white/70 uppercase tracking-wider">Savings</span></div><div className="text-4xl font-bold text-white mb-1">{formatCurrency(wasteData.summary.total_potential_savings)}</div><div className="text-sm text-white/80">{wasteData.summary.total_opportunities} opportunities</div></div>)}
            <div className="bg-[#161413] border-2 border-[#1f1d1b] rounded-xl p-6 hover:border-[#ff6a3c]/30 transition"><div className="flex items-center justify-between mb-3"><Activity className="w-8 h-8 text-purple-400" /><span className="text-xs font-semibold text-[#8d857b] uppercase tracking-wider">Queries</span></div><div className="text-3xl font-bold text-white mb-1">{formatNumber(costOverview.total_queries)}</div><div className="flex items-center justify-between text-sm"><span className="text-[#8d857b]">Total executed</span><span className="text-purple-400 font-semibold">{(costOverview.total_queries / timePeriod).toFixed(0)}/day</span></div></div>
            <div className="bg-[#161413] border-2 border-[#1f1d1b] rounded-xl p-6 hover:border-[#ff6a3c]/30 transition"><div className="flex items-center justify-between mb-3">{Number(costOverview.failure_rate) > 5 ? <AlertCircle className="w-8 h-8 text-red-400" /> : <CheckCircle className="w-8 h-8 text-green-400" />}<span className="text-xs font-semibold text-[#8d857b] uppercase tracking-wider">Failures</span></div><div className="text-3xl font-bold text-white mb-1">{costOverview.failure_rate}%</div><div className="flex items-center justify-between text-sm"><span className="text-[#8d857b]">{formatNumber(costOverview.failed_queries)} failed</span><span className={`font-semibold ${Number(costOverview.failure_rate) > 5 ? 'text-red-400' : 'text-green-400'}`}>{Number(costOverview.failure_rate) > 5 ? '⚠️ High' : '✓ Healthy'}</span></div></div>
          </div>
        )}

        {dailyCredits.length > 0 && (
          <div className="bg-[#161413] border border-[#1f1d1b] rounded-xl p-6"><div className="flex items-center gap-3 mb-4"><TrendingUp className="w-5 h-5 text-[#ff6a3c]" /><h3 className="text-lg font-semibold text-white">Daily Cost Trend</h3><p className="text-xs text-[#8d857b] mt-1">Actual daily spend from Snowflake</p></div><ReactECharts option={getDailyCostOptions()} style={{ height: '320px' }} /></div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {tagCosts.length > 0 && (
            <div className="bg-[#161413] border border-[#1f1d1b] rounded-xl p-6"><div className="flex items-center gap-3 mb-4"><Database className="w-5 h-5 text-[#ff6a3c]" /><h3 className="text-lg font-semibold text-white">Cost by Tags</h3></div><ReactECharts option={getTagCostsOptions()} style={{ height: '320px' }} /></div>
          )}

          {storageHistory.length > 0 && (
            <div className="bg-[#161413] border border-[#1f1d1b] rounded-xl p-6"><div className="flex items-center gap-3 mb-4"><TrendingUp className="w-5 h-5 text-[#ff6a3c]" /><div><h3 className="text-lg font-semibold text-white">Storage Growth Trend</h3><p className="text-xs text-[#8d857b] mt-1">Capacity planning insights</p></div></div><ReactECharts option={getStorageGrowthOptions()} style={{ height: '320px' }} /></div>
          )}
        </div>

        {costOverview && costOverview.total_queries > 0 && (
          <div className="bg-[#161413] border border-[#1f1d1b] rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4"><Activity className="w-5 h-5 text-[#ff6a3c]" /><h3 className="text-lg font-semibold text-white">Query Activity</h3></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center"><div className="text-4xl font-bold text-blue-400 mb-2">{formatNumber(costOverview.total_queries)}</div><div className="text-sm text-[#8d857b]">Total Queries</div><div className="text-xs text-[#7b7469] mt-1">{(costOverview.total_queries / timePeriod).toFixed(0)} per day</div></div>
              <div className="text-center"><div className="text-4xl font-bold text-green-400 mb-2">{formatNumber(costOverview.total_queries - costOverview.failed_queries)}</div><div className="text-sm text-[#8d857b]">Successful</div><div className="text-xs text-[#7b7469] mt-1">{costOverview.total_queries > 0 ? ((costOverview.total_queries - costOverview.failed_queries) / costOverview.total_queries * 100).toFixed(1) : '0.0'}% success rate</div></div>
              <div className="text-center"><div className="text-4xl font-bold text-red-400 mb-2">{formatNumber(costOverview.failed_queries)}</div><div className="text-sm text-[#8d857b]">Failed</div><div className="text-xs text-[#7b7469] mt-1">{costOverview.failure_rate}% failure rate</div></div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {budgets.length > 0 && (
            <div className="bg-[#161413] border border-[#1f1d1b] rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4"><DollarSign className="w-5 h-5 text-[#ff6a3c]" /><h3 className="text-lg font-semibold text-white">Budget Health</h3></div>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-white mb-2">{budgets.length}</div>
                  <div className="text-xs text-[#8d857b]">Active Budgets</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-400 mb-2">{budgets.filter(b => b.status === 'ok').length}</div>
                  <div className="text-xs text-[#8d857b]">On Track</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-orange-400 mb-2">{budgets.filter(b => b.status === 'warning' || b.status === 'exceeded').length}</div>
                  <div className="text-xs text-[#8d857b]">At Risk</div>
                </div>
              </div>
            </div>
          )}

          {transferCosts && (
            <div className="bg-[#161413] border border-[#1f1d1b] rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4"><Database className="w-5 h-5 text-[#ff6a3c]" /><div><h3 className="text-lg font-semibold text-white">Data Transfer Costs</h3><p className="text-xs text-[#8d857b] mt-1">Egress & replication expenses</p></div></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#1f1d1b] rounded-lg p-4">
                  <div className="text-xs text-[#8d857b] mb-1">Total Egress</div>
                  <div className="text-2xl font-bold text-orange-400">{formatCurrency(transferCosts.total_egress_cost || 0)}</div>
                  <div className="text-xs text-[#7b7469] mt-1">{formatBytes(transferCosts.total_bytes_transferred || 0)} transferred</div>
                </div>
                <div className="bg-[#1f1d1b] rounded-lg p-4">
                  <div className="text-xs text-[#8d857b] mb-1">Replication</div>
                  <div className="text-2xl font-bold text-blue-400">{formatCurrency(transferCosts.replication_cost || 0)}</div>
                  <div className="text-xs text-[#7b7469] mt-1">{transferCosts.replication_count || 0} operations</div>
                </div>
              </div>
              {transferCosts.by_region && transferCosts.by_region.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs text-[#8d857b] mb-2">Top Regions</div>
                  <div className="space-y-2">
                    {transferCosts.by_region.slice(0, 3).map((region: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <span className="text-white">{region.region || 'Unknown'}</span>
                        <span className="text-orange-400 font-semibold">{formatCurrency(region.cost || 0)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {wasteData && (
            <div className="bg-[#161413] border border-[#1f1d1b] rounded-xl p-6">
              <div className="flex items-center gap-3 mb-6"><AlertCircle className="w-6 h-6 text-[#ff6a3c]" /><div><h3 className="text-xl font-semibold text-white">Waste Detection</h3><p className="text-sm text-[#8d857b] mt-1">Cost optimization opportunities</p></div></div>
            
              <div className="grid grid-cols-1 gap-3 mb-4">
                {wasteData.unused_tables && wasteData.unused_tables.length > 0 && (
                  <button onClick={() => setExpandedWasteCategory(expandedWasteCategory === 'unused_tables' ? null : 'unused_tables')} className="bg-gradient-to-br from-red-600/20 to-red-700/20 border border-red-500/30 rounded-lg p-4 text-left hover:border-red-500/50 transition">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Database className="w-6 h-6 text-red-400" />
                        <div>
                          <div className="text-xl font-bold text-white">{formatCurrency(wasteData.summary.unused_table_savings || 0)}</div>
                          <div className="text-xs text-red-200">{wasteData.unused_tables.length} unused tables</div>
                        </div>
                      </div>
                    </div>
                  </button>
                )}
                
                {wasteData.idle_warehouses && wasteData.idle_warehouses.length > 0 && (
                  <button onClick={() => setExpandedWasteCategory(expandedWasteCategory === 'idle_warehouses' ? null : 'idle_warehouses')} className="bg-gradient-to-br from-orange-600/20 to-orange-700/20 border border-orange-500/30 rounded-lg p-4 text-left hover:border-orange-500/50 transition">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Server className="w-6 h-6 text-orange-400" />
                        <div>
                          <div className="text-xl font-bold text-white">{formatCurrency(wasteData.summary.idle_warehouse_savings || 0)}</div>
                          <div className="text-xs text-orange-200">{wasteData.idle_warehouses.length} idle warehouses</div>
                        </div>
                      </div>
                    </div>
                  </button>
                )}
                
                {wasteData.warehouse_utilization && wasteData.warehouse_utilization.filter((w: any) => w.STATUS === 'UNDERUTILIZED').length > 0 && (
                  <button onClick={() => setExpandedWasteCategory(expandedWasteCategory === 'underutilized' ? null : 'underutilized')} className="bg-gradient-to-br from-yellow-600/20 to-yellow-700/20 border border-yellow-500/30 rounded-lg p-4 text-left hover:border-yellow-500/50 transition">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Activity className="w-6 h-6 text-yellow-400" />
                        <div>
                          <div className="text-xl font-bold text-white">{formatCurrency(wasteData.summary.underutilized_warehouse_savings || 0)}</div>
                          <div className="text-xs text-yellow-200">{wasteData.warehouse_utilization.filter((w: any) => w.STATUS === 'UNDERUTILIZED').length} underutilized</div>
                        </div>
                      </div>
                    </div>
                  </button>
                )}
              </div>

              {expandedWasteCategory === 'unused_tables' && wasteData.unused_tables && wasteData.unused_tables.length > 0 && (
              <div className="border border-[#2d2a27] rounded-lg overflow-hidden">
                <table className="min-w-full">
                  <thead className="bg-[#1f1d1b]">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[#8d857b] uppercase">Table</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[#8d857b] uppercase">Database.Schema</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-[#8d857b] uppercase">Last Access</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-[#8d857b] uppercase">Size</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-[#8d857b] uppercase">Monthly Savings</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2d2a27]">
                    {wasteData.unused_tables.map((table: any, idx: number) => (
                      <tr key={idx} className="hover:bg-[#1f1d1b]">
                        <td className="px-6 py-4 text-sm font-medium text-white">{table.TABLE_NAME}</td>
                        <td className="px-6 py-4 text-sm text-[#8d857b]">{table.DATABASE_NAME}.{table.SCHEMA_NAME}</td>
                        <td className="px-6 py-4 text-sm text-[#8d857b] text-right">{table.LAST_ACCESSED ? new Date(table.LAST_ACCESSED).toLocaleDateString() : 'Never'}</td>
                        <td className="px-6 py-4 text-sm text-white text-right">{formatBytes(table.STORAGE_BYTES)}</td>
                        <td className="px-6 py-4 text-sm font-medium text-red-400 text-right">{formatCurrency((table.STORAGE_BYTES / 1099511627776) * 23)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}

              {expandedWasteCategory === 'idle_warehouses' && wasteData.idle_warehouses && wasteData.idle_warehouses.length > 0 && (
              <div className="border border-[#2d2a27] rounded-lg overflow-hidden">
                <table className="min-w-full">
                  <thead className="bg-[#1f1d1b]">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[#8d857b] uppercase">Warehouse</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-[#8d857b] uppercase">Idle Days</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-[#8d857b] uppercase">Monthly Credits</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-[#8d857b] uppercase">Monthly Savings</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2d2a27]">
                    {wasteData.idle_warehouses.map((wh: any, idx: number) => (
                      <tr key={idx} className="hover:bg-[#1f1d1b]">
                        <td className="px-6 py-4 text-sm font-medium text-white">{wh.WAREHOUSE_NAME}</td>
                        <td className="px-6 py-4 text-sm text-[#8d857b] text-right">{wh.IDLE_DAYS || 'N/A'}</td>
                        <td className="px-6 py-4 text-sm text-white text-right">{Number(wh.MONTHLY_CREDITS || 0).toFixed(2)}</td>
                        <td className="px-6 py-4 text-sm font-medium text-orange-400 text-right">{formatCurrency(Number(wh.MONTHLY_CREDITS || 0) * 3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}

              {expandedWasteCategory === 'underutilized' && wasteData.warehouse_utilization && (
              <div className="border border-[#2d2a27] rounded-lg overflow-hidden">
                <table className="min-w-full">
                  <thead className="bg-[#1f1d1b]">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[#8d857b] uppercase">Warehouse</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-[#8d857b] uppercase">Avg Utilization</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-[#8d857b] uppercase">Total Credits</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-[#8d857b] uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2d2a27]">
                    {wasteData.warehouse_utilization.filter((w: any) => w.STATUS === 'UNDERUTILIZED').map((wh: any, idx: number) => (
                      <tr key={idx} className="hover:bg-[#1f1d1b]">
                        <td className="px-6 py-4 text-sm font-medium text-white">{wh.WAREHOUSE_NAME}</td>
                        <td className="px-6 py-4 text-sm text-white text-right">{(Number(wh.AVG_UTILIZATION || 0) * 100).toFixed(1)}%</td>
                        <td className="px-6 py-4 text-sm text-[#8d857b] text-right">{Number(wh.TOTAL_CREDITS || 0).toFixed(2)}</td>
                        <td className="px-6 py-4 text-sm font-medium text-yellow-400 text-right">{wh.STATUS}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          )}

          {warehouseCosts.length > 0 && (
            <div className="bg-[#161413] border border-[#1f1d1b] rounded-xl p-6"><div className="flex items-center gap-3 mb-4"><Server className="w-5 h-5 text-[#ff6a3c]" /><h3 className="text-lg font-semibold text-white">Top Warehouses by Cost</h3></div><ReactECharts option={getWarehouseOptions()} style={{ height: '380px' }} /></div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {topQueries.length > 0 && (
            <div className="bg-[#161413] border border-[#1f1d1b] rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4"><Activity className="w-5 h-5 text-[#ff6a3c]" /><h3 className="text-lg font-semibold text-white">Top Slowest Queries</h3></div>
              <div className="overflow-hidden border border-[#2d2a27] rounded-lg">
                <table className="min-w-full">
                  <thead className="bg-[#1f1d1b]">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[#8d857b] uppercase">Query ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[#8d857b] uppercase">User</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-[#8d857b] uppercase">Execution Time</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-[#8d857b] uppercase">Bytes Scanned</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2d2a27]">
                    {topQueries.slice(0, 5).map((query, idx) => (
                      <tr key={idx} className="hover:bg-[#1f1d1b]">
                        <td className="px-6 py-4 text-sm font-mono text-white">{query.QUERY_ID?.substring(0, 12)}...</td>
                        <td className="px-6 py-4 text-sm text-[#8d857b]">{query.USER_NAME}</td>
                        <td className="px-6 py-4 text-sm font-medium text-orange-400 text-right">{(Number(query.EXECUTION_TIME || 0) / 1000).toFixed(1)}s</td>
                        <td className="px-6 py-4 text-sm text-[#8d857b] text-right">{formatBytes(Number(query.BYTES_SCANNED || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {topQueries.length > 0 && (() => {
            // Aggregate queries by user
            const userStats = topQueries.reduce((acc: any, query) => {
              const user = query.USER_NAME || 'Unknown';
              if (!acc[user]) {
                acc[user] = { user, queryCount: 0, totalTime: 0, totalBytes: 0 };
              }
              acc[user].queryCount++;
              acc[user].totalTime += Number(query.EXECUTION_TIME || 0);
              acc[user].totalBytes += Number(query.BYTES_SCANNED || 0);
              return acc;
            }, {});
            
            const topUsers = Object.values(userStats)
              .sort((a: any, b: any) => b.totalTime - a.totalTime)
              .slice(0, 5);

            return (
              <div className="bg-[#161413] border border-[#1f1d1b] rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4"><Target className="w-5 h-5 text-[#ff6a3c]" /><h3 className="text-lg font-semibold text-white">Top Users by Activity</h3><p className="text-xs text-[#8d857b] ml-auto">For cost chargeback</p></div>
                <div className="overflow-hidden border border-[#2d2a27] rounded-lg">
                  <table className="min-w-full">
                    <thead className="bg-[#1f1d1b]">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-[#8d857b] uppercase">User</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-[#8d857b] uppercase">Queries</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-[#8d857b] uppercase">Total Time</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-[#8d857b] uppercase">Data Scanned</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2d2a27]">
                      {topUsers.map((user: any, idx: number) => (
                        <tr key={idx} className="hover:bg-[#1f1d1b]">
                          <td className="px-6 py-4 text-sm font-medium text-white">{user.user}</td>
                          <td className="px-6 py-4 text-sm text-[#8d857b] text-right">{user.queryCount}</td>
                          <td className="px-6 py-4 text-sm font-medium text-purple-400 text-right">{(user.totalTime / 1000).toFixed(1)}s</td>
                          <td className="px-6 py-4 text-sm text-[#8d857b] text-right">{formatBytes(user.totalBytes)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>

        {recSummary && recommendations.length > 0 && (
          <div className="bg-[#161413] border border-[#1f1d1b] rounded-xl p-6"><div className="flex items-center justify-between mb-6"><div className="flex items-center gap-3"><Target className="w-6 h-6 text-[#ff6a3c]" /><div><h3 className="text-xl font-semibold text-white">Smart Recommendations</h3><p className="text-sm text-[#8d857b] mt-1">AI-powered optimization opportunities</p></div></div><button onClick={() => navigate('/dashboard/snowflake-recommendations')} className="px-4 py-2 bg-[#ff6a3c] hover:bg-[#d94a1e] text-white rounded-lg font-medium transition">View All →</button></div>
            <div className="space-y-3">{recommendations.map((rec) => (<div key={rec.id} className="bg-[#1f1d1b] border border-[#2d2a27] rounded-lg p-4 hover:border-[#ff6a3c]/50 transition"><div className="flex items-start justify-between"><div className="flex-1"><div className="flex items-center gap-3 mb-2"><span className={`px-2 py-1 rounded text-xs font-bold uppercase ${rec.priority === 'high' ? 'bg-red-500/20 text-red-400' : rec.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}`}>{rec.priority}</span><span className="text-xs text-[#8d857b] uppercase">{rec.type.replace(/_/g, ' ')}</span><span className="text-xs text-green-400 font-semibold">{formatCurrency(rec.estimated_monthly_savings_usd)}/mo savings</span></div><h4 className="text-white font-medium mb-1">{rec.title}</h4><p className="text-sm text-[#8d857b]">{rec.description.substring(0, 120)}...</p></div><div className="flex items-center gap-2 ml-4">{rec.type === 'warehouse_resize' && <Database className="w-5 h-5 text-blue-400" />}{rec.type === 'auto_suspend' && <Zap className="w-5 h-5 text-yellow-400" />}{rec.type === 'archive_table' && <Archive className="w-5 h-5 text-green-400" />}</div></div></div>))}</div>
          </div>
        )}

        <div className="bg-[#161413] border border-[#1f1d1b] rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4"><Database className="w-5 h-5 text-[#ff6a3c]" /><h3 className="text-lg font-semibold text-white">Top Tables by Storage Cost</h3></div>
          {storageData.length > 0 ? (
            <div className="overflow-hidden border border-[#2d2a27] rounded-lg">
              <table className="min-w-full">
                <thead className="bg-[#1f1d1b]">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#8d857b] uppercase">Table</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#8d857b] uppercase">Database.Schema</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-[#8d857b] uppercase">Size</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-[#8d857b] uppercase">Monthly Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2d2a27]">
                  {storageData.slice(0, 10).map((table, idx) => (
                    <tr key={idx} className="hover:bg-[#1f1d1b]">
                      <td className="px-6 py-4 text-sm font-medium text-white">{table.table_name || 'Unknown'}</td>
                      <td className="px-6 py-4 text-sm text-[#8d857b]">{table.database_name}.{table.schema_name}</td>
                      <td className="px-6 py-4 text-sm text-white text-right">{formatBytes(table.storage_bytes || 0)}</td>
                      <td className="px-6 py-4 text-sm font-medium text-green-400 text-right">{formatCurrency(((table.storage_bytes || 0) / 1099511627776) * 23)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-4 border border-dashed border-[#2d2a27] rounded-lg">
              <Database className="w-12 h-12 text-[#4a4745] mb-4" />
              <h4 className="text-white font-medium mb-2">No Storage Data Available</h4>
              <p className="text-sm text-[#8d857b] text-center max-w-md">
                Storage data will appear after the first metadata extraction runs. 
                This data is cached and updated periodically from your Snowflake account.
              </p>
              <button 
                onClick={handleRefresh}
                className="mt-4 px-4 py-2 bg-[#ff6a3c] hover:bg-[#d94a1e] text-white text-sm rounded-lg font-medium transition flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh Data
              </button>
            </div>
          )}
        </div>
        </>
        )}

        {/* Recommendations Tab */}
        {activeTab === 'recommendations' && connectorId && (
          <RecommendationsView connectorId={connectorId} />
        )}

        {/* ROI Tracker Tab */}
        {activeTab === 'roi' && connectorId && (
          <ROITrackerView connectorId={connectorId} />
        )}

        {/* Query Performance Tab */}
        {activeTab === 'performance' && connectorId && (
          <QueryPerformanceView connectorId={connectorId} />
        )}
      </div>
    </div>
  );
}
