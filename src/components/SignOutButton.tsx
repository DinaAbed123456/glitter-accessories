"use client";
import { useRouter } from "next/navigation";
import { signOut } from "@/actions/auth";
export default function SignOutButton(){const router=useRouter();return <button className="underline" onClick={async()=>{await signOut();router.push("/");router.refresh();}}>تسجيل الخروج</button>;}
