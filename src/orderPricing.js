export function calculateOrderTotal(subtotal, discountCode) {
  return discountCode === "zosmy2027"
    ? Math.round(subtotal * 0.9)
    : subtotal;
}