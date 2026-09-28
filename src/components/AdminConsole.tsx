"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import {
  adminAction,
  adminStaffAction,
  inviteStaff,
  uploadBannerMedia,
  uploadProductImage,
} from "@/actions/admin"
import { signOut } from "@/actions/auth"
import { useRouter } from "next/navigation"

const sections = [
  { id: "dashboard", name: "الرئيسية" },
  { id: "products", name: "المنتجات" },
  { id: "categories", name: "الفئات" },
  { id: "offers", name: "العروض" },
  { id: "coupons", name: "الكوبونات" },
  { id: "banners", name: "البانرات" },
  { id: "orders", name: "الطلبات" },
  { id: "delivery_zones", name: "مناطق التوصيل" },
  { id: "staff", name: "الموظفون" },
  { id: "audit_logs", name: "سجل العمليات" },
  { id: "settings", name: "الإعدادات" },
] as const
type Section = typeof sections[number]["id"]
const fields: Partial<Record<Section, {
  key: string
  label: string
  type?: string
}[]>> = {
  categories: [
    { key: "name", label: "اسم الفئة" },
    { key: "slug", label: "الرابط اللاتيني" },
    { key: "image_url", label: "رابط الصورة" },
    { key: "sort_order", label: "الترتيب", type: "number" },
    { key: "is_visible", label: "ظاهرة", type: "checkbox" },
  ],
  products: [
    { key: "name", label: "اسم المنتج" },
    { key: "description", label: "الوصف", type: "textarea" },
    { key: "price", label: "السعر بالشيكل", type: "number" },
    { key: "old_price", label: "السعر السابق", type: "number" },
    { key: "stock", label: "المخزون", type: "number" },
    { key: "category_id", label: "معرّف الفئة" },
    { key: "is_visible", label: "ظاهر", type: "checkbox" },
    { key: "is_featured", label: "مميز", type: "checkbox" },
  ],
  offers: [
    { key: "name", label: "اسم العرض" },
    { key: "description", label: "الوصف", type: "textarea" },
    { key: "discount_type", label: "نوع الخصم (percentage أو fixed)" },
    { key: "discount_value", label: "قيمة الخصم", type: "number" },
    { key: "starts_at", label: "يبدأ", type: "datetime-local" },
    { key: "ends_at", label: "ينتهي", type: "datetime-local" },
    { key: "product_ids", label: "معرّفات المنتجات المرتبطة، مفصولة بفواصل" },
    { key: "is_active", label: "فعال", type: "checkbox" },
  ],
  coupons: [
    { key: "code", label: "الكود" },
    { key: "discount_type", label: "نوع الخصم (percentage أو fixed)" },
    { key: "discount_value", label: "قيمة الخصم", type: "number" },
    { key: "minimum_order", label: "الحد الأدنى", type: "number" },
    { key: "starts_at", label: "يبدأ", type: "datetime-local" },
    { key: "ends_at", label: "ينتهي", type: "datetime-local" },
    {
      key: "usage_limit",
      label: "حد الاستخدام (اتركيه فارغًا بلا حد)",
      type: "number",
    },
    { key: "is_active", label: "فعال", type: "checkbox" },
  ],
  banners: [
    { key: "title", label: "العنوان" },
    { key: "description", label: "الوصف", type: "textarea" },
    { key: "media_path", label: "مسار الوسائط في التخزين" },
    { key: "media_type", label: "النوع (image أو video)" },
    { key: "sort_order", label: "الترتيب", type: "number" },
    { key: "destination_type", label: "نوع الوجهة" },
    { key: "destination_id", label: "معرّف الفئة أو العرض" },
    { key: "destination_url", label: "رابط داخلي يبدأ بـ /" },
    { key: "is_active", label: "فعال", type: "checkbox" },
  ],
  delivery_zones: [
    { key: "name", label: "اسم المنطقة" },
    { key: "fee", label: "سعر التوصيل بالشيكل", type: "number" },
    { key: "is_active", label: "فعالة", type: "checkbox" },
  ],
  settings: [
    { key: "setting_key", label: "مفتاح الإعداد" },
    { key: "setting_value", label: "القيمة" },
  ],
}
export default function AdminConsole({ role }: { role: "admin" | "staff" }) {
  const [section, setSection] = useState<Section>("dashboard")
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null)
  const [notice, setNotice] = useState("")
  const [busy, setBusy] = useState(false)
  const router = useRouter()
  const load = useCallback(async (s: Section) => {
    if (s === "dashboard") {
      const [p, o, c] = await Promise.all([
        adminAction({ section: "products", operation: "list" }),
        adminAction({ section: "orders", operation: "list" }),
        adminAction({ section: "categories", operation: "list" }),
      ])
      const arr = [
        ...(p.ok ? p.data : []),
        ...(o.ok ? o.data : []),
        ...(c.ok ? c.data : []),
      ]
      setRows(arr)
      return
    }
    const result = await adminAction({ section: s, operation: "list" })
    if (result.ok) setRows(result.data as Record<string, unknown>[])
    else {
      setRows([])
      setNotice(result.error)
    }
  }, [])
  useEffect(() => {
    void load(section)
  }, [section, load])
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    const fd = new FormData(e.currentTarget)
    const values: Record<string, unknown> = {}
    for (const field of fields[section] || []) {
      const value = fd.get(field.key)
      values[field.key] =
        field.type === "checkbox"
          ? value === "on"
          : field.key === "product_ids"
            ? String(value || "")
                .split(",")
                .map((v) => v.trim())
                .filter(Boolean)
            : field.type === "number"
              ? value === ""
                ? null
                : Number(value)
              : field.type === "datetime-local"
                ? value
                  ? new Date(String(value)).toISOString()
                  : ""
                : String(value ?? "").trim() || null
    }
    const result = await adminAction({
      section,
      operation: "save",
      id: editing?.id,
      values,
    })
    if (result.ok) {
      const id = (result.data as { id?: string })?.id
      const file = fd.get("image")
      let uploadError = ""
      if (section === "products" && id && file instanceof File && file.size) {
        const upload = await uploadProductImage({
          productId: id,
          file,
          altText: values.name,
        })
        if (!upload.ok) uploadError = upload.error
      }
      if (section === "banners" && id && file instanceof File && file.size) {
        const upload = await uploadBannerMedia({ bannerId: id, file })
        if (!upload.ok) uploadError = upload.error
      }
      setNotice(uploadError || "تم حفظ البيانات.")
      setEditing(null)
      await load(section)
    } else setNotice(result.error)
    setBusy(false)
  }
  async function remove(row: Record<string, unknown>) {
    if (!window.confirm("هل تريدين حذف هذا السجل؟")) return
    const result = await adminAction({
      section,
      operation: "delete",
      id: typeof row.id === "string" ? row.id : undefined,
      key: typeof row.setting_key === "string" ? row.setting_key : undefined,
    })
    setNotice(result.ok ? "تم الحذف." : result.error)
    await load(section)
  }
  async function updateStatus(id: string, status: string) {
    const result = await adminAction({
      section: "orders",
      operation: "status",
      id,
      values: { status },
    })
    setNotice(result.ok ? "تم تحديث حالة الطلب." : result.error)
    await load(section)
  }
  async function logout() {
    await signOut()
    router.push("/admin/login")
    router.refresh()
  }
  const visibleSections = sections.filter(
    (item) => role === "admin" || item.id !== "staff",
  )
  return (
    <div dir="rtl" className="min-h-screen bg-[#f5f2f1] text-[#201d1c]">
      <header className="flex h-20 items-center justify-between border-b border-black/10 bg-white px-5 md:px-8">
        <a href="/" className="font-serif text-2xl">
          Glitter
        </a>
        <div className="flex items-center gap-4 text-xs">
          <span>{role === "admin" ? "الأدمن الرئيسي" : "موظف المتجر"}</span>
          <button onClick={logout} className="underline">
            خروج
          </button>
        </div>
      </header>
      <div className="grid md:grid-cols-[230px_1fr]">
        <aside className="overflow-x-auto bg-[#211e1c] p-3 text-white md:min-h-[calc(100vh-80px)] md:p-5">
          <nav className="flex gap-1 md:block">
            {visibleSections.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setNotice("")
                  setEditing(null)
                  setSection(item.id)
                }}
                className={`whitespace-nowrap px-4 py-3 text-right text-xs md:mb-1 md:block md:w-full ${
                  section === item.id
                    ? "bg-[#bd8589]"
                    : "text-white/65 hover:bg-white/5"
                }`}
              >
                {item.name}
              </button>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 p-5 md:p-9">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-[#ad7e82]">لوحة الإدارة</p>
              <h1 className="mt-2 text-3xl font-light">
                {sections.find((s) => s.id === section)?.name}
              </h1>
            </div>
            {fields[section] && (
              <button
                onClick={() => setEditing({})}
                className="bg-[#211e1c] px-5 py-3 text-xs text-white"
              >
                + إضافة
              </button>
            )}
          </div>
          {notice && (
            <p role="status" className="mt-5 bg-white p-4 text-xs">
              {notice}
            </p>
          )}
          {editing && fields[section] && (
            <form
              onSubmit={save}
              className="mt-6 grid gap-4 border border-black/10 bg-white p-5 md:grid-cols-2"
            >
              <h2 className="text-lg md:col-span-2">
                {editing.id ? "تعديل" : "إضافة"}{" "}
                {sections.find((s) => s.id === section)?.name}
              </h2>
              {fields[section]?.map((field) => (
                <label key={field.key} className="text-xs">
                  {field.label}
                  {field.type === "checkbox" ? (
                    <input
                      name={field.key}
                      type="checkbox"
                      defaultChecked={Boolean(editing[field.key])}
                      className="mr-3"
                    />
                  ) : field.type === "textarea" ? (
                    <textarea
                      name={field.key}
                      defaultValue={String(editing[field.key] || "")}
                      className="mt-2 min-h-24 w-full border border-black/15 p-3"
                    />
                  ) : (
                    <input
                      name={field.key}
                      type={field.type || "text"}
                      required={
                        ![
                          "old_price",
                          "category_id",
                          "image_url",
                          "media_path",
                          "destination_url",
                          "usage_limit",
                        ].includes(field.key)
                      }
                      defaultValue={
                        field.type === "datetime-local" && editing[field.key]
                          ? new Date(String(editing[field.key]))
                              .toISOString()
                              .slice(0, 16)
                          : String(editing[field.key] ?? "")
                      }
                      className="mt-2 w-full border border-black/15 p-3"
                    />
                  )}
                </label>
              ))}
              {(section === "products" || section === "banners") && (
                <label className="text-xs">
                  {section === "products" ? "صورة المنتج" : "صورة أو فيديو البانر"}
                  <input
                    name="image"
                    type="file"
                    accept={
                      section === "products"
                        ? "image/png,image/jpeg,image/webp,image/avif"
                        : "image/png,image/jpeg,image/webp,image/avif,video/mp4,video/webm"
                    }
                    className="mt-2 block w-full border p-3"
                  />
                </label>
              )}
              <div className="flex gap-3 md:col-span-2">
                <button
                  disabled={busy}
                  className="bg-[#211e1c] px-7 py-3 text-xs text-white"
                >
                  حفظ
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="border px-7 py-3 text-xs"
                >
                  إلغاء
                </button>
              </div>
            </form>
          )}
          {section === "dashboard" ? (
            <div className="mt-7 grid gap-4 md:grid-cols-3">
              <Stat
                title="المنتجات"
                count={rows.filter((r) => "price" in r).length}
              />
              <Stat
                title="الطلبات"
                count={rows.filter((r) => "order_number" in r).length}
              />
              <Stat
                title="الفئات"
                count={rows.filter((r) => "slug" in r).length}
              />
            </div>
          ) : section === "staff" ? (
            <StaffPanel setNotice={setNotice} />
          ) : (
            <div className="mt-7 overflow-x-auto bg-white p-5">
              <table className="w-full min-w-[650px] text-right text-xs">
                <thead className="border-b text-black/45">
                  <tr>
                    <th className="py-3">السجل</th>
                    <th>التفاصيل</th>
                    <th>الحالة/التاريخ</th>
                    <th>الإجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr
                      key={String(row.id || i)}
                      className="border-b border-black/5"
                    >
                      <td className="py-4">
                        {String(
                          row.name ||
                            row.product_name ||
                            row.code ||
                            row.order_number ||
                            row.action ||
                            row.id ||
                            "—",
                        )}
                      </td>
                      <td>
                        {String(
                          row.description ||
                            row.email ||
                            row.entity ||
                            row.delivery_zone_name ||
                            "",
                        )}
                      </td>
                      <td>
                        {section === "orders" ? (
                          <select
                            value={String(row.status)}
                            onChange={(e) =>
                              void updateStatus(String(row.id), e.target.value)
                            }
                            className="border p-2"
                          >
                            {[
                              "جديد",
                              "قيد المعالجة",
                              "قيد التجهيز",
                              "خرج للتوصيل",
                              "تم التسليم",
                              "ملغي",
                            ].map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                        ) : (
                          String(row.status || row.created_at || row.fee || "")
                        )}
                      </td>
                      <td>
                        {fields[section] && (
                          <>
                            <button
                              onClick={() => setEditing(row)}
                              className="underline"
                            >
                              تعديل
                            </button>
                            <button
                              onClick={() => void remove(row)}
                              className="mr-3 text-red-700 underline"
                            >
                              حذف
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length === 0 && (
                <p className="py-10 text-center text-xs text-black/45">
                  لا توجد سجلات أو لا تسمح صلاحيتك بعرضها.
                </p>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
function Stat({ title, count }: { title: string; count: number }) {
  return (
    <div className="bg-white p-6">
      <p className="text-xs text-black/45">{title}</p>
      <p className="mt-4 text-3xl">{count}</p>
    </div>
  )
}
function StaffPanel({ setNotice }: { setNotice: (message: string) => void }) {
  const available = [
    "products",
    "categories",
    "offers",
    "coupons",
    "banners",
    "orders",
    "delivery_zones",
  "audit_logs",
  "settings",
  ] as const
  type Permission = {
    section: string
    can_read: boolean
    can_write: boolean
  }
  type Staff = {
    user_id: string
    is_active: boolean
    permissions: Permission[]
  }
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [permissions, setPermissions] = useState<Permission[]>(
    available.map((section) => ({
      section,
      can_read: false,
      can_write: false,
    })),
  )
  const [staff, setStaff] = useState<Staff[]>([])
  const labels: Record<string, string> = {
    products: "المنتجات",
    categories: "الفئات",
    offers: "العروض",
    coupons: "الكوبونات",
    banners: "البانرات",
    orders: "الطلبات",
    delivery_zones: "التوصيل",
    audit_logs: "سجل العمليات",
    settings: "الإعدادات",
  }
  const load = useCallback(async () => {
    const result = await adminStaffAction({ operation: "list" })
    if (result.ok) setStaff(result.data as Staff[])
    else setNotice(result.error)
  }, [setNotice])
  useEffect(() => {
    void load()
  }, [load])
  function toggle(section: string, key: "can_read" | "can_write") {
    setPermissions((current) =>
      current.map((p) =>
        p.section === section
          ? {
              ...p,
              [key]: !p[key],
              ...(key === "can_read" && p.can_read ? { can_write: false } : {}),
            }
          : p,
      ),
    )
  }
  async function create() {
    setBusy(true)
    const result = await inviteStaff({
      email,
      permissions: permissions.filter((p) => p.can_read || p.can_write),
    })
    setNotice(result.ok ? "أُرسلت دعوة الموظف إلى البريد." : result.error)
    if (result.ok) {
      setEmail("")
      await load()
    }
    setBusy(false)
  }
  async function save(staffUser: Staff) {
    setBusy(true)
    const result = await adminStaffAction({
      operation: "permissions",
      userId: staffUser.user_id,
      permissions: staffUser.permissions,
    })
    setNotice(result.ok ? "تم حفظ صلاحيات الموظف." : result.error)
    await load()
    setBusy(false)
  }
  async function deactivate(userId: string) {
    if (!window.confirm("سيتم سحب صلاحيات الإدارة من الموظف. متابعة؟")) return
    const result = await adminStaffAction({ operation: "deactivate", userId })
    setNotice(result.ok ? "تم سحب صلاحيات الموظف." : result.error)
    await load()
  }
  return (
    <div className="mt-7 space-y-6">
      <section className="bg-white p-6">
        <h2 className="text-lg">دعوة موظف</h2>
        <p className="mt-2 text-xs text-black/50">
          الأدمن الرئيسي وحده يستطيع إنشاء حسابات الموظفين وتحديد صلاحياتها.
        </p>
        <label className="mt-5 block max-w-xl text-xs">
          البريد الإلكتروني
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 w-full border p-3"
          />
        </label>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {permissions.map((p) => (
            <div
              key={p.section}
              className="flex flex-wrap items-center gap-3 border p-3 text-xs"
            >
              <strong>{labels[p.section]}</strong>
              <label>
                <input
                  type="checkbox"
                  checked={p.can_read}
                  onChange={() => toggle(p.section, "can_read")}
                />{" "}
                قراءة
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={p.can_write}
                  onChange={() => toggle(p.section, "can_write")}
                />{" "}
                تعديل
              </label>
            </div>
          ))}
        </div>
        <button
          disabled={busy || !email}
          onClick={() => void create()}
          className="mt-5 bg-[#211e1c] px-6 py-3 text-xs text-white"
        >
          إرسال دعوة الموظف
        </button>
      </section>
      <section className="overflow-x-auto bg-white p-6">
        <h2 className="text-lg">الموظفون وصلاحياتهم</h2>
        {staff.map((person) => (
          <article
            key={person.user_id}
            className="mt-5 border border-black/10 p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <code className="text-xs">{person.user_id}</code>
              <span className="text-xs">
                {person.is_active ? "نشط" : "موقوف"}
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {available.map((section) => {
                const item = person.permissions.find(
                  (p) => p.section === section,
                ) || { section, can_read: false, can_write: false }
                return (
                  <div key={section} className="flex gap-3 text-xs">
                    <strong>{labels[section]}</strong>
                    <label>
                      <input
                        type="checkbox"
                        checked={item.can_read}
                        onChange={(e) =>
                          setStaff((current) =>
                            current.map((s) =>
                              s.user_id !== person.user_id
                                ? s
                                : {
                                    ...s,
                                    permissions: [
                                      ...s.permissions.filter(
                                        (p) => p.section !== section,
                                      ),
                                      {
                                        ...item,
                                        can_read: e.target.checked,
                                        can_write: e.target.checked
                                          ? item.can_write
                                          : false,
                                      },
                                    ],
                                  },
                            ),
                          )
                        }
                      />
                      قراءة
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={item.can_write}
                        onChange={(e) =>
                          setStaff((current) =>
                            current.map((s) =>
                              s.user_id !== person.user_id
                                ? s
                                : {
                                    ...s,
                                    permissions: [
                                      ...s.permissions.filter(
                                        (p) => p.section !== section,
                                      ),
                                      {
                                        ...item,
                                        can_read: true,
                                        can_write: e.target.checked,
                                      },
                                    ],
                                  },
                            ),
                          )
                        }
                      />
                      تعديل
                    </label>
                  </div>
                )
              })}
            </div>
            <div className="mt-5 flex gap-4 text-xs">
              <button
                disabled={busy}
                onClick={() => void save(person)}
                className="underline"
              >
                حفظ الصلاحيات
              </button>
              <button
                onClick={() => void deactivate(person.user_id)}
                className="text-red-700 underline"
              >
                إزالة الموظف
              </button>
            </div>
          </article>
        ))}
        {staff.length === 0 && (
          <p className="py-8 text-xs text-black/50">لا يوجد موظفون مسجلون.</p>
        )}
      </section>
    </div>
  )
}
