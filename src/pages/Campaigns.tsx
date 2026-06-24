import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Users, ArrowRightLeft, CheckCircle2 } from "lucide-react";

export default function Campaigns() {
  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Campaigns & Marketing</h1>
        <p className="text-muted-foreground mt-1">Powered by Vendesta Campaign Pro</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-primary" />
              Vendesta Campaign Pro Sync
            </CardTitle>
            <CardDescription>
              Your CRM contacts are automatically synced to Vendesta for email and SMS marketing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted/30 border rounded-lg p-6 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-semibold">Square Peg Connect</div>
                  <div className="text-xs text-muted-foreground">Source of Truth</div>
                </div>
              </div>

              <div className="hidden md:flex flex-col items-center justify-center text-muted-foreground">
                <div className="text-xs font-medium uppercase tracking-wider mb-1">Live Sync</div>
                <ArrowRightLeft className="w-6 h-6 animate-pulse" />
              </div>

              <div className="flex flex-col items-center text-center space-y-2">
                <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-500">
                  <Megaphone className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-semibold">Campaign Pro</div>
                  <div className="text-xs text-muted-foreground">Vendesta Backend</div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-medium">Active Sync Rules</h3>
              <div className="grid gap-2">
                <div className="flex items-center justify-between text-sm p-3 border rounded-md">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span>New B2B Contacts &rarr; "Corporate Prospects" List</span>
                  </div>
                  <Badge variant="outline">Active</Badge>
                </div>
                <div className="flex items-center justify-between text-sm p-3 border rounded-md">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span>Past Catering Clients &rarr; "Catering Follow-up" Sequence</span>
                  </div>
                  <Badge variant="outline">Active</Badge>
                </div>
                <div className="flex items-center justify-between text-sm p-3 border rounded-md">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span>Tuesday Fundraisers &rarr; "Community Partners" List</span>
                  </div>
                  <Badge variant="outline">Active</Badge>
                </div>
              </div>
            </div>
            
            <div className="pt-2 flex justify-end">
              <Button>Launch Campaign Pro Dashboard</Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Recent Broadcasts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Summer Catering Promo</div>
                  <div className="text-xs font-semibold text-green-500">42% Open</div>
                </div>
                <div className="text-xs text-muted-foreground">Sent 3 days ago via Vendesta</div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Fundraiser Info Packet</div>
                  <div className="text-xs font-semibold text-green-500">68% Open</div>
                </div>
                <div className="text-xs text-muted-foreground">Automated Trigger</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
