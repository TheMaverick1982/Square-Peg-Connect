import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Link as LinkIcon, Loader2, DollarSign } from "lucide-react";
import type { CateringOrder } from "@/lib/data";

interface QuoteItem {
  description: string;
  amount: number;
  quantity: number;
}

export function QuoteBuilder({ order, onUpdate }: { order: CateringOrder; onUpdate: (updated: CateringOrder) => void }) {
  const { toast } = useToast();
  const [items, setItems] = useState<QuoteItem[]>(order.quoteItems || []);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [paymentLink, setPaymentLink] = useState(order.paymentLink || "");

  const total = items.reduce((sum, item) => sum + (item.amount * item.quantity), 0);

  const handleAddItem = () => {
    setItems([...items, { description: "", amount: 0, quantity: 1 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof QuoteItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSaveQuote = async () => {
    setIsSaving(true);
    const { error } = await supabase
      .from('catering_requests')
      .update({ quote_items: items, quote_total: total })
      .eq('id', order.id);

    setIsSaving(false);
    
    if (error) {
      toast({ title: "Error saving quote", description: error.message, variant: "destructive" });
      return;
    }
    
    onUpdate({ ...order, quoteItems: items, quoteTotal: total });
    toast({ title: "Quote saved", description: "Quote items have been updated." });
  };

  const handleGenerateLink = async () => {
    if (items.length === 0) {
      toast({ title: "No items", description: "Add at least one item to generate a quote.", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    
    // First save the current items
    await handleSaveQuote();

    const { data, error } = await supabase.functions.invoke('create-stripe-payment', {
      body: {
        items,
        customerEmail: order.email || "",
        customerName: order.contactName,
        requestId: order.id,
        successUrl: window.location.origin,
        cancelUrl: window.location.origin
      }
    });

    setIsGenerating(false);

    if (error || data?.error) {
      toast({ title: "Failed to generate link", description: data?.error || error?.message, variant: "destructive" });
      return;
    }

    if (data?.url) {
      const link = data.url;
      setPaymentLink(link);
      
      // Save link to DB and auto-update status to 'Waiting on the customer'
      await supabase.from('catering_requests').update({ 
        payment_link: link,
        status: 'Waiting on the customer' 
      }).eq('id', order.id);
      
      onUpdate({ ...order, paymentLink: link, quoteItems: items, quoteTotal: total, status: 'Waiting on the customer' as any });
      toast({ title: "Link generated", description: "Payment link is ready, and status is now Waiting on Customer!" });
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(paymentLink);
    toast({ title: "Copied!", description: "Payment link copied to clipboard." });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold border-b pb-2 flex items-center gap-2">
        <DollarSign className="w-4 h-4 text-muted-foreground" />
        Quote & Payment
      </h3>
      
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input 
              placeholder="Item description" 
              value={item.description} 
              onChange={(e) => handleItemChange(index, "description", e.target.value)}
              className="flex-1"
            />
            <Input 
              type="number" 
              placeholder="Qty" 
              value={item.quantity || ''} 
              onChange={(e) => handleItemChange(index, "quantity", parseFloat(e.target.value))}
              className="w-20"
              min="1"
            />
            <div className="relative w-24">
              <DollarSign className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input 
                type="number" 
                placeholder="Price" 
                value={item.amount || ''} 
                onChange={(e) => handleItemChange(index, "amount", parseFloat(e.target.value))}
                className="pl-7"
                min="0"
                step="0.01"
              />
            </div>
            <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(index)} className="text-destructive">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
        
        <div className="flex items-center justify-between pt-2">
          <Button variant="outline" size="sm" onClick={handleAddItem} className="gap-1">
            <Plus className="w-3.5 h-3.5" /> Add Item
          </Button>
          <div className="text-sm font-semibold">
            Total: ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      <div className="bg-muted/30 p-4 rounded-lg border mt-4">
        {paymentLink ? (
          <div className="space-y-3 text-center">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mx-auto text-green-600">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <div className="font-medium text-sm">Payment Link Ready</div>
              <div className="text-xs text-muted-foreground mt-1">
                Drop this link in your Vendasta conversation to get paid securely via Stripe.
              </div>
            </div>
            <div className="flex gap-2 justify-center">
              <Button onClick={handleCopyLink} className="gap-2">
                <LinkIcon className="w-4 h-4" /> Copy Link
              </Button>
              <Button variant="outline" onClick={handleGenerateLink} disabled={isGenerating}>
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Regenerate"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Generate a secure Stripe Checkout link for this quote.
            </p>
            <Button onClick={handleGenerateLink} disabled={isGenerating || items.length === 0} className="w-full">
              {isGenerating ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
              ) : (
                "Generate Payment Link"
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
