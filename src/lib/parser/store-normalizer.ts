export interface StoreMapping {
	storeId: number;
	canonicalStore: string;
	displayName: string;
}

export interface StoreNormalizer {
	normalize(rawBilledBy: string): StoreMapping;
}

/**
 * Fetches all aliases and store dimensions from the database and returns a normalizer instance.
 */
export async function createStoreNormalizer(
	sql: any,
): Promise<StoreNormalizer> {
	const aliases = await sql`
		SELECT source_name, canonical_store 
		FROM store_alias_mapping 
		WHERE active = true
	`;

	const dimensions = await sql`
		SELECT id, store_name, display_name 
		FROM store_dimension 
		WHERE active = true
	`;

	// Map to store dimension details by store_name (case-insensitive key)
	const storeMap = new Map<
		string,
		{ id: number; display_name: string; store_name: string }
	>();
	for (const d of dimensions) {
		storeMap.set(d.store_name.toLowerCase(), {
			id: d.id,
			display_name: d.display_name,
			store_name: d.store_name,
		});
	}

	// Map from normalized alias to canonical store_name
	const aliasMap = new Map<string, string>();
	for (const a of aliases) {
		aliasMap.set(a.source_name.toLowerCase().trim(), a.canonical_store);
	}

	// Find the Noida store for default fallback
	const noidaStore = dimensions.find(
		(d: any) => d.store_name === "SmartworksNoida Noida",
	) ||
		dimensions[0] || {
			id: 1,
			store_name: "SmartworksNoida Noida",
			display_name: "Smart Works Noida",
		};

	return {
		normalize(rawBilledBy: string): StoreMapping {
			const cleanRaw = (rawBilledBy || "").trim().toLowerCase();

			// Look up in alias map
			let canonicalStore = aliasMap.get(cleanRaw);

			// If not found in alias map, check if it's already a canonical name (case-insensitive)
			if (!canonicalStore) {
				const match = storeMap.get(cleanRaw);
				if (match) {
					canonicalStore = match.store_name;
				}
			}

			// Strictly enforce that the canonicalStore must be in our storeMap (whitelist)
			if (!canonicalStore || !storeMap.has(canonicalStore.toLowerCase())) {
				if (cleanRaw.includes("klj")) {
					canonicalStore = "Klj store";
				} else {
					canonicalStore = "SmartworksNoida Noida";
				}
			}

			// Look up dimensions for canonical store
			const dim = storeMap.get(canonicalStore.toLowerCase());
			if (dim) {
				return {
					storeId: dim.id,
					canonicalStore: dim.store_name,
					displayName: dim.display_name,
				};
			}

			// Fallback to Noida
			return {
				storeId: noidaStore.id,
				canonicalStore: noidaStore.store_name,
				displayName: noidaStore.display_name,
			};
		},
	};
}
