import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { StoreSettingsProvider } from "@/hooks/use-store-settings";
import { Layout } from "@/components/layout";
import NotFound from "@/pages/not-found";

import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Users from "@/pages/users";
import Roles from "@/pages/roles";
import ChangePassword from "@/pages/change-password";
import StoreSettings from "@/pages/store-settings";

const queryClient = new QueryClient();

const ProtectedRoute = ({ component: Component }: { component: React.ComponentType<any> }) => {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading session...</div>;
  }
  
  if (!user) {
    return <Redirect to="/login" />;
  }

  return (
    <Layout>
      <Component />
    </Layout>
  );
};

function Router() {
  return (
    <Switch>
      <Route path="/">
        {() => {
          const { user, isLoading } = useAuth();
          if (isLoading) return null;
          return user ? <Redirect to="/dashboard" /> : <Redirect to="/login" />;
        }}
      </Route>
      <Route path="/login" component={Login} />
      <Route path="/dashboard"><ProtectedRoute component={Dashboard} /></Route>
      <Route path="/users"><ProtectedRoute component={Users} /></Route>
      <Route path="/roles"><ProtectedRoute component={Roles} /></Route>
      <Route path="/settings/password"><ProtectedRoute component={ChangePassword} /></Route>
      <Route path="/admin/store-settings"><ProtectedRoute component={StoreSettings} /></Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <StoreSettingsProvider>
            <AuthProvider>
              <Router />
            </AuthProvider>
          </StoreSettingsProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
