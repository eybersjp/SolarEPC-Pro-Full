import { useState, useEffect, useMemo, useRef, memo, useCallback } from "react";
import {
    useEnergyEstimateQuery,
    useFinancialAnalysisQuery,
    useSiteDesignQuery,
    useTriggerEnergyEstimateMutation,
    usePVDesignQuery
} from "@/hooks/useSiteDesigns";
import { useDesignCanvasStore } from "@/stores/useDesignCanvasStore";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Sheet,
    SheetContent,
    SheetTitle,
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
    RefreshCw,
    MapPin,
    AlertTriangle,
    Clock
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
import { toast } from "sonner";

interface ResultsBottomSheetProps {
    designId: string;
}

// Optimization: Formatting helpers outside component
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

// Optimization: Memoized components
const MetricItem = memo(({
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
));
MetricItem.displayName = "MetricItem";

const MetricCard = memo(({ title, value, icon: Icon, isLoading, suffix }: any) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            {isLoading ? (
                <Skeleton className="h-7 w-20" />
            ) : (
                <div className="text-2xl font-bold">
                    {value}{suffix && <span className="text-sm font-normal text-muted-foreground ml-1">{suffix}</span>}
                </div>
            )}
        </CardContent>
    </Card>
));
MetricCard.displayName = "MetricCard";

