import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Link as LinkIcon, Code, Copy, CheckCircle2, Share } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ShareFormDialogProps {
  formTitle: string;
  formPath: string; // e.g., '/public/catering'
}

export function ShareFormDialog({ formTitle, formPath }: ShareFormDialogProps) {
  const { toast } = useToast();
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  // Dynamically extract the base path from the current URL to ensure it works
  // correctly through the Vibe proxy sandbox without stripping the UUIDs.
  const basePath = window.location.pathname.split('/').slice(0, -1).join('/');
  const url = `${window.location.origin}${basePath}${formPath}`;

  const embedCode = `<iframe src="${url}" width="100%" height="800" frameborder="0" style="border: none; border-radius: 8px; min-height: 800px;"></iframe>`;

  const copyToClipboard = (text: string, isEmbed: boolean) => {
    navigator.clipboard.writeText(text);
    if (isEmbed) {
      setCopiedEmbed(true);
      setTimeout(() => setCopiedEmbed(false), 2000);
      toast({ title: "Embed Code Copied", description: "The iframe code has been copied to your clipboard." });
    } else {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      toast({ title: "Link Copied", description: "The public form link has been copied to your clipboard." });
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 shadow-sm">
          <Share className="w-4 h-4" />
          Share Form
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share {formTitle}</DialogTitle>
          <DialogDescription>
            Share the direct link to the public form, or embed it seamlessly on your own website.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Direct Link Section */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <LinkIcon className="w-4 h-4" /> Direct Link
            </Label>
            <div className="flex gap-2">
              <Input readOnly value={url} className="bg-muted/50" />
              <Button 
                variant="secondary" 
                className="shrink-0 w-24"
                onClick={() => copyToClipboard(url, false)}
              >
                {copiedLink ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                {copiedLink ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Send this link directly to customers via email, text, or social media.
            </p>
          </div>

          {/* Embed Code Section */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Code className="w-4 h-4" /> Website Embed Code
            </Label>
            <div className="flex gap-2 items-start">
              <Textarea 
                readOnly 
                value={embedCode} 
                className="bg-muted/50 min-h-[100px] font-mono text-xs resize-none" 
              />
              <Button 
                variant="secondary" 
                className="shrink-0 w-24"
                onClick={() => copyToClipboard(embedCode, true)}
              >
                {copiedEmbed ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                {copiedEmbed ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Paste this HTML snippet into your WordPress, Squarespace, or Webflow site to embed the form directly on your page.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
