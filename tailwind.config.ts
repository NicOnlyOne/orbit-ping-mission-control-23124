// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        display: "var(--font-family-display)",
        body: "var(--font-family-body)",
        mono: "var(--font-family-mono)",
      },
      fontSize: {
        hero: "var(--font-size-hero)",
        "page-title": "var(--font-size-page-title)",
        "section-title": "var(--font-size-section-title)",
        "card-title": "var(--font-size-card-title)",
        "body-lg": "var(--font-size-body-lg)",
        body: "var(--font-size-body)",
        "body-sm": "var(--font-size-body-sm)",
        caption: "var(--font-size-caption)",
        stat: "var(--font-size-stat)",
      },
      fontWeight: {
        "token-normal": "var(--font-weight-normal)",
        "token-medium": "var(--font-weight-medium)",
        "token-semibold": "var(--font-weight-semibold)",
        "token-bold": "var(--font-weight-bold)",
      },
      lineHeight: {
        tight: "var(--line-height-tight)",
        normal: "var(--line-height-normal)",
        relaxed: "var(--line-height-relaxed)",
      },
      spacing: {
        "space-xs": "var(--space-xs)",
        "space-sm": "var(--space-sm)",
        "space-md": "var(--space-md)",
        "space-lg": "var(--space-lg)",
        "space-xl": "var(--space-xl)",
        "space-2xl": "var(--space-2xl)",
        "space-3xl": "var(--space-3xl)",
        "space-section": "var(--space-section)",
        "space-page-x": "var(--space-page-x)",
        "space-card": "var(--space-card)",
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Custom: Space Mission Control palette
        space: {
          deep: "hsl(var(--space-deep))",
          dark: "hsl(var(--space-dark))",
          medium: "hsl(var(--space-medium))",
          light: "hsl(var(--space-light))",
        },
        // Custom: status colors (single, clean definition)
        status: {
          online: "hsl(var(--status-online))",
          offline: "hsl(var(--status-offline))",
          warning: "hsl(var(--status-warning))",
          checking: "hsl(var(--status-checking))",
        },
        // Custom: Brand colors from design system
        "nebula-blue": "hsl(var(--nebula-blue))",
        "starlight-white": "hsl(var(--starlight-white))",
        "astro-green": "hsl(var(--astro-green))",
        "meteor-gray": "hsl(var(--meteor-gray))",
        "rocket-red": "hsl(var(--rocket-red))",
        // Custom: sidebar palette
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius-lg)",
        md: "var(--radius-md)",
        sm: "var(--radius-sm)",
        xl: "var(--radius-xl)",
        card: "var(--radius-card)",
        button: "var(--radius-button)",
        input: "var(--radius-input)",
        badge: "var(--radius-badge)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        orbit: {
          "0%": { transform: "rotate(0deg) translateX(4px) rotate(0deg)" },
          "100%": { transform: "rotate(360deg) translateX(4px) rotate(-360deg)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(255,255,255,0.2)" },
          "50%": { boxShadow: "0 0 0 8px rgba(255,255,255,0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        starfield: {
          "0%": { opacity: "0.6" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        orbit: "orbit 20s linear infinite",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        float: "float 3s ease-in-out infinite",
        starfield: "starfield 3s ease-in-out infinite alternate",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
