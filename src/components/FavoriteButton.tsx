"use client";

import { useState } from "react";
import { toggleFavorite } from "@/actions/favorites";

export default function FavoriteButton({ productId }: { productId: string }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function toggle() { setBusy(true); const result = await toggleFavorite(productId); setMessage(result.message); setBusy(false); }
  return <button type="button" onClick={toggle} disabled={busy} className="border border-black/20 px-6 py-3 text-xs">♡ المفضلة{message ? ` · ${message}` : ""}</button>;
}
