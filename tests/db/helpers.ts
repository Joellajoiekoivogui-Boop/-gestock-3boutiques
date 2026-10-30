import { randomUUID } from 'node:crypto';
import pg from 'pg';

const url = process.env.TEST_DATABASE_URL;
if (!url) {
  throw new Error('TEST_DATABASE_URL manquant : lancez ces tests avec `npm run test:db`.');
}

export const pool = new pg.Pool({ connectionString: url, max: 20 });

// Requête en super-utilisateur (équivalent de l'éditeur SQL Supabase).
export async function sql<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await pool.query<T>(text, params);
  return result.rows;
}

// Exécute `fn` exactement comme une requête PostgREST d'un utilisateur
// connecté (rôle authenticated + claims JWT), ou anonyme si uid est null.
export async function as<T>(uid: string | null, fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    if (uid) {
      await client.query(`select set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ sub: uid, role: 'authenticated' }),
      ]);
      await client.query('set local role authenticated');
    } else {
      await client.query(`select set_config('request.jwt.claims', '{"role":"anon"}', true)`);
      await client.query('set local role anon');
    }
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function createUser(options: {
  role?: 'admin' | 'cashier';
  active?: boolean;
  permissions?: string[];
  name?: string;
} = {}): Promise<string> {
  const id = randomUUID();
  await sql(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [
    id,
    `${id}@test.local`,
    { full_name: options.name ?? 'Utilisateur test' },
  ]);
  await sql(`update public.profiles set role = $2, is_active = $3, permissions = $4 where id = $1`, [
    id,
    options.role ?? 'cashier',
    options.active ?? true,
    options.permissions ?? [],
  ]);
  return id;
}

export async function createProduct(options: {
  name?: string;
  price: number;
  trackStock?: boolean;
  stock?: number;
  available?: boolean;
}): Promise<string> {
  const [category] = await sql<{ id: string }>(`select id from public.categories order by sort_order limit 1`);
  const [row] = await sql<{ id: string }>(
    `insert into public.products (name, category_id, price, track_stock, stock_quantity, is_available)
     values ($1, $2, $3, $4, $5, $6) returning id`,
    [
      options.name ?? `Produit ${randomUUID().slice(0, 8)}`,
      category.id,
      options.price,
      options.trackStock ?? false,
      options.stock ?? 0,
      options.available ?? true,
    ],
  );
  return row.id;
}

export type SaleResult = {
  sale_id: string;
  receipt_number: string;
  total_amount: number;
  replayed: boolean;
};

export async function createSale(
  uid: string,
  items: { product_id: string; quantity: number; [key: string]: unknown }[],
  options: { method?: string; discount?: number; key?: string } = {},
): Promise<SaleResult> {
  return as(uid, async (client) => {
    const { rows } = await client.query<{ result: SaleResult }>(
      `select public.create_sale($1::jsonb, $2, $3::uuid, $4) as result`,
      [JSON.stringify(items), options.method ?? 'cash', options.key ?? randomUUID(), options.discount ?? 0],
    );
    return rows[0].result;
  });
}

// Retient le produit verrouillé pendant que `run` lance ses requêtes, puis le
// libère : toutes les requêtes concurrentes se retrouvent réellement en
// compétition au même instant.
export async function withProductHeld<T>(productId: string, run: () => Promise<T>): Promise<T> {
  const holder = await pool.connect();
  try {
    await holder.query('begin');
    await holder.query('select id from public.products where id = $1 for update', [productId]);
    const pending = run();
    await new Promise((resolve) => setTimeout(resolve, 400));
    await holder.query('commit');
    return await pending;
  } finally {
    holder.release();
  }
}

export async function stockOf(productId: string): Promise<number> {
  const [row] = await sql<{ stock_quantity: number }>(
    `select stock_quantity from public.products where id = $1`,
    [productId],
  );
  return row.stock_quantity;
}

// numeric arrive en chaîne depuis le pilote pg.
export const n = (value: unknown) => Number(value);
