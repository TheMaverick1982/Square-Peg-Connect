import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "react-oidc-context";
import { Navigate } from "react-router-dom";

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const auth = useAuth();

  const handleVendestaSSO = () => {
    setIsLoading(true);
    auth.signinRedirect();
  };

  if (auth.isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
      
      <div className="w-full max-w-md bg-card border shadow-xl rounded-2xl p-8 relative z-10">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="h-20 mb-4 flex items-center justify-center">
            <img src="https://media-api-prod.apigateway.co/files/v3/AG-D5HZKZ2TNH/FileID-2859e6a7-48eb-46ed-83a6-9d6ebb5d5850/uploaded-1782298633843015700.png" alt="Square Peg Connect Logo" className="max-h-full w-auto object-contain" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Square Peg Connect</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to manage catering, contacts, and events.</p>
        </div>

        <div className="space-y-4">
          <Button 
            className="w-full h-12 text-base font-medium relative" 
            onClick={handleVendestaSSO}
            disabled={isLoading}
          >
            {isLoading ? "Connecting to Vendesta..." : "Sign in with Vendesta SSO"}
          </Button>
        </div>
      </div>
      
      <div className="mt-8 text-center text-sm text-muted-foreground space-y-1">
        <p>Secure access managed by Vendesta.</p>
        <p>Having trouble? <a href="#" className="text-primary hover:underline">Contact IT Support</a></p>
      </div>
    </div>
  );
}
