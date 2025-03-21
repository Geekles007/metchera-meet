'use client';

import { useRef, useEffect } from 'react';
import gsap from 'gsap';

export default function GsapExample() {
  const boxRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // Make sure the element exists
    if (boxRef.current) {
      // Create a GSAP animation
      gsap.to(boxRef.current, {
        x: 100,
        duration: 1,
        ease: "power2.out",
        yoyo: true,
        repeat: -1
      });
    }

    // Cleanup function
    return () => {
      // Kill any animations to prevent memory leaks
      gsap.killTweensOf(boxRef.current);
    };
  }, []);

  return (
    <div className="flex justify-center items-center h-[300px]">
      <div 
        ref={boxRef} 
        className="w-20 h-20 bg-blue-500 rounded-md"
      >
      </div>
    </div>
  );
} 