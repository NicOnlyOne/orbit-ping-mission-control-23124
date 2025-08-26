import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-space-deep via-space-dark to-space-medium">
      <Navigation />
      
      <div className="pt-20 flex items-center justify-center min-h-screen">
        <div className="text-center space-y-6 p-8">
          <div className="text-8xl mb-4">🛰️</div>
          <h1 className="text-6xl font-bold text-foreground mb-4">404</h1>
          <p className="text-2xl text-muted-foreground mb-8">
            Houston, we have a problem. This page is lost in space.
          </p>
          <Link to="/">
            <Button variant="rocket" size="lg" className="text-lg px-8 py-6">
              <Home className="h-5 w-5 mr-2" />
              Return to Mission Control
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