export function ResultsBottomSheet({ designId }: ResultsBottomSheetProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const rightPanelOpen = useDesignCanvasStore((state) => state.rightPanelOpen);
    const [isSmallScreen, setIsSmallScreen] = useState(false);
    const [calcStartTime, setCalcStartTime] = useState<number | null>(null);
    const [pollingTimedOut, setPollingTimedOut] = useState(false);

    // Status tracking for toasts
    const prevStatusRef = useRef<string | null>(null);

    // Fetch Data
    const { data: design, isLoading: isDesignLoading } = useSiteDesignQuery(designId);

    const isZeroCapacity = design ? design.system_size_kwp === 0 : false;
    const shouldPollEnergy = !pollingTimedOut && !isZeroCapacity;

    const {
        data: energyData,
        isLoading: isEnergyLoading,
        isFetching: isEnergyFetching,
        refetch: refetchEnergy
    } = useEnergyEstimateQuery(designId, {
        refetchInterval: (data: any) => (data?.status === 'calculating' && shouldPollEnergy) ? 2000 : false
    });

    const { data: financialData, isLoading: isFinancialLoading } = useFinancialAnalysisQuery(designId);
    const { data: pvDesign, isLoading: isPVDesignLoading } = usePVDesignQuery(design?.tender_id || '', design?.pv_design_id || null);
    const { mutate: retryEnergyEstimate, isPending: isRetryingEnergy } = useTriggerEnergyEstimateMutation(designId);

    const isEnergyCalculating = energyData?.status === 'calculating';
    const isEnergyFailed = energyData?.status === 'failed';
    const isEnergyUnavailable = !energyData && !isEnergyLoading;
    const hasModules = design && design.total_modules > 0;

    // Toast Notifications for state transitions
    useEffect(() => {
        if (!energyData?.status || !designId) return;

        const currentStatus = energyData.status;
        const prevStatus = prevStatusRef.current;

        if (prevStatus !== currentStatus) {
            if (currentStatus === 'calculating') {
                toast.info("Calculating energy production...", { id: `energy-calc-${designId}` });
                setCalcStartTime(Date.now());
                setPollingTimedOut(false);
            } else if (currentStatus === 'completed' && prevStatus === 'calculating') {
                toast.success("Energy estimation complete!", { id: `energy-calc-${designId}` });
                setCalcStartTime(null);
            } else if (currentStatus === 'failed') {
                toast.error(energyData.error_message || "Energy estimation failed", { id: `energy-calc-${designId}` });
                setCalcStartTime(null);
            }
        }

        prevStatusRef.current = currentStatus;
    }, [energyData?.status, energyData?.error_message, designId]);

    // Polling timeout safeguard (5 minutes)
    useEffect(() => {
        if (!isEnergyCalculating || !calcStartTime) return;

        const timeoutId = setTimeout(() => {
            setPollingTimedOut(true);
            toast.warning("Calculation is taking longer than expected. Please check back later.");
        }, 5 * 60 * 1000);

        return () => clearTimeout(timeoutId);
    }, [isEnergyCalculating, calcStartTime]);

    // Responsive Resize Handler
    useEffect(() => {
        const checkScreenSize = () => setIsSmallScreen(window.innerWidth < 768);
        checkScreenSize();
        window.addEventListener('resize', checkScreenSize);
        return () => window.removeEventListener('resize', checkScreenSize);
    }, []);

    // Data Transformation
    const monthlyChartData = useMemo(() => {
        if (!energyData?.monthly_energy_kwh || energyData.monthly_energy_kwh.length === 0) return [];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return energyData.monthly_energy_kwh.map((energy, index) => ({
            month: monthNames[index] || `M${index + 1}`,
            energy_kwh: energy,
            energy_mwh: energy / 1000
        }));
    }, [energyData?.monthly_energy_kwh]);

    // Derived logic for warnings
    const isStaleEnergy = useMemo(() => {
        if (!energyData?.calculated_at || !design?.updated_at) return false;
        return new Date(energyData.calculated_at) < new Date(design.updated_at);
    }, [energyData?.calculated_at, design?.updated_at]);

    // Common guidance for errors
    const getErrorGuidance = useCallback((error: string) => {
        const lowerError = error.toLowerCase();
        if (lowerError.includes("location") || lowerError.includes("coordinate"))
            return "Please verify the tender location coordinates in the project settings.";
        if (lowerError.includes("capacity") || lowerError.includes("zero") || lowerError.includes("no modules"))
            return "Increase system size by placing more modules on the canvas.";
        if (lowerError.includes("pvwatts") || lowerError.includes("service"))
            return "The PVWatts service is temporarily unavailable. Please try again later.";
        return "Check design parameters or contact support for assistance.";
    }, []);

    const EnergySpecialState = useMemo(() => {
        if (isEnergyCalculating) {
            return (
                <div className="flex items-center gap-2 text-amber-600 font-semibold animate-pulse">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{pollingTimedOut ? "Taking a while..." : "Calculating..."}</span>
                </div>
            );
        }
        if (isEnergyFailed) {
            return (
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
            );
        }
        if (isStaleEnergy) {
            return (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="flex items-center gap-2 text-amber-500 font-semibold cursor-help">
                                <Clock className="h-4 w-4" />
                                <span>Outdated</span>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Design has changed since last calculation. Values may be inaccurate.</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            );
        }
        return null;
    }, [isEnergyCalculating, isEnergyFailed, isStaleEnergy, energyData?.error_message, pollingTimedOut]);

    // Conditional Rendering Early Returns
    if (!designId) return null;

    // Show initial loading bar
    if (isDesignLoading && !design) {
        return (
            <div className={cn("fixed bottom-0 left-0 right-0 z-30 transition-all duration-300", rightPanelOpen ? "md:mr-[320px]" : "mr-0")}>
                <div className="bg-white/95 backdrop-blur-md border-t px-6 py-4">
                    <Skeleton className="h-10 w-full" />
                </div>
            </div>
        );
    }

    // Derived Formats
    const formattedSystemSize = `${design?.system_size_kwp.toFixed(2) || "0.00"} kWp`;

    const formattedEnergyValue = useMemo(() => {
        if (isZeroCapacity) return "N/A";
        if (isEnergyUnavailable) return "Unavailable";
        if (!energyData?.annual_energy_kwh) return "—";
        return formatEnergy(energyData.annual_energy_kwh / 1000);
    }, [isZeroCapacity, isEnergyUnavailable, energyData?.annual_energy_kwh]);

    const formattedPayback = financialData ? `${financialData.simple_payback_years.toFixed(1)} years` : "—";

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
            />
            <MetricItem
                icon={Zap}
                bgClass="bg-indigo-100"
                colorClass="text-indigo-600"
                label="System Size"
                value={formattedSystemSize}
                specialState={isZeroCapacity ? (
                    <div className="flex items-center gap-1 text-amber-600 font-bold">
                        <span>0.00 kWp</span>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <AlertTriangle className="h-4 w-4 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>System size is 0 kWp – cannot estimate energy</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                ) : null}
            />
            <MetricItem
                icon={Sun}
                bgClass="bg-amber-100"
                colorClass="text-amber-600"
                label="Annual Energy"
                value={formattedEnergyValue}
                isLoading={isEnergyLoading && !energyData}
                specialState={EnergySpecialState}
            />
            <MetricItem
                icon={TrendingUp}
                bgClass="bg-emerald-100"
                colorClass="text-emerald-600"
                label="Payback Period"
                value={formattedPayback}
                isLoading={isFinancialLoading && !financialData}
            />
        </div>
    );

    const buttonLabel = isEnergyCalculating ? (pollingTimedOut ? "Polling Paused" : "View Status") : (isEnergyFailed ? "View Error" : "View Details");

    return (
        <>
            {/* Expanded Sheet */}
            <Sheet open={isExpanded} onOpenChange={setIsExpanded}>
                <SheetContent
                    side="bottom"
                    className={cn(
                        "p-0 transition-all duration-300 ease-in-out h-[75vh] max-h-[85vh] shadow-2xl",
                        rightPanelOpen ? "md:mr-[320px]" : "mr-0",
                        "pointer-events-auto flex flex-col"
                    )}
                    onOpenAutoFocus={(e) => e.preventDefault()}
                >
                    <div className="flex flex-col h-full bg-white/95 backdrop-blur-md">
                        {/* Header */}
                        <div className="px-6 py-4 border-b bg-white/50 flex items-center justify-between sticky top-0 z-10">
                            <div className="flex items-center gap-3">
                                <SheetTitle className="text-xl font-bold">Design Performance & Analysis</SheetTitle>
                                {isEnergyFetching && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setIsExpanded(false)}
                                className="text-slate-500 hover:text-slate-900"
                                aria-label="Minimize design results"
                            >
                                Minimize
                                <ChevronDown className="ml-2 h-4 w-4" />
                            </Button>
                        </div>

                        {/* Scrollable Tabs Content */}
                        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6 animate-in fade-in duration-500">
                            {!hasModules ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-6 py-20">
                                    <div className="p-4 bg-amber-50 rounded-full text-amber-600">
                                        <AlertTriangle className="h-12 w-12" />
                                    </div>
                                    <div className="text-center space-y-2">
                                        <h3 className="text-lg font-semibold text-slate-900">No Modules Placed</h3>
                                        <p className="max-w-md">Start placing modules on the canvas to see energy production estimates and financial analysis.</p>
                                    </div>
                                    <Button onClick={() => setIsExpanded(false)}>Return to Canvas</Button>
                                </div>
                            ) : (
                                <Tabs defaultValue="overview" className="w-full">
                                    <TabsList className="mb-6 w-full md:w-auto overflow-x-auto justify-start bg-white/50 p-1 border">
                                        <TabsTrigger value="overview">System Overview</TabsTrigger>
                                        <TabsTrigger value="energy" className="relative">
                                            Energy Production
                                            {isEnergyCalculating && <span className="absolute -top-1 -right-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span></span>}
                                        </TabsTrigger>
                                        <TabsTrigger value="financial">Financial Metrics</TabsTrigger>
                                    </TabsList>

                                    {/* System Overview Tab */}
                                    <TabsContent value="overview" className="space-y-6 outline-none">
                                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                            <MetricCard
                                                title="Total Modules"
                                                value={design?.total_modules?.toLocaleString()}
                                                icon={LayoutGrid}
                                                isLoading={isDesignLoading}
                                            />
                                            <MetricCard
                                                title="System Size"
                                                value={design?.system_size_kwp.toFixed(2)}
                                                suffix="kWp"
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
                                                value={design?.site_area_sqm ? formatNumber(design.site_area_sqm) : "—"}
                                                suffix="m²"
                                                icon={Square}
                                                isLoading={isDesignLoading}
                                            />
                                        </div>
                                    </TabsContent>

                                    {/* Energy Production Tab */}
                                    <TabsContent value="energy" className="space-y-6 outline-none">
                                        {!design?.tender_id && (
                                            <Alert variant="warning" className="bg-amber-50 border-amber-200">
                                                <AlertTriangle className="h-4 w-4" />
                                                <AlertTitle>Missing Location Data</AlertTitle>
                                                <AlertDescription>Location data is required for accurate energy estimation. Please update the tender settings.</AlertDescription>
                                            </Alert>
                                        )}

                                        <div className="grid gap-4 md:grid-cols-2">
                                            <MetricCard
                                                title="Annual Energy"
                                                value={formattedEnergyValue}
                                                icon={Sun}
                                                isLoading={isEnergyLoading && !energyData}
                                            />
                                            <MetricCard
                                                title="Capacity Factor"
                                                value={energyData?.capacity_factor ? formatPercentage(energyData.capacity_factor) : "—"}
                                                icon={Activity}
                                                isLoading={isEnergyLoading && !energyData}
                                            />
                                        </div>

                                        {isZeroCapacity && (
                                            <Alert variant="warning" className="bg-amber-50 border-amber-200">
                                                <AlertTriangle className="h-4 w-4" />
                                                <AlertTitle>System Size Warning</AlertTitle>
                                                <AlertDescription>System size is 0 kWp – cannot estimate energy. Please place modules on the canvas.</AlertDescription>
                                            </Alert>
                                        )}

                                        {isEnergyUnavailable && !isZeroCapacity && (
                                            <div className="flex flex-col items-center justify-center p-12 text-center text-slate-500 bg-slate-50 rounded-xl border-2 border-dashed">
                                                <Sun className="h-12 w-12 mb-4 opacity-20" />
                                                <h4 className="text-lg font-semibold text-slate-900">Energy estimation unavailable</h4>
                                                <p className="max-w-sm mt-2 text-sm leading-relaxed">
                                                    We couldn't retrieve energy production data for this design.
                                                    Try recalculating or double check your site parameters.
                                                </p>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="mt-6"
                                                    onClick={() => retryEnergyEstimate()}
                                                    disabled={isRetryingEnergy}
                                                >
                                                    <RefreshCw className={cn("mr-2 h-4 w-4", isRetryingEnergy && "animate-spin")} />
                                                    Recalculate Now
                                                </Button>
                                            </div>
                                        )}

                                        <Card className={cn(isEnergyUnavailable && "hidden")}>
                                            <CardHeader className="flex flex-row items-center justify-between">
                                                <CardTitle className="text-sm font-medium">Monthly Production (MWh)</CardTitle>
                                                {isStaleEnergy && (
                                                    <Button variant="ghost" size="sm" onClick={() => retryEnergyEstimate()} disabled={isRetryingEnergy} className="h-8 text-amber-600 hover:bg-amber-50">
                                                        <RefreshCw className={cn("mr-2 h-3 w-3", isRetryingEnergy && "animate-spin")} />
                                                        Recalculate
                                                    </Button>
                                                )}
                                            </CardHeader>
                                            <CardContent>
                                                {isEnergyLoading && !energyData ? (
                                                    <Skeleton className="h-[300px] w-full" />
                                                ) : isEnergyFailed ? (
                                                    <div className="h-[300px] w-full flex flex-col items-center justify-center text-red-500 gap-4 border-2 border-dashed border-red-200 rounded-lg bg-red-50/50">
                                                        <AlertCircle className="h-10 w-10 text-red-500" />
                                                        <div className="text-center max-w-[400px] px-4">
                                                            <p className="font-bold text-lg">Estimation Failed</p>
                                                            <p className="text-sm text-red-500 font-medium mt-1 uppercase tracking-tight">Error: {energyData?.error_message || "Unknown error"}</p>
                                                            <p className="text-xs text-red-400 mt-3 leading-relaxed">{getErrorGuidance(energyData?.error_message || "")}</p>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <Button variant="outline" size="sm" onClick={() => retryEnergyEstimate()} disabled={isRetryingEnergy} className="text-red-600 border-red-200 hover:bg-red-50">
                                                                <RefreshCw className={cn("mr-2 h-4 w-4", isRetryingEnergy && "animate-spin")} />
                                                                Retry Estimation
                                                            </Button>
                                                            <a href="mailto:support@solarepc-pro.com" className="text-xs text-slate-400 hover:underline flex items-center px-4">Contact Support</a>
                                                        </div>
                                                    </div>
                                                ) : isEnergyCalculating ? (
                                                    <div className="h-[300px] w-full flex flex-col items-center justify-center text-amber-600 gap-4">
                                                        <div className="relative">
                                                            <Loader2 className={cn("h-12 w-12 animate-spin", pollingTimedOut && "animate-none opacity-40")} />
                                                            <Activity className="h-6 w-6 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-50" />
                                                        </div>
                                                        <div className="text-center">
                                                            <p className="font-semibold text-lg">
                                                                {pollingTimedOut ? "Polling Paused" : "Generating Production Profile"}
                                                            </p>
                                                            <p className="text-slate-400 text-sm">
                                                                {pollingTimedOut
                                                                    ? "The calculation is taking longer than expected."
                                                                    : "Querying NREL PVWatts® for meteorological data..."}
                                                            </p>
                                                        </div>
                                                        {pollingTimedOut && (
                                                            <div className="flex gap-2">
                                                                <Button variant="outline" size="sm" onClick={() => {
                                                                    setPollingTimedOut(false);
                                                                    setCalcStartTime(Date.now());
                                                                    refetchEnergy();
                                                                }}>
                                                                    <RefreshCw className="mr-2 h-4 w-4" />
                                                                    Check Status
                                                                </Button>
                                                                <Button variant="ghost" size="sm" onClick={() => window.location.reload()}>
                                                                    Refresh Page
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : monthlyChartData.length > 0 ? (
                                                    <div className="space-y-4">
                                                        {monthlyChartData.length < 12 && (
                                                            <div className="bg-amber-50 text-amber-700 text-xs px-2 py-1 rounded flex items-center gap-2">
                                                                <AlertTriangle className="h-3 w-3" /> Incomplete monthly data
                                                            </div>
                                                        )}
                                                        <div className="h-[300px] w-full">
                                                            <ResponsiveContainer width="100%" height="100%">
                                                                <BarChart data={monthlyChartData}>
                                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
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
                                                                        cursor={{ fill: '#f8fafc' }}
                                                                        contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                                                        formatter={(value: any) => [`${typeof value === 'number' ? value.toFixed(2) : value} MWh`, 'Energy']}
                                                                    />
                                                                    <Bar
                                                                        dataKey="energy_mwh"
                                                                        fill="#3b82f6"
                                                                        radius={[6, 6, 0, 0]}
                                                                        animationDuration={1500}
                                                                    />
                                                                </BarChart>
                                                            </ResponsiveContainer>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="h-[300px] w-full flex flex-col items-center justify-center text-slate-400 gap-2 border-2 border-dashed rounded-lg bg-slate-50/50">
                                                        <Sun className="h-8 w-8 opacity-50" />
                                                        <p>Production data will appear here.</p>
                                                    </div>
                                                )}

                                                <div className="mt-6 flex items-center justify-between text-xs text-slate-400 border-t pt-4">
                                                    <div>Last calculated: {energyData?.calculated_at ? new Date(energyData.calculated_at).toLocaleString() : 'Never'}</div>
                                                    <div>Powered by <a href="https://pvwatts.nrel.gov/" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-800 font-medium">NREL PVWatts®</a></div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </TabsContent>

                                    {/* Financial Metrics Tab */}
                                    <TabsContent value="financial" className="space-y-6 outline-none">
                                        <div className="grid gap-4 md:grid-cols-2">
                                            <MetricCard
                                                title="Estimated System Cost"
                                                value={financialData ? formatCurrency(financialData.system_cost_usd) : "—"}
                                                icon={DollarSign}
                                                isLoading={isFinancialLoading && !financialData}
                                            />
                                            <MetricCard
                                                title="Projected Annual Savings"
                                                value={financialData ? `${formatCurrency(financialData.annual_savings_usd)}/yr` : "—"}
                                                icon={TrendingUp}
                                                isLoading={isFinancialLoading && !financialData}
                                            />
                                            <MetricCard
                                                title="Simple Payback"
                                                value={financialData ? financialData.simple_payback_years.toFixed(1) : "—"}
                                                suffix="years"
                                                icon={Calendar}
                                                isLoading={isFinancialLoading && !financialData}
                                            />
                                            <MetricCard
                                                title="Return on Investment (ROI)"
                                                value={financialData ? formatPercentage(financialData.roi_pct) : "—"}
                                                icon={Percent}
                                                isLoading={isFinancialLoading && !financialData}
                                            />
                                        </div>

                                        {financialData ? (
                                            <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
                                                <div className="bg-slate-50 px-4 py-2 border-b flex items-center justify-between">
                                                    <h4 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                                                        <AlertCircle className="h-3 w-3 text-slate-400" />
                                                        Calculation Assumptions
                                                    </h4>
                                                </div>
                                                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                                                    <div className="flex justify-between items-center border-b border-dashed pb-2">
                                                        <span className="text-sm text-slate-500">Retail Electricity Rate</span>
                                                        <span className="font-semibold tabular-nums">{formatRate(financialData.electricity_rate_usd_per_kwh)}/kWh</span>
                                                    </div>
                                                    <div className="flex justify-between items-center border-b border-dashed pb-2">
                                                        <span className="text-sm text-slate-500">Annual Escalation Rate</span>
                                                        <span className="font-semibold tabular-nums">{formatPercentage(financialData.annual_rate_escalation_pct)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : !isFinancialLoading && (
                                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 text-center">
                                                <DollarSign className="h-10 w-10 text-blue-500/50 mx-auto mb-3" />
                                                <h4 className="font-semibold text-blue-900">Financial Analysis Unavailable</h4>
                                                <p className="text-blue-700 text-sm mt-1 max-w-sm mx-auto">Complete the Bill of Quantities (BOQ) in the project settings to enable detailed financial projections.</p>
                                                <Button variant="outline" size="sm" className="mt-4 border-blue-200 text-blue-700 hover:bg-blue-100">Open BOQ Editor</Button>
                                            </div>
                                        )}
                                    </TabsContent>
                                </Tabs>
                            )}
                        </div>
                    </div>
                </SheetContent>
            </Sheet>

            {/* Collapsed Summary Bar */}
            {!isExpanded && (
                <div
                    className={cn(
                        "fixed bottom-0 left-0 right-0 z-30 transition-all duration-300 pointer-events-none",
                        rightPanelOpen ? "md:mr-[320px]" : "mr-0"
                    )}
                >
                    <div className={cn(
                        "bg-white/95 backdrop-blur-md border-t shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)] px-6 py-4 pointer-events-auto transition-colors duration-500",
                        isEnergyCalculating && "bg-amber-50/90",
                        isEnergyFailed && "bg-red-50/90"
                    )}>
                        <div className="flex flex-col md:flex-row items-center justify-between gap-4 max-w-screen-2xl mx-auto">
                            <div className="flex-1 w-full" aria-live="polite" aria-busy={isEnergyCalculating}>
                                {!hasModules ? (
                                    <div className="flex items-center gap-3 text-slate-500">
                                        <div className="p-2 bg-slate-100 rounded-full">
                                            <MapPin className="h-4 w-4" />
                                        </div>
                                        <span className="font-medium">Design is empty. Place modules to see results.</span>
                                    </div>
                                ) : summaryContent}
                            </div>

                            <Button
                                variant={isEnergyFailed ? "destructive" : (isEnergyCalculating ? "secondary" : "outline")}
                                size="sm"
                                onClick={() => setIsExpanded(true)}
                                disabled={!hasModules && !isDesignLoading}
                                className={cn(
                                    "whitespace-nowrap w-full md:w-auto mt-2 md:mt-0 font-bold transition-all",
                                    !hasModules && "opacity-50 cursor-not-allowed"
                                )}
                            >
                                {buttonLabel}
                                {isEnergyCalculating ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <ChevronUp className="ml-2 h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

// Utility Alert Component for missing data
function Alert({ children, variant = "warning", className }: any) {
    const variants: any = {
        warning: "bg-amber-50 text-amber-900 border-amber-200",
        error: "bg-red-50 text-red-900 border-red-200"
    };
    return (
        <div className={cn("flex gap-3 p-4 rounded-lg border", variants[variant], className)}>
            {children}
        </div>
    );
}

function AlertTitle({ children }: any) {
    return <h5 className="font-bold text-sm">{children}</h5>;
}

function AlertDescription({ children }: any) {
    return <p className="text-sm opacity-90 leading-relaxed">{children}</p>;
}
