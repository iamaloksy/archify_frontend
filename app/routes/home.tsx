import type { Route } from "./+types/home";
import Navbar from "../../components/Navbar";
import {ArrowRight, ArrowUpRight, Clock, Layers, Search} from "lucide-react";
import Button from "../../components/ui/Button";
import Upload from "../../components/Upload";
import {useOutletContext, useNavigate} from "react-router";
import {useEffect, useRef, useState} from "react";
import {createProject, getProjects} from "../../lib/puter.action";

export function meta({}: Route.MetaArgs) {
  return [
        { title: "Archify AI" },
        { name: "description", content: "Archify AI helps you generate stunning 3D visualizations from floor plans." },
  ];
}

export default function Home() {
    const navigate = useNavigate();
    const { isSignedIn } = useOutletContext<AuthContext>();
    const [projects, setProjects] = useState<DesignItem[]>([]);
    const [query, setQuery] = useState("");
    const [page, setPage] = useState(0);
    const [hasNext, setHasNext] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const isCreatingProjectRef = useRef(false);

    const handleUploadComplete = async (base64Image: string) => {
        try {

            if(isCreatingProjectRef.current) return false;
            isCreatingProjectRef.current = true;
            const newId = Date.now().toString();
            const name = `Residence ${newId}`;

            const newItem = {
                id: newId, name, sourceImage: base64Image,
                renderedImage: undefined,
                timestamp: Date.now()
            }

            const saved = await createProject({ item: newItem, visibility: 'private' });

            if(!saved) {
                console.error("Failed to create project");
                window.alert("Project save failed. Please check backend connection and try again.");
                return false;
            }

            setProjects((prev) => [saved, ...prev]);

            navigate(`/visualizer/${saved.id}`, {
                state: {
                    initialImage: saved.sourceImage,
                    initialRendered: saved.renderedImage || null,
                    name
                }
            });

            return true;
        } finally {
            isCreatingProjectRef.current = false;
        }
    }

    const fetchProjects = async (nextPage: number, append: boolean) => {
        setIsLoading(true);
        const result = await getProjects({ page: nextPage, size: 12, q: query });

        setHasNext(result.hasNext);
        setPage(result.page);
        setProjects((prev) => append ? [...prev, ...result.items] : result.items);
        setIsLoading(false);
    };

    useEffect(() => {
        if (!isSignedIn) {
            setProjects([]);
            setHasNext(false);
            return;
        }

        const timer = setTimeout(() => {
            void fetchProjects(0, false);
        }, 250);

        return () => clearTimeout(timer);
    }, [query, isSignedIn]);

  return (
      <div className="home">
          <Navbar />

          <section className="hero">
              <div className="announce">
                  <div className="dot">
                      <div className="pulse"></div>
                  </div>

                  <p>Introducing Archify AI</p>
              </div>

              <h1>Build beautiful spaces at the speed of thought with Archify AI</h1>

              <p className="subtitle">
                  Archify AI is an AI-first design environment that helps you visualize, render, and ship architectural projects faster than ever.
              </p>

              <div className="actions">
                  <a href="#upload" className="cta">
                      Start Building <ArrowRight className="icon" />
                  </a>
              </div>

              <div id="upload" className="upload-shell">
                <div className="grid-overlay" />

                  <div className="upload-card">
                      <div className="upload-head">
                          <div className="upload-icon">
                              <Layers className="icon" />
                          </div>

                          <h3>Upload your floor plan</h3>
                          <p>Supports JPG, PNG, formats up to 10MB</p>
                      </div>

                      <Upload onComplete={handleUploadComplete} />
                  </div>
              </div>
          </section>

          <section className="projects">
              <div className="section-inner">
                  <div className="section-head">
                      <div className="copy">
                          <h2>Projects</h2>
                          <p>Your latest work and shared community projects, all in one place.</p>
                      </div>
                      <div className="search-shell" style={{ position: "relative", minWidth: 240 }}>
                          <Search size={14} style={{ position: "absolute", left: 10, top: 11, color: "#71717a" }} />
                          <input
                              value={query}
                              onChange={(event) => setQuery(event.target.value)}
                              placeholder="Search by project name"
                              style={{
                                  height: 36,
                                  border: "1px solid #e4e4e7",
                                  borderRadius: 8,
                                  paddingLeft: 30,
                                  paddingRight: 10,
                                  fontSize: 13,
                                  width: "100%",
                              }}
                          />
                      </div>
                  </div>

                  <div className="projects-grid">
                      {projects.map(({id, name, renderedImage, sourceImage, thumbnail, timestamp, isPublic}) => (
                          <div key={id} className="project-card group" onClick={() => navigate(`/visualizer/${id}`)}>
                              <div className="preview">
                                  <img  src={thumbnail || renderedImage || sourceImage} alt="Project"
                                  />

                                  <div className="badge">
                                      <span>{isPublic ? "Shared" : "Private"}</span>
                                  </div>
                              </div>

                              <div className="card-body">
                                  <div>
                                      <h3>{name}</h3>

                                      <div className="meta">
                                          <Clock size={12} />
                                          <span>{new Date(timestamp).toLocaleDateString()}</span>
                                          <span>By You</span>
                                      </div>
                                  </div>
                                  <div className="arrow" style={{ display: "flex", gap: 10 }}>
                                      <ArrowUpRight size={18} />
                                  </div>
                              </div>
                          </div>
                      ))}
                  </div>

                  {hasNext && (
                      <div style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>
                          <Button
                              variant="outline"
                              onClick={() => void fetchProjects(page + 1, true)}
                              disabled={isLoading}
                          >
                              {isLoading ? "Loading..." : "Load more"}
                          </Button>
                      </div>
                  )}
              </div>
          </section>
      </div>
  )
}
