import type { ServiceCategoryEnum } from '../types';

type ServiceCategory = Record<string, null>;

// Helper function to convert backend ServiceCategory to string
export const serviceCategoryToString = (category: ServiceCategory): string => {
  if ('Plumbing' in category) return 'Plumbing';
  if ('HairStyling' in category) return 'Hair Styling';
  if ('HouseCleaning' in category) return 'House Cleaning';
  if ('Electrical' in category) return 'Electrical';
  if ('Gardening' in category) return 'Gardening';
  if ('PetGrooming' in category) return 'Pet Grooming';
  if ('Tutoring' in category) return 'Tutoring';
  if ('Construction' in category) return 'Construction';
  if ('PersonalTraining' in category) return 'Personal Training';
  if ('Other' in category) return 'Other';
  return 'Unknown';
};

export const categoryLabel = (category: ServiceCategoryEnum) => serviceCategoryToString({ [category]: null });

// Helper function to convert string to backend ServiceCategory type
export const stringToServiceCategory = (categoryStr: string): ServiceCategory => {
  switch (categoryStr.toLowerCase().replace(/\s+/g, '')) {
    case 'plumbing': return { 'Plumbing': null };
    case 'hairstyling': return { 'HairStyling': null };
    case 'housecleaning': return { 'HouseCleaning': null };
    case 'electrical': return { 'Electrical': null };
    case 'gardening': return { 'Gardening': null };
    case 'petgrooming': return { 'PetGrooming': null };
    case 'tutoring': return { 'Tutoring': null };
    case 'construction': return { 'Construction': null };
    case 'personaltraining': return { 'PersonalTraining': null };
    case 'other': return { 'Other': null };
    default: return { 'Plumbing': null };
  }
};

// Convert ServiceCategory to ID string for UI components
export const serviceCategoryToId = (category: ServiceCategory): string => {
  return serviceCategoryToString(category).toLowerCase().replace(/\s+/g, '');
};

// Get all available service categories as strings
export const getServiceCategoryStrings = (): string[] => {
  return [
    'Plumbing',
    'Hair Styling', 
    'House Cleaning',
    'Electrical',
    'Gardening',
    'Pet Grooming',
    'Tutoring',
    'Construction',
    'Personal Training',
    'Other'
  ];
};
