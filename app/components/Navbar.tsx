'use client';

import Link from 'next/link';
import { useAuth } from '@/app/context/AuthContext';
import { Button } from './ui/button';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';

export default function Navbar() {
  const { user, signOut, loading } = useAuth();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // GSAP animation for mobile menu
  useEffect(() => {
    // Skip effect if we're not rendering the navbar
    if (pathname.startsWith('/auth') || pathname.startsWith('/meet/')) {
      return;
    }
    
    if (mobileMenuRef.current) {
      if (isMenuOpen) {
        gsap.fromTo(
          mobileMenuRef.current,
          { opacity: 0, height: 0 },
          { opacity: 1, height: 'auto', duration: 0.3, ease: 'power2.out' }
        );
      } else {
        gsap.to(
          mobileMenuRef.current,
          { opacity: 0, height: 0, duration: 0.3, ease: 'power2.in' }
        );
      }
    }
  }, [isMenuOpen, pathname]);

  // Skip rendering navbar on certain pages
  if (
    pathname.startsWith('/auth') || 
    pathname.startsWith('/meet/')
  ) {
    return null;
  }

  return (
    <header className="bg-gray-900/70 backdrop-blur-md py-4 px-4 md:px-6 z-50 sticky top-0 border-b border-gray-800">
      <div className="container mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
            <span className="font-bold text-white">M</span>
          </div>
          <h1 className="text-xl font-bold text-white">Metchera Meet</h1>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          <Link href="/dashboard" className="text-gray-300 hover:text-white transition">
            Dashboard
          </Link>
          <Link href="/profile" className="text-gray-300 hover:text-white transition">
            Profile
          </Link>
          
          {!loading && (
            <>
              {user ? (
                <Button 
                  onClick={() => signOut()}
                  variant="outline"
                  className="border-gray-700 hover:bg-gray-800"
                >
                  Sign Out
                </Button>
              ) : (
                <div className="flex items-center gap-3">
                  <Button 
                    onClick={() => router.push('/auth/login')}
                    variant="outline"
                    className="border-gray-700 hover:bg-gray-800"
                  >
                    Sign In
                  </Button>
                  <Button onClick={() => router.push('/auth/register')}>
                    Sign Up
                  </Button>
                </div>
              )}
            </>
          )}
        </nav>

        {/* Mobile Menu Button */}
        <button 
          className="md:hidden text-white"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
          </svg>
        </button>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div 
          ref={mobileMenuRef}
          className="md:hidden bg-gray-900 border-t border-gray-800 mt-4"
        >
          <div className="container mx-auto py-4 px-4 flex flex-col gap-4">
            <Link 
              href="/dashboard" 
              className="text-gray-300 hover:text-white transition py-2"
              onClick={() => setIsMenuOpen(false)}
            >
              Dashboard
            </Link>
            <Link 
              href="/profile" 
              className="text-gray-300 hover:text-white transition py-2"
              onClick={() => setIsMenuOpen(false)}
            >
              Profile
            </Link>
            
            {!loading && (
              <>
                {user ? (
                  <Button 
                    onClick={() => {
                      signOut();
                      setIsMenuOpen(false);
                    }}
                    variant="outline"
                    className="border-gray-700 hover:bg-gray-800 mt-2"
                  >
                    Sign Out
                  </Button>
                ) : (
                  <div className="flex flex-col gap-3 mt-2">
                    <Button 
                      onClick={() => {
                        router.push('/auth/login');
                        setIsMenuOpen(false);
                      }}
                      variant="outline"
                      className="border-gray-700 hover:bg-gray-800"
                    >
                      Sign In
                    </Button>
                    <Button 
                      onClick={() => {
                        router.push('/auth/register');
                        setIsMenuOpen(false);
                      }}
                    >
                      Sign Up
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
} 