import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { queryClient } from "@/lib/queryClient";
import NotFound from "./pages/NotFound";
import { LocationProvider } from "./lib/LocationContext";
import { routes } from "./routes";

import { EmployeeProvider } from "./lib/EmployeeContext";

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <EmployeeProvider>
        <LocationProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter basename={import.meta.env.BASE_URL}>
            <Routes>
              {routes.map((route, i) => (
                <Route key={i} path={route.path} element={route.element}>
                  {route.children?.map((child, j) => (
                    <Route 
                      key={j} 
                      index={child.index} 
                      path={child.path} 
                      element={child.element} 
                    />
                  ))}
                </Route>
              ))}
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </LocationProvider>
      </EmployeeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
