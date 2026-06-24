import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Mail, Lock } from "lucide-react";
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
          <div className="w-16 h-16 bg-primary/10 flex items-center justify-center rounded-xl mb-4">
            <ShieldCheck className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Square Peg CRM</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to manage catering, contacts, and events.</p>
        </div>

        <div className="space-y-4">
          <Button 
            className="w-full h-12 text-base font-medium relative" 
            onClick={handleVendestaSSO}
            disabled={isLoading}
          >
            {isLoading ? "Connecting to Vendesta..." : "Sign in with Vendesta SSO"}
            {!isLoading && (
              <div className="absolute right-4 w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                <ShieldCheck className="w-3 h-3 text-white" />
              </div>
            )}
          </Button>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground font-medium">Or continue with email</span>
            </div>
          </div>

          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleVendestaSSO(); }}>
            <div className="space-y-2">
              <Label htmlFor="email">Work Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="email" type="email" placeholder="manager@squarepeg.com" className="pl-9 bg-muted/50" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <a href="#" className="text-xs text-primary hover:underline font-medium">Forgot password?</a>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="password" type="password" className="pl-9 bg-muted/50" />
              </div>
            </div>
            <Button variant="outline" className="w-full" type="button" onClick={handleVendestaSSO}>
              Sign In
            </Button>
          </form>
        </div>
      </div>
      
      <div className="mt-8 text-center text-sm text-muted-foreground space-y-1">
        <p>Secure access managed by Vendesta.</p>
        <p>Having trouble? <a href="#" className="text-primary hover:underline">Contact IT Support</a></p>
      </div>
    </div>
  );
}
