import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

export const APP_CONFIG = {
	name: "ZenZebra",
	version: packageJson.version,
	copyright: `© ${currentYear}, ZenZebra.`,
	meta: {
		title: "ZenZebra",
		description:
			"A clean platform foundation built on the next-shadcn admin dashboard.",
	},
};
