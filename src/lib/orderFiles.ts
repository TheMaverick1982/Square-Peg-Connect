import { supabase } from "@/lib/supabase";

export type OrderAttachment = { path: string; name: string; type: string; size: number; url: string };
export const ORDER_FILES_BUCKET = "order-files";
export const ORDER_FILE_MAX_MB = 25;

/** Upload files for a catering order / reservation and return their attachment records. */
export async function uploadOrderFiles(table: string, id: string | number, files: File[]): Promise<OrderAttachment[]> {
  const out: OrderAttachment[] = [];
  for (const f of files) {
    const safe = f.name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-120) || "file";
    const path = `${table}/${id}/${Date.now()}_${safe}`;
    const { error } = await supabase.storage.from(ORDER_FILES_BUCKET).upload(path, f, { contentType: f.type || undefined });
    if (error) throw new Error(`${f.name}: ${error.message}`);
    out.push({ path, name: f.name, type: f.type, size: f.size, url: supabase.storage.from(ORDER_FILES_BUCKET).getPublicUrl(path).data.publicUrl });
  }
  return out;
}
