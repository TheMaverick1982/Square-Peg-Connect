import { useEffect } from "react";

/** Tell search engines not to index this page (public forms we only share by link). */
export function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow, noarchive";
    document.head.appendChild(meta);
    return () => { meta.remove(); };
  }, []);
}
