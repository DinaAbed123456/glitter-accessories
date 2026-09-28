"use server";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const sections=["categories","products","offers","coupons","banners","delivery_zones","orders","staff","audit_logs","settings"] as const;
const tableBySection={categories:"categories",products:"products",offers:"offers",coupons:"coupons",banners:"banners",delivery_zones:"delivery_zones",orders:"orders",staff:"admin_users",audit_logs:"audit_logs",settings:"store_settings"} as const;
const inputSchema=z.object({section:z.enum(sections),operation:z.enum(["list","save","delete","status"]),id:z.string().uuid().optional(),key:z.string().regex(/^[a-z0-9_.-]{2,100}$/).optional(),values:z.record(z.unknown()).optional()});
const idSchema=z.string().uuid();

export async function adminAction(input:unknown){
 const parsed=inputSchema.safeParse(input);if(!parsed.success)return{ok:false as const,error:"بيانات الإدارة غير صالحة."};
 const {section,operation,id,key,values={}}=parsed.data;
 if(section==="staff")return{ok:false as const,error:"إدارة الموظفين متاحة للأدمن الرئيسي فقط عبر الدعوات."};
 const supabase=await createSupabaseServerClient();const table=tableBySection[section];
 if(operation==="list"){if(section==="offers"){const {data,error}=await supabase.from("offers").select("*,offer_products(product_id)").order("created_at",{ascending:false});return error?{ok:false as const,error:"لا تتوفر صلاحية قراءة هذا القسم."}:{ok:true as const,data:(data??[]).map(o=>({...o,product_ids:o.offer_products.map((x:{product_id:string})=>x.product_id)}))};}let query=supabase.from(table).select("*");if(section==="orders")query=query.order("created_at",{ascending:false});else if(section==="audit_logs")query=query.order("created_at",{ascending:false}).limit(200);else query=query.order("created_at",{ascending:false});const {data,error}=await query;return error?{ok:false as const,error:"لا تتوفر صلاحية قراءة هذا القسم."}:{ok:true as const,data:data??[]};}
 if(operation==="delete"){if(section==="settings"){if(!key)return{ok:false as const,error:"مفتاح الإعداد غير صالح."};const {error}=await supabase.from("store_settings").delete().eq("setting_key",key);return error?{ok:false as const,error:"تعذر حذف الإعداد."}:{ok:true as const};}if(!id||!idSchema.safeParse(id).success)return{ok:false as const,error:"المعرّف غير صالح."};let paths:string[]=[];if(section==="products"){const {data}=await supabase.from("product_images").select("storage_path").eq("product_id",id);paths=(data??[]).map(x=>x.storage_path);}if(section==="banners"){const {data}=await supabase.from("banners").select("media_path").eq("id",id).maybeSingle();if(data?.media_path)paths=[data.media_path];}const {error}=await supabase.from(table).delete().eq("id",id);if(error)return{ok:false as const,error:"تعذر حذف السجل؛ قد يكون مرتبطًا ببيانات أخرى."};if(paths.length)await supabase.storage.from("product-media").remove(paths);return{ok:true as const};}
 if(operation==="status"){if(section!=="orders"||!id)return{ok:false as const,error:"تغيير الحالة متاح للطلبات فقط."};const status=z.enum(["جديد","قيد المعالجة","قيد التجهيز","خرج للتوصيل","تم التسليم","ملغي"]).safeParse(values.status);if(!status.success)return{ok:false as const,error:"حالة الطلب غير صالحة."};const {error}=await supabase.from("orders").update({status:status.data,updated_at:new Date().toISOString()}).eq("id",id);return error?{ok:false as const,error:"تعذر تحديث حالة الطلب."}:{ok:true as const};}
 const schemas={
  categories:z.object({name:z.string().trim().min(2).max(100),slug:z.string().trim().regex(/^[a-z0-9-]+$/).max(120),image_url:z.string().url().or(z.literal("")).optional(),is_visible:z.boolean().default(true),sort_order:z.coerce.number().int().min(0).default(0)}),
  products:z.object({name:z.string().trim().min(2).max(180),description:z.string().max(5000).default(""),price:z.coerce.number().min(0),old_price:z.coerce.number().min(0).nullable().optional(),stock:z.coerce.number().int().min(0),category_id:z.string().uuid().nullable().optional(),is_visible:z.boolean().default(false),is_featured:z.boolean().default(false)}),
  offers:z.object({name:z.string().trim().min(2).max(160),description:z.string().max(3000).default(""),discount_type:z.enum(["percentage","fixed"]),discount_value:z.coerce.number().positive(),starts_at:z.string().datetime(),ends_at:z.string().datetime(),is_active:z.boolean().default(false),product_ids:z.array(z.string().uuid()).max(100).default([])}),
  coupons:z.object({code:z.string().trim().min(3).max(64).transform(v=>v.toUpperCase()),discount_type:z.enum(["percentage","fixed"]),discount_value:z.coerce.number().positive(),minimum_order:z.coerce.number().min(0).default(0),starts_at:z.string().datetime(),ends_at:z.string().datetime(),usage_limit:z.coerce.number().int().min(0).nullable().optional(),is_active:z.boolean().default(false)}),
  banners:z.object({media_path:z.string().max(500).nullable().optional(),media_type:z.enum(["image","video"]).default("image"),title:z.string().max(200).default(""),description:z.string().max(2000).default(""),sort_order:z.coerce.number().int().min(0).default(0),is_active:z.boolean().default(false),destination_type:z.enum(["offer","category","products","page"]).default("products"),destination_id:z.string().uuid().nullable().optional(),destination_url:z.string().max(500).nullable().optional().refine(value=>!value||value.startsWith("/"))}),
  delivery_zones:z.object({name:z.string().trim().min(2).max(100),fee:z.coerce.number().min(0),is_active:z.boolean().default(true)}),
  settings:z.object({setting_key:z.string().trim().regex(/^[a-z0-9_.-]{2,100}$/),setting_value:z.string().max(10000)}),
 };
 if(section==="orders"||section==="audit_logs")return{ok:false as const,error:"لا يمكن إنشاء سجل في هذا القسم."};
 const schema=schemas[section];const result=schema.safeParse(values);if(!result.success)return{ok:false as const,error:"تحققي من الحقول المطلوبة والقيم المدخلة."};
 const db=supabase as unknown as {from:(name:string)=>any};let payload:Record<string,unknown>={...result.data,...(id?{id}:{})};let productIds:string[]=[];
 if(section==="offers"){const offer=result.data as z.infer<typeof schemas.offers>;productIds=offer.product_ids;const {product_ids:_,...offerValues}=offer;payload={...offerValues,...(id?{id}:{})};}
 if(section==="settings"){const settings=result.data as z.infer<typeof schemas.settings>;payload={setting_key:settings.setting_key,setting_value:settings.setting_value,updated_by:(await supabase.auth.getUser()).data.user?.id,updated_at:new Date().toISOString()};}
 const {data,error}=await db.from(table).upsert(payload,{onConflict:section==="settings"?"setting_key":"id"}).select().single();if(error)return{ok:false as const,error:"تعذر حفظ التغييرات؛ تحققي من الصلاحيات والقيم الفريدة."};
 if(section==="offers"){const {error:clearError}=await supabase.from("offer_products").delete().eq("offer_id",data.id);if(clearError)return{ok:false as const,error:"حُفظ العرض لكن تعذر تحديث المنتجات المرتبطة."};if(productIds.length){const {error:linkError}=await supabase.from("offer_products").insert(productIds.map(product_id=>({offer_id:data.id,product_id})));if(linkError)return{ok:false as const,error:"حُفظ العرض لكن تعذر ربط المنتجات."};}}
 return{ok:true as const,data};
}

