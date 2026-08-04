"use client";

import * as Ably from "ably";
import { type ReactNode, useEffect } from "react";
import { CHANNELS, type RealtimeEvent } from "@/lib/realtime/channels";
import { useRealtimeStore } from "@/stores/realtime-store";

/**
 * Subscribes the dashboard to live ingestion events.
 *
 * Authenticates via `authUrl`, so the browser only ever holds a short-lived, subscribe-only
 * token and never the Ably API key. Ably's client handles reconnection and backoff itself;
 * on reconnect it replays messages missed during a brief drop, and anything older is picked up
 * by the normal refetch, so a network blip cannot leave the dashboard permanently stale.
 *
 * Renders nothing. If realtime is not configured the provider stays inert and the dashboard
 * behaves exactly as it did before.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
	const setStatus = useRealtimeStore((s) => s.setStatus);
	const applyEvent = useRealtimeStore((s) => s.applyEvent);

	useEffect(() => {
		let client: Ably.Realtime | null = null;
		let cancelled = false;

		(async () => {
			// Ask the server whether realtime is switched on before opening a connection, so an
			// unconfigured deployment does not sit in a reconnect loop against a 500.
			try {
				const res = await fetch("/api/realtime/token");
				if (!res.ok) {
					setStatus("disabled");
					return;
				}
				const body = await res.json();
				if (body?.enabled === false) {
					setStatus("disabled");
					return;
				}
			} catch {
				setStatus("disabled");
				return;
			}

			if (cancelled) return;

			client = new Ably.Realtime({
				// authCallback rather than authUrl: the endpoint wraps its response in
				// { enabled, tokenRequest } so it can also report that realtime is switched
				// off, and Ably expects the bare token request.
				authCallback: async (_params, callback) => {
					try {
						const res = await fetch("/api/realtime/token");
						if (!res.ok)
							throw new Error(`token endpoint returned ${res.status}`);
						const body = await res.json();
						if (!body?.tokenRequest)
							throw new Error("token endpoint returned no tokenRequest");
						callback(null, body.tokenRequest);
					} catch (error) {
						callback(
							error instanceof Error ? error.message : "realtime auth failed",
							null,
						);
					}
				},
				echoMessages: false,
			});

			client.connection.on("connected", () => setStatus("connected"));
			client.connection.on("connecting", () => setStatus("connecting"));
			client.connection.on("disconnected", () => setStatus("disconnected"));
			client.connection.on("suspended", () => setStatus("disconnected"));
			client.connection.on("failed", () => setStatus("disabled"));

			const channel = client.channels.get(CHANNELS.global);
			channel.subscribe((message) => {
				const event = message.data as RealtimeEvent;
				if (event?.name) applyEvent(event);
			});
		})();

		return () => {
			cancelled = true;
			client?.close();
		};
	}, [setStatus, applyEvent]);

	return <>{children}</>;
}
