'use client';
import React, { useState } from 'react';
import Image from 'next/image';
import { Badge } from '../ui/badge';
import Link from 'next/link';
import Logo from '@/public/wordmark.png';
import { AnimatedThemeToggler } from '../ui/animated-theme-toggler';
import { Info, X, Instagram } from 'lucide-react';
import { Button } from '../ui/button';
import { usePathname } from 'next/navigation';

const Header = ({ 
  track = "Current Track", 
  className = "" 
}) => {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const pathname = usePathname(); // Get current path
  
  const openPopup = () => setIsPopupOpen(true);
  const closePopup = () => setIsPopupOpen(false);

  // Check if we're in an admin route
  const isAdminRoute = pathname?.startsWith('/admin');

  // If we're in an admin route, don't render the header
  if (isAdminRoute) {
    return null;
  }

  return (
    <>
      <header className={`w-full ${className}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Info Button */}
            <Button 
              size={'icon'} 
              variant={'secondary'} 
              onClick={openPopup}
            >
              <Info/>
            </Button>

            {/* Logo and Track Section */}
            <div className="flex items-center space-x-2">
              {/* Logo */}
              <div className="flex-shrink-0">
                <Link href="/">
                  <Image
                    src={Logo.src}
                    alt="Company Logo"
                    width={100}
                    height={40}
                    className={`h-6 w-auto invert dark:invert-0 dark:saturate-0 dark:contrast(1)`}
                    priority
                  />
                </Link>
              </div>
            </div>
           
            <Button size={'icon'} variant={'secondary'}>
              <AnimatedThemeToggler/>
            </Button>
          </div>
        </div>
      </header>

      {/* Popup Overlay */}
      {isPopupOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xl flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-3xl shadow-xl max-w-md w-full p-6 relative">
            {/* Close Button */}
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-4 right-4"
              onClick={closePopup}
            >
              <X className="h-4 w-4" />
            </Button>

            {/* Popup Content */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold tracking-tighter">
                Copyright Information
              </h2>
              
              <div className="space-y-3">
                <p className="tracking-tight font-semibold text-muted-foreground">
                  © {new Date().getFullYear()} deltagarage. All rights reserved.
                </p>
                
              <div className='flex justify-between bg-muted rounded-xl p-4'>
              <div className="flex items-center space-x-1 tracking-tighter italic font-semibold">
                  <span className="text-muted-foreground">Made by</span>
                  <span className="font-semibold text-foreground dark:text-white">Shopigo</span>
                </div>

                {/* Instagram Link */}
                <Link 
                    href="https://instagram.com/getshopigo" 
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                <Button size={'sm'}>
                 
                    <Instagram />
                    <span>@getshopigo</span>
                  
                </Button></Link>
              </div>
              </div>

              {/* Additional Info */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm tracking-tight italic text-gray-500 dark:text-gray-400">
                  This application is proudly powered by Shopigo.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Header;