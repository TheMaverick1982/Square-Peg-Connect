import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { locations } from "@/lib/data";
import { type EmployeeProfile, useEmployee } from "@/lib/EmployeeContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LocationPicker } from "@/components/LocationPicker";
import { inviteTeamMember, removeTeamMember } from "@/lib/teamApi";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Shield, ShieldAlert, Store, UserCog, Settings as SettingsIcon, UploadCloud, FileArchive, Trash2, Link as LinkIcon, Loader2, UserPlus, Mail } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

function MarketingAssetsTab() {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [fundraiserAsset, setFundraiserAsset] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAssets = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.storage.from('marketing-assets').list('fundraisers');
    if (!error && data) {
      const pack = data.find(f => f.name === 'fundraiser-promo-pack.zip');
      if (pack) {
        const { data: urlData } = supabase.storage.from('marketing-assets').getPublicUrl(`fundraisers/${pack.name}`);
        setFundraiserAsset({ ...pack, publicUrl: urlData.publicUrl });
      } else {
        setFundraiserAsset(null);
      }
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Enforce .zip
    if (!file.name.endsWith('.zip') && file.type !== 'application/zip' && file.type !== 'application/x-zip-compressed') {
      toast({ title: "Invalid File", description: "Please upload a .zip file containing your assets.", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    
    // Always overwrite the same filename so the link stays constant
    const filePath = 'fundraisers/fundraiser-promo-pack.zip';

    const { error } = await supabase.storage
      .from('marketing-assets')
      .upload(filePath, file, { upsert: true });

    setIsUploading(false);

    if (error) {
      toast({ title: "Upload Failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Upload Successful", description: "Fundraiser promo pack updated." });
      fetchAssets();
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDelete = async () => {
    const { error } = await supabase.storage.from('marketing-assets').remove(['fundraisers/fundraiser-promo-pack.zip']);
    if (error) {
      toast({ title: "Delete Failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: "Promo pack removed." });
      setFundraiserAsset(null);
    }
  };

  const handleCopyLink = () => {
    if (fundraiserAsset?.publicUrl) {
      navigator.clipboard.writeText(fundraiserAsset.publicUrl);
      toast({ title: "Link Copied", description: "Asset download link copied to clipboard." });
    }
  };

  return (
    <div className="bg-card border rounded-lg p-6 max-w-3xl">
      <div className="mb-6 border-b pb-4">
        <h3 className="text-lg font-semibold">Fundraiser Promotional Pack</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Upload a <span className="font-semibold text-foreground">.zip</span> file containing the flyers and social assets for Tuesday Fundraisers. 
          When a fundraiser is confirmed, this file will be automatically linked in their email.
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mb-2 text-primary" />
          <p className="text-sm">Checking assets...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {fundraiserAsset ? (
            <div className="flex items-center justify-between bg-muted/20 border p-4 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <FileArchive className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold text-sm">fundraiser-promo-pack.zip</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Updated {format(new Date(fundraiserAsset.updated_at || fundraiserAsset.created_at), "MMM d, yyyy")} • {(fundraiserAsset.metadata?.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-8 gap-2" onClick={handleCopyLink}>
                  <LinkIcon className="w-3.5 h-3.5" />
                  Copy Link
                </Button>
                <Button variant="outline" size="sm" className="h-8 gap-2 text-destructive hover:bg-destructive/10 border-destructive/20 hover:text-destructive" onClick={handleDelete}>
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 border-2 border-dashed rounded-lg bg-muted/10">
              <UploadCloud className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <h4 className="text-sm font-semibold">No Promo Pack Uploaded</h4>
              <p className="text-xs text-muted-foreground mt-1 mb-4 max-w-sm mx-auto">
                Upload a .zip file with your flyers. The system will generate a permanent link.
              </p>
            </div>
          )}

          <div className="flex items-center justify-center">
            <input 
              type="file" 
              accept=".zip,application/zip" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleUpload} 
            />
            <Button 
              onClick={() => fileInputRef.current?.click()} 
              disabled={isUploading}
              className="w-full sm:w-auto"
            >
              {isUploading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</>
              ) : (
                <><UploadCloud className="w-4 h-4 mr-2" /> {fundraiserAsset ? "Replace Promo Pack" : "Upload Promo Pack (.zip)"}</>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddTeamMember() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "manager" | "employee">("manager");
  const [locs, setLocs] = useState<string[]>([]);

  const addMember = useMutation({
    mutationFn: () => inviteTeamMember({
      email: email.trim().toLowerCase(), name: name.trim(), role, locations: role === 'admin' ? [] : locs,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee_profiles'] });
      toast({ title: "Invite sent", description: `${email.trim()} will get an email to set their password.` });
      setName(""); setEmail(""); setRole("manager"); setLocs([]);
    },
    onError: (error) => {
      toast({ title: "Couldn't send invite", description: (error as Error).message, variant: "destructive" });
    },
  });

  return (
    <div className="bg-card border rounded-lg p-4 mt-4 space-y-3">
      <div className="flex items-center gap-2 font-semibold text-sm">
        <UserPlus className="w-4 h-4" /> Add a team member
        <span className="font-normal text-muted-foreground">— they'll get an email to set their password</span>
      </div>
      <form
        className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
        onSubmit={(e) => { e.preventDefault(); if (email.trim()) addMember.mutate(); }}
      >
        <div className="md:col-span-3">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" className="mt-1" />
        </div>
        <div className="md:col-span-3">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</label>
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@squarepegpizzeria.com" className="mt-1" />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Role</label>
          <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Super Admin</SelectItem>
              <SelectItem value="manager">Location Manager</SelectItem>
              <SelectItem value="employee">Staff</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Locations</label>
          <div className="mt-1">
            <LocationPicker value={role === 'admin' ? [] : locs} onChange={setLocs} disabled={role === 'admin'} />
          </div>
        </div>
        <Button type="submit" className="md:col-span-2" disabled={addMember.isPending}>
          {addMember.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
          Send invite
        </Button>
      </form>
    </div>
  );
}

function RemoveMemberButton({ email, name }: { email: string; name: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { profile } = useEmployee();
  const [busy, setBusy] = useState(false);
  if (profile?.email?.toLowerCase() === email.toLowerCase()) return null;
  return (
    <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive hover:text-destructive" disabled={busy}
      onClick={async () => {
        if (!window.confirm(`Remove ${name || email} from Square Peg Connect? They will lose access immediately.`)) return;
        setBusy(true);
        try {
          await removeTeamMember(email);
          queryClient.invalidateQueries({ queryKey: ['employee_profiles'] });
          toast({ title: "Removed", description: `${email} no longer has access.` });
        } catch (err) {
          toast({ title: "Couldn't remove", description: (err as Error).message, variant: "destructive" });
        } finally { setBusy(false); }
      }}>
      <Trash2 className="w-3.5 h-3.5 mr-1" /> {busy ? "Removing…" : "Remove"}
    </Button>
  );
}

function SendLoginEmailButton({ email }: { email: string }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={busy}
      title="Emails them a link to set up or reset their password"
      onClick={async () => {
        setBusy(true);
        try {
          const out = await inviteTeamMember({ email });
          toast({
            title: out.sent === 'invite' ? "Invite sent" : "Reset link sent",
            description: out.sent === 'invite'
              ? `${email} will get an email to set up their login.`
              : `${email} will get an email to choose a new password.`,
          });
        } catch (err) {
          toast({ title: "Couldn't send email", description: (err as Error).message, variant: "destructive" });
        } finally { setBusy(false); }
      }}>
      <Mail className="w-3.5 h-3.5 mr-1" /> {busy ? "Sending…" : "Send login email"}
    </Button>
  );
}

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
    <>
    <AddTeamMember />
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
                  <LocationPicker
                    className="h-8 text-xs"
                    disabled={employee.role === 'admin'}
                    value={employee.role === 'admin' ? [] : (employee.assigned_locations?.length ? employee.assigned_locations : (employee.assigned_location ? [employee.assigned_location] : []))}
                    onChange={(newLocs) => updateProfile.mutate({
                      id: employee.id,
                      assigned_locations: newLocs,
                      assigned_location: newLocs.length > 0 ? newLocs[0] : null,
                    })}
                  />
                  {employee.role === 'admin' && (
                    <div className="text-[10px] text-muted-foreground mt-1 ml-1">
                      Admins inherently have access to all locations.
                    </div>
                  )}
                </div>

                <div className="col-span-2 text-right text-sm text-muted-foreground flex flex-col items-end gap-1">
                  <span>{(employee as any).created_at ? format(new Date((employee as any).created_at), "MMM d, yyyy") : "—"}</span>
                  <div className="flex gap-1">
                    <SendLoginEmailButton email={employee.email} />
                    <RemoveMemberButton email={employee.email} name={employee.name} />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
    </>
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
          <TabsTrigger 
            value="assets" 
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none h-12 px-6"
          >
            Marketing Assets
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
              <h3 className="text-lg font-medium">Notification Settings</h3>
              <p className="text-sm text-muted-foreground mb-4">Manage where system alerts (like new Staff Photos or Marketing Requests) are sent.</p>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Marketing Team Emails</label>
                  <p className="text-xs text-muted-foreground mb-1.5">Who receives alerts when Staff Photos are uploaded or marketing support is requested? (Comma separated)</p>
                  <input 
                    type="text" 
                    className="w-full px-3 py-2 border rounded-md bg-background" 
                    defaultValue="brian@brianhardy.com, darene.gtomp@gmail.com" 
                    disabled 
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    * To change these permanently, update the MARKETING_NOTIFY_EMAILS secret in your Supabase dashboard.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-card border rounded-lg p-6">
              <h3 className="text-lg font-medium">Integrations</h3>
              <p className="text-sm text-muted-foreground mb-4">Connected third-party services and APIs.</p>
              
              <div className="flex items-center justify-between border-b pb-4 mb-4">
                <div>
                  <div className="font-medium">Resend</div>
                  <div className="text-sm text-muted-foreground">Connected for automated email delivery</div>
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
                  <div className="col-span-8">Location Code</div>
                </div>
                <div className="divide-y min-w-[600px]">
                  {locations.map(loc => (
                    <div key={loc.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-muted/5">
                      <div className="col-span-4 font-medium text-sm">{loc.name}</div>
                      <div className="col-span-8 text-sm text-muted-foreground">Internal ID: {loc.id}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="assets" className="flex-1 mt-6">
          <MarketingAssetsTab />
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
