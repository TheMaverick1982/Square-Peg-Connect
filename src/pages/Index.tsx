import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Sparkles } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md bg-card backdrop-blur-sm border border-border shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
        <CardContent className="p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto transition-transform duration-300 hover:scale-110">
            <Sparkles className="w-8 h-8 text-primary-foreground" />
          </div>

          <div className="space-y-3">
            <h1 className="text-2xl font-bold text-foreground">
              Welcome to Your App
            </h1>
            <p className="text-muted-foreground leading-relaxed">
              Built with React, TypeScript, Vite, shadcn/ui, and Tailwind CSS. Start building your application by editing this page.
            </p>
          </div>

          <div className="pt-2">
            <Button
              className="group bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
            >
              <span className="flex items-center gap-2">
                Get Started
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
              </span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;
