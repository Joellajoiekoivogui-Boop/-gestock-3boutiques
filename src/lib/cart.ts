// Calculs du panier côté caisse (aperçu instantané).
// Le serveur recalcule TOUT à partir des prix en base au moment de valider :
// ces valeurs ne servent qu'à l'affichage.

export type CartLine = {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  // null = stock non suivi (pas de limite)
  maxQuantity: number | null;
};

export const MAX_LINE_QUANTITY = 10_000;

export function clampQuantity(quantity: number, maxQuantity: number | null): number {
  const limit = Math.min(MAX_LINE_QUANTITY, maxQuantity ?? MAX_LINE_QUANTITY);
  if (!Number.isFinite(quantity)) return 1;
  return Math.max(0, Math.min(Math.trunc(quantity), limit));
}

export function lineTotal(line: Pick<CartLine, 'unitPrice' | 'quantity'>): number {
  return line.unitPrice * line.quantity;
}

export function cartTotals(lines: CartLine[], discount: number) {
  const subtotal = lines.reduce((sum, line) => sum + lineTotal(line), 0);
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const safeDiscount = Math.max(0, Math.min(Math.trunc(Number.isFinite(discount) ? discount : 0), subtotal));
  return { subtotal, discount: safeDiscount, total: subtotal - safeDiscount, itemCount };
}

export function addToCart(lines: CartLine[], product: Omit<CartLine, 'quantity'>): CartLine[] {
  const existing = lines.find((l) => l.productId === product.productId);
  if (!existing) {
    if (product.maxQuantity !== null && product.maxQuantity < 1) return lines;
    return [...lines, { ...product, quantity: 1 }];
  }
  return setQuantity(lines, product.productId, existing.quantity + 1);
}

export function setQuantity(lines: CartLine[], productId: string, quantity: number): CartLine[] {
  return lines
    .map((line) =>
      line.productId === productId ? { ...line, quantity: clampQuantity(quantity, line.maxQuantity) } : line,
    )
    .filter((line) => line.quantity > 0);
}

export function removeFromCart(lines: CartLine[], productId: string): CartLine[] {
  return lines.filter((line) => line.productId !== productId);
}
