"use client";

export default function AddToCartButton({ productId, disabled = false }: { productId: string; disabled?: boolean }) {
  function add() {
    const raw = localStorage.getItem("glitter-cart-v1");
    const cart: Record<string, number> = raw ? JSON.parse(raw) : {};
    cart[productId] = Math.min(20, (cart[productId] || 0) + 1);
    localStorage.setItem("glitter-cart-v1", JSON.stringify(cart));
    window.dispatchEvent(new Event("glitter-cart-change"));
  }
  return <button onClick={add} disabled={disabled} className="bg-[#211e1c] px-7 py-3 text-xs text-white disabled:opacity-40">أضيفي إلى السلة</button>;
}
