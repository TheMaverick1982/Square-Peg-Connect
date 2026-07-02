import React, { useState } from "react";
import Papa from "papaparse";
import { supabase } from "@/lib/supabase";
import { locations } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, Loader2, ArrowRight } from "lucide-react";
import { format } from "date-fns";

const TARGET_FIELDS = [
  { id: "organization", label: "Organization Name (Required)" },
  { id: "event_date", label: "Event Date (Required)" },
  { id: "name", label: "Contact Name" },
  { id: "email", label: "Email" },
  { id: "phone", label: "Phone" },
  { id: "address", label: "Mailing Address" },
  { id: "payable_to", label: "Payable To" },
  { id: "notes", label: "Notes" },
  { id: "total_sales", label: "Total Sales ($)" },
  { id: "total_donated", label: "Total Donated ($)" },
  { id: "status", label: "Status (Confirmed, Completed)" },
];

export function FundraiserCsvImporter({ onImportSuccess }: { onImportSuccess: () => void }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<any[]>([]);
  
  // Maps target DB field ID -> CSV Column Header
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [fallbackLocationId, setFallbackLocationId] = useState<string>(locations[0].id);
  const [isImporting, setIsImporting] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;
    setFile(uploadedFile);

    Papa.parse(uploadedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data && results.data.length > 0) {
          setHeaders(Object.keys(results.data[0] as any));
          setCsvData(results.data);
          
          // Auto-guess mapping based on exact/partial matches
          const guessedMapping: Record<string, string> = {};
          const lowerHeaders = Object.keys(results.data[0] as any).map(h => ({ original: h, lower: h.toLowerCase() }));
          
          TARGET_FIELDS.forEach(field => {
             const match = lowerHeaders.find(h => 
               h.lower === field.id || 
               h.lower.includes(field.id.split('_')[0]) ||
               field.label.toLowerCase().includes(h.lower)
             );
             if (match) guessedMapping[field.id] = match.original;
          });
          setMapping(guessedMapping);
          setStep(2);
        } else {
          toast({ title: "Empty file", description: "The CSV file appears to be empty.", variant: "destructive" });
        }
      },
      error: (error) => {
        toast({ title: "Parse Error", description: error.message, variant: "destructive" });
      }
    });
  };

  const handleImport = async () => {
    if (!mapping.organization || !mapping.event_date) {
      toast({ title: "Missing fields", description: "Organization and Event Date are required.", variant: "destructive" });
      return;
    }

    setIsImporting(true);

    const rowsToInsert = csvData.map(row => {
      // Clean and format date
      let parsedDate = new Date();
      if (row[mapping.event_date]) {
         const d = new Date(row[mapping.event_date]);
         if (!isNaN(d.getTime())) parsedDate = d;
      }

      // Clean status
      let rawStatus = (row[mapping.status || ""] || "Confirmed").trim();
      if (!["Requested", "Confirmed", "Completed"].includes(rawStatus)) {
        rawStatus = "Confirmed";
      }

      return {
        organization: row[mapping.organization] || "Unknown Org",
        event_date: format(parsedDate, 'yyyy-MM-dd'),
        name: row[mapping.name || ""] || "Unknown Contact",
        email: row[mapping.email || ""] || "no-email@example.com",
        phone: row[mapping.phone || ""] || "000-000-0000",
        address: row[mapping.address || ""] || "Unknown Address",
        payable_to: row[mapping.payable_to || ""] || null,
        notes: row[mapping.notes || ""] || null,
        total_sales: parseFloat(row[mapping.total_sales || ""]?.replace(/[^0-9.-]+/g,"")) || 0,
        total_donated: parseFloat(row[mapping.total_donated || ""]?.replace(/[^0-9.-]+/g,"")) || 0,
        status: rawStatus,
        location: fallbackLocationId // Defaulting imported rows to the chosen fallback location
      };
    });

    const { error } = await supabase.from('fundraisers').insert(rowsToInsert);

    setIsImporting(false);

    if (error) {
      toast({ title: "Import Failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Import Successful", description: `Successfully imported ${rowsToInsert.length} fundraisers.` });
      setIsOpen(false);
      onImportSuccess();
      // Reset
      setStep(1);
      setFile(null);
      setMapping({});
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) {
        setTimeout(() => { setStep(1); setFile(null); }, 300);
      }
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 shadow-sm">
          <FileSpreadsheet className="w-4 h-4" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Import Fundraisers from CSV</DialogTitle>
          <DialogDescription>
            {step === 1 ? "Upload your spreadsheet to batch import fundraisers." : "Map your CSV columns to the system fields."}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="grid gap-4 py-4">
            <Label htmlFor="csv-upload" className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:bg-muted/50 transition-colors flex flex-col items-center gap-3">
              <Upload className="w-8 h-8 text-muted-foreground" />
              <div className="text-sm font-medium">Click to select a CSV file</div>
              <div className="text-xs text-muted-foreground">.csv files only</div>
              <Input id="csv-upload" type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
            </Label>
          </div>
        ) : (
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto px-1">
            <div className="bg-primary/10 text-primary p-3 rounded-lg text-sm mb-2 border border-primary/20">
              Found <strong>{csvData.length}</strong> rows. Select which column from your file matches each system field.
            </div>

            <div className="grid grid-cols-2 gap-4 items-end mb-2">
              <div className="space-y-1.5">
                 <Label className="text-xs font-semibold uppercase text-muted-foreground">Assign all to location:</Label>
                 <Select value={fallbackLocationId} onValueChange={setFallbackLocationId}>
                   <SelectTrigger>
                     <SelectValue />
                   </SelectTrigger>
                   <SelectContent>
                     {locations.map(loc => <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>)}
                   </SelectContent>
                 </Select>
              </div>
            </div>
            
            <div className="space-y-4">
              {TARGET_FIELDS.map(field => (
                <div key={field.id} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <Label className="text-sm">{field.label}</Label>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  <Select value={mapping[field.id] || "unmapped"} onValueChange={(val) => setMapping({ ...mapping, [field.id]: val === "unmapped" ? "" : val })}>
                    <SelectTrigger className={!mapping[field.id] && field.label.includes("Required") ? "border-destructive" : ""}>
                      <SelectValue placeholder="Ignore" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unmapped" className="text-muted-foreground italic">-- Ignore --</SelectItem>
                      {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 2 && (
            <Button onClick={handleImport} disabled={isImporting || !mapping.organization || !mapping.event_date} className="w-full">
              {isImporting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importing...</> : "Confirm & Import"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
