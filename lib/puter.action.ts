const AUTH_STORAGE_KEY = "archify-ai.auth.token";
const USER_ID_STORAGE_KEY = "archify-ai.user-id";
const USERNAME_STORAGE_KEY = "archify-ai.username";
const PROD_API_BASE_URL = "https://archify-backend-40tl.onrender.com";

const resolveApiBaseUrl = () => {
    const configured = import.meta.env.VITE_API_BASE_URL;
    if (configured) return configured;

    if (typeof window !== "undefined") {
        const host = window.location.hostname;
        if (host === "localhost" || host === "127.0.0.1") {
            return "http://localhost:8080";
        }
    }

    return PROD_API_BASE_URL;
};

const API_BASE_URL = resolveApiBaseUrl();

type ApiUser = {
    id: string;
    username: string;
    email: string;
};

type AuthResponse = {
    token: string;
    user: ApiUser;
};

type ApiProject = {
    id: string;
    name?: string | null;
    thumbnail?: string | null;
    sourceImage: string;
    renderedImage?: string | null;
    renderedPath?: string | null;
    ownerId: string;
    timestamp: number;
    isPublic: boolean;
};

type ApiProjectsPage = {
    items: ApiProject[];
    page: number;
    size: number;
    total: number;
    hasNext: boolean;
};

const readAuthToken = () => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(AUTH_STORAGE_KEY);
};

const readUserId = () => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(USER_ID_STORAGE_KEY);
};

const loadPuter = async () => {
    const mod = await import("@heyputer/puter.js");
    return mod.default;
};

const isUnknownSessionError = (error: unknown) => {
    if (!error) return false;
    const message = error instanceof Error ? error.message : String(error);
    return message.toLowerCase().includes("session id unknown");
};

const resolvePuterUser = async (puter: any) => {
    try {
        return await puter.auth.whoami();
    } catch {
        return await puter.auth.getUser();
    }
};

const writeAuthToken = (token: string | null) => {
    if (typeof window === "undefined") return;
    if (token) {
        window.localStorage.setItem(AUTH_STORAGE_KEY, token);
        return;
    }
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
};

const mapUser = (user: ApiUser | null) => {
    if (!user) return null;
    return {
        id: user.id,
        username: user.username,
    };
};

const mapProject = (project: ApiProject): DesignItem => ({
    id: project.id,
    name: project.name,
    thumbnail: project.thumbnail,
    sourceImage: project.sourceImage,
    renderedImage: project.renderedImage,
    renderedPath: project.renderedPath,
    ownerId: project.ownerId,
    timestamp: project.timestamp,
    isPublic: project.isPublic,
});

const apiRequest = async <T>(
    path: string,
    options: RequestInit = {},
    useAuth = true
): Promise<T> => {
    const token = readAuthToken();
    const userId = readUserId();
    
    const headers = new Headers(options.headers);
    headers.set("Content-Type", "application/json");

    if (useAuth && token) {
        headers.set("Authorization", `Bearer ${token}`);
    }
    
    // Send userId as header for Puter-based auth
    if (useAuth && userId) {
        headers.set("X-User-Id", userId);
    }

    let response: Response;
    try {
        response = await fetch(`${API_BASE_URL}${path}`, {
            ...options,
            headers,
        });
    } catch {
        throw new Error(`Cannot reach backend at ${API_BASE_URL}`);
    }

    if (!response.ok) {
        if (response.status === 401) {
            writeAuthToken(null);
            if (typeof window !== "undefined") {
                window.localStorage.removeItem(USER_ID_STORAGE_KEY);
                window.localStorage.removeItem(USERNAME_STORAGE_KEY);
            }
        }

        let message = "Request failed";
        try {
            const payload = await response.json();
            message = payload?.message || payload?.error || message;
        } catch {
            // Ignore JSON parsing failures and fallback to default message.
        }

        throw new Error(message);
    }

    if (response.status === 204) {
        return null as T;
    }

    return (await response.json()) as T;
};

const toThumbnail = async (image: string, maxSize = 280): Promise<string | null> => {
    if (typeof window === "undefined" || !image?.startsWith("data:")) return null;

    return await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
            const width = Math.max(1, Math.floor(img.width * ratio));
            const height = Math.max(1, Math.floor(img.height * ratio));

            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext("2d");
            if (!ctx) {
                resolve(null);
                return;
            }

            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL("image/jpeg", 0.75));
        };

        img.onerror = () => resolve(null);
        img.src = image;
    });
};

export const signIn = async () => {
    try {
        const puter = await loadPuter();
        let user: { uuid?: string; username?: string } | null = null;

        try {
            await puter.auth.signIn();
            user = await resolvePuterUser(puter);
        } catch (error) {
            if (!isUnknownSessionError(error)) {
                throw error;
            }

            try {
                await puter.auth.signOut();
            } catch {
                // Ignore sign-out failures and continue with a fresh sign-in.
            }

            await puter.auth.signIn();
            user = await resolvePuterUser(puter);
        }

        const puterUuid = user?.uuid;
        const username = user?.username || "Puter User";

        if (!puterUuid) {
            throw new Error("Puter authentication did not return a UUID");
        }
        
        const response = await apiRequest<{ userId: string; username: string; puterUuid: string }>(
            "/api/auth/puter-signin",
            {
                method: "POST",
                body: JSON.stringify({ 
                    puterUuid,
                    username,
                }),
            },
            false
        );

        if (typeof window !== "undefined") {
            window.localStorage.setItem(USER_ID_STORAGE_KEY, response.userId);
            window.localStorage.setItem(USERNAME_STORAGE_KEY, response.username);
        }

        return { id: response.userId, username: response.username };
    } catch (error) {
        console.error("Puter sign-in failed:", error);
        throw error;
    }
};

