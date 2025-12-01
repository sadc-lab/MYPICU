import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
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
        status: {
          critical: "hsl(var(--status-critical))",
          "critical-fg": "hsl(var(--status-critical-foreground))",
          "critical-bg": "hsl(var(--status-critical-bg))",
          "warning-high": "hsl(var(--status-warning-high))",
          "warning-high-fg": "hsl(var(--status-warning-high-foreground))",
          "warning-high-bg": "hsl(var(--status-warning-high-bg))",
          warning: "hsl(var(--status-warning))",
          "warning-fg": "hsl(var(--status-warning-foreground))",
          "warning-bg": "hsl(var(--status-warning-bg))",
          normal: "hsl(var(--status-normal))",
          "normal-fg": "hsl(var(--status-normal-foreground))",
          "normal-bg": "hsl(var(--status-normal-bg))",
        },
        score: {
          critical: "hsl(var(--score-critical))",
          "critical-text": "hsl(var(--score-critical-text))",
          "critical-bg": "hsl(var(--score-critical-bg))",
          "critical-border": "hsl(var(--score-critical-border))",
          "warning-high": "hsl(var(--score-warning-high))",
          "warning-high-text": "hsl(var(--score-warning-high-text))",
          "warning-high-bg": "hsl(var(--score-warning-high-bg))",
          "warning-high-border": "hsl(var(--score-warning-high-border))",
          warning: "hsl(var(--score-warning))",
          "warning-text": "hsl(var(--score-warning-text))",
          "warning-bg": "hsl(var(--score-warning-bg))",
          "warning-border": "hsl(var(--score-warning-border))",
          normal: "hsl(var(--score-normal))",
          "normal-text": "hsl(var(--score-normal-text))",
          "normal-bg": "hsl(var(--score-normal-bg))",
          "normal-border": "hsl(var(--score-normal-border))",
        },
        pelod: {
          critical: "hsl(var(--pelod-critical))",
          high: "hsl(var(--pelod-high))",
          warning: "hsl(var(--pelod-warning))",
          moderate: "hsl(var(--pelod-moderate))",
          normal: "hsl(var(--pelod-normal))",
        },
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
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
