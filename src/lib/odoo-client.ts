/**
 * Lightweight JSON-RPC 2.0 Client for Odoo Enterprise SaaS (Odoo 19.x)
 * Operates natively over standard HTTPS POST endpoints:
 * - /web/session/authenticate
 * - /web/dataset/call_kw
 */

export interface OdooConfig {
	url: string;
	db: string;
	username: string;
	password: string;
}

export function getOdooClient(config?: Partial<OdooConfig>): OdooClient {
	return new OdooClient(config);
}

export class OdooClient {
	private url: string;
	private db: string;
	private username: string;
	private password: string;
	private sessionCookie: string | null = null;
	private uid: number | null = null;

	constructor(config?: Partial<OdooConfig>) {
		this.url = (config?.url || process.env.ODOO_URL || "https://zenzebra1.odoo.com").replace(/\/+$/, "");
		this.db = config?.db || process.env.ODOO_DB || "zenzebra1";
		this.username = config?.username || process.env.ODOO_USERNAME || "diwakar@zenzebra.in";
		this.password = config?.password || process.env.ODOO_PASSWORD || "Jc775869w@";
	}

	/** Authenticates with Odoo SaaS and captures the session cookie */
	public async authenticate(): Promise<number> {
		if (this.sessionCookie && this.uid) {
			return this.uid;
		}

		const endpoint = `${this.url}/web/session/authenticate`;
		const payload = {
			jsonrpc: "2.0",
			method: "call",
			params: {
				db: this.db,
				login: this.username,
				password: this.password,
			},
			id: Math.floor(Math.random() * 100000),
		};

		const res = await fetch(endpoint, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});

		if (!res.ok) {
			throw new Error(`Odoo authentication HTTP error ${res.status}: ${res.statusText}`);
		}

		const setCookieHeader = res.headers.get("set-cookie");
		if (setCookieHeader) {
			const match = setCookieHeader.match(/session_id=[^;]+/);
			if (match) {
				this.sessionCookie = match[0];
			}
		}

		const data = await res.json();
		if (data.error) {
			throw new Error(`Odoo Authentication Failed: ${data.error.data?.message || data.error.message}`);
		}

		if (!data.result || !data.result.uid) {
			throw new Error("Odoo Authentication failed: invalid credentials or session missing");
		}

		this.uid = data.result.uid;
		return this.uid!;
	}

	/** Executes a call_kw JSON-RPC method against Odoo models */
	public async callKw(model: string, method: string, args: any[] = [], kwargs: Record<string, any> = {}): Promise<any> {
		await this.authenticate();

		const endpoint = `${this.url}/web/dataset/call_kw`;
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};
		if (this.sessionCookie) {
			headers.Cookie = this.sessionCookie;
		}

		const payload = {
			jsonrpc: "2.0",
			method: "call",
			params: {
				model,
				method,
				args,
				kwargs,
			},
			id: Math.floor(Math.random() * 100000),
		};

		const res = await fetch(endpoint, {
			method: "POST",
			headers,
			body: JSON.stringify(payload),
		});

		const data = await res.json();
		if (data.error) {
			throw new Error(`Odoo API Error [${model}.${method}]: ${data.error.data?.message || data.error.message}`);
		}

		return data.result;
	}

	/** Domain search and read helper */
	public async searchRead(
		model: string,
		domain: any[] = [],
		fields: string[] = [],
		options: { limit?: number; offset?: number; order?: string } = {}
	): Promise<any[]> {
		return this.callKw(model, "search_read", [domain], {
			fields,
			limit: options.limit || 500,
			offset: options.offset || 0,
			order: options.order || "id asc",
		});
	}

	/** Count matching records */
	public async searchCount(model: string, domain: any[] = []): Promise<number> {
		return this.callKw(model, "search_count", [domain]);
	}
}
