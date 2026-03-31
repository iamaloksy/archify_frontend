import {useEffect, useMemo, useState} from "react";
import {BarChart3, RefreshCcw, Sparkles} from "lucide-react";
import {useNavigate, useOutletContext} from "react-router";
import Navbar from "../../components/Navbar";
import Button from "../../components/ui/Button";
import {getAiUsageSummary} from "../../lib/puter.action";

const formatNumber = (value: number) =>
    new Intl.NumberFormat("en-US", {maximumFractionDigits: 2}).format(value);

const Dashboard = () => {
    const navigate = useNavigate();
    const {isSignedIn, signIn, userName} = useOutletContext<AuthContext>();

    const [usage, setUsage] = useState<AiUsageSummary | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const progress = useMemo(() => {
        if (!usage || usage.monthlyLimit <= 0) return 0;
        return Math.min(100, Math.max(0, (usage.used / usage.monthlyLimit) * 100));
    }, [usage]);

    const loadUsage = async () => {
        if (!isSignedIn) {
            setUsage(null);
            return;
        }

        try {
            setIsLoading(true);
            setError(null);
            const summary = await getAiUsageSummary();
            setUsage(summary);
        } catch (loadError) {
            const message = loadError instanceof Error ? loadError.message : "Unable to load usage right now.";
            setError(message);
            setUsage(null);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void loadUsage();
    }, [isSignedIn]);

    return (
        <div className="home">
            <Navbar />

            <section className="dashboard">
                <div className="dashboard-head">
                    <div>
                        <p className="eyebrow">Account Insights</p>
                        <h1>AI Usage Dashboard</h1>
                        <p className="subtitle">
                            {userName ? `${userName}` : "Track your monthly AI usage and limits."}
                        </p>
                    </div>

                    <div className="dashboard-actions">
                        <Button variant="outline" onClick={() => navigate("/")}>Back Home</Button>
                        {isSignedIn && (
                            <Button onClick={() => void loadUsage()} disabled={isLoading}>
                                <RefreshCcw size={14} className={isLoading ? "spin" : ""} />
                                {isLoading ? "Refreshing..." : "Refresh"}
                            </Button>
                        )}
                    </div>
                </div>

                {!isSignedIn ? (
                    <div className="dashboard-empty">
                        <Sparkles size={18} />
                        <p>Please sign in to view your AI limit and usage.</p>
                        <Button
                            onClick={async () => {
                                const ok = await signIn();
                                if (ok) {
                                    await loadUsage();
                                }
                            }}
                        >
                            Sign in with Puter
                        </Button>
                    </div>
                ) : error ? (
                    <div className="dashboard-empty">
                        <p>{error}</p>
                        <Button onClick={() => void loadUsage()}>Try Again</Button>
                    </div>
                ) : (
                    <>
                        <div className="usage-grid">
                            <div className="usage-card">
                                <p className="label">Monthly Limit</p>
                                <h3>{usage ? formatNumber(usage.monthlyLimit) : "-"}</h3>
                            </div>
                            <div className="usage-card">
                                <p className="label">Used</p>
                                <h3>{usage ? formatNumber(usage.used) : "-"}</h3>
                            </div>
                            <div className="usage-card">
                                <p className="label">Remaining</p>
                                <h3>{usage ? formatNumber(usage.remaining) : "-"}</h3>
                            </div>
                        </div>

                        <div className="usage-progress">
                            <div className="usage-progress-head">
                                <p>Usage Progress</p>
                                <span>{formatNumber(progress)}%</span>
                            </div>
                            <div className="track">
                                <div className="fill" style={{width: `${progress}%`}} />
                            </div>
                        </div>

                        <div className="usage-breakdown">
                            <div className="title-row">
                                <BarChart3 size={16} />
                                <h3>API Usage Breakdown</h3>
                            </div>

                            {isLoading ? (
                                <p className="muted">Loading usage...</p>
                            ) : usage && usage.usage.length > 0 ? (
                                <div className="usage-table">
                                    <div className="usage-row usage-row--head">
                                        <span>API</span>
                                        <span>Count</span>
                                        <span>Units</span>
                                        <span>Cost</span>
                                    </div>
                                    {usage.usage.map((item) => (
                                        <div className="usage-row" key={item.key}>
                                            <span>{item.key}</span>
                                            <span>{formatNumber(item.count)}</span>
                                            <span>{formatNumber(item.units)}</span>
                                            <span>{formatNumber(item.cost)}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="muted">No usage recorded yet for this month.</p>
                            )}
                        </div>
                    </>
                )}
            </section>
        </div>
    );
};

export default Dashboard;
