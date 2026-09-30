import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { supabase, initialLinkError } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { LOGO_URL } from "@/lib/brand";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "signin" | "signup" | "forgot" | "newpassword";

export default function Login() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || "/";

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    initialLinkError ? "That email link has expired or was already used. Use \"Forgot password?\" to get a new one." : null
  );
  const [notice, setNotice] = useState<string | null>(null);

  const switchMode = (m: Mode) => { setMode(m); setError(null); setNotice(null); setPassword(""); setConfirm(""); };
  const activeMode: Mode = auth.isRecovery ? "newpassword" : mode;

  if (auth.isLoading) {
    return (
      <div aria-busy="true" className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  if (auth.isAuthenticated && !auth.isRecovery) return <Navigate to={from} replace />;
  if (auth.isRecovery && !auth.isAuthenticated) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-sm p-6 text-center">
          <h1 className="text-lg font-semibold mb-2">This link has expired</h1>
          <p className="text-sm text-muted-foreground mb-4">Email links work once and expire after a while. Request a fresh one below.</p>
          <Button className="w-full" onClick={() => { auth.clearRecovery(); switchMode("forgot"); window.history.replaceState(null, "", "/login"); }}>
            Send me a new link
          </Button>
        </Card>
      </div>
    );
  }

  const origin = window.location.origin;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if ((activeMode === "signup" || activeMode === "newpassword") && password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if ((activeMode === "signup" || activeMode === "newpassword") && password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }

    setBusy(true);
    try {
      if (activeMode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw new Error(error.message === "Invalid login credentials" ? "Wrong email or password." : error.message);
        navigate(from, { replace: true });
      } else if (activeMode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: `${origin}/login` },
        });
        if (error) throw error;
        if (data.session) {
          navigate(from, { replace: true });
        } else {
          setNotice("Check your email for a confirmation link, then come back here to sign in.");
          switchModeKeepNotice("signin");
        }
      } else if (activeMode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${origin}/login`,
        });
        if (error) throw error;
        setNotice("If that email has an account, a reset link is on its way.");
      } else if (activeMode === "newpassword") {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        auth.clearRecovery();
        navigate("/", { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function switchModeKeepNotice(m: Mode) { setMode(m); setPassword(""); setConfirm(""); }

  const titles: Record<Mode, { title: string; sub: string; cta: string }> = {
    signin: { title: "Sign in", sub: "Square Peg Connect team login", cta: "Sign in" },
    signup: { title: "Set up your account", sub: "Use the email your manager added to the team list.", cta: "Create account" },
    forgot: { title: "Reset your password", sub: "We'll email you a link to choose a new one.", cta: "Send reset link" },
    newpassword: { title: "Choose a new password", sub: "You'll be signed in right after.", cta: "Save password" },
  };
  if (auth.linkType === "invite") {
    titles.newpassword = { title: "Welcome to Square Peg Connect", sub: "Choose a password to finish setting up your account.", cta: "Create password" };
  }
  const t = titles[activeMode];

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm p-6 shadow-lg">
        <div className="flex flex-col items-center text-center mb-6">
          <img src={LOGO_URL} alt="Square Peg Pizzeria" className="h-14 w-auto mb-4" />
          <h1 className="text-xl font-semibold">{t.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t.sub}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {activeMode !== "newpassword" && (
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" required autoFocus
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          )}

          {activeMode !== "forgot" && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{activeMode === "signin" ? "Password" : "New password"}</Label>
                {activeMode === "signin" && (
                  <button type="button" className="text-xs text-primary hover:underline" onClick={() => switchMode("forgot")}>
                    Forgot password?
                  </button>
                )}
              </div>
              <Input id="password" type="password" required
                autoComplete={activeMode === "signin" ? "current-password" : "new-password"}
                autoFocus={activeMode === "newpassword"}
                value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          )}

          {(activeMode === "signup" || activeMode === "newpassword") && (
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input id="confirm" type="password" autoComplete="new-password" required
                value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
          )}

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {notice && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">{notice}</p>}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Please wait…" : t.cta}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          {activeMode === "signin" && (
            <>First time here?{" "}
              <button type="button" className="text-primary hover:underline font-medium" onClick={() => switchMode("signup")}>
                Set up your account
              </button>
            </>
          )}
          {(activeMode === "signup" || activeMode === "forgot") && (
            <button type="button" className="text-primary hover:underline font-medium" onClick={() => switchMode("signin")}>
              Back to sign in
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}
