"use client";

import { usePathname, useRouter } from "next/navigation";
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useState,
} from "react";

interface AuthUser {
	userId: number;
	name: string;
	username: string;
	employeeId: string;
}

interface AuthContextValue {
	user: AuthUser | null;
	isLoaded: boolean;
	signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
	user: null,
	isLoaded: false,
	signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<AuthUser | null>(null);
	const [isLoaded, setIsLoaded] = useState(false);
	const router = useRouter();
	const pathname = usePathname();

	useEffect(() => {
		if (pathname === "/login") {
			setUser(null);
			setIsLoaded(true);
			return;
		}

		async function fetchUser() {
			try {
				const res = await fetch("/api/auth/me");
				if (res.ok) {
					const data = await res.json();
					setUser(data.user);
				} else {
					setUser(null);
				}
			} catch {
				setUser(null);
			} finally {
				setIsLoaded(true);
			}
		}
		fetchUser();
	}, [pathname]);

	const signOut = async () => {
		try {
			await fetch("/api/auth/logout", { method: "POST" });
		} finally {
			setUser(null);
			router.push("/login");
		}
	};

	return (
		<AuthContext.Provider value={{ user, isLoaded, signOut }}>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth() {
	return useContext(AuthContext);
}
