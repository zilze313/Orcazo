import Link from "next/link";
import { Sparkles } from "lucide-react";

export function MarketingFooter() {
  return (
    <footer className="border-t bg-muted/20">
      <div className="container max-w-7xl px-4 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
        <div className="col-span-2 md:col-span-1">
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold tracking-tight text-base"
          >
            <span className="inline-flex w-7 h-7 rounded-md bg-primary text-primary-foreground items-center justify-center">
              <Sparkles className="h-4 w-4" />
            </span>
            Orcazo
          </Link>
          <p className="text-muted-foreground mt-3 max-w-xs leading-relaxed">
            The supreme platform for affiliate content marketing. Connect brands
            with vetted creators worldwide.
          </p>
        </div>
        <div>
          <div className="font-semibold mb-3">Platform</div>
          <ul className="space-y-2 text-muted-foreground">
            <li>
              <Link href="/" className="hover:text-foreground">
                For Brands
              </Link>
            </li>
            <li>
              <Link href="/creators" className="hover:text-foreground">
                For Creators
              </Link>
            </li>
            <li>
              <Link href="/login" className="hover:text-foreground">
                Sign in
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <div className="font-semibold mb-3">Company</div>
          <ul className="space-y-2 text-muted-foreground">
            <li>
              <a href="#" className="hover:text-foreground">
                About
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-foreground">
                Contact
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-foreground">
                Careers
              </a>
            </li>
          </ul>
        </div>
        <div>
          <div className="font-semibold mb-3">Legal</div>
          <ul className="space-y-2 text-muted-foreground">
            <li>
              <Link href="/privacy" className="hover:text-foreground">
                Privacy
              </Link>
            </li>
            <li>
              <Link href="/terms" className="hover:text-foreground">
                Terms
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t">
        <div className="container max-w-7xl px-4 py-5 text-xs text-muted-foreground flex flex-col sm:flex-row justify-between gap-2">
          <div>© {new Date().getFullYear()} Orcazo. All rights reserved.</div>
          <div>Made for brands and creators worldwide.</div>
        </div>
      </div>
    </footer>
  );
}
