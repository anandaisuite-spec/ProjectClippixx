export const ORDER_TYPE_LABELS: Record<string, string> = {
  birthday_wish: 'Birthday Wish',
  shoutout: 'Shoutout',
  brand_promotion: 'Brand Promotion',
  product_launch: 'Product Launch',
  event_invitation: 'Event Invitation',
  chief_guest: 'Chief Guest',
  emcee: 'Emcee',
  pep_talk: 'Pep Talk',
  roast: 'Roast',
  custom: 'Custom',
};

export const PERSONAL_ORDER_TYPES = ['birthday_wish', 'shoutout', 'pep_talk', 'roast', 'custom'] as const;
export const BUSINESS_ORDER_TYPES = ['brand_promotion', 'product_launch', 'event_invitation', 'chief_guest', 'emcee', 'custom'] as const;

export const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending', accepted: 'Accepted', rejected: 'Rejected',
  in_progress: 'In Progress', delivered: 'Delivered', completed: 'Completed',
  cancelled: 'Cancelled', refunded: 'Refunded',
};

export const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  accepted: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  in_progress: 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400',
  delivered: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-500/15 dark:text-gray-400',
  rejected: 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400',
  refunded: 'bg-gray-100 text-gray-500 dark:bg-gray-500/15 dark:text-gray-400',
};
