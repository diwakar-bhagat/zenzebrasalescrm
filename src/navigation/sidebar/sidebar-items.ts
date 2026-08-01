import {
	Activity,
	BarChart3,
	DollarSign,
	LayoutDashboard,
	LineChart,
	LogOut,
	type LucideIcon,
	Receipt,
	Settings,
	ShoppingBag,
	Upload,
	Users,
} from "lucide-react";

export interface NavSubItem {
	title: string;
	url: string;
	icon?: LucideIcon;
	comingSoon?: boolean;
	newTab?: boolean;
	isNew?: boolean;
}

export interface NavMainItem {
	title: string;
	url: string;
	icon?: LucideIcon;
	subItems?: NavSubItem[];
	comingSoon?: boolean;
	newTab?: boolean;
	isNew?: boolean;
	badge?: number | string;
}

export interface NavGroup {
	id: number;
	label?: string;
	items: NavMainItem[];
}

export const sidebarItems: NavGroup[] = [
	{
		id: 1,
		label: "Platform",
		items: [
			{
				title: "Sales Dashboard",
				url: "/dashboard/sales",
				icon: LayoutDashboard,
			},
			{
				title: "Store Overview",
				url: "/dashboard/ecommerce",
				icon: ShoppingBag,
			},
			{
				title: "Customer Intelligence",
				url: "/dashboard/customer-intelligence",
				icon: Users,
				isNew: true,
			},
			{
				title: "CRM",
				url: "/dashboard/crm",
				icon: BarChart3,
			},
			{
				title: "Finance",
				url: "/dashboard/finance",
				icon: DollarSign,
			},
			{
				title: "Net Purchase",
				url: "/dashboard/net-purchase",
				icon: Receipt,
				isNew: true,
			},
			{
				title: "Analytics",
				url: "/dashboard/analytics",
				icon: LineChart,
			},
		],
	},
	{
		id: 2,
		label: "Others",
		items: [
			{
				title: "System",
				url: "/dashboard/admin/system",
				icon: Activity,
			},
			// Odoo is the operational source of truth; the Excel importer is a compatibility
			// adapter for pre-ERP history and gap backfills, so it lives under admin rather
			// than presenting itself as the way data normally arrives.
			{
				title: "Data Import",
				url: "/dashboard/sales/upload",
				icon: Upload,
			},
			{
				title: "Settings",
				url: "/dashboard/settings",
				icon: Settings,
			},
			{
				title: "Sign Out",
				url: "/api/auth/logout",
				icon: LogOut,
			},
		],
	},
];
