import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useLocationContext } from "@/lib/LocationContext";
import { locations } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { Camera, MapPin, Download, Expand, X, Loader2, Calendar } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";

interface PhotoSubmission {
  id: string;
  created_at: string;
  submitter_name: string;
  location_id: string;
  notes: string;
  photo_urls: string[];
}

export default function StaffPhotos() {
  const { selectedLocationId } = useLocationContext();
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const { data: submissions = [], isLoading } = useQuery({
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

  // Flatten submissions into a single array of photos for the masonry grid
  const allPhotos = submissions.flatMap(sub => 
    (sub.photo_urls || []).map(url => ({
      url,
      submission: sub
    }))
  );

  const downloadPhoto = async (url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `staff-photo-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Failed to download image", err);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Staff Photos</h1>
          <p className="text-muted-foreground mt-1">Content submitted by team members from the floor.</p>
        </div>
        
        <Button onClick={() => window.open('/public/photo-upload', '_blank')} variant="outline">
          <Camera className="w-4 h-4 mr-2" />
          View Public Upload Form
        </Button>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p>Loading photo gallery...</p>
          </div>
        </div>
      ) : allPhotos.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center border rounded-lg bg-card border-dashed">
          <Camera className="w-12 h-12 text-muted-foreground opacity-20 mb-4" />
          <h3 className="text-lg font-medium">No photos yet</h3>
          <p className="text-muted-foreground mt-1 max-w-sm mx-auto">
            When staff members upload photos from the floor, they will appear in this gallery.
          </p>
        </div>
      ) : (
        <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4 pb-12">
          {allPhotos.map((photo, i) => (
            <Card 
              key={i} 
              className="break-inside-avoid overflow-hidden group cursor-pointer hover:ring-2 ring-primary/50 transition-all"
              onClick={() => setSelectedPhoto(photo.url)}
            >
              <div className="relative">
                <img 
                  src={photo.url} 
                  alt="Staff submission" 
                  className="w-full object-cover bg-muted min-h-[200px]"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Expand className="w-8 h-8 text-white" />
                </div>
                <Button 
                  size="icon" 
                  variant="secondary" 
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 rounded-full shadow-md"
                  onClick={(e) => downloadPhoto(photo.url, e)}
                  title="Download Photo"
                >
                  <Download className="w-4 h-4" />
                </Button>
              </div>
              <CardContent className="p-3 text-xs">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-semibold">{photo.submission.submitter_name}</span>
                  <span className="text-muted-foreground flex items-center">
                    <Calendar className="w-3 h-3 mr-1" />
                    {format(new Date(photo.submission.created_at), "MMM d")}
                  </span>
                </div>
                <div className="flex items-center text-muted-foreground mb-2">
                  <MapPin className="w-3 h-3 mr-1" />
                  {locations.find(l => l.id === photo.submission.location_id)?.name || "Unknown Location"}
                </div>
                {photo.submission.notes && (
                  <p className="text-muted-foreground italic line-clamp-2 border-t pt-2 mt-2">"{photo.submission.notes}"</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Full Screen Photo Modal */}
      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-5xl w-full p-1 bg-transparent border-none shadow-none">
          <VisuallyHidden.Root>
            <DialogTitle>View Photo</DialogTitle>
            <DialogDescription>Full screen photo preview</DialogDescription>
          </VisuallyHidden.Root>
          <div className="relative flex items-center justify-center min-h-[50vh]">
            <DialogClose className="absolute top-0 right-0 m-2 z-50 bg-black/50 text-white rounded-full p-2 hover:bg-black/80 transition-colors">
              <X className="w-5 h-5" />
            </DialogClose>
            {selectedPhoto && (
              <img 
                src={selectedPhoto} 
                alt="Full screen preview" 
                className="max-h-[85vh] w-auto object-contain rounded-md"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
