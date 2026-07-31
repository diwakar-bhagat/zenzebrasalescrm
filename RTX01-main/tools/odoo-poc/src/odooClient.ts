import dotenv from "dotenv";
import path from "path";

// Load environment variables from .env
dotenv.config({ path: path.resolve(__dirname, "../.env") });

export interface OdooSession {
	sessionId: string;
	uid: number;
	username: string;
	db: string;
	serverVersion: string;
	userContext: Record<string, any>;
}

export interface VersionInfo {
	server_version?: string;
	server_version_info?: any[];
	server_serie?: string;
	protocol_version?: number;
}

export interface SearchReadOptions {
	domain?: Array<any>;
	fields?: string[];
	limit?: number;
	offset?: number;
	order?: string;
}

export class OdooClient {
	private url: string;
	private db: string;
	private username: string;
	private password: string;
	private session: OdooSession | null = null;

	constructor() {
		this.url = (
			process.env.ODOO_URL || "https://your-instance.odoo.com"
		).replace(/\/$/, "");
		this.db = process.env.ODOO_DB || "";
		this.username = process.env.ODOO_USERNAME || "";
		this.password = process.env.ODOO_PASSWORD || "";
	}

	public getUrl(): string {
		return this.url;
	}

	public getSession(): OdooSession | null {
		return this.session;
	}

	public isConfigured(): boolean {
		return (
			Boolean(this.url) &&
			!this.url.includes("your-instance.odoo.com") &&
			Boolean(this.db) &&
			Boolean(this.username) &&
			Boolean(this.password)
		);
	}

	/**
	 * Test 0: Health check - GET / and GET /web
	 */
	public async healthCheck(): Promise<{
		rootOk: boolean;
		webOk: boolean;
		rootStatus: number;
		webStatus: number;
	}> {
		const rootRes = await fetch(`${this.url}/`, { method: "GET" });
		const webRes = await fetch(`${this.url}/web`, { method: "GET" });
		return {
			rootOk: rootRes.ok,
			webOk: webRes.ok,
			rootStatus: rootRes.status,
			webStatus: webRes.status,
		};
	}

	/**
	 * Fetch server version info via /web/webclient/version_info
	 */
	public async getVersionInfo(): Promise<VersionInfo> {
		const endpoint = `${this.url}/web/webclient/version_info`;
		const payload = {
			jsonrpc: "2.0",
			method: "call",
			params: {},
			id: Date.now(),
		};

		const response = await fetch(endpoint, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});

		if (!response.ok) {
			throw new Error(`HTTP ${response.status} fetching version_info`);
		}

		const data: any = await response.json();
		return data.result || {};
	}

	/**
	 * Test 1: Authenticate via POST /web/session/authenticate
	 */
	public async authenticate(): Promise<OdooSession> {
		if (!this.isConfigured()) {
			throw new Error(
				"Odoo credentials missing or invalid in tools/odoo-poc/.env file. Populate ODOO_URL, ODOO_DB, ODOO_USERNAME, and ODOO_PASSWORD.",
			);
		}

		const authUrl = `${this.url}/web/session/authenticate`;
		const payload = {
			jsonrpc: "2.0",
			method: "call",
			params: {
				db: this.db,
				login: this.username,
				password: this.password,
			},
			id: Date.now(),
		};

		const response = await fetch(authUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});

		if (!response.ok) {
			throw new Error(
				`Authentication HTTP error: ${response.status} ${response.statusText}`,
			);
		}

		const setCookie = response.headers.get("set-cookie") || "";
		const sessionMatch = setCookie.match(/session_id=([^;]+)/);
		const sessionId = sessionMatch ? sessionMatch[1] : "";

		const body: any = await response.json();

		if (body.error) {
			throw new Error(
				`Odoo Authentication Failed: ${JSON.stringify(body.error.data?.message || body.error.message || body.error)}`,
			);
		}

		const result = body.result;

		if (!result || !result.uid) {
			throw new Error("Authentication succeeded but returned no UID.");
		}

		this.session = {
			sessionId: sessionId || result.session_id || "session_acquired",
			uid: result.uid,
			username: result.username || this.username,
			db: result.db || this.db,
			serverVersion: result.server_version || "standard",
			userContext: result.user_context || {},
		};

		return this.session;
	}

	/**
	 * Generic callKw wrapper using session cookie authentication
	 */
	public async callKw(
		model: string,
		method: string,
		args: any[] = [],
		kwargs: Record<string, any> = {},
	): Promise<any> {
		if (!this.session) {
			await this.authenticate();
		}

		const endpoint = `${this.url}/web/dataset/call_kw`;
		const payload = {
			jsonrpc: "2.0",
			method: "call",
			params: {
				model,
				method,
				args,
				kwargs: {
					context: this.session?.userContext || {},
					...kwargs,
				},
			},
			id: Date.now(),
		};

		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};

		if (this.session?.sessionId) {
			headers["Cookie"] = `session_id=${this.session.sessionId}`;
		}

		const response = await fetch(endpoint, {
			method: "POST",
			headers,
			body: JSON.stringify(payload),
		});

		if (!response.ok) {
			throw new Error(
				`Odoo API HTTP error (${model}.${method}): ${response.status} ${response.statusText}`,
			);
		}

		const body: any = await response.json();

		if (body.error) {
			throw new Error(
				`Odoo Error (${model}.${method}): ${JSON.stringify(body.error.data?.message || body.error.message || body.error)}`,
			);
		}

		return body.result;
	}

	/**
	 * Execute search_read on an Odoo model
	 */
	public async searchRead(
		model: string,
		options: SearchReadOptions = {},
	): Promise<any[]> {
		const kwargs: Record<string, any> = {};
		if (options.fields) kwargs.fields = options.fields;
		if (options.limit !== undefined) kwargs.limit = options.limit;
		if (options.offset !== undefined) kwargs.offset = options.offset;
		if (options.order) kwargs.order = options.order;

		return this.callKw(model, "search_read", [options.domain || []], kwargs);
	}

	/**
	 * Dynamic field discovery via fields_get()
	 */
	public async fieldsGet(
		model: string,
		attributes: string[] = ["type", "string", "readonly", "help"],
	): Promise<Record<string, any>> {
		return this.callKw(model, "fields_get", [], { attributes });
	}
}
