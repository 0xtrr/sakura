// Pricing type definitions
export type PricingType = 'free' | 'freemium' | 'paid';

export interface PopularServer {
  url: string;
  name: string;
  pricing: PricingType;
  description: string;
  pricingDetails?: string;
}

// Popular Blossom servers for quick addition
export const POPULAR_SERVERS: PopularServer[] = [
  { 
    url: 'https://blossom.primal.net', 
    name: 'Primal',
    pricing: 'free',
    description: 'Free server by Primal'
  },
  { 
    url: 'https://nostr.media', 
    name: 'Nostr.media',
    pricing: 'free',
    description: 'Free Nostr media hosting'
  },
  { 
    url: 'https://nostrmedia.com', 
    name: 'NostrMedia.com',
    pricing: 'freemium',
    description: 'Free: 100 uploads, 30 days retention. Paid plans available.',
    pricingDetails: 'Free tier: 100 uploads with 30 days retention. Three paid plan levels with higher limits and longer retention.'
  },
  { 
    url: 'https://blossom.band', 
    name: 'Blossom.band',
    pricing: 'freemium',
    description: 'Free for images/videos, paid for other files',
    pricingDetails: 'Free for common media types (images, videos). Other file types may require payment.'
  },
  { 
    url: 'https://cdn.satellite.earth', 
    name: 'Satellite',
    pricing: 'paid',
    description: '$0.05/GB/month',
    pricingDetails: 'Flat rate of $0.05 USD per gigabyte per month'
  },
];

// Helper function to get pricing badge styling
export const getPricingBadge = (pricing: PricingType) => {
  switch (pricing) {
    case 'free':
      return {
        text: 'Free',
        className: 'bg-green-100 text-green-800 border-green-200'
      };
    case 'freemium':
      return {
        text: 'Freemium',
        className: 'bg-blue-100 text-blue-800 border-blue-200'
      };
    case 'paid':
      return {
        text: 'Paid',
        className: 'bg-orange-100 text-orange-800 border-orange-200'
      };
  }
};

// Helper function to normalize URLs for comparison (remove trailing slash)
export const normalizeUrl = (url: string): string => {
  return url.endsWith('/') ? url.slice(0, -1) : url;
};