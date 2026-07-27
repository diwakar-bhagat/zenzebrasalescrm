/**
 * ZenZebra Retail Intelligence Platform - Founder Action Center Engine
 */

export interface FounderActionItem {
	id: string;
	title: string;
	category: "CRM" | "Commercial" | "Retention" | "Finance" | "Inventory";
	priority: "P0" | "P1" | "P2";
	impactEstimate: string;
	confidencePercent: number;
	actionUrl: string;
	actionButtonText: string;
	createdAt: string;
}

export function generateFounderActions(input: {
	hotLeadsCount?: number;
	pendingProposalsCount?: number;
	decliningStoresCount?: number;
	lowStockItemsCount?: number;
}): FounderActionItem[] {
	const actions: FounderActionItem[] = [];
	const now = new Date().toISOString();

	// P0: Hot Leads requiring follow-up
	if (input.hotLeadsCount && input.hotLeadsCount > 0) {
		actions.push({
			id: "act_hot_leads",
			title: `Follow up with ${input.hotLeadsCount} Hot Opportunities`,
			category: "CRM",
			priority: "P0",
			impactEstimate: "+ ₹4.5L Potential Revenue",
			confidencePercent: 92,
			actionUrl: "/dashboard/crm",
			actionButtonText: "Open CRM Board",
			createdAt: now,
		});
	}

	// P1: Store Dip Investigation
	if (input.decliningStoresCount && input.decliningStoresCount > 0) {
		actions.push({
			id: "act_store_dip",
			title: `Investigate Revenue Dip in ${input.decliningStoresCount} Store`,
			category: "Commercial",
			priority: "P1",
			impactEstimate: "Prevent ₹1.2L Monthly Loss",
			confidencePercent: 88,
			actionUrl: "/dashboard/ecommerce",
			actionButtonText: "View Store Analytics",
			createdAt: now,
		});
	}

	// P1: Overdue Proposals
	if (input.pendingProposalsCount && input.pendingProposalsCount > 0) {
		actions.push({
			id: "act_pending_proposals",
			title: `Review ${input.pendingProposalsCount} Pending Enterprise Proposals`,
			category: "CRM",
			priority: "P1",
			impactEstimate: "Accelerate Sales Velocity",
			confidencePercent: 85,
			actionUrl: "/dashboard/crm",
			actionButtonText: "Review Proposals",
			createdAt: now,
		});
	}

	return actions;
}