export const signUp = async () => {
    // For Puter auth, sign-up is the same as sign-in
    // The backend auto-creates the user on first sign-in
    return signIn();
};

export const signOut = async () => {
    if (typeof window !== "undefined") {
        window.localStorage.removeItem(USER_ID_STORAGE_KEY);
        window.localStorage.removeItem(USERNAME_STORAGE_KEY);
    }
};

export const getCurrentUser = async () => {
    if (typeof window === "undefined") return null;
    
    const userId = window.localStorage.getItem(USER_ID_STORAGE_KEY);
    if (!userId) return null;
    const username = window.localStorage.getItem(USERNAME_STORAGE_KEY) || "Puter User";

    return { id: userId, username };
};

export const createProject = async ({ item, visibility = "private" }: CreateProjectParams): Promise<DesignItem | null> => {
    try {
        const thumbnail = await toThumbnail(item.sourceImage);
        const saved = await apiRequest<ApiProject>("/api/projects", {
            method: "POST",
            body: JSON.stringify({
                name: item.name,
                sourceImage: item.sourceImage,
                thumbnail,
                isPublic: visibility === "public",
            }),
        });

        return mapProject(saved);
    } catch (error) {
        console.error("Failed to save project", error);
        return null;
    }
};

export const updateProjectRender = async ({
    projectId,
    renderedImage,
    renderedPath,
}: {
    projectId: string;
    renderedImage: string;
    renderedPath?: string;
}): Promise<DesignItem | null> => {
    try {
        const thumbnail = await toThumbnail(renderedImage);
        const updated = await apiRequest<ApiProject>(`/api/projects/${projectId}/render`, {
            method: "PATCH",
            body: JSON.stringify({ renderedImage, renderedPath, thumbnail }),
        });

        return mapProject(updated);
    } catch (error) {
        console.error("Failed to update render", error);
        return null;
    }
};

export const updateProjectName = async ({
    projectId,
    name,
}: {
    projectId: string;
    name: string;
}): Promise<DesignItem | null> => {
    try {
        const updated = await apiRequest<ApiProject>(`/api/projects/${projectId}/name`, {
            method: "PATCH",
            body: JSON.stringify({ name }),
        });

        return mapProject(updated);
    } catch (error) {
        console.error("Failed to update project name", error);
        return null;
    }
};

export const shareProject = async (projectId: string): Promise<DesignItem | null> => {
    try {
        const updated = await apiRequest<ApiProject>(`/api/projects/${projectId}/share`, {
            method: "POST",
        });
        return mapProject(updated);
    } catch (error) {
        console.error("Failed to share project", error);
        return null;
    }
};

export const unshareProject = async (projectId: string): Promise<DesignItem | null> => {
    try {
        const updated = await apiRequest<ApiProject>(`/api/projects/${projectId}/unshare`, {
            method: "POST",
        });
        return mapProject(updated);
    } catch (error) {
        console.error("Failed to unshare project", error);
        return null;
    }
};

export const deleteProject = async (projectId: string): Promise<boolean> => {
    try {
        await apiRequest<null>(`/api/projects/${projectId}`, { method: "DELETE" });
        return true;
    } catch (error) {
        console.error("Failed to delete project", error);
        return false;
    }
};

export const getProjects = async ({ page = 0, size = 12, q = "" }: ProjectsQuery = {}): Promise<ProjectsPageResult> => {
    if (!readUserId()) {
        return {
            items: [],
            page,
            size,
            total: 0,
            hasNext: false,
        };
    }

    try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("size", String(size));
        if (q.trim()) {
            params.set("q", q.trim());
        }

        const projects = await apiRequest<ApiProjectsPage>(`/api/projects?${params.toString()}`, { method: "GET" });
        return {
            items: projects.items.map(mapProject),
            page: projects.page,
            size: projects.size,
            total: projects.total,
            hasNext: projects.hasNext,
        };
    } catch (error) {
        console.error("Failed to get projects", error);
        return {
            items: [],
            page,
            size,
            total: 0,
            hasNext: false,
        };
    }
};

export const getProjectById = async ({ id }: { id: string }) => {
    try {
        if (readUserId()) {
            const owned = await apiRequest<ApiProject>(`/api/projects/${id}`, { method: "GET" });
            return mapProject(owned);
        }
    } catch {
        // Fallback to public endpoint.
    }

    try {
        const shared = await apiRequest<ApiProject>(`/api/public/projects/${id}`, { method: "GET" }, false);
        return mapProject(shared);
    } catch (error) {
        console.error("Failed to fetch project", error);
        return null;
    }
};
