const USER_ID_STORAGE_KEY = "archify-ai.user-id";
const USERNAME_STORAGE_KEY = "archify-ai.username";
export const FORCE_INTERACTIVE_SIGNIN_KEY = "archify-ai.force-interactive-signin";

const API_BASE_URL = "http://localhost:8080";

const clearStoredAuthState = () => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(USER_ID_STORAGE_KEY);
    window.localStorage.removeItem(USERNAME_STORAGE_KEY);
};

const loadPuter = async () => {
    const mod = await import("@heyputer/puter.js");
    return mod.default;
};

const resolvePuterUser = async (puter: any) => {
    try {
        return await puter.auth.whoami();
    } catch {
        return await puter.auth.getUser();
    }
};

const shouldForceInteractiveSignIn = () => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(FORCE_INTERACTIVE_SIGNIN_KEY) === "1";
};

const synchronizeBackendLogin = async (puterUuid: string, username: string) => {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ puterUuid, username })
    });

    if (!response.ok) {
        let serverMessage = "";
        try {
            const body = await response.json();
            if (body?.message) {
                serverMessage = String(body.message);
            }
        } catch {
            try {
                serverMessage = (await response.text()).trim();
            } catch {
                serverMessage = "";
            }
        }

        const reason = serverMessage ? `: ${serverMessage}` : "";
        throw new Error(`Backend login synchronization failed (${response.status})${reason}`);
    }

    return response.json();
};

export const signIn = async () => {
    try {
        const puter = await loadPuter();

        const forceInteractiveSignIn = shouldForceInteractiveSignIn();

        // If account switching was requested, sign out first to force Puter account chooser.
        if (forceInteractiveSignIn && puter.auth.isSignedIn()) {
            try {
                await puter.auth.signOut();
            } catch {
                // Ignore sign-out failures and still try interactive sign-in.
            }
        }

        if (forceInteractiveSignIn || !puter.auth.isSignedIn()) {
            await puter.auth.signIn();
        }

        const user = await resolvePuterUser(puter);
        const puterUuid = user?.uuid;
        const username = user?.username || "Puter User";

        if (!puterUuid) {
            throw new Error("Puter authentication failed to return a UUID");
        }

        let data: { id: string; username: string };
        try {
            data = await synchronizeBackendLogin(puterUuid, username);
        } catch (syncError) {
            // Keep Puter login usable even when backend sync is temporarily unavailable.
            console.warn("Backend login synchronization skipped:", syncError);
            data = { id: puterUuid, username };
        }

        if (typeof window !== "undefined") {
            window.localStorage.removeItem(FORCE_INTERACTIVE_SIGNIN_KEY);
            window.localStorage.setItem(USER_ID_STORAGE_KEY, data.id); // Matches puterUuid
            window.localStorage.setItem(USERNAME_STORAGE_KEY, data.username);
        }

        return { id: data.id, username: data.username };
    } catch (error) {
        console.error("Sign-in failed:", error);
        throw error;
    }
};

export const signUp = async () => signIn();

export const signOut = async () => {
    try {
        const puter = await loadPuter();
        await puter.auth.signOut();
    } catch {
        // Ignore SDK failures during sign out
    }

    if (typeof window !== "undefined") {
        clearStoredAuthState();
        window.localStorage.setItem(FORCE_INTERACTIVE_SIGNIN_KEY, "1");
    }
};

export const getCurrentUser = async () => {
    if (typeof window === "undefined") return null;

    // To prevent Puter.js from crashing or triggering websocket errors on initial page mount (401/400 errors),
    // we strictly read from local storage rather than initializing `loadPuter()` universally.
    const userId = window.localStorage.getItem(USER_ID_STORAGE_KEY);
    const username = window.localStorage.getItem(USERNAME_STORAGE_KEY);
    
    if (!userId) return null;

    return { id: userId, username: username || "User" };
};

