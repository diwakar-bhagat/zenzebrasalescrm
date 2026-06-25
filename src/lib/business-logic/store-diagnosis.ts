export interface DiagnosisResult {
	type:
		| "FOOTFALL"
		| "BASKET"
		| "PRODUCT_MIX"
		| "PREMIUM_MIX"
		| "HEALTHY"
		| "STABLE";
	owner:
		| "MARKETING"
		| "MERCHANDISING"
		| "CATEGORY"
		| "OPERATIONS"
		| "STORE_OPS";
	message: string;
	priority: "LOW" | "MEDIUM" | "HIGH";
}

const SIGNIFICANT_CHANGE = 5;

export function diagnoseStore(
	revenueGrowth: number | "NEW STORE",
	billsGrowth: number | "NEW STORE",
	aovGrowth: number | "NEW STORE",
): DiagnosisResult {
	// If it's a new store, return a default welcoming/monitoring status
	if (
		revenueGrowth === "NEW STORE" ||
		billsGrowth === "NEW STORE" ||
		aovGrowth === "NEW STORE"
	) {
		return {
			type: "HEALTHY",
			owner: "STORE_OPS",
			message: "New store setup. Establishing performance baselines.",
			priority: "LOW",
		};
	}

	const rev = Number(revenueGrowth ?? 0);
	const bills = Number(billsGrowth ?? 0);
	const aov = Number(aovGrowth ?? 0);
	const absRev = Math.abs(rev);

	// Determine Priority / Magnitude (Impact Score)
	let priority: "LOW" | "MEDIUM" | "HIGH" = "LOW";
	if (absRev >= 15) {
		priority = "HIGH";
	} else if (absRev >= SIGNIFICANT_CHANGE) {
		priority = "MEDIUM";
	}

	// 1. Check if revenue change is significant. If not, store is stable.
	if (absRev < SIGNIFICANT_CHANGE) {
		return {
			type: "STABLE",
			owner: "STORE_OPS",
			message: "Revenue is stable within normal variances.",
			priority: "LOW",
		};
	}

	// 2. Revenue Decline Cases (rev < -SIGNIFICANT_CHANGE)
	if (rev <= -SIGNIFICANT_CHANGE) {
		// Case 1: Revenue ↓, Bills ↓, AOV stable (between -SIGNIFICANT_CHANGE and SIGNIFICANT_CHANGE)
		if (bills <= -SIGNIFICANT_CHANGE && Math.abs(aov) < SIGNIFICANT_CHANGE) {
			return {
				type: "FOOTFALL",
				owner: "MARKETING",
				message:
					"Revenue decline driven by fewer customer transactions. Focus on footfall generation.",
				priority,
			};
		}

		// Case 2: Revenue ↓, Bills stable, AOV ↓
		if (Math.abs(bills) < SIGNIFICANT_CHANGE && aov <= -SIGNIFICANT_CHANGE) {
			return {
				type: "BASKET",
				owner: "MERCHANDISING",
				message:
					"Customer transaction volume is stable, but average ticket size has dropped. Review bundling and upselling.",
				priority,
			};
		}

		// Case 3: Revenue ↓, Bills ↑, AOV ↓↓
		if (bills >= SIGNIFICANT_CHANGE && aov <= -SIGNIFICANT_CHANGE) {
			return {
				type: "PRODUCT_MIX",
				owner: "CATEGORY",
				message:
					"Transaction volume grew, but average spend fell significantly. Review aggressive discounting and product assortment.",
				priority,
			};
		}

		// Fallback for other declines
		return {
			type: "FOOTFALL",
			owner: "MARKETING",
			message:
				"Store experiencing revenue pressure. Review local competitor activity and marketing outreach.",
			priority,
		};
	}

	// 3. Revenue Growth Cases (rev >= SIGNIFICANT_CHANGE)
	if (rev >= SIGNIFICANT_CHANGE) {
		// Case 4: Revenue ↑, Bills ↓, AOV ↑
		if (bills <= -SIGNIFICANT_CHANGE && aov >= SIGNIFICANT_CHANGE) {
			return {
				type: "PREMIUM_MIX",
				owner: "OPERATIONS",
				message:
					"Fewer transactions, but higher spend per customer. Focus on premium basket retention.",
				priority,
			};
		}

		// Case 5: Revenue ↑, Bills ↑
		if (bills >= SIGNIFICANT_CHANGE) {
			return {
				type: "HEALTHY",
				owner: "STORE_OPS",
				message:
					"Revenue growth driven by increased customer visits and healthy ticket sizes.",
				priority,
			};
		}

		// Fallback for other increases
		return {
			type: "HEALTHY",
			owner: "STORE_OPS",
			message:
				"Positive revenue expansion. Monitor inventory to support high-velocity SKUs.",
			priority,
		};
	}

	return {
		type: "STABLE",
		owner: "STORE_OPS",
		message: "Revenue is stable within normal variances.",
		priority: "LOW",
	};
}

