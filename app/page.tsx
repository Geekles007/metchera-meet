'use client'

import Link from 'next/link';
import { Button } from '@/app/components/ui/button';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { FaVideo, FaRocket, FaLock, FaMicrophone } from 'react-icons/fa';
import gsap from 'gsap';

export default function Home() {
  const router = useRouter();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const feature1Ref = useRef<HTMLDivElement>(null);
  const feature2Ref = useRef<HTMLDivElement>(null);
  const feature3Ref = useRef<HTMLDivElement>(null);
  const feature4Ref = useRef<HTMLDivElement>(null);
  
  // GSAP animations when the component mounts
  useEffect(() => {
    // Create a timeline for the hero section
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    
    tl.fromTo(
      titleRef.current,
      { y: 50, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8 }
    )
    .fromTo(
      subtitleRef.current,
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8 },
      "-=0.5" // Start slightly before the previous animation ends
    )
    .fromTo(
      buttonRef.current,
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8 },
      "-=0.5"
    );
    
    // Animate feature cards
    const featureRefs = [feature1Ref.current, feature2Ref.current, feature3Ref.current, feature4Ref.current];
    
    featureRefs.forEach((feature, index) => {
      if (feature) {
        gsap.fromTo(
          feature,
          { 
            y: 50, 
            opacity: 0 
          },
          { 
            y: 0, 
            opacity: 1, 
            duration: 0.6,
            delay: 0.8 + (index * 0.2) // Stagger the animations
          }
        );
      }
    });
    
    return () => {
      // Cleanup animations
      tl.kill();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Hero Section */}
      <section className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-5xl text-center">
          <h1 
            ref={titleRef}
            className="text-4xl md:text-6xl font-bold mb-6"
          >
            Video meetings for everyone
          </h1>
          <p 
            ref={subtitleRef}
            className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto"
          >
            Connect, collaborate, and celebrate with secure and high-quality video conferencing
          </p>
          <div ref={buttonRef} className="flex flex-col sm:flex-row justify-center gap-4">
            <Button 
              onClick={() => router.push('/meet/new')}
              size="lg"
              className="text-lg py-6 px-8"
            >
              Start a meeting
            </Button>
            <Button 
              onClick={() => router.push('/auth/register')}
              variant="outline"
              size="lg"
              className="text-lg py-6 px-8 border-gray-700"
            >
              Sign up for free
            </Button>
          </div>
        </div>
      </section>
      
      {/* Feature Section */}
      <section className="py-16 px-4 bg-gray-800/40">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-center mb-12">Everything you need in one place</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div 
              ref={feature1Ref}
              className="bg-gray-800 p-6 rounded-xl border border-gray-700"
            >
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-4">
                <FaVideo className="text-blue-500 text-xl" />
              </div>
              <h3 className="text-xl font-semibold mb-2">HD Video</h3>
              <p className="text-gray-400">Crystal clear video and audio for the best meeting experience.</p>
            </div>
            
            <div 
              ref={feature2Ref}
              className="bg-gray-800 p-6 rounded-xl border border-gray-700"
            >
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-4">
                <FaRocket className="text-purple-500 text-xl" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Instant Meetings</h3>
              <p className="text-gray-400">Start or join meetings with just a single click.</p>
            </div>
            
            <div 
              ref={feature3Ref}
              className="bg-gray-800 p-6 rounded-xl border border-gray-700"
            >
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mb-4">
                <FaLock className="text-green-500 text-xl" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Secure Calls</h3>
              <p className="text-gray-400">End-to-end encryption for your privacy and security.</p>
            </div>
            
            <div 
              ref={feature4Ref}
              className="bg-gray-800 p-6 rounded-xl border border-gray-700"
            >
              <div className="w-12 h-12 bg-yellow-500/20 rounded-lg flex items-center justify-center mb-4">
                <FaMicrophone className="text-yellow-500 text-xl" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Noise Cancellation</h3>
              <p className="text-gray-400">Advanced audio processing to reduce background noise.</p>
            </div>
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="py-24 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to get started?</h2>
          <p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto">
            Join thousands of users who use Metchera Meet every day.
          </p>
          <Button 
            onClick={() => router.push('/auth/register')}
            size="lg"
            className="text-lg py-6 px-10"
          >
            Sign up for free
          </Button>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="bg-gray-800/70 py-10 px-4 border-t border-gray-700">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-4 md:mb-0">
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center mr-2">
                <span className="font-bold">M</span>
              </div>
              <span className="text-xl font-bold">Metchera Meet</span>
            </div>
            <div className="text-gray-400 text-sm">
              © {new Date().getFullYear()} Metchera Meet. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
