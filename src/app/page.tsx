'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Building2, Package, Cpu, ArrowRightLeft, TrendingUp, BarChart3, PieChart, Activity, Users, Shield, ClipboardList } from 'lucide-react';
import { Card } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';

interface DashboardStats {
  vendors: number;
  products: number;
  ioUniversal: number;
  ioMappings: number;
  users: number;
  roles: number;
  auditLogs: number;
}

type StatKey = keyof DashboardStats;

interface DashboardItem {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  statKey: StatKey;
  adminOnly?: boolean;
}

const dashboardItems: DashboardItem[] = [
  { title: 'Vendors', description: 'Manage telematics device vendors', href: '/vendors', icon: Building2, color: 'bg-blue-500', statKey: 'vendors' },
  { title: 'Products', description: 'Manage vendor products and devices', href: '/products', icon: Package, color: 'bg-green-500', statKey: 'products' },
  { title: 'IO Universal', description: 'Define universal IO parameters', href: '/io-universal', icon: Cpu, color: 'bg-purple-500', statKey: 'ioUniversal' },
  { title: 'IO Mappings', description: 'Map IO parameters to products', href: '/io-mappings', icon: ArrowRightLeft, color: 'bg-orange-500', statKey: 'ioMappings' },
];

const adminDashboardItems: DashboardItem[] = [
  { title: 'Users', description: 'Manage system users', href: '/users', icon: Users, color: 'bg-indigo-500', statKey: 'users', adminOnly: true },
  { title: 'Roles', description: 'Manage roles and permissions', href: '/roles', icon: Shield, color: 'bg-pink-500', statKey: 'roles', adminOnly: true },
  { title: 'Audit Logs', description: 'View system activity logs', href: '/audit-logs', icon: ClipboardList, color: 'bg-gray-500', statKey: 'auditLogs', adminOnly: true },
];

