import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AuthPage from "./pages/Auth";
import SessionsPage from "./pages/Sessions";
import SessionPage from "./pages/Session";
import Header from "@/components/layout/Header";
import { AuthProvider, useAuth } from "@/context/AuthContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <div className="flex min-h-screen flex-col">
            <Header />
            <main className="container mx-auto flex-1 bg-white py-8">
              <Routes>
                <Route path="/" element={<HomeRedirect />} />
                <Route path="/auth" element={<AuthGate />} />
                <Route path="/sessions" element={<Protected><SessionsPage /></Protected>} />
                <Route path="/session/:id" element={<Protected><SessionPage /></Protected>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

function Protected({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const location = useLocation();
  if (!token) return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

function HomeRedirect() {
  const { token } = useAuth();
  return <Navigate to={token ? "/sessions" : "/auth"} replace />;
}

function AuthGate() {
  const { token } = useAuth();
  return token ? <Navigate to="/sessions" replace /> : <AuthPage />;
}

createRoot(document.getElementById("root")!).render(<App />);