export async function uploadProductImage(input:{productId:unknown;file:File;altText?:unknown}){
 const id=idSchema.safeParse(input.productId);const alt=z.string().max(300).safeParse(input.altText??"");
 if(!id.success||!alt.success||!(input.file instanceof File)||input.file.size===0||input.file.size>8*1024*1024||!(["image/jpeg","image/png","image/webp","image/avif"].includes(input.file.type)))return{ok:false as const,error:"الصورة غير صالحة. الحد الأقصى ٨ ميغابايت."};
 const supabase=await createSupabaseServerClient();const ext=input.file.type.split("/")[1].replace("jpeg","jpg");const path=`products/${id.data}/${crypto.randomUUID()}.${ext}`;
 const {error:uploadError}=await supabase.storage.from("product-media").upload(path,input.file,{contentType:input.file.type,upsert:false});if(uploadError)return{ok:false as const,error:"تعذر رفع الصورة؛ تحققي من صلاحية إدارة المنتجات."};
 const {error:rowError}=await supabase.from("product_images").insert({product_id:id.data,storage_path:path,alt_text:alt.data});if(rowError){await supabase.storage.from("product-media").remove([path]);return{ok:false as const,error:"تم الرفع لكن تعذر ربط الصورة بالمنتج."};}return{ok:true as const,path};
}

export async function uploadBannerMedia(input:{bannerId:unknown;file:File}){
 const id=idSchema.safeParse(input.bannerId);if(!id.success||!(input.file instanceof File)||input.file.size===0||input.file.size>20*1024*1024||!(["image/jpeg","image/png","image/webp","image/avif","video/mp4","video/webm"].includes(input.file.type)))return{ok:false as const,error:"ملف الوسائط غير صالح أو يتجاوز ٢٠ ميغابايت."};
 const supabase=await createSupabaseServerClient();const ext=input.file.type.split("/")[1].replace("jpeg","jpg");const path=`banners/${id.data}/${crypto.randomUUID()}.${ext}`;
 const {error:uploadError}=await supabase.storage.from("product-media").upload(path,input.file,{contentType:input.file.type,upsert:false});if(uploadError)return{ok:false as const,error:"تعذر رفع الوسائط؛ تحققي من صلاحية إدارة البانرات."};
 const {error:updateError}=await supabase.from("banners").update({media_path:path,media_type:input.file.type.startsWith("video/")?"video":"image"}).eq("id",id.data);if(updateError){await supabase.storage.from("product-media").remove([path]);return{ok:false as const,error:"تم الرفع لكن تعذر ربط الملف بالبانر."};}return{ok:true as const,path};
}

