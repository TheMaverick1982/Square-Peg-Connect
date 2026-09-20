import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { locations } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Camera, ImagePlus, Loader2, X, CheckCircle2 } from "lucide-react";

export default function PublicPhotoUpload() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    staff_name: "",
    location_id: "",
    notes: ""
  });
  
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    
    const selectedFiles = Array.from(e.target.files);
    
    // Filter for images only
    const imageFiles = selectedFiles.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length !== selectedFiles.length) {
      toast({
        title: "Images only",
        description: "Some files were skipped because they are not images.",
        variant: "destructive"
      });
    }
    
    setFiles(prev => [...prev, ...imageFiles]);
    
    // Create preview URLs
    const newPreviews = imageFiles.map(file => URL.createObjectURL(file));
    setPreviews(prev => [...prev, ...newPreviews]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    
    // Revoke object URL to prevent memory leaks
    URL.revokeObjectURL(previews[index]);
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const submitPhotos = useMutation({
    mutationFn: async () => {
      if (!files.length) throw new Error("Please select at least one photo.");
      
      const uploadedUrls: string[] = [];
      
      // 1. Upload all files to Supabase Storage
      for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
        const filePath = `${formData.location_id}/${fileName}`;
        
        const { error: uploadError, data } = await supabase.storage
          .from('staff-photos')
          .upload(filePath, file);
          
        if (uploadError) throw uploadError;
        
        const { data: publicUrlData } = supabase.storage
          .from('staff-photos')
          .getPublicUrl(filePath);
          
        uploadedUrls.push(publicUrlData.publicUrl);
      }
      
      // 2. Save submission to database
      const { data: submission, error: dbError } = await supabase
        .from('staff_photo_submissions')
        .insert([{
          staff_name: formData.staff_name,
          location_id: formData.location_id,
          notes: formData.notes,
          photo_urls: uploadedUrls
        }])
        .select()
        .single();
        
      if (dbError) throw dbError;
      
      // 3. Trigger email notification
      const { error: fnError } = await supabase.functions.invoke('send-staff-photo-alert', {
        body: { 
          submission, 
          location: locations.find(l => l.id === formData.location_id) 
        }
      });
      
      if (fnError) {
        console.error("Email notification failed:", fnError);
        // We don't throw here because the photos were successfully uploaded
      }
      
      return submission;
    },
    onSuccess: () => {
      setIsSuccess(true);
      // Clean up object URLs
      previews.forEach(url => URL.revokeObjectURL(url));
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-muted/30 py-12 px-4 flex items-center justify-center">
        <div className="max-w-md w-full bg-card rounded-2xl shadow-xl border p-8 text-center animate-in fade-in zoom-in duration-500">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold mb-3">Upload Complete!</h2>
          <p className="text-muted-foreground mb-8">
            Thank you for sharing! Your photos have been sent to the marketing team.
          </p>
          <Button 
            className="w-full" 
            onClick={() => {
              setFormData({ staff_name: "", location_id: "", notes: "" });
              setFiles([]);
              setPreviews([]);
              setIsSuccess(false);
            }}
          >
            Upload More Photos
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4 sm:px-6">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <img 
            src="https://media-api-prod.apigateway.co/files/v3/AG-D5HZKZ2TNH/FileID-2859e6a7-48eb-46ed-83a6-9d6ebb5d5850/uploaded-1782298633843015700.png" 
            alt="Square Peg Pizzeria" 
            className="h-16 mx-auto object-contain mb-6"
          />
          <h1 className="text-2xl font-bold tracking-tight">Staff Photo Upload</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Share great moments, busy crowds, and beautiful food directly with the marketing team.
          </p>
        </div>

        <div className="bg-card rounded-xl shadow-sm border p-6 space-y-6">
          <div className="space-y-4">
            <div>
              <Label>Your Name <span className="text-destructive">*</span></Label>
              <Input 
                placeholder="e.g. Sarah" 
                value={formData.staff_name}
                onChange={e => setFormData(f => ({ ...f, staff_name: e.target.value }))}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label>Location <span className="text-destructive">*</span></Label>
              <Select 
                value={formData.location_id} 
                onValueChange={v => setFormData(f => ({ ...f, location_id: v }))}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select your store..." />
                </SelectTrigger>
                <SelectContent>
                  {locations.map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>What's happening? (Optional)</Label>
              <Textarea 
                placeholder="e.g. Crazy busy Saturday night!" 
                value={formData.notes}
                onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))}
                className="mt-1.5 h-20 resize-none"
              />
            </div>
          </div>

          <div className="border-t pt-6">
            <Label className="mb-3 block">Photos <span className="text-destructive">*</span></Label>
            
            {previews.length > 0 && (
              <div className="grid grid-cols-2 gap-3 mb-4">
                {previews.map((url, i) => (
                  <div key={i} className="relative aspect-square rounded-md overflow-hidden group bg-muted border">
                    <img src={url} alt={`Preview ${i}`} className="object-cover w-full h-full" />
                    <button 
                      onClick={() => removeFile(i)}
                      className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-destructive transition-colors"
                      type="button"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Button 
                type="button" 
                variant="outline" 
                className="h-24 border-dashed bg-muted/30 hover:bg-muted/50 flex flex-col gap-2"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.capture = "environment";
                    fileInputRef.current.click();
                  }
                }}
              >
                <Camera className="w-6 h-6 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Take Photo</span>
              </Button>
              
              <Button 
                type="button" 
                variant="outline" 
                className="h-24 border-dashed bg-muted/30 hover:bg-muted/50 flex flex-col gap-2"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.removeAttribute("capture");
                    fileInputRef.current.click();
                  }
                }}
              >
                <ImagePlus className="w-6 h-6 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Choose Library</span>
              </Button>
            </div>
            
            <input 
              type="file" 
              accept="image/*" 
              multiple 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileSelect}
            />
          </div>

          <Button 
            className="w-full h-12 text-lg font-medium mt-6" 
            onClick={() => submitPhotos.mutate()}
            disabled={!formData.staff_name || !formData.location_id || files.length === 0 || submitPhotos.isPending}
          >
            {submitPhotos.isPending ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Uploading...</>
            ) : (
              "Submit Photos"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}