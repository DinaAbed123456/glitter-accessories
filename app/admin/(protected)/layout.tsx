import { redirect } from "next/navigation";
import { getAdminRole } from "@/actions/auth";
export default async function AdminLayout({children}:{children:React.ReactNode}){const role=await getAdminRole();if(!role)redirect("/admin/login");return children;}
