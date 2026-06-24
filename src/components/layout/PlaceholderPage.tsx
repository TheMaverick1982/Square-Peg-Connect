import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function PlaceholderPage({ title, description }: { title: string, description: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-12rem)] text-center space-y-4">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <AlertCircle className="w-8 h-8 text-primary" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <p className="text-muted-foreground max-w-[500px]">{description}</p>
      <div className="pt-4">
        <Button variant="outline">Go Back Dashboard</Button>
      </div>
    </div>
  );
}
