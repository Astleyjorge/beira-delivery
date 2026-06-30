// Money is stored as integer centavos on the backend. This converts to a
// readable Metical amount: 35000 → "350,00 MT"
export function formatMetical(cents: number): string {
  const value = (cents / 100).toFixed(2).replace(".", ",");
  return `${value} MT`;
}

// Turns a status enum into human-readable text for the customer.
export function formatStatus(status: string): string {
  const labels: Record<string, string> = {
    placed: "Order placed",
    confirmed: "Confirmed by restaurant",
    preparing: "Being prepared",
    ready_for_pickup: "Ready for pickup",
    rider_assigned: "Rider on the way to restaurant",
    picked_up: "Out for delivery",
    delivered: "Delivered",
    cancelled: "Cancelled",
  };
  return labels[status] ?? status;
}
