import 'react';

declare module 'react' {
  interface ButtonHTMLAttributes<T> extends HTMLAttributes<T> {
    variant?: string;
    size?: string;
    asChild?: boolean;
  }
} 