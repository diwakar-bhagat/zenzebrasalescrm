import {
  LayoutDashboard,
  LogOut,
  Settings,
  Upload,
  type LucideIcon,
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
        title: "Founder Dashboard",
        url: "/dashboard/founder",
        icon: LayoutDashboard,
      },
      {
        title: "Upload Data",
        url: "/dashboard/founder/upload",
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
