import { useState, useEffect, useMemo } from "react";
import { useEnergyEstimateQuery, useFinancialAnalysisQuery, useSiteDesignQuery, useTriggerEnergyEstimateMutation, usePVDesignQuery } from "@/hooks/useSiteDesigns";
import { useDesignCanvasStore } from "@/stores/useDesignCanvasStore";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import {
    LayoutGrid,
    Zap,
    Sun,
    TrendingUp,
    ChevronUp,
    Loader2,
    AlertCircle,
    ChevronDown,
    Activity,
    Square,
    DollarSign,
    Calendar,
    Percent,
    RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer
} from "recharts";

interface ResultsBottomSheetProps {
    designId: string;
}

export function ResultsBottomSheet({ designId }: ResultsBottomSheetProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const rightPanelOpen = useDesignCanvasStore((state) => state.rightPanelOpen);
    const [isSmallScreen, setIsSmallScreen] = useState(false);

    // Fetch Data
    const { data: design, isLoading: isDesignLoading } = useSiteDesignQuery(designId);
    const { data: energyData, isLoading: isEnergyLoading } = useEnergyEstimateQuery(designId);
    const { data: financialData, isLoading: isFinancialLoading } = useFinancialAnalysisQuery(designId);
    const { data: pvDesign, isLoading: isPVDesignLoading } = usePVDesignQuery(design?.tender_id || '', design?.pv_design_id || null);

    // Responsive Resize Handler
    useEffect(() => {
        const checkScreenSize = () => {
            setIsSmallScreen(window.innerWidth < 768);
        };

        // Initial check
        checkScreenSize();

        window.addEventListener('resize', checkScreenSize);
        return () => window.removeEventListener('resize', checkScreenSize);
    }, []);

    // Data Transformation
    const monthlyChartData = useMemo(() => {
        if (!energyData?.monthly_energy_kwh) return [];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return energyData.monthly_energy_kwh.map((energy, index) => ({
            month: monthNames[index],
            energy_kwh: energy,
            energy_mwh: energy / 1000
        }));
    }, [energyData?.monthly_energy_kwh]);

    const { mutate: retryEnergyEstimate, isPending: isRetryingEnergy } = useTriggerEnergyEstimateMutation(designId);

    // Formatting Helpers
    const formatCurrency = (value: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

    const formatRate = (value: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(value);

    const formatEnergy = (value: number) =>
        `${value.toFixed(2)} MWh`;

    const formatPercentage = (value: number) =>
        `${value.toFixed(1)}%`;

    const formatNumber = (value: number, decimals: number = 2) =>
        value.toFixed(decimals);

    // Conditional Rendering
    if (!designId) return null;
    if (design && design.total_modules === 0) return null;

    // Derived Formats
    const formattedSystemSize = design ? `${design.system_size_kwp.toFixed(2)} kWp` : "0.00 kWp";
    const formattedEnergy = energyData ? `${(energyData.annual_energy_kwh / 1000).toFixed(2)} MWh` : "—";
    const formattedPayback = financialData ? `${financialData.simple_payback_years.toFixed(1)} years` : "—";

    const isEnergyCalculating = energyData?.status === 'calculating';
    const isEnergyFailed = energyData?.status === 'failed';

    const rightPanelOffset = rightPanelOpen ? "mr-[320px]" : "mr-0";

    // Reusable Metric Component
    const MetricItem = ({
        icon: Icon,
        colorClass,
        bgClass,
        label,
        value,
        isLoading,
        specialState
    }: any) => (
        <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-full", bgClass, colorClass)}>
                <Icon className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
                <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">{label}</span>
                {isLoading ? (
                    <Skeleton className="h-6 w-16" />
                ) : specialState ? (
                    specialState
                ) : (
                    <span className="text-lg font-bold text-slate-900">{value}</span>
                )}
            </div>
        </div>
    );

    const EnergySpecialState = isEnergyCalculating ? (
        <div className="flex items-center gap-2 text-amber-600 font-semibold">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Calculating...</span>
        </div>
    ) : isEnergyFailed ? (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 text-red-500 font-semibold cursor-help">
                        <AlertCircle className="h-4 w-4" />
                        <span>Failed</span>
                    </div>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{energyData?.error_message || "Estimation failed"}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    ) : null;

    // Summary Bar Content
    const summaryContent = (
        <div className={cn(
            "grid gap-4 items-center",
            isSmallScreen ? "grid-cols-2" : "grid-cols-4"
        )}>
            <MetricItem
                icon={LayoutGrid}
                bgClass="bg-blue-100"
                colorClass="text-blue-600"
                label="Total Modules"
                value={design?.total_modules?.toLocaleString() ?? 0}
                isLoading={isDesignLoading}
            />
            <MetricItem
                icon={Zap}
                bgClass="bg-indigo-100"
                colorClass="text-indigo-600"
                label="System Size"
                value={formattedSystemSize}
                isLoading={isDesignLoading}
            />
            <MetricItem
                icon={Sun}
                bgClass="bg-amber-100"
                colorClass="text-amber-600"
                label="Annual Energy"
                value={formattedEnergy}
                isLoading={isEnergyLoading}
                specialState={EnergySpecialState}
            />
            <MetricItem
                icon={TrendingUp}
                bgClass="bg-emerald-100"
                colorClass="text-emerald-600"
                label="Payback Period"
                value={formattedPayback}
                isLoading={isFinancialLoading}
            />
        </div>
    );

    // Tab Components
    const MetricCard = ({ title, value, icon: Icon, isLoading }: any) => (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <Skeleton className="h-7 w-20" />
                ) : (
                    <div className="text-2xl font-bold">{value}</div>
                )}
            </CardContent>
        </Card>
    );

    return (
        <>
            {/* Expanded Sheet */}
            <Sheet open={isExpanded} onOpenChange={setIsExpanded}>
                <SheetContent
                    side="bottom"
                    className={cn(
                        "p-0 transition-all duration-300 ease-in-out h-[70vh] max-h-[70vh] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]",
                        rightPanelOpen ? "mr-[0px] md:mr-[320px]" : "mr-0", // Responsive margin
                        "pointer-events-auto", // Ensure interaction
                        "flex flex-col"
                    )}
                    onOpenAutoFocus={(e) => e.preventDefault()} // Prevent focus stealing
                >
                    <div className="flex flex-col h-full bg-white/95 backdrop-blur-md">
                        {/* Header */}
                        <div className="px-6 py-4 border-b bg-white/50 flex items-center justify-between sticky top-0 z-10">
                            <SheetTitle>Design Results</SheetTitle>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setIsExpanded(false)}
                                className="text-slate-500 hover:text-slate-900"
                            >
                                Minimize
                                <ChevronDown className="ml-2 h-4 w-4" />
                            </Button>
                        </div>

                        {/* Scrollable Tabs Content */}
                        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6">
                            <Tabs defaultValue="overview" className="w-full">
                                <TabsList className="mb-6 w-full md:w-auto overflow-x-auto justify-start">
                                    <TabsTrigger value="overview">System Overview</TabsTrigger>
                                    <TabsTrigger value="energy">Energy Production</TabsTrigger>
                                    <TabsTrigger value="financial">Financial Metrics</TabsTrigger>
                                </TabsList>

                                {/* System Overview Tab */}
                                <TabsContent value="overview" className="space-y-6">
                                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                        <MetricCard
                                            title="Total Modules"
                                            value={design?.total_modules?.toLocaleString()}
                                            icon={LayoutGrid}
                                            isLoading={isDesignLoading}
                                        />
                                        <MetricCard
                                            title="System Size"
                                            value={formattedSystemSize}
                                            icon={Zap}
                                            isLoading={isDesignLoading}
                                        />
                                        <MetricCard
                                            title="DC:AC Ratio"
                                            value={pvDesign ? formatNumber(pvDesign.dc_ac_ratio, 2) : "—"}
                                            icon={Activity}
                                            isLoading={isDesignLoading || isPVDesignLoading}
                                        />
                                        <MetricCard
                                            title="Site Area"
                                            value={design?.site_area_sqm ? `${formatNumber(design.site_area_sqm)} m²` : "—"}
                                            icon={Square}
                                            isLoading={isDesignLoading}
                                        />
                                    </div>
                                </TabsContent>

                                {/* Energy Production Tab */}
                                <TabsContent value="energy" className="space-y-6">
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <MetricCard
                                            title="Annual Energy"
                                            value={formattedEnergy}
                                            icon={Sun}
                                            isLoading={isEnergyLoading}
                                        />
                                        <MetricCard
                                            title="Capacity Factor"
                                            value={energyData?.capacity_factor ? formatPercentage(energyData.capacity_factor) : "—"}
                                            icon={Activity}
                                            isLoading={isEnergyLoading}
                                        />
                                    </div>

                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-sm font-medium">Monthly Production (MWh)</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            {isEnergyLoading ? (
                                                <Skeleton className="h-[300px] w-full" />
                                            ) : isEnergyFailed ? (
                                                <div className="h-[300px] w-full flex flex-col items-center justify-center text-red-500 gap-4 border-2 border-dashed border-red-200 rounded-lg bg-red-50/50">
                                                    <AlertCircle className="h-10 w-10 text-red-500" />
                                                    <div className="text-center">
                                                        <p className="font-semibold">Energy estimation failed</p>
                                                        <p className="text-sm text-red-400 mt-1 max-w-[250px]">{energyData?.error_message || "An unknown error occurred"}</p>
                                                    </div>
                                                    <Button variant="outline" size="sm" onClick={() => retryEnergyEstimate()} disabled={isRetryingEnergy} className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700">
                                                        <RefreshCw className={cn("mr-2 h-4 w-4", isRetryingEnergy && "animate-spin")} />
                                                        Retry Estimation
                                                    </Button>
                                                </div>
                                            ) : isEnergyCalculating ? (
                                                <div className="h-[300px] w-full flex flex-col items-center justify-center text-amber-600 gap-2">
                                                    <Loader2 className="h-8 w-8 animate-spin" />
                                                    <p>Calculating energy production...</p>
                                                </div>
                                            ) : monthlyChartData.length > 0 ? (
                                                <div className="h-[300px] w-full">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <BarChart data={monthlyChartData}>
                                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                            <XAxis
                                                                dataKey="month"
                                                                axisLine={false}
                                                                tickLine={false}
                                                                tick={{ fill: '#64748b', fontSize: 12 }}
                                                                dy={10}
                                                            />
                                                            <YAxis
                                                                axisLine={false}
                                                                tickLine={false}
                                                                tick={{ fill: '#64748b', fontSize: 12 }}
                                                            />
                                                            <RechartsTooltip
                                                                cursor={{ fill: '#f1f5f9' }}
                                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                                                formatter={(value: any) => [`${typeof value === 'number' ? value.toFixed(2) : value} MWh`, 'Energy']}
                                                            />
                                                            <Bar
                                                                dataKey="energy_mwh"
                                                                fill="#3b82f6"
                                                                radius={[4, 4, 0, 0]}
                                                            />
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            ) : (
                                                <div className="h-[300px] w-full flex flex-col items-center justify-center text-slate-400 gap-2 border-2 border-dashed rounded-lg">
                                                    <Sun className="h-8 w-8 opacity-50" />
                                                    <p>No energy data available</p>
                                                </div>
                                            )}

                                            <div className="mt-4 text-xs text-slate-500 text-center">
                                                Powered by <a href="https://pvwatts.nrel.gov/" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-800">NREL PVWatts®</a>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                {/* Financial Metrics Tab */}
                                <TabsContent value="financial" className="space-y-6">
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <MetricCard
                                            title="System Cost"
                                            value={financialData ? formatCurrency(financialData.system_cost_usd) : "—"}
                                            icon={DollarSign}
                                            isLoading={isFinancialLoading}
                                        />
                                        <MetricCard
                                            title="Annual Savings"
                                            value={financialData ? `${formatCurrency(financialData.annual_savings_usd)}/yr` : "—"}
                                            icon={TrendingUp}
                                            isLoading={isFinancialLoading}
                                        />
                                        <MetricCard
                                            title="Payback Period"
                                            value={financialData ? `${financialData.simple_payback_years.toFixed(1)} years` : "—"}
                                            icon={Calendar}
                                            isLoading={isFinancialLoading}
                                        />
                                        <MetricCard
                                            title="ROI"
                                            value={financialData ? formatPercentage(financialData.roi_pct) : "—"}
                                            icon={Percent}
                                            isLoading={isFinancialLoading}
                                        />
                                    </div>

                                    {financialData && (
                                        <div className="bg-slate-50 border rounded-lg p-4 text-sm text-slate-600 space-y-2">
                                            <h4 className="font-semibold text-slate-900 mb-2">Assumptions</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="flex justify-between">
                                                    <span>Electricity Rate:</span>
                                                    <span className="font-medium">{formatRate(financialData.electricity_rate_usd_per_kwh)}/kWh</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Annual Escalation:</span>
                                                    <span className="font-medium">{formatPercentage(financialData.annual_rate_escalation_pct)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {!financialData && !isFinancialLoading && (
                                        <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500 bg-slate-50 rounded-lg border-2 border-dashed">
                                            <DollarSign className="h-8 w-8 mb-2 opacity-50" />
                                            <p>Financial analysis unavailable.</p>
                                        </div>
                                    )}
                                </TabsContent>
                            </Tabs>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>

            {/* Collapsed Summary Bar (Always Visible) */}
            {!isExpanded && (
                <div
                    className={cn(
                        "fixed bottom-0 left-0 right-0 z-30 transition-all duration-300 ease-in-out",
                        rightPanelOpen ? "mr-[0px] md:mr-[320px]" : "mr-0"
                    )}
                >
                    <div className="bg-white/95 backdrop-blur-md border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] px-6 py-4">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="flex-1 w-full">
                                {summaryContent}
                            </div>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsExpanded(true)}
                                className="whitespace-nowrap w-full md:w-auto mt-4 md:mt-0 font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100"
                            >
                                View Details
                                <ChevronUp className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
