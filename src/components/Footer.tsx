import { Link } from "react-router-dom";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border/40 py-space-lg px-space-page-x">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-space-sm text-caption text-muted-foreground/60">
        <span>
          © {year}{" "}
          <a
            href="https://niconlyone.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-muted-foreground transition-colors"
          >
            niconlyone.com
          </a>
        </span>
        <Link
          to="/design-system"
          className="hover:text-muted-foreground transition-colors"
        >
          Design System
        </Link>
      </div>
    </footer>
  );
}
