import {useEffect, useRef, useState} from "react";
import {ArrowRight, CheckCircle2, ShieldCheck, X} from "lucide-react";
import {createPortal} from "react-dom";
import Button from "./ui/Button";

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSignIn: () => Promise<boolean>;
}

const AuthModal = ({ isOpen, onClose, onSignIn }: AuthModalProps) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!isOpen) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [isOpen, onClose]);

    useEffect(() => {
        return () => {
            if (closeTimerRef.current) {
                clearTimeout(closeTimerRef.current);
                closeTimerRef.current = null;
            }
        };
    }, []);

    if (!isOpen || typeof document === "undefined") return null;

    const reset = () => {
        setError(null);
        setSuccessMessage(null);
        setIsSubmitting(false);
    };

    const close = () => {
        reset();
        onClose();
    };

    const handleSignIn = async () => {
        setError(null);

        try {
            setIsSubmitting(true);
            const ok = await onSignIn();

            if (ok) {
                setSuccessMessage("Signed in with Puter");
                closeTimerRef.current = setTimeout(() => {
                    close();
                    closeTimerRef.current = null;
                }, 1200);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : "Puter sign-in failed";
            setError(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return createPortal((
        <div
            className="auth-dialog-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="Authentication dialog"
            onClick={close}
        >
            <div className="auth-dialog" onClick={(event) => event.stopPropagation()}>
                <div className="auth-hero">
                    <div>
                        <h3>Sign in with Puter</h3>
                        <p>
                            Continue with your Puter account to access saved visualizations.
                        </p>
                    </div>
                    <button type="button" className="auth-close" onClick={close} aria-label="Close auth dialog">
                        <X size={16} />
                    </button>
                </div>

                <div className="auth-card">
                    <div className="auth-tabs" style={{ justifyContent: "center" }}>
                        <button type="button" className="active" disabled>
                            Puter Login
                        </button>
                    </div>

                    <div className="auth-form">
                        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#52525b", marginBottom: 12 }}>
                            <ShieldCheck size={16} />
                            <p>Secure auth powered by Puter</p>
                        </div>

                        {error && <p className="auth-error">{error}</p>}

                        <Button type="button" onClick={() => void handleSignIn()} className="auth-submit" disabled={isSubmitting}>
                            {isSubmitting ? "Please wait..." : "Continue with Puter"}
                            {!isSubmitting && <ArrowRight size={15} />}
                        </Button>
                    </div>
                </div>

                {successMessage && (
                    <div className="auth-success-popup" role="status" aria-live="polite">
                        <CheckCircle2 size={16} />
                        <span>{successMessage}</span>
                    </div>
                )}
            </div>
        </div>
    ), document.body);
};

export default AuthModal;
