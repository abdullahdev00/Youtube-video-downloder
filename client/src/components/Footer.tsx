import { Github, Twitter, Mail, Shield, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoUrl from "@assets/generated_images/YouTube_downloader_logo_design_023487b7.png";

export function Footer() {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    product: [
      { name: "Features", href: "#features" },
      { name: "Pricing", href: "#pricing" },
      { name: "API", href: "#api" },
      { name: "Status", href: "#status" },
    ],
    legal: [
      { name: "Privacy Policy", href: "#privacy" },
      { name: "Terms of Service", href: "#terms" },
      { name: "DMCA Policy", href: "#dmca" },
      { name: "Cookie Policy", href: "#cookies" },
    ],
    support: [
      { name: "Help Center", href: "#help" },
      { name: "Contact Us", href: "#contact" },
      { name: "FAQ", href: "#faq" },
      { name: "Report Bug", href: "#bug-report" },
    ],
  };

  return (
    <footer className="bg-card border-t border-border/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand Section */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <img src={logoUrl} alt="YTDownloader Pro" className="h-8 w-8" />
              <span className="text-xl font-bold text-foreground">YTDownloader Pro</span>
            </div>
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
              The most trusted YouTube video downloader. Fast, secure, and reliable downloads in multiple formats.
            </p>
            <div className="flex gap-3">
              <Button variant="ghost" size="icon" className="hover-elevate" data-testid="button-social-twitter">
                <Twitter className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="hover-elevate" data-testid="button-social-github">
                <Github className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="hover-elevate" data-testid="button-social-email">
                <Mail className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Links Sections */}
          <div>
            <h3 className="font-semibold text-foreground mb-4">Product</h3>
            <ul className="space-y-2">
              {footerLinks.product.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
                    data-testid={`link-footer-${link.name.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-4">Legal</h3>
            <ul className="space-y-2">
              {footerLinks.legal.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
                    data-testid={`link-footer-${link.name.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-4">Support</h3>
            <ul className="space-y-2">
              {footerLinks.support.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
                    data-testid={`link-footer-${link.name.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Trust Indicators */}
        <div className="flex flex-wrap justify-center items-center gap-6 py-6 border-y border-border/50">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="h-4 w-4 text-chart-2" />
            <span>SSL Secured</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="h-4 w-4 text-chart-2" />
            <span>Privacy Protected</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="h-4 w-4 text-chart-2" />
            <span>GDPR Compliant</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="h-4 w-4 text-chart-2" />
            <span>No Data Stored</span>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="flex flex-col md:flex-row justify-between items-center pt-6 text-sm text-muted-foreground">
          <div className="mb-4 md:mb-0">
            <p data-testid="text-copyright">
              © {currentYear} YTDownloader Pro. All rights reserved.
            </p>
          </div>
          <div className="flex items-center gap-6">
            <span className="text-xs">
              Not affiliated with YouTube LLC
            </span>
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 bg-chart-2 rounded-full" />
              <span className="text-xs" data-testid="text-status">
                All systems operational
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}