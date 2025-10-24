// Class name utility for conditional styles
import { twMerge } from 'tailwind-merge';
import { ClassValue, clsx } from 'clsx';

export function cn(...args: ClassValue[]) {
  return twMerge(clsx(args));
}