import { sql } from "@/lib/db";

/**
 * Store identity resolution, memoized per process.
 *
 * The previous Odoo sync re-queried store_alias_mapping and store_dimension once per order
 * inside its loop — two Neon HTTP round-trips per order — and left store_id NULL whenever the
 * lookup missed. Resolving from a single cached snapshot removes the N+1 and makes a miss
 * explicit rather than silently producing an unlinked row.
 */

interface StoreSnapshot {
	/** lowercased source_name -> canonical_store */
	aliases: Map<string, string>;
	/** store_name -> store_dimension.id */
	dimensions: Map<string, number>;
	loadedAt: number;
}

export interface ResolvedStore {
	canonicalStore: string;
	storeId: number | null;
}

let snapshot: StoreSnapshot | null = null;

/** Cache lifetime. Store dimensions change on the order of months; a minute is ample. */
const TTL_MS = 60_000;

async function loadSnapshot(): Promise<StoreSnapshot> {
	const [aliasRows, dimensionRows] = await Promise.all([
		sql`SELECT source_name, canonical_store FROM store_alias_mapping`,
		sql`SELECT id, store_name FROM store_dimension`,
	]);

	const aliases = new Map<string, string>();
	for (const row of aliasRows as { source_name: string; canonical_store: string }[]) {
		if (row.source_name) {
			aliases.set(row.source_name.trim().toLowerCase(), row.canonical_store);
		}
	}

	const dimensions = new Map<string, number>();
	for (const row of dimensionRows as { id: number; store_name: string }[]) {
		if (row.store_name) dimensions.set(row.store_name, Number(row.id));
	}

	return { aliases, dimensions, loadedAt: Date.now() };
}

/** Drops the cache. Long-running scripts call this after seeding new aliases. */
export function invalidateStoreCache(): void {
	snapshot = null;
}

/**
 * Maps a raw source store name to its canonical name and store_dimension id.
 *
 * Returns storeId: null when the canonical name has no store_dimension row — callers should
 * treat that as a data-quality signal rather than a normal outcome.
 */
export async function resolveStore(rawStoreName: string): Promise<ResolvedStore> {
	if (!snapshot || Date.now() - snapshot.loadedAt > TTL_MS) {
		snapshot = await loadSnapshot();
	}

	const raw = (rawStoreName ?? "").trim();
	const canonicalStore = snapshot.aliases.get(raw.toLowerCase()) ?? raw;
	const storeId = snapshot.dimensions.get(canonicalStore) ?? null;

	return { canonicalStore, storeId };
}
