import {useOutletContext, useNavigate, useParams} from "react-router";
import {useEffect, useRef, useState} from "react";
import {generate3DView} from "../../lib/ai.action";
import {Box, Download, RefreshCcw, Save, Share2, Trash2, X} from "lucide-react";
import Button from "../../components/ui/Button";
import {deleteProject, getProjectById, shareProject, unshareProject, updateProjectName, updateProjectRender} from "../../lib/puter.action";
import {ReactCompareSlider, ReactCompareSliderImage} from "react-compare-slider";

const VisualizerId = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { userId } = useOutletContext<AuthContext>();

    const hasInitialGenerated = useRef(false);

    const [project, setProject] = useState<DesignItem | null>(null);
    const [isProjectLoading, setIsProjectLoading] = useState(true);

    const [isProcessing, setIsProcessing] = useState(false);
    const [currentImage, setCurrentImage] = useState<string | null>(null);
    const [generationError, setGenerationError] = useState<string | null>(null);
    const [editedName, setEditedName] = useState("");
    const [isSavingName, setIsSavingName] = useState(false);
    const canManage = !!project?.ownerId && !!userId && project.ownerId === userId;

    const handleBack = () => navigate('/');
    const handleExport = () => {
        if (!currentImage) return;

        const link = document.createElement('a');
        link.href = currentImage;
        link.download = `archify-ai-${id || 'design'}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    const handleShareToggle = async () => {
        if (!project?.id) return;

        const next = project.isPublic
            ? await unshareProject(project.id)
            : await shareProject(project.id);

        if (!next) return;

        setProject(next);

        if (next.isPublic && typeof window !== "undefined") {
            const shareUrl = `${window.location.origin}/visualizer/${next.id}`;
            try {
                await navigator.clipboard.writeText(shareUrl);
                window.alert("Share link copied to clipboard");
            } catch {
                window.alert(`Share URL: ${shareUrl}`);
            }
        }
    };

    const handleDelete = async () => {
        if (!project?.id) return;

        const confirmed = window.confirm("Delete this project permanently?");
        if (!confirmed) return;

        const deleted = await deleteProject(project.id);
        if (deleted) {
            navigate("/");
        }
    };

    const handleSaveName = async (nameOverride?: string) => {
        if (!project?.id || !canManage) return;

        const nextName = (nameOverride ?? editedName).trim();
        if (!nextName) return;
        if ((project.name || "").trim() === nextName) return;

        try {
            setIsSavingName(true);
            const updated = await updateProjectName({
                projectId: project.id,
                name: nextName,
            });

            if (updated) {
                setProject(updated);
                setEditedName(updated.name || "");
            }
        } finally {
            setIsSavingName(false);
        }
    };

    const runGeneration = async (item: DesignItem) => {
        if(!id || !item.sourceImage) return;

        try {
            setIsProcessing(true);
            setGenerationError(null);
            const result = await generate3DView({ sourceImage: item.sourceImage });

            if(result.renderedImage) {
                setCurrentImage(result.renderedImage);

                const saved = await updateProjectRender({
                    projectId: item.id,
                    renderedImage: result.renderedImage,
                    renderedPath: result.renderedPath,
                });

                if(saved) {
                    setProject(saved);
                    setCurrentImage(saved.renderedImage || result.renderedImage);
                }
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : "Rendering failed. Please try again.";
            setGenerationError(message);
            console.error('Generation failed: ', error)
        } finally {
            setIsProcessing(false);
        }
    }

    useEffect(() => {
        let isMounted = true;

        const loadProject = async () => {
            if (!id) {
                setIsProjectLoading(false);
                return;
            }

            setIsProjectLoading(true);

            const fetchedProject = await getProjectById({ id });

            if (!isMounted) return;

            setProject(fetchedProject);
            setCurrentImage(fetchedProject?.renderedImage || null);
            setEditedName(fetchedProject?.name || "");
            setIsProjectLoading(false);
            hasInitialGenerated.current = false;
        };

        loadProject();

        return () => {
            isMounted = false;
        };
    }, [id]);

    useEffect(() => {
        if (
            isProjectLoading ||
            hasInitialGenerated.current ||
            !project?.sourceImage ||
            !canManage
        )
            return;

        if (project.renderedImage) {
            setCurrentImage(project.renderedImage);
            hasInitialGenerated.current = true;
            return;
        }

        hasInitialGenerated.current = true;
        void runGeneration(project);
    }, [project, isProjectLoading, canManage]);

    return (
        <div className="visualizer">
            <nav className="topbar">
                <div className="brand">
                    <Box className="logo" />

                    <span className="name">Archify AI</span>
                </div>
                <Button variant="ghost" size="sm" onClick={handleBack} className="exit">
                    <X className="icon" /> Exit Editor
                </Button>
            </nav>

            <section className="content">
                <div className="panel">
                    <div className="panel-header">
                        <div className="panel-meta">
                            <p>Project</p>
                            {canManage ? (
                                <div className="name-editor">
                                    <input
                                        value={editedName}
                                        onChange={(event) => setEditedName(event.target.value)}
                                        onBlur={(event) => {
                                            void handleSaveName(event.target.value);
                                        }}
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter") {
                                                event.preventDefault();
                                                void handleSaveName((event.target as HTMLInputElement).value);
                                            }
                                        }}
                                        placeholder={`Residence ${id}`}
                                        maxLength={120}
                                    />
                                </div>
                            ) : (
                                <h2>{project?.name || `Residence ${id}`}</h2>
                            )}
                            <p className="note">
                                {canManage ? "Owner view" : project?.isPublic ? "Public shared view" : "Viewer mode"}
                            </p>
                        </div>

                        <div className="panel-actions">
                            <Button
                                size="sm"
                                onClick={handleExport}
                                className="export"
                                disabled={!currentImage}
                            >
                                <Download className="w-4 h-4 mr-2" /> Export
                            </Button>
                            {canManage && (
                                <>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                            void handleSaveName();
                                        }}
                                        disabled={isSavingName || !editedName.trim() || editedName.trim() === (project?.name || "").trim()}
                                    >
                                        <Save className="w-4 h-4 mr-2" />
                                        {isSavingName ? "Saving..." : "Save Name"}
                                    </Button>
                                    <Button size="sm" onClick={handleShareToggle} className="share" disabled={!project}>
                                        <Share2 className="w-4 h-4 mr-2" />
                                        {project?.isPublic ? "Unshare" : "Share"}
                                    </Button>
                                    <Button size="sm" onClick={handleDelete} variant="outline" disabled={!project}>
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Delete
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>

                    <div className={`render-area ${isProcessing ? 'is-processing': ''}`}>
                        {generationError && (
                            <div className="render-error" role="alert" aria-live="polite">
                                {generationError}
                            </div>
                        )}

                        {currentImage ? (
                            <img src={currentImage} alt="AI Render" className="render-img" />
                        ) : (
                            <div className="render-placeholder">
                                {project?.sourceImage && (
                                    <img src={project?.sourceImage} alt="Original" className="render-fallback" />
                                )}
                            </div>
                        )}

                        {isProcessing && (
                            <div className="render-overlay">
                                <div className="rendering-card">
                                    <RefreshCcw className="spinner" />
                                    <span className="title">Rendering...</span>
                                    <span className="subtitle">Generating your 3D visualization</span>
                                </div>
                            </div>
                        )}
                    </div>

                </div>

                <div className="panel compare">
                    <div className="panel-header">
                        <div className="panel-meta">
                            <p>Comparison</p>
                            <h3>Before and After</h3>
                        </div>
                        <div className="hint">Drag to compare</div>
                    </div>

                    <div className="compare-stage">
                        {project?.sourceImage && currentImage ? (
                            <ReactCompareSlider
                                defaultValue={50}
                                style={{ width: '100%', height: 'auto' }}
                                itemOne={
                                    <ReactCompareSliderImage src={project?.sourceImage} alt="before" className="compare-img" />
                                }
                                itemTwo={
                                    <ReactCompareSliderImage src={currentImage ?? project?.renderedImage ?? undefined} alt="after" className="compare-img" />
                                }
                            />
                        ) : (
                            <div className="compare-fallback">
                                {project?.sourceImage && (
                                    <img src={project.sourceImage} alt="Before" className="compare-img" />
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </section>
        </div>
    )
}
export default VisualizerId
