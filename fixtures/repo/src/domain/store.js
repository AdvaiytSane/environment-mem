export const USERS = [
  { id: 'u1', name: 'Ada Lovelace', email: 'ada@example.com', createdAt: '2025-01-10T00:00:00.000Z' },
  { id: 'u2', name: 'Grace Hopper', email: 'grace@example.com', createdAt: '2025-01-12T00:00:00.000Z' },
  { id: 'u3', name: 'Alan Turing', email: 'alan@example.com', createdAt: '2025-02-01T00:00:00.000Z' },
  { id: 'u4', name: 'Katherine Johnson', email: 'kat@example.com', createdAt: '2025-02-15T00:00:00.000Z' },
  { id: 'u5', name: 'Margaret Hamilton', email: 'margaret@example.com', createdAt: '2025-03-01T00:00:00.000Z' },
];

export const ORDERS = [
  { id: 'o1', userId: 'u1', amountCents: 5000, status: 'paid', createdAt: '2025-01-20T00:00:00.000Z' },
  { id: 'o2', userId: 'u1', amountCents: 2500, status: 'refunded', createdAt: '2025-01-22T00:00:00.000Z' },
  { id: 'o3', userId: 'u2', amountCents: 10000, status: 'paid', createdAt: '2025-01-25T00:00:00.000Z' },
  { id: 'o4', userId: 'u2', amountCents: 3000, status: 'paid', createdAt: '2025-02-02T00:00:00.000Z' },
  { id: 'o5', userId: 'u3', amountCents: 7500, status: 'pending', createdAt: '2025-02-10T00:00:00.000Z' },
  { id: 'o6', userId: 'u1', amountCents: 1200, status: 'paid', createdAt: '2025-02-12T00:00:00.000Z' },
  { id: 'o7', userId: 'u4', amountCents: 4200, status: 'paid', createdAt: '2025-02-20T00:00:00.000Z' },
  { id: 'o8', userId: 'u5', amountCents: 9900, status: 'refunded', createdAt: '2025-03-05T00:00:00.000Z' },
  { id: 'o9', userId: 'u2', amountCents: 1500, status: 'refunded', createdAt: '2025-03-08T00:00:00.000Z' },
  { id: 'o10', userId: 'u3', amountCents: 6600, status: 'paid', createdAt: '2025-03-10T00:00:00.000Z' },
];
