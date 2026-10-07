import { storeClock, tzForLocation, tzLabel } from "@/lib/tz";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useLocationContext } from "@/lib/LocationContext";
import { locations } from "@/lib/data";
import { format } from "date-fns";
import { Camera, MapPin, Download, Trash2, Loader2, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

interface PhotoSubmission {
  id: string;
  staff_name: string;
  location_id: string;
  notes: string;
  photo_urls: string[];
  created_at: string;
}

export default function StaffPhotosDashboard() {
  const { selectedLocationId } = useLocationContext();
  const { toast } = useToast();
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const { data: submissions = [], isLoading, refetch } = useQuery({
    queryKey: ['staff_photos', selectedLocationId],
    queryFn: async () => {
      let query = supabase.from('staff_photo_submissions').select('*').order('created_at', { ascending: false });
      if (selectedLocationId) {
        query = query.eq('location_id', selectedLocationId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as PhotoSubmission[];
    }
  });

  const handleDelete = async (id: string, urls: string[]) => {
    try {
      // Delete the record
      const { error: dbError } = await supabase
        .from('staff_photo_submissions')
        .delete()
        .eq('id', id);
        
      if (dbError) throw dbError;

      // Extract file paths from public URLs and delete from storage
      const filePaths = urls.map(url => {
        const parts = url.split('/staff-photos/');
        return parts.length > 1 ? parts[1] : null;
      }).filter(Boolean) as string[];

      if (filePaths.length > 0) {
        await supabase.storage.from('staff-photos').remove(filePaths);
      }

      toast({ title: "Photos deleted successfully" });
      refetch();
    } catch (error: any) {
      toast({ title: "Failed to delete", description: error.message, variant: "destructive" });
    }
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      toast({ title: "Download failed", variant: "destructive" });
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Staff Photos</h1>
          <p className="text-muted-foreground mt-1">
            Browse and download photos uploaded by team members on the ground.
          </p>
        </div>
        <div className="text-sm font-medium bg-muted/50 px-3 py-1.5 rounded-md border text-muted-foreground">
          Public Upload Link: <span className="text-foreground select-all">{window.location.origin}/public/photo-upload</span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : submissions.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-12 text-center bg-muted/10">
          <Camera className="w-12 h-12 text-muted-foreground opacity-20 mb-4" />
          <h3 className="text-xl font-medium mb-2">No photos yet</h3>
          <p className="text-muted-foreground max-w-sm mx-auto">
            Share the public upload link with your staff so they can start sending photos directly from their phones.
          </p>
        </div>
      ) : (
        <div className="columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-6 space-y-6">
          {submissions.map((sub) => (
            <div key={sub.id} className="break-inside-avoid bg-card border rounded-xl overflow-hidden shadow-sm group">
              <div className="p-4 border-b bg-muted/20">
                <div className="flex justify-between items-start mb-2">
                  <div className="font-semibold">{sub.staff_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {format(storeClock(sub.created_at, tzForLocation(sub.location_id)), "MMM d, h:mm a")} {tzLabel(sub.created_at, tzForLocation(sub.location_id))}
                  </div>
                </div>
                <div className="flex items-center text-xs text-muted-foreground mb-2">
                  <MapPin className="w-3 h-3 mr-1" />
                  {locations.find(l => l.id === sub.location_id)?.name || "Unknown"}
                </div>
                {sub.notes && (
                  <p className="text-sm mt-2 pt-2 border-t text-muted-foreground italic">
                    "{sub.notes}"
                  </p>
                )}
              </div>
              
              <div className="p-3 grid grid-cols-2 gap-2 bg-muted/10">
                {sub.photo_urls.map((url, i) => (
                  <div key={i} className={`relative rounded-md overflow-hidden bg-muted aspect-square group/img ${sub.photo_urls.length === 1 ? 'col-span-2' : ''}`}>
                    <img src={url} alt={`Staff upload ${i}`} className="object-cover w-full h-full" loading="lazy" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button size="icon" variant="secondary" className="h-8 w-8 rounded-full" onClick={() => setSelectedPhoto(url)}>
                        <Maximize2 className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="secondary" className="h-8 w-8 rounded-full" onClick={() => handleDownload(url, `staff-photo-${sub.id}-${i}.jpg`)}>
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="p-2 border-t bg-muted/5 flex justify-end">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8">
                      <Trash2 className="w-4 h-4 mr-2" /> Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete these photos?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently remove the submission and delete the image files from storage. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(sub.id, sub.photo_urls)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fullscreen Photo Modal */}
      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-5xl p-1 bg-black/90 border-0 shadow-2xl">
          {selectedPhoto && (
            <div className="relative w-full h-[80vh] flex items-center justify-center">
              <img src={selectedPhoto} alt="Fullscreen preview" className="max-w-full max-h-full object-contain" />
              <Button 
                variant="secondary" 
                className="absolute top-4 right-4 shadow-lg"
                onClick={() => handleDownload(selectedPhoto, `staff-photo-download.jpg`)}
              >
                <Download className="w-4 h-4 mr-2" /> Download
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}