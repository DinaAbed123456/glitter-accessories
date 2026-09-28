import { redirect } from "next/navigation";
type SearchParams = Promise<Record<string,string|string[]|undefined>>;
export default async function SearchPage({searchParams}:{searchParams:SearchParams}) { const p=await searchParams; const q=typeof p.q==="string"?p.q:""; redirect(`/shop?q=${encodeURIComponent(q)}`); }
