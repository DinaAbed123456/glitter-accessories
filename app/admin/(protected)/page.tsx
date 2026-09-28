import AdminConsole from "@/components/AdminConsole";
import { getAdminRole } from "@/actions/auth";
export default async function AdminPage(){const role=await getAdminRole();if(!role)return null;return <AdminConsole role={role}/>;}