// Simple bar chart component
function BarChartSimple({ data, labels, colors }: { data: number[]; labels: string[]; colors: string[] }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end justify-between gap-4 h-40 px-4">
      {data.map((value, i) => (
        <div key={labels[i]} className="flex flex-col items-center flex-1">
          <div className="w-full flex flex-col items-center">
            <span className="text-sm font-semibold text-gray-700 mb-1">{value}</span>
            <div className={`w-full max-w-[60px] rounded-t-lg ${colors[i]} transition-all duration-500`} style={{ height: `${(value / max) * 100}px` }} />
          </div>
          <span className="text-xs text-gray-500 mt-2 text-center">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

// Color mapping for SVG strokes
const strokeColors: Record<string, string> = {
  'bg-blue-500': '#3b82f6',
  'bg-green-500': '#22c55e',
  'bg-purple-500': '#a855f7',
  'bg-orange-500': '#f97316',
};

// Simple donut chart component
function DonutChart({ data, labels, colors }: { data: number[]; labels: string[]; colors: string[] }) {
  const total = data.reduce((a, b) => a + b, 0) || 1;
  const circumference = 2 * Math.PI * 14; // r = 14
  let cumulativePercent = 0;

  return (
    <div className="flex items-center justify-center gap-6">
      <div className="relative w-32 h-32">
        <svg viewBox="0 0 36 36" className="w-full h-full">
          {/* Background circle */}
          <circle cx="18" cy="18" r="14" fill="none" stroke="#e5e7eb" strokeWidth="4" />
          {/* Data segments */}
          {data.map((value, i) => {
            const percent = (value / total) * 100;
            const dashLength = (percent / 100) * circumference;
            const dashOffset = circumference - (cumulativePercent / 100) * circumference + circumference / 4;
            cumulativePercent += percent;
            return (
              <circle
                key={i}
                cx="18"
                cy="18"
                r="14"
                fill="none"
                stroke={strokeColors[colors[i]] || '#888'}
                strokeWidth="4"
                strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold text-gray-700">{total}</span>
        </div>
      </div>
      <div className="space-y-2">
        {labels.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${colors[i]}`} />
            <span className="text-sm text-gray-600">{label}: {data[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Activity indicator component
function ActivityIndicator({ value, label, trend }: { value: number; label: string; trend: 'up' | 'down' | 'neutral' }) {
  const trendColors = { up: 'text-green-500', down: 'text-red-500', neutral: 'text-gray-500' };
  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
      <div>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
      <div className={`flex items-center ${trendColors[trend]}`}>
        <TrendingUp className={`w-5 h-5 ${trend === 'down' ? 'rotate-180' : ''}`} />
      </div>
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    vendors: 0, products: 0, ioUniversal: 0, ioMappings: 0,
    users: 0, roles: 0, auditLogs: 0
  });
  const [loading, setLoading] = useState(true);

  // Check if user is admin
  const isAdmin = user?.Roles?.some(role => role === 'Administrator') || false;

  useEffect(() => {
    async function fetchStats() {
      try {
        // Fetch main stats
        const [vendorsRes, productsRes, ioRes, mappingsRes] = await Promise.all([
          fetch('/api/vendors?pageSize=1', { credentials: 'include' }).then(r => r.json()),
          fetch('/api/products?pageSize=1', { credentials: 'include' }).then(r => r.json()),
          fetch('/api/io-universal?pageSize=1', { credentials: 'include' }).then(r => r.json()),
          fetch('/api/io-mappings?pageSize=1', { credentials: 'include' }).then(r => r.json()),
        ]);

        let usersCount = 0, rolesCount = 0, auditLogsCount = 0;

        // Fetch admin stats only if user is admin
        if (isAdmin) {
          try {
            const [usersRes, rolesRes, auditRes] = await Promise.all([
              fetch('/api/users?pageSize=1', { credentials: 'include' }).then(r => r.json()),
              fetch('/api/roles?pageSize=1', { credentials: 'include' }).then(r => r.json()),
              fetch('/api/audit-logs?pageSize=1', { credentials: 'include' }).then(r => r.json()),
            ]);
            usersCount = usersRes.total || 0;
            rolesCount = rolesRes.total || 0;
            auditLogsCount = auditRes.total || 0;
          } catch (error) {
            console.error('Error fetching admin stats:', error);
          }
        }

        setStats({
          vendors: vendorsRes.total || 0,
          products: productsRes.total || 0,
          ioUniversal: ioRes.total || 0,
          ioMappings: mappingsRes.total || 0,
          users: usersCount,
          roles: rolesCount,
          auditLogs: auditLogsCount,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [isAdmin]);

  const chartData = [stats.vendors, stats.products, stats.ioUniversal, stats.ioMappings];
  const chartLabels = ['Vendors', 'Products', 'IO Universal', 'IO Mappings'];
  const chartColors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500'];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-gray-600">Welcome to the Telematics IO Manager.</p>
      </div>

      {/* Main Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {dashboardItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${item.color}`}>
                  <item.icon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {loading ? '...' : stats[item.statKey]}
                  </p>
                  <p className="text-sm text-gray-500">{item.title}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Admin Stats Cards - Only visible to administrators */}
      {isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {adminDashboardItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-lg ${item.color}`}>
                    <item.icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {loading ? '...' : stats[item.statKey]}
                    </p>
                    <p className="text-sm text-gray-500">{item.title}</p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Data Distribution" actions={<BarChart3 className="w-5 h-5 text-gray-400" />}>
          {loading ? (
            <div className="h-40 flex items-center justify-center text-gray-400">Loading...</div>
          ) : (
            <BarChartSimple data={chartData} labels={chartLabels} colors={chartColors} />
          )}
        </Card>

        <Card title="Overview" actions={<PieChart className="w-5 h-5 text-gray-400" />}>
          {loading ? (
            <div className="h-40 flex items-center justify-center text-gray-400">Loading...</div>
          ) : (
            <DonutChart data={chartData} labels={chartLabels} colors={chartColors} />
          )}
        </Card>
      </div>

      {/* Activity Summary */}
      <Card title="System Summary" actions={<Activity className="w-5 h-5 text-gray-400" />}>
        <div className={`grid grid-cols-1 md:grid-cols-2 ${isAdmin ? 'lg:grid-cols-4 xl:grid-cols-7' : 'lg:grid-cols-4'} gap-4`}>
          <ActivityIndicator value={stats.vendors} label="Total Vendors" trend="up" />
          <ActivityIndicator value={stats.products} label="Total Products" trend="up" />
          <ActivityIndicator value={stats.ioUniversal} label="IO Parameters" trend="neutral" />
          <ActivityIndicator value={stats.ioMappings} label="Active Mappings" trend="up" />
          {isAdmin && (
            <>
              <ActivityIndicator value={stats.users} label="Total Users" trend="neutral" />
              <ActivityIndicator value={stats.roles} label="Total Roles" trend="neutral" />
              <ActivityIndicator value={stats.auditLogs} label="Audit Entries" trend="up" />
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
