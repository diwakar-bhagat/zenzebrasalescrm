import {
	BarChart3,
	DollarSign,
	LayoutDashboard,
	LineChart,
	LogOut,
	type LucideIcon,
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
				title: "Customer Retention",
				url: "/dashboard/retention",
				icon: Users,
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
				title: "Analytics",
				url: "/dashboard/analytics",
				icon: LineChart,
			},
			{
				title: "Upload Data",
				url: "/dashboard/sales/upload",
				icon: Upload,
			},
		],
	},
	{
		id: 2,
		label: "Others",
		items: [
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
