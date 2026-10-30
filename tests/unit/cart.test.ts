import { describe, expect, it } from 'vitest';
import { addToCart, cartTotals, clampQuantity, removeFromCart, setQuantity, type CartLine } from '@/lib/cart';

const riz = { productId: 'riz', name: 'Riz au poulet', unitPrice: 25000, maxQuantity: null };
const jus = { productId: 'jus', name: 'Jus naturel', unitPrice: 10000, maxQuantity: 3 };

describe('panier', () => {
  it('calcule l’exemple du reçu : 2 × 25 000 + 1 × 10 000 = 60 000', () => {
    let lines: CartLine[] = [];
    lines = addToCart(lines, riz);
    lines = addToCart(lines, riz);
    lines = addToCart(lines, jus);
    expect(cartTotals(lines, 0)).toEqual({ subtotal: 60000, discount: 0, total: 60000, itemCount: 3 });
  });

  it('applique la remise sans jamais dépasser le sous-total', () => {
    const lines = setQuantity(addToCart([], riz), 'riz', 2);
    expect(cartTotals(lines, 5000).total).toBe(45000);
    expect(cartTotals(lines, 999999).total).toBe(0);
    expect(cartTotals(lines, -10).discount).toBe(0);
    expect(cartTotals(lines, Number.NaN).discount).toBe(0);
  });

  it('respecte le stock disponible', () => {
    let lines = addToCart([], jus);
    lines = setQuantity(lines, 'jus', 10);
    expect(lines[0].quantity).toBe(3);
    lines = addToCart(lines, jus);
    expect(lines[0].quantity).toBe(3);
    expect(addToCart([], { ...jus, maxQuantity: 0 })).toEqual([]);
  });

  it('retire la ligne à quantité 0 et sur suppression', () => {
    const lines = addToCart(addToCart([], riz), jus);
    expect(setQuantity(lines, 'riz', 0).map((l) => l.productId)).toEqual(['jus']);
    expect(removeFromCart(lines, 'jus').map((l) => l.productId)).toEqual(['riz']);
  });

  it('borne les quantités saisies', () => {
    expect(clampQuantity(2.7, null)).toBe(2);
    expect(clampQuantity(-4, null)).toBe(0);
    expect(clampQuantity(50000, null)).toBe(10000);
    expect(clampQuantity(Number.NaN, 5)).toBe(1);
  });
});
