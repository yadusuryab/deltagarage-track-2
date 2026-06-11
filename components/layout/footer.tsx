"use client";

import * as React from "react";
import Link from "next/link";
import { Instagram } from "lucide-react";
import { Button } from "../ui/button";
import { usePathname } from "next/navigation";

function Footer() {
  const currentYear = new Date().getFullYear();
  const pathname = usePathname(); // Get current path
  


  // Check if we're in an admin route
  const isAdminRoute = pathname?.startsWith('/admin');

  // If we're in an admin route, don't render the header
  if (isAdminRoute) {
    return null;
  }
  // Fetch categories on component mount
  
  // Get first 5 categories or default ones if none available

  // Fallback categories if none are fetched



  // Link declarations - organize all links here
  const footerLinks = {
    help: [
      { label: "CONTACT US", href: "https://deltagarage.in/contact" },
      // { label: "SHIPPING INFO", href: "/shipping" },
      // { label: "RETURNS", href: "/returns" },
      // { label: "SIZE GUIDE", href: "/size-guide" }
    ],
    company: [
      { label: "ABOUT US", href: "/about" }
    ],
  
    legal: [
      { label: "PRIVACY POLICY", href: "https://deltagarage.in/privacy-policy" },
      { label: "TERMS & CONDITIONS", href: "https://deltagarage.in/terms" },
      { label: "COOKIES", href: "/cookies" }
    ],
    social: [
      { label: "INSTAGRAM", href: process.env.NEXT_PUBLIC_INSTA || "https://instagram.com/deltagarage.shoppe" },

      // { label: "LINKEDIN", href: process.env.NEXT_PUBLIC_LINKEDIN || "#" },
      // { label: "TIKTOK", href: process.env.NEXT_PUBLIC_TIKTOK || "#" },
      // { label: "PINTEREST", href: process.env.NEXT_PUBLIC_PINTEREST || "#" }
    ]
  };

  return (
    <footer className="bg-muted text-foreground ">
      {/* Marquee Bar */}
      <div className="bg-black text-white py-3 overflow-hidden">
        <div className="marquee-container">
          <div className="marquee-content animate-marquee whitespace-nowrap">
            <span className="font-bold text-sm uppercase tracking-widest mx-8">
              deltagarage ORDER TRACKING
            </span>
            <span className="font-bold text-sm uppercase tracking-widest mx-8">
            TRACK YOUR ORDER
            </span>
          
            <span className="font-bold text-sm uppercase tracking-widest mx-8">
              deltagarage ORDER TRACKING
            </span>
          </div>
        </div>
      </div>

      {/* Logo Section */}
     

      {/* Main Footer Content */}
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 max-w-4xl mx-auto">
          {/* HELP Column */}
          <div>
            <h3 className="tracking-tighter font-semibold text-sm uppercase  mb-6">
              HELP
            </h3>
            <div className="space-y-3">
              {footerLinks.help.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="block text-xs text-muted-foreground uppercase tracking-tight hover:underline font-semibold transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* COMPANY Column */}
       

          {/* SHOP BY CATEGORY - Dynamic */}
         

          {/* INSTAGRAM */}
          <div>
            <h3 className="font-medium text-sm uppercase tracking-tight mb-6">
              INSTAGRAM
            </h3>
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">
                FOLLOW deltagarage
              </p>
              <div className="flex flex-col space-y-3">
                <Link href={footerLinks.social[0].href}>
                  <Button className="w-full" variant={'outline'}>
                    <Instagram className="w-4 h-4 mr-2" />
                    FOLLOW
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Social Links Bar */}
      <div className="bg-black text-white py-4">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap justify-center items-center gap-6 md:gap-8">
            <span className="font-medium text-xs uppercase tracking-widest">
              CONNECT
            </span>
            {footerLinks.social.map((platform) => (
              <Link
                key={platform.label}
                href={platform.href}
                className="text-xs uppercase tracking-widest hover:text-gray-300 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                {platform.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div >
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-center">
          
            <nav className="flex gap-1 italic font-semibold">
             <span className="text-muted-foreground">Made by</span>
                <Link
                  
                  href={'https://instagram.com/getshopigo'}
                >
                  Shopigo.
                </Link>
            
            </nav>
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">
              © {currentYear} {process.env.NEXT_PUBLIC_APP_NAME} deltagarage. All rights reserved.
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-marquee {
          animation: marquee 20s linear infinite;
        }
        .marquee-container {
          overflow: hidden;
          white-space: nowrap;
          position: relative;
        }
        .marquee-content {
          display: inline-flex;
          animation: marquee 20s linear infinite;
        }
        .marquee-content:hover {
          animation-play-state: paused;
        }
      `}</style>
    </footer>
  );
}

export { Footer };