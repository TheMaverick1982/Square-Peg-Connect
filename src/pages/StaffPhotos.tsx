import { storeClock, tzForLocation, tzLabel } from "@/lib/tz";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useLocationContext } from "@/lib/LocationContext";
import { locations } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { Camera, MapPin, Download, Expand, X, Loader2, Calendar, Trash2, Check } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { useToast } from "@/hooks/use-toast";
import { AlertRecipientsButton } from "@/components/AlertRecipientsButton";
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface PhotoSubmission {
  id: string;
  created_at: string;
  submitter_name: string;
  location_id: string;
  notes: string;
  photo_urls: string[];
}

interface FlattenedPhoto {
  id: string; // The URL itself serves as a unique ID for the specific photo
  url: string;
  submission: PhotoSubmission;
}

export default function StaffPhotos() {
  const { selectedLocationId } = useLocationContext();
  const [selectedPhoto, setSelectedPhoto] = useState<FlattenedPhoto | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDownloading, setIsDownloading] = useState(false);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
  const allPhotos: FlattenedPhoto[] = submissions.flatMap(sub => 
    (sub.photo_urls || []).map(url => ({
      id: url,
      url,
      submission: sub
    }))
  );

  const toggleSelection = (id: string, e?: React.SyntheticEvent) => {
    e?.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === allPhotos.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allPhotos.map(p => p.id)));
    }
  };

  const downloadSelected = async () => {
    if (selectedIds.size === 0) return;
    setIsDownloading(true);
    
    try {
      const zip = new JSZip();
      const folder = zip.folder("SquarePeg_StaffPhotos");
      
      const photosToDownload = allPhotos.filter(p => selectedIds.has(p.id));
      
      // Fetch all selected images in parallel
      const fetchPromises = photosToDownload.map(async (photo, index) => {
        const response = await fetch(photo.url);
        const blob = await response.blob();
        
        // Construct a clean filename
        const locName = locations.find(l => l.id === photo.submission.location_id)?.name || "Unknown";
        const dateStr = format(new Date(photo.submission.created_at), "yyyy-MM-dd");
        const safeName = photo.submission.submitter_name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        
        // Try to get original extension, fallback to jpg
        const extMatch = photo.url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
        const ext = extMatch ? extMatch[1] : 'jpg';
        
        const fileName = `${dateStr}_${locName}_${safeName}_${index + 1}.${ext}`;
        folder?.file(fileName, blob);
      });
      
      await Promise.all(fetchPromises);
      
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `SquarePeg_StaffPhotos_${format(new Date(), "yyyy-MM-dd")}.zip`);
      
      toast({ title: `Successfully downloaded ${photosToDownload.length} photos` });
      setSelectedIds(new Set());
    } catch (error) {
      console.error("Download failed:", error);
      toast({ title: "Download failed", description: "There was an error generating the zip file.", variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async () => {
      // Group by submission to minimize database updates
      const photosToDelete = allPhotos.filter(p => selectedIds.has(p.id));
      const submissionsToUpdate = new Map<string, string[]>();
      
      // Figure out which URLs to keep for each submission
      allPhotos.forEach(p => {
        if (!selectedIds.has(p.id)) {
          const keepList = submissionsToUpdate.get(p.submission.id) || [];
          keepList.push(p.url);
          submissionsToUpdate.set(p.submission.id, keepList);
        } else {
          // Ensure the submission exists in the map even if empty
          if (!submissionsToUpdate.has(p.submission.id)) {
            submissionsToUpdate.set(p.submission.id, []);
          }
        }
      });

      // 1. Delete from storage bucket
      const filePaths = photosToDelete.map(p => {
        const urlParts = p.url.split('/public/staff-photos/');
        return urlParts.length > 1 ? urlParts[1] : '';
      }).filter(Boolean);

      if (filePaths.length > 0) {
        const { error: storageError } = await supabase.storage.from('staff-photos').remove(filePaths);
        if (storageError) console.error("Storage delete error:", storageError);
      }

      // 2. Update or delete database rows
      for (const [subId, remainingUrls] of submissionsToUpdate.entries()) {
        if (remainingUrls.length === 0) {
          // Delete entire submission row if no photos left
          await supabase.from('staff_photo_submissions').delete().eq('id', subId);
        } else {
          // Update row with remaining photos
          await supabase.from('staff_photo_submissions').update({ photo_urls: remainingUrls }).eq('id', subId);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff_photos'] });
      setSelectedIds(new Set());
      toast({ title: "Photos deleted successfully" });
    },
    onError: (error) => {
      toast({ title: "Failed to delete photos", description: error.message, variant: "destructive" });
    }
  });

  const downloadSinglePhoto = async (url: string, e: React.MouseEvent) => {
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
        
        <div className="flex flex-wrap items-center gap-2">
          <AlertRecipientsButton
            settingKey="staff_photos"
            title="Staff photo email alerts"
            description="These people get an email (with thumbnails) every time photos are uploaded on the Staff Photo form. One email per line."
          />
          {selectedIds.size > 0 && (
            <>
              <Button 
                variant="outline" 
                onClick={downloadSelected}
                disabled={isDownloading}
              >
                {isDownloading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Zipping...</>
                ) : (
                  <><Download className="w-4 h-4 mr-2" /> Download ({selectedIds.size})</>
                )}
              </Button>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 className="w-4 h-4 mr-2" /> Delete ({selectedIds.size})
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete {selectedIds.size} photos?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete the selected photos from the database and storage.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => deleteMutation.mutate()} 
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}

          <Button onClick={() => window.open('/public/photo-upload', '_blank')} variant="outline">
            <Camera className="w-4 h-4 mr-2" />
            Upload Link
          </Button>
        </div>
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
        <>
          <div className="flex items-center gap-2 pb-2">
            <Checkbox 
              id="select-all" 
              checked={selectedIds.size === allPhotos.length && allPhotos.length > 0}
              onCheckedChange={toggleSelectAll}
            />
            <Label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
              Select All {allPhotos.length} Photos
            </Label>
            <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">
              {selectedIds.size > 0 ? `${selectedIds.size} selected · click photos to add or remove` : "Tip: tick the box on a photo to start picking"}
            </span>
            {selectedIds.size > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs ml-auto" onClick={() => setSelectedIds(new Set())}>Clear selection</Button>
            )}
          </div>
          
          <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4 pb-12">
            {allPhotos.map((photo, i) => {
              const isSelected = selectedIds.has(photo.id);
              
              return (
                <Card 
                  key={photo.id ?? i} 
                  className={`break-inside-avoid overflow-hidden group cursor-pointer transition-all ${isSelected ? 'ring-4 ring-primary' : 'hover:ring-2 ring-primary/50'}`}
                  // While picking photos, clicking anywhere on a photo selects it; otherwise it opens full screen.
                  onClick={() => (selectedIds.size > 0 ? toggleSelection(photo.id) : setSelectedPhoto(photo))}
                >
                  <div className="relative">
                    <img 
                      src={photo.url} 
                      alt="Staff submission" 
                      className="w-full object-cover bg-muted min-h-[200px]"
                      loading="lazy"
                    />
                    
                    {/* Select button: always visible, big hit area (works on phones/iPads too). */}
                    <button
                      type="button"
                      aria-label={isSelected ? "Deselect photo" : "Select photo"}
                      aria-pressed={isSelected}
                      className={`absolute top-0 left-0 z-10 p-2.5 ${isSelected ? '' : 'opacity-90 hover:opacity-100'}`}
                      onClick={(e) => toggleSelection(photo.id, e)}
                    >
                      <span className={`flex items-center justify-center w-7 h-7 rounded-md border-2 shadow-sm transition-colors ${isSelected ? 'bg-primary border-primary text-primary-foreground' : 'bg-background/90 border-white'}`}>
                        {isSelected && <Check className="w-4 h-4" strokeWidth={3} />}
                      </span>
                    </button>

                    {selectedIds.size === 0 ? (
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                        <Expand className="w-8 h-8 text-white" />
                      </div>
                    ) : (
                      <>
                        {isSelected && <div className="absolute inset-0 bg-primary/15 pointer-events-none" />}
                        <button
                          type="button"
                          title="View full screen"
                          className="absolute bottom-2 right-2 z-10 h-8 w-8 rounded-full bg-background/90 shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => { e.stopPropagation(); setSelectedPhoto(photo); }}
                        >
                          <Expand className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    
                    <Button 
                      size="icon" 
                      variant="secondary" 
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 rounded-full shadow-md z-10"
                      onClick={(e) => downloadSinglePhoto(photo.url, e)}
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
              );
            })}
          </div>
        </>
      )}

      {/* Full Screen Photo Modal */}
      <Dialog open={!!selectedPhoto} onOpenChange={(open) => !open && setSelectedPhoto(null)}>
        <DialogContent className="max-w-5xl w-full p-4 bg-background border-border shadow-lg gap-0">
          <VisuallyHidden.Root>
            <DialogTitle>View Photo</DialogTitle>
            <DialogDescription>Full screen photo preview</DialogDescription>
          </VisuallyHidden.Root>
          
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-4 flex-1">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                  <Select 
                    value={selectedPhoto?.submission.location_id}
                    onValueChange={(val) => {
                      if (!selectedPhoto) return;
                      
                      // Optimistically update UI
                      setSelectedPhoto({
                        ...selectedPhoto,
                        submission: {
                          ...selectedPhoto.submission,
                          location_id: val
                        }
                      });
                      
                      // Persist to DB
                      supabase.from('staff_photo_submissions')
                        .update({ location_id: val })
                        .eq('id', selectedPhoto.submission.id)
                        .then(({ error }) => {
                          if (error) {
                            toast({ title: "Error updating location", description: error.message, variant: "destructive" });
                          } else {
                            queryClient.invalidateQueries({ queryKey: ['staff_photos'] });
                          }
                        });
                    }}
                  >
                    <SelectTrigger className="w-[200px] h-8">
                      <SelectValue placeholder="Select Location" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map(loc => (
                        <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {selectedPhoto && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    {format(storeClock(selectedPhoto.submission.created_at, tzForLocation(selectedPhoto.submission.location_id)), "MMM d, yyyy h:mm a")} {tzLabel(selectedPhoto.submission.created_at, tzForLocation(selectedPhoto.submission.location_id))}
                  </div>
                )}
              </div>
              <DialogClose asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full shrink-0">
                  <X className="w-4 h-4" />
                </Button>
              </DialogClose>
            </div>

            <div className="relative flex items-center justify-center min-h-[50vh] bg-muted/30 rounded-lg overflow-hidden border">
              {selectedPhoto && (
                <img 
                  src={selectedPhoto.url} 
                  alt="Full screen preview" 
                  className="max-h-[75vh] w-auto object-contain"
                />
              )}
            </div>
            
            {selectedPhoto?.submission.notes && (
              <div className="pt-2 text-sm">
                <span className="font-semibold mr-2">{selectedPhoto.submission.submitter_name}:</span>
                <span className="text-muted-foreground italic">"{selectedPhoto.submission.notes}"</span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