export async function inviteStaff(input:unknown){
 const values=z.object({email:z.string().trim().email(),permissions:z.array(z.object({section:z.enum(["products","categories","offers","coupons","banners","orders","delivery_zones","audit_logs","settings"]),can_read:z.boolean(),can_write:z.boolean()})).max(9)}).safeParse(input);
 if(!values.success)return{ok:false as const,error:"بيانات الموظف غير صالحة."};const supabase=await createSupabaseServerClient();const {data:role}=await supabase.rpc("current_admin_role");if(role!=="admin")return{ok:false as const,error:"إنشاء الموظفين متاح للأدمن الرئيسي فقط."};
 const admin=createSupabaseAdminClient();const {data:invite,error}=await admin.auth.admin.inviteUserByEmail(values.data.email,{redirectTo:`${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/admin`});if(error||!invite.user)return{ok:false as const,error:"تعذر إرسال دعوة الموظف. تحققي من إعدادات البريد."};
 const {error:staffError}=await admin.from("admin_users").insert({user_id:invite.user.id,role:"staff",created_by:(await supabase.auth.getUser()).data.user?.id});if(staffError)return{ok:false as const,error:"تم إرسال الدعوة لكن تعذر حفظ صلاحيات الموظف."};
  const {error:permissionError}=await admin.from("admin_permissions").insert(values.data.permissions.map(p=>({user_id:invite.user!.id,...p,can_read:p.can_read||p.can_write})));if(permissionError)return{ok:false as const,error:"أُنشئ الموظف لكن تعذر حفظ الصلاحيات."};
 await admin.from("audit_logs").insert({actor_id:(await supabase.auth.getUser()).data.user?.id,action:"invite",entity:"admin_users",entity_id:invite.user.id,details:{email:values.data.email,permissions:values.data.permissions}});return{ok:true as const};
}

export async function adminStaffAction(input:unknown){
 const parsed=z.object({operation:z.enum(["list","permissions","deactivate"]),userId:z.string().uuid().optional(),permissions:z.array(z.object({section:z.enum(["products","categories","offers","coupons","banners","orders","delivery_zones","audit_logs","settings"]),can_read:z.boolean(),can_write:z.boolean()})).max(9).optional()}).safeParse(input);
 if(!parsed.success)return{ok:false as const,error:"الطلب غير صالح."};const supabase=await createSupabaseServerClient();const {data:role}=await supabase.rpc("current_admin_role");if(role!=="admin")return{ok:false as const,error:"هذه العملية للأدمن الرئيسي فقط."};
 try{const admin=createSupabaseAdminClient();const actor=(await supabase.auth.getUser()).data.user?.id;
  if(parsed.data.operation==="list"){const {data:staff,error}=await admin.from("admin_users").select("user_id,is_active,created_at,role").eq("role","staff").order("created_at",{ascending:false});if(error)return{ok:false as const,error:"تعذر تحميل الموظفين."};const ids=(staff??[]).map(x=>x.user_id);const {data:permissions}=ids.length?await admin.from("admin_permissions").select("user_id,section,can_read,can_write").in("user_id",ids):{data:[]};return{ok:true as const,data:(staff??[]).map(person=>({...person,permissions:(permissions??[]).filter(p=>p.user_id===person.user_id)}))};}
  if(!parsed.data.userId)return{ok:false as const,error:"الموظف غير محدد."};const {data:target}=await admin.from("admin_users").select("role").eq("user_id",parsed.data.userId).maybeSingle();if(target?.role!=="staff")return{ok:false as const,error:"لا يمكن تعديل حساب أدمن رئيسي."};
  if(parsed.data.operation==="deactivate"){const {error}=await admin.from("admin_users").delete().eq("user_id",parsed.data.userId);if(error)return{ok:false as const,error:"تعذر سحب صلاحيات الموظف."};await admin.from("audit_logs").insert({actor_id:actor,action:"revoke",entity:"admin_users",entity_id:parsed.data.userId,details:{}});return{ok:true as const};}
  const permissions=parsed.data.permissions??[];await admin.from("admin_permissions").delete().eq("user_id",parsed.data.userId);if(permissions.length){const {error}=await admin.from("admin_permissions").insert(permissions.map(p=>({user_id:parsed.data.userId,...p,can_read:p.can_read||p.can_write})));if(error)return{ok:false as const,error:"تعذر حفظ الصلاحيات."};}await admin.from("audit_logs").insert({actor_id:actor,action:"permissions_update",entity:"admin_users",entity_id:parsed.data.userId,details:{permissions}});return{ok:true as const};
 }catch{return{ok:false as const,error:"إعداد الإدارة غير مكتمل؛ تحققي من مفتاح الخدمة."};}
}
