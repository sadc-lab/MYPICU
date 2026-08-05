import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useSearchParams, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { TeamsHostBridge } from "@/components/TeamsHostBridge";
import { CopilotPromptGenerator } from "@/components/CopilotPromptGenerator";
import { usePatient } from "@/hooks/usePatients";
import Dashboard from "./pages/Dashboard";
import Optistate from "./pages/Optistate";
import Optibrain from "./pages/Optibrain";
import Optiheart from "./pages/Optiheart";
import Optilungs from "./pages/Optilungs";
import Optirenal from "./pages/Optirenal";
import Optigastro from "./pages/Optigastro";
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
import TeamsConfig from "./pages/TeamsConfig";

const queryClient = new QueryClient();

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
        <TeamsHostBridge />
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
            {/* Teams ouvre cette page pour configurer un onglet de canal :
                elle doit rester hors authentification. */}
            <Route path="/teams/config" element={<TeamsConfig />} />
            <Route path="/autoreg" element={<ProtectedRoute><AutoregStudy /></ProtectedRoute>} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/optistate" element={<ProtectedRoute><Optistate /></ProtectedRoute>} />
            <Route path="/optibrain" element={<ProtectedRoute><Optibrain /></ProtectedRoute>} />
            <Route path="/optiheart" element={<ProtectedRoute><Optiheart /></ProtectedRoute>} />
            <Route path="/optilungs" element={<ProtectedRoute><Optilungs /></ProtectedRoute>} />
            <Route path="/optirenal" element={<ProtectedRoute><Optirenal /></ProtectedRoute>} />
            <Route path="/optigastro" element={<ProtectedRoute><Optigastro /></ProtectedRoute>} />
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
