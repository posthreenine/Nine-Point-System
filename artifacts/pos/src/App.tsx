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
import Categories from "@/pages/categories";
import Products from "@/pages/products";
import Ingredients from "@/pages/ingredients";
import StockMovements from "@/pages/stock-movements";
import Recipes from "@/pages/recipes";
import ProfitAnalysis from "@/pages/profit-analysis";

import POS from "@/pages/pos";
import Tables from "@/pages/tables";
import Transactions from "@/pages/transactions";
import QrisSettings from "@/pages/qris-settings";

import Shifts from "@/pages/shifts";
import DailyReport from "@/pages/reports/daily";
import WeeklyReport from "@/pages/reports/weekly";
import MonthlyReport from "@/pages/reports/monthly";
import ProductReport from "@/pages/reports/products";
import ProfitReport from "@/pages/reports/profit";

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
          return user ? <Redirect to="/pos" /> : <Redirect to="/login" />;
        }}
      </Route>
      <Route path="/login" component={Login} />
      <Route path="/dashboard"><ProtectedRoute component={Dashboard} /></Route>
      <Route path="/users"><ProtectedRoute component={Users} /></Route>
      <Route path="/roles"><ProtectedRoute component={Roles} /></Route>
      <Route path="/settings/password"><ProtectedRoute component={ChangePassword} /></Route>
      <Route path="/admin/store-settings"><ProtectedRoute component={StoreSettings} /></Route>
      <Route path="/admin/qris-settings"><ProtectedRoute component={QrisSettings} /></Route>

      <Route path="/pos"><ProtectedRoute component={POS} /></Route>
      <Route path="/tables"><ProtectedRoute component={Tables} /></Route>
      <Route path="/transactions"><ProtectedRoute component={Transactions} /></Route>

      <Route path="/products/categories"><ProtectedRoute component={Categories} /></Route>
      <Route path="/products/ingredients"><ProtectedRoute component={Ingredients} /></Route>
      <Route path="/products/recipes"><ProtectedRoute component={Recipes} /></Route>
      <Route path="/products"><ProtectedRoute component={Products} /></Route>

      <Route path="/inventory/stock"><ProtectedRoute component={Ingredients} /></Route>
      <Route path="/inventory/movements"><ProtectedRoute component={StockMovements} /></Route>

      <Route path="/shifts"><ProtectedRoute component={Shifts} /></Route>

      <Route path="/reports/daily"><ProtectedRoute component={DailyReport} /></Route>
      <Route path="/reports/weekly"><ProtectedRoute component={WeeklyReport} /></Route>
      <Route path="/reports/monthly"><ProtectedRoute component={MonthlyReport} /></Route>
      <Route path="/reports/products"><ProtectedRoute component={ProductReport} /></Route>
      <Route path="/reports/profit"><ProtectedRoute component={ProfitReport} /></Route>
      <Route path="/reports/profit-analysis"><ProtectedRoute component={ProfitAnalysis} /></Route>

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
