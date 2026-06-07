import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import WizardPage from "./pages/WizardPage";
import HistoryPage from "./pages/HistoryPage";
import PlanDetailPage from "./pages/PlanDetailPage";
import PrintPage from "./pages/PrintPage";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/wizard" component={WizardPage} />
      <Route path="/wizard/:planId" component={WizardPage} />
      <Route path="/history" component={HistoryPage} />
      <Route path="/plan/:planId" component={PlanDetailPage} />
      <Route path="/print/:planId" component={PrintPage} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster position="top-center" richColors />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
