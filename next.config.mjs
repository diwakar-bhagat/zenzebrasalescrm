import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
	reactCompiler: true,
	compiler: {
		removeConsole: process.env.NODE_ENV === "production",
	},
	// These native modules must not be bundled by webpack
	serverExternalPackages: ["@node-rs/argon2"],
	turbopack: {
		root: __dirname,
	},
	async redirects() {
		return [
			{
				source: "/dashboard",
				destination: "/dashboard/default",
				permanent: false,
			},
		];
	},
};

export default nextConfig;