export interface StoreAovBillsDiagnosisResult {
	type:
		| "FOOTFALL"
		| "CURATION"
		| "MIX_SHIFT"
		| "HEALTHY"
		| "RAMP_UP"
		| "STABLE";
	owner:
		| "MARKETING"
		| "MERCHANDISING"
		| "CATEGORY"
		| "OPERATIONS"
		| "STORE_OPS";
	message: string;
	affectedCategories: string[];
}

export function diagnoseStoreAovBills({
	storeAgeDays,
	revenueGrowth,
	billsGrowth,
	aovGrowth,
}: {
	storeAgeDays: number;
	revenueGrowth: number | "NEW STORE";
	billsGrowth: number | "NEW STORE";
	aovGrowth: number | "NEW STORE";
}): StoreAovBillsDiagnosisResult {
	if (storeAgeDays < 30) {
		return {
			type: "RAMP_UP",
			owner: "STORE_OPS",
			message:
				"Store is in ramp-up phase (< 30 days active). Establishing operational baselines.",
			affectedCategories: [],
		};
	}

	if (
		revenueGrowth === "NEW STORE" ||
		billsGrowth === "NEW STORE" ||
		aovGrowth === "NEW STORE"
	) {
		return {
			type: "HEALTHY",
			owner: "STORE_OPS",
			message: "New store. Direct comparisons are not yet active.",
			affectedCategories: [],
		};
	}

	const rev = Number(revenueGrowth);
	const bills = Number(billsGrowth);
	const aov = Number(aovGrowth);

	// AOV threshold is 5%
	const AOV_THRESHOLD = 5;
	const BILLS_THRESHOLD = 5;

	// Case 1: Bill Cuts DOWN, AOV stable/up
	if (bills <= -BILLS_THRESHOLD && Math.abs(aov) <= AOV_THRESHOLD) {
		return {
			type: "FOOTFALL",
			owner: "MARKETING",
			message:
				"Customer visits are declining. Marketing needs to improve acquisition and footfall.",
			affectedCategories: [],
		};
	}

	// Case 2: Bill Cuts stable, AOV DOWN
	if (Math.abs(bills) <= BILLS_THRESHOLD && aov <= -AOV_THRESHOLD) {
		return {
			type: "CURATION",
			owner: "MERCHANDISING",
			message:
				"Customer traffic is stable but curation is impacting basket value.",
			affectedCategories: ["Beverages", "Snacks"], // hook showing top category contributors placeholder
		};
	}

	// Case 3: Bill Cuts UP, AOV DOWN
	if (bills >= BILLS_THRESHOLD && aov <= -AOV_THRESHOLD) {
		return {
			type: "MIX_SHIFT",
			owner: "CATEGORY",
			message:
				"Customer traffic increased, but weak assortment and curation is dampening overall value.",
			affectedCategories: [],
		};
	}

	// Case 4: Bill Cuts UP, AOV UP
	if (bills >= BILLS_THRESHOLD && aov >= AOV_THRESHOLD) {
		return {
			type: "HEALTHY",
			owner: "STORE_OPS",
			message:
				"Healthy growth across both transaction frequency and ticket size.",
			affectedCategories: [],
		};
	}

	// Fallback decline
	if (rev <= -BILLS_THRESHOLD) {
		return {
			type: "FOOTFALL",
			owner: "MARKETING",
			message:
				"Store experiencing revenue pressure. Review competitor actions and local outreach.",
			affectedCategories: [],
		};
	}

	// Fallback growth
	if (rev >= BILLS_THRESHOLD) {
		return {
			type: "HEALTHY",
			owner: "STORE_OPS",
			message:
				"Positive revenue expansion. Monitor inventory to support high-velocity SKUs.",
			affectedCategories: [],
		};
	}

	return {
		type: "STABLE",
		owner: "STORE_OPS",
		message: "Revenue is stable within normal variances.",
		affectedCategories: [],
	};
}
