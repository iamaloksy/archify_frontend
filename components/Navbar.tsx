import {useState} from "react";
import {Box} from "lucide-react";
import Button from "./ui/Button";
import {useOutletContext} from "react-router";
import AuthModal from "./AuthModal";

const Navbar = () => {
    const { isSignedIn, userName, signIn, signOut } = useOutletContext<AuthContext>()
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

    const handleAuthClick = async () => {
        if(isSignedIn) {
            try {
                await signOut();
            } catch (e) {
                console.error(`Sign out failed: ${e}`);
            }

            return;
        }

        setIsAuthModalOpen(true);
    };

    return (
        <header className="navbar">
            <nav className="inner">
                <div className="left">
                    <div className="brand">
                        <Box  className="logo" />

                        <span className="name">
                            Archify AI
                        </span>
                    </div>
                </div>

                <div className="actions">
                    {isSignedIn ? (
                        <>
                            <span className="greeting">
                                {userName ? `Hi, ${userName}` : 'Signed in'}
                            </span>

                            <Button size="sm" onClick={handleAuthClick} className="btn">
                                Log Out
                            </Button>
                        </>
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
