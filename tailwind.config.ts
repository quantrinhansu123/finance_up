import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "var(--background)",
                foreground: "var(--foreground)",
                card: "var(--card)",
                "card-hover": "var(--card-hover)",
                "card-border": "var(--card-border)",
                primary: "var(--primary)",
                secondary: "var(--secondary)",
                muted: "var(--muted)",
            },
        },
    },
    plugins: [],
};
export default config;
