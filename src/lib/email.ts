import "server-only";

export async function sendStoreEmail(to:string,subject:string,html:string){
 const key=process.env.RESEND_API_KEY;const from=process.env.RESEND_FROM_EMAIL;
 if(!key||!from)return false;
 const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({from,to,subject,html}),cache:"no-store"});
 return response.ok;
}
