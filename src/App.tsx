import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { FocusProvider } from "@/context/FocusContext";
import { useFocus } from "@/context/FocusContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";
import { isSupabaseConfigured, supabaseConfigError } from "@/lib/supabase";
import { NavBar } from "@/components/NavBar";
import { ExtensionOnboardingPrompt } from "@/components/ExtensionOnboardingPrompt";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import AuthPage from "./pages/Auth";
import TodayPage from "./pages/Today";
import GoalsPage from "./pages/Goals";
import GoalDetailPage from "./pages/GoalDetail";
import SessionsPage from "./pages/Sessions";
import PatternsPage from "./pages/Patterns";
import WeeklyReviewPage from "./pages/WeeklyReview";
import SettingsPage from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function MissingEnvScreen() {
  return (
    <div className="min-h-screen bg-background px-6 py-16 text-foreground">
      <div className="mx-auto max-w-2xl rounded-xl border border-border bg-card p-8">
        <p className="section-label">SETUP REQUIRED</p>
        <h1 className="mt-2 text-2xl font-semibold">FocusOS is missing required environment variables</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {supabaseConfigError}
        </p>
        <div className="mt-4 rounded-lg border border-border bg-background/60 p-4 text-sm text-foreground">
          Add these in your deployment environment and redeploy:
          <div className="mt-2 font-mono-calc text-xs text-muted-foreground">VITE_SUPABASE_URL</div>
          <div className="font-mono-calc text-xs text-muted-foreground">VITE_SUPABASE_ANON_KEY</div>
        </div>
      </div>
    </div>
  );
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const { state } = useFocus();

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <ExtensionOnboardingPrompt />
      {state.initialized ? children : (
        <div className="mx-auto max-w-content px-8 py-8 text-sm text-muted-foreground">Loading your workspace...</div>
      )}
    </div>
  );
}

const App = () => (
  isSupabaseConfigured ? (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <BrowserRouter>
              <FocusProvider>
                <Toaster />
                <Sonner />
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/auth" element={<AuthPage />} />
                  <Route path="/today" element={<ProtectedRoute><AppLayout><TodayPage /></AppLayout></ProtectedRoute>} />
                  <Route path="/goals" element={<ProtectedRoute><AppLayout><GoalsPage /></AppLayout></ProtectedRoute>} />
                  <Route path="/goals/:id" element={<ProtectedRoute><AppLayout><GoalDetailPage /></AppLayout></ProtectedRoute>} />
                  <Route path="/sessions" element={<ProtectedRoute><AppLayout><SessionsPage /></AppLayout></ProtectedRoute>} />
                  <Route path="/patterns" element={<ProtectedRoute><AppLayout><PatternsPage /></AppLayout></ProtectedRoute>} />
                  <Route path="/review" element={<ProtectedRoute><AppLayout><WeeklyReviewPage /></AppLayout></ProtectedRoute>} />
                  <Route path="/settings" element={<ProtectedRoute><AppLayout><SettingsPage /></AppLayout></ProtectedRoute>} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </FocusProvider>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  ) : (
    <MissingEnvScreen />
  )
);

export default App;
