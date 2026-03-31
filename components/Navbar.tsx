import {useState} from "react";
import {Box, CircleUserRound, LayoutDashboard, LogOut} from "lucide-react";
import Button from "./ui/Button";
import {Link, useOutletContext} from "react-router";
import AuthModal from "./AuthModal";

const Navbar = () => {
    const { isSignedIn, userName, signIn, signOut } = useOutletContext<AuthContext>()
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

    const handleSignOut = async () => {
        try {
            await signOut();
        } catch (e) {
            console.error(`Sign out failed: ${e}`);
        }
    };

    const handleAuthClick = async () => {
        if(isSignedIn) {
            await handleSignOut();
            return;
        }

        setIsAuthModalOpen(true);
    };

    return (
        <header className="navbar">
            <nav className="inner">
                <div className="left">
                    <Link to="/" className="brand">
                        <Box  className="logo" />

                        <span className="name">
                            Archify AI
                        </span>
                    </Link>
                </div>

                <div className="actions">
                    {isSignedIn ? (
                        <div className="profile-menu">
                            <button type="button" className="profile-trigger" aria-label="Open profile menu">
                                <CircleUserRound size={20} />
                            </button>

                            <div className="profile-dropdown" role="menu" aria-label="Profile menu">
                                <span className="profile-username" role="menuitem">
                                    {userName || "Signed in"}
                                </span>

                                <Link to="/dashboard" className="profile-link" role="menuitem">
                                    <LayoutDashboard size={14} />
                                    <span>Dashboard</span>
                                </Link>

                                <button type="button" className="profile-logout" onClick={() => void handleSignOut()} role="menuitem">
                                    <LogOut size={14} />
                                    <span>Log Out</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <Button onClick={handleAuthClick} size="sm" variant="ghost">
                                Sign in
                            </Button>

                            <a href="#upload" className="cta">Get Started</a>
                        </>
                    )}
                </div>
            </nav>

            <AuthModal
                isOpen={isAuthModalOpen}
                onClose={() => setIsAuthModalOpen(false)}
                onSignIn={signIn}
            />
        </header>
    )
}

export default Navbar
