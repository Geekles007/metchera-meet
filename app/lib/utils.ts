import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import React from "react";

/**
 * Combines multiple className values using clsx and tailwind-merge
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format time from timestamp (e.g., 2:35 PM)
 */
export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Generate a random meeting ID
 */
export function generateMeetingId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const segments = [];
  
  // Create 3 segments of 3 characters each
  for (let i = 0; i < 3; i++) {
    let segment = '';
    for (let j = 0; j < 3; j++) {
      segment += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    segments.push(segment);
  }
  
  return segments.join('-');
}

/**
 * Get initials from a name
 */
export function getUserInitials(name: string): string {
  if (!name) return '?';
  
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Get a random color for avatar backgrounds
 */
export function getRandomColor(): string {
  const colors = [
    'bg-red-500',
    'bg-blue-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-teal-500',
  ];
  
  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Check if a URL is valid
 */
export function isValidUrl(url: string): boolean {
  try {
    // Check if we're in an environment where URL is available
    if (typeof URL === 'undefined') {
      // Simple validation for server-side
      return url.match(/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/) !== null;
    }
    
    // Make sure the URL has a protocol before passing to the URL constructor
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'http://' + url;
    }
    new URL(url);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Shorten a string to a specific length with ellipsis
 */
export function truncateString(str: string, length: number): string {
  if (!str || str.length <= length) return str;
  return str.substring(0, length) + '...';
}

// Format a user's name for display
export function formatName(name: string): string {
  if (!name) return 'Guest';
  return name.split(' ').map(n => n.charAt(0).toUpperCase() + n.slice(1)).join(' ');
}

// Fix for framer-motion className type issue
export const motion = {
  div: (props: any) => {
    const { className, ...rest } = props;
    return React.createElement('div', { ...rest, className });
  }
};

/**
 * Format a date to a human-readable distance to now (e.g. "5 minutes ago")
 */
export function formatDistanceToNow(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  // Less than a minute
  if (diffInSeconds < 60) {
    return 'just now';
  }
  
  // Less than an hour
  if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  }
  
  // Less than a day
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }
  
  // Less than a week
  if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
  
  // Format as date
  return date.toLocaleDateString();
} 