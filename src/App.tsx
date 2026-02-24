import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Optistate from "./pages/Optistate";
import Optibrain from "./pages/Optibrain";
import Optiheart from "./pages/Optiheart";
import Optilungs from "./pages/Optilungs";
import Feedback from "./pages/Feedback";
import Login from "./pages/auth/Login";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import Signup from "./pages/auth/Signup";
import ManagerSignup from "./pages/auth/ManagerSignup";
import WorkerSignup from "./pages/auth/WorkerSignup";
import ImportPatientData from "./pages/admin/ImportPatientData";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

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
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/optistate" element={<ProtectedRoute><Optistate /></ProtectedRoute>} />
            <Route path="/optibrain" element={<ProtectedRoute><Optibrain /></ProtectedRoute>} />
            <Route path="/optiheart" element={<ProtectedRoute><Optiheart /></ProtectedRoute>} />
            <Route path="/optilungs" element={<ProtectedRoute><Optilungs /></ProtectedRoute>} />
            <Route path="/feedback" element={<ProtectedRoute><Feedback /></ProtectedRoute>} />
            <Route path="/admin/import" element={<ProtectedRoute><ImportPatientData /></ProtectedRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
