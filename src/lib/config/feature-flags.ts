/**
 * ZenZebra CRM Feature Flags & Dynamic Configuration
 */

export interface FeatureFlags {
	enableCrmAiRecommendations: boolean;
	enableRetentionModule: boolean;
	enableOdooRealtimeWebhooks: boolean;
	enableFinancePurchaseOrders: boolean;
	enableExperimentalCharts: boolean;
	enableStrictRbac: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {
	enableCrmAiRecommendations: true,
	enableRetentionModule: true,
	enableOdooRealtimeWebhooks: true,
	enableFinancePurchaseOrders: true,
	enableExperimentalCharts: false,
	enableStrictRbac: false,
};

class FeatureFlagService {
	private flags: FeatureFlags = { ...DEFAULT_FLAGS };

	public isEnabled(flag: keyof FeatureFlags): boolean {
		return this.flags[flag] ?? false;
	}

	public getFlags(): FeatureFlags {
		return { ...this.flags };
	}

	public setFlag(flag: keyof FeatureFlags, enabled: boolean): void {
		this.flags[flag] = enabled;
	}
}

export const featureFlags = new FeatureFlagService();
