'use client'

import dynamic from 'next/dynamic'

// Loading skeleton for panels
const PanelSkeleton = () => (
    <div className="animate-pulse bg-gray-800/50 rounded-lg p-4 h-full">
        <div className="h-4 bg-gray-700/50 rounded w-1/3 mb-4" />
        <div className="space-y-3">
            <div className="h-3 bg-gray-700/50 rounded w-full" />
            <div className="h-3 bg-gray-700/50 rounded w-5/6" />
            <div className="h-3 bg-gray-700/50 rounded w-4/6" />
        </div>
    </div>
)

// Loading skeleton for modals
const ModalSkeleton = () => (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50">
        <div className="animate-pulse bg-gray-800 rounded-xl p-6 w-96">
            <div className="h-6 bg-gray-700/50 rounded w-1/2 mb-4" />
            <div className="space-y-3">
                <div className="h-4 bg-gray-700/50 rounded w-full" />
                <div className="h-4 bg-gray-700/50 rounded w-3/4" />
            </div>
        </div>
    </div>
)

// Loading skeleton for dashboards
const DashboardSkeleton = () => (
    <div className="animate-pulse w-full h-full bg-gray-900/50 p-6">
        <div className="h-8 bg-gray-700/50 rounded w-1/4 mb-6" />
        <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="h-24 bg-gray-700/50 rounded" />
            <div className="h-24 bg-gray-700/50 rounded" />
            <div className="h-24 bg-gray-700/50 rounded" />
        </div>
        <div className="h-64 bg-gray-700/50 rounded" />
    </div>
)

// Lazy-loaded heavy components with SSR disabled for client-only components
export const LazyResearchNotebook = dynamic(
    () => import('./edge/ResearchNotebook').then(mod => ({ default: mod.ResearchNotebook })),
    {
        loading: () => <PanelSkeleton />,
        ssr: false
    }
)

export const LazyMarketDetailModal = dynamic(
    () => import('./edge/MarketDetailModal').then(mod => ({ default: mod.MarketDetailModal })),
    {
        loading: () => <ModalSkeleton />,
        ssr: false
    }
)

export const LazyInsightsDashboard = dynamic(
    () => import('./insights/InsightsDashboard').then(mod => ({ default: mod.InsightsDashboard })),
    {
        loading: () => <DashboardSkeleton />,
        ssr: false
    }
)

export const LazyAgentDashboard = dynamic(
    () => import('./agent/AgentDashboard').then(mod => ({ default: mod.AgentDashboard })),
    {
        loading: () => <DashboardSkeleton />,
        ssr: false
    }
)

export const LazyHubWorkspace = dynamic(
    () => import('./edge/HubWorkspace').then(mod => ({ default: mod.HubWorkspace })),
    {
        loading: () => <DashboardSkeleton />,
        ssr: false
    }
)

export const LazyCommandCenter = dynamic(
    () => import('./edge/CommandCenter').then(mod => ({ default: mod.CommandCenter })),
    {
        loading: () => <PanelSkeleton />,
        ssr: false
    }
)

export const LazyCountryNewsPanel = dynamic(
    () => import('./edge/CountryNewsPanel').then(mod => ({ default: mod.CountryNewsPanel })),
    {
        loading: () => <PanelSkeleton />,
        ssr: false
    }
)

export const LazyNotificationCenter = dynamic(
    () => import('./panels/NotificationCenter').then(mod => ({ default: mod.NotificationCenter })),
    {
        loading: () => <PanelSkeleton />,
        ssr: false
    }
)
