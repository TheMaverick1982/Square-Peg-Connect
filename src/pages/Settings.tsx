import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { locations } from "@/lib/data";
import { type EmployeeProfile, useEmployee } from "@/lib/EmployeeContext";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Shield, ShieldAlert, Store, UserCog, Settings as SettingsIcon } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

function TeamManagementTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employee_profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as EmployeeProfile[];
    }
  });

  const updateProfile = useMutation({
    mutationFn: async (updates: Partial<EmployeeProfile> & { id: string }) => {
      const { error } = await supabase
        .from('employee_profiles')
        .update(updates)
        .eq('id', updates.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee_profiles'] });
      toast({ title: "Profile updated", description: "The employee's access has been saved." });
    },
    onError: (error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    }
  });

  return (
    <div className="bg-card border rounded-lg overflow-hidden flex flex-col mt-4 min-h-[500px]">
      <div className="overflow-x-auto h-full flex flex-col">
        <div className="min-w-[800px] grid grid-cols-12 gap-4 p-4 border-b bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
          <div className="col-span-4">Team Member</div>
          <div className="col-span-2">System Role</div>
          <div className="col-span-4">Assigned Location</div>
          <div className="col-span-2 text-right">Joined</div>
        </div>

        <div className="divide-y overflow-auto flex-1 min-w-[800px]">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-3"></div>
              <p>Loading team members...</p>
            </div>
          ) : employees.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center h-48">
              <UserCog className="w-8 h-8 mb-3 opacity-20" />
              <p>No team members found.</p>
            </div>
          ) : (
            employees.map(employee => (
              <div key={employee.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-muted/10 transition-colors">
                <div className="col-span-4">
                  <div className="font-semibold text-sm text-foreground">{employee.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{employee.email}</div>
                </div>
                
                <div className="col-span-2">
                  <Select 
                    value={employee.role} 
                    onValueChange={(val) => updateProfile.mutate({ id: employee.id, role: val as any })}
                  >
                    <SelectTrigger className={`h-8 text-xs ${employee.role === 'admin' ? 'bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200' : ''}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">
                        <div className="flex items-center gap-2">
                          <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                          Super Admin
                        </div>
                      </SelectItem>
                      <SelectItem value="manager">
                        <div className="flex items-center gap-2">
                          <Store className="w-3.5 h-3.5 text-blue-500" />
                          Location Manager
                        </div>
                      </SelectItem>
                      <SelectItem value="employee">
                        <div className="flex items-center gap-2">
                          <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                          Staff
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-4">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="outline" 
                        role="combobox"
                        className="w-full justify-between h-8 text-xs font-normal bg-background"
                        disabled={employee.role === 'admin'}
                      >
                        {employee.role === 'admin' 
                          ? "All Locations (Unrestricted)"
                          : employee.assigned_locations?.length 
                            ? `${employee.assigned_locations.length} Locations Selected`
                            : (employee.assigned_location ? locations.find(l => l.id === employee.assigned_location)?.name : "Select Locations...")}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-[250px]" align="start">
                      {locations.map(loc => {
                        const isSelected = employee.assigned_locations?.includes(loc.id) || (!employee.assigned_locations?.length && employee.assigned_location === loc.id);
                        return (
                          <DropdownMenuCheckboxItem
                            key={loc.id}
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              const currentLocs = employee.assigned_locations?.length 
                                ? [...employee.assigned_locations] 
                                : (employee.assigned_location ? [employee.assigned_location] : []);
                              
                              let newLocs;
                              if (checked) {
                                newLocs = [...currentLocs, loc.id];
                              } else {
                                newLocs = currentLocs.filter(id => id !== loc.id);
                              }
                              
                              updateProfile.mutate({
                                id: employee.id,
                                assigned_locations: newLocs,
                                assigned_location: newLocs.length > 0 ? newLocs[0] : null
                              });
                            }}
                          >
                            {loc.name}
                          </DropdownMenuCheckboxItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {employee.role === 'admin' && (
                    <div className="text-[10px] text-muted-foreground mt-1 ml-1">
                      Admins inherently have access to all locations.
                    </div>
                  )}
                </div>

                <div className="col-span-2 text-right text-sm text-muted-foreground">
                  {(employee as any).created_at ? format(new Date((employee as any).created_at), "MMM d, yyyy") : "—"}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function Settings() {
  const { profile } = useEmployee();
  const isAdmin = profile?.role === "admin";
  const defaultTab = isAdmin ? "team" : "general";

  return (
    <div className="flex flex-col h-full space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage workspace preferences, integrations, and roles.</p>
      </div>

      <Tabs defaultValue={defaultTab} className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start border-b rounded-none h-12 bg-transparent p-0">
          <TabsTrigger 
            value="general" 
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none h-12 px-6"
          >
            General
          </TabsTrigger>
          <TabsTrigger 
            value="locations" 
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none h-12 px-6"
          >
            Locations
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger 
              value="team" 
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none h-12 px-6"
            >
              Team Access
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="general" className="flex-1 mt-6">
          <div className="max-w-2xl space-y-8">
            <div className="bg-card border rounded-lg p-6">
              <h3 className="text-lg font-medium">Workspace Profile</h3>
              <p className="text-sm text-muted-foreground mb-4">Manage your company's profile information.</p>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Company Name</label>
                  <input type="text" className="w-full mt-1.5 px-3 py-2 border rounded-md bg-background" defaultValue="Square Peg Pizzeria" disabled />
                </div>
                <div>
                  <label className="text-sm font-medium">Primary Contact Email</label>
                  <input type="email" className="w-full mt-1.5 px-3 py-2 border rounded-md bg-background" defaultValue="hello@squarepegpizzeria.com" disabled />
                </div>
                <Button disabled variant="outline">Save Changes</Button>
              </div>
            </div>

            <div className="bg-card border rounded-lg p-6">
              <h3 className="text-lg font-medium">Integrations</h3>
              <p className="text-sm text-muted-foreground mb-4">Connected third-party services and APIs.</p>
              
              <div className="flex items-center justify-between border-b pb-4 mb-4">
                <div>
                  <div className="font-medium">Vendasta</div>
                  <div className="text-sm text-muted-foreground">Connected for SSO and Form automation</div>
                </div>
                <div className="px-3 py-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-xs font-medium rounded-full">
                  Connected
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Toast POS</div>
                  <div className="text-sm text-muted-foreground">Sync sales data for fundraiser tracker</div>
                </div>
                <Button variant="outline" size="sm">Connect</Button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="locations" className="flex-1 mt-6">
          <div className="max-w-4xl">
            <div className="bg-card border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <div className="min-w-[600px] grid grid-cols-12 gap-4 p-4 border-b bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <div className="col-span-4">Location Name</div>
                  <div className="col-span-8">Location ID</div>
                </div>
                <div className="divide-y min-w-[600px]">
                  {locations.map(loc => (
                    <div key={loc.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-muted/5">
                      <div className="col-span-4 font-medium text-sm">{loc.name}</div>
                      <div className="col-span-8 text-sm text-muted-foreground">Internal ID: {loc.id} | Vendasta ID: {loc.vendestaId}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="team" className="flex-1 h-full m-0 pb-6 flex flex-col">
            <TeamManagementTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