export const getAiUsageSummary = async (): Promise<AiUsageSummary> => {
    try {
        const puter = await loadPuter();
        const monthlyUsage = await puter.auth.getMonthlyUsage();

        const monthlyLimit = Number(monthlyUsage?.allowanceInfo?.monthUsageAllowance ?? 0);
        const remaining = Number(monthlyUsage?.allowanceInfo?.remaining ?? 0);
        const used = Math.max(monthlyLimit - remaining, 0);

        const usage = Object.entries(monthlyUsage?.usage ?? {})
            .map(([key, value]) => {
                const metric = value as { count?: number; units?: number; cost?: number };
                return {
                    key,
                    count: Number(metric?.count ?? 0),
                    units: Number(metric?.units ?? 0),
                    cost: Number(metric?.cost ?? 0),
                };
            })
            .sort((a, b) => b.units - a.units);

        return { monthlyLimit, remaining, used, usage };
    } catch {
        return { monthlyLimit: 100, remaining: 100, used: 0, usage: [] };
    }
};

const apiRequest = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
    const userId = typeof window !== "undefined" ? window.localStorage.getItem(USER_ID_STORAGE_KEY) : null;
    
    const headers = new Headers(options.headers);
    headers.set("Content-Type", "application/json");
    if (userId) {
        headers.set("x-user-id", userId);
    }

    const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
    if (!response.ok) throw new Error("Backend request failed");
    if (response.status === 204) return null as T;
    return response.json();
};

export const createProject = async ({ item, visibility = "private" }: CreateProjectParams): Promise<DesignItem | null> => {
    return apiRequest<DesignItem>("/api/projects", {
        method: "POST",
        body: JSON.stringify({
            name: item.name,
            sourceImage: item.sourceImage,
            thumbnail: item.sourceImage,
            isPublic: visibility === "public"
        })
    }).catch(e => { console.error(e); return null; });
};

export const updateProjectRender = async ({ projectId, renderedImage, renderedPath }: { projectId: string; renderedImage: string; renderedPath?: string; }): Promise<DesignItem | null> => {
    return apiRequest<DesignItem>(`/api/projects/${projectId}/render`, {
        method: "PATCH",
        body: JSON.stringify({ renderedImage, renderedPath, thumbnail: renderedImage })
    }).catch(e => { console.error(e); return null; });
};

export const updateProjectName = async ({ projectId, name }: { projectId: string; name: string; }): Promise<DesignItem | null> => {
    return apiRequest<DesignItem>(`/api/projects/${projectId}/name`, {
        method: "PATCH",
        body: JSON.stringify({ name })
    }).catch(e => { console.error(e); return null; });
};

export const shareProject = async (projectId: string): Promise<DesignItem | null> => {
    return apiRequest<DesignItem>(`/api/projects/${projectId}/share`, { method: "POST" }).catch(() => null);
};

export const unshareProject = async (projectId: string): Promise<DesignItem | null> => {
    return apiRequest<DesignItem>(`/api/projects/${projectId}/unshare`, { method: "POST" }).catch(() => null);
};

export const deleteProject = async (projectId: string): Promise<boolean> => {
    return apiRequest<null>(`/api/projects/${projectId}`, { method: "DELETE" }).then(() => true).catch(() => false);
};

export const getProjects = async ({ page = 0, size = 12, q = "" }: { page?: number; size?: number; q?: string } = {}): Promise<ProjectsPageResult> => {
    if (typeof window === "undefined" || !window.localStorage.getItem(USER_ID_STORAGE_KEY)) {
        return { items: [], page: 0, size, total: 0, hasNext: false };
    }
    return apiRequest<ProjectsPageResult>(`/api/projects?page=${page}&size=${size}&q=${q}`).catch(() => ({ items: [], page: 0, size: 12, total: 0, hasNext: false }));
};

export const getProjectById = async ({ id }: { id: string }): Promise<DesignItem | null> => {
    return apiRequest<DesignItem>(`/api/projects/${id}`).catch(() => null);
};
