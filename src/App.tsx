import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useSearchParams, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { CopilotPromptGenerator } from "@/components/CopilotPromptGenerator";
import { usePatient } from "@/hooks/usePatients";
import Dashboard from "./pages/Dashboard";
import Optistate from "./pages/Optistate";
import Optibrain from "./pages/Optibrain";
import Feedback from "./pages/Feedback";
import Login from "./pages/auth/Login";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import Signup from "./pages/auth/Signup";
import ManagerSignup from "./pages/auth/ManagerSignup";
import WorkerSignup from "./pages/auth/WorkerSignup";
import ImportPatientData from "./pages/admin/ImportPatientData";
import NotFound from "./pages/NotFound";
import AutoregStudy from "./pages/AutoregStudy";

const queryClient = new QueryClient();

// MVP1 : les modules d'organes secondaires renvoient vers le hub Optistate,
// en conservant le paramètre `patient` pour ne pas perdre le contexte clinique.
const RedirectToState = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.toString();
  return <Navigate to={query ? `/optistate?${query}` : "/optistate"} replace />;
};

const ORGAN_MAP: Record<string, string> = {
  "/optibrain": "cerveau",
  "/optiheart": "coeur",
  "/optilungs": "poumons",
  "/optirenal": "renal",
  "/optigastro": "gastro",
  "/optistate": "general",
};

const ORGAN_BY_SCORE_KEY: Array<{ key: keyof Pick<any, 'brainScore'>; organ: string }> = [
  { key: 'brainScore' as any, organ: 'cerveau' },
  { key: 'heartScore' as any, organ: 'coeur' },
  { key: 'lungsScore' as any, organ: 'poumons' },
  { key: 'kidneyScore' as any, organ: 'renal' },
];

const CopilotPromptWrapper = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get("patient") || undefined;
  const organ = ORGAN_MAP[location.pathname];
  const { data: patient } = usePatient(patientId || null);

  // Only show on protected clinical pages
  const showOn = ["/", "/optistate", "/optibrain", "/optiheart", "/optilungs", "/optirenal", "/optigastro"].includes(location.pathname);

  if (!showOn) return null;

  // Auto-preselect organs with score >= 1 (critical/warning systems)
  const criticalOrgans = patient
    ? ORGAN_BY_SCORE_KEY
        .filter(({ key }) => ((patient as any)[key] || 0) >= 1)
        .sort((a, b) => ((patient as any)[b.key] || 0) - ((patient as any)[a.key] || 0))
        .map(({ organ }) => organ)
    : [];

  // Build severity map (organ -> score) so the generator can color cage/icon
  const organSeverities: Record<string, number> = patient
    ? ORGAN_BY_SCORE_KEY.reduce((acc, { key, organ }) => {
        const score = (patient as any)[key] || 0;
        if (score >= 1) acc[organ] = score;
        return acc;
      }, {} as Record<string, number>)
    : {};

  // Fallback: current page organ if no critical ones detected
  const defaultOrgans =
    criticalOrgans.length > 0 ? criticalOrgans : organ ? [organ] : undefined;

  return (
    <CopilotPromptGenerator
      patientId={patientId}
      organ={organ}
      defaultOrgans={defaultOrgans}
      organSeverities={organSeverities}
    />
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth/login" element={<Login />} />
            <Route path="/auth/signup" element={<Signup />} />
            <Route path="/auth/manager-signup" element={<ManagerSignup />} />
            <Route path="/auth/worker-signup" element={<WorkerSignup />} />
            <Route path="/auth/forgot-password" element={<ForgotPassword />} />
            <Route path="/auth/reset-password" element={<ResetPassword />} />
            <Route path="/autoreg" element={<ProtectedRoute><AutoregStudy /></ProtectedRoute>} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/optistate" element={<ProtectedRoute><Optistate /></ProtectedRoute>} />
            <Route path="/optibrain" element={<ProtectedRoute><Optibrain /></ProtectedRoute>} />
            {/* MVP1 : modules cœur/poumons/rénal/gastrique retirés — redirigés vers le hub Optistate en gardant le contexte patient */}
            <Route path="/optiheart" element={<RedirectToState />} />
            <Route path="/optilungs" element={<RedirectToState />} />
            <Route path="/optirenal" element={<RedirectToState />} />
            <Route path="/optigastro" element={<RedirectToState />} />
            <Route path="/feedback" element={<ProtectedRoute><Feedback /></ProtectedRoute>} />
            <Route path="/admin/import" element={<ProtectedRoute><ImportPatientData /></ProtectedRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          <CopilotPromptWrapper />
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
