/**
 * Generic campus places, used by lost & found and marketplace meeting points. Each module adds a free
 * text "exactly where" (room, hall name...), so this list stays short and never names the wrong building.
 */
export const CAMPUS_PLACES = [
  'central_library',
  'academic_building',
  'cafeteria',
  'central_auditorium',
  'residential_hall',
  'medical_centre',
  'playground',
  'bus',
  'main_gate',
  'other',
] as const;
export type CampusPlace = (typeof CAMPUS_PLACES)[number];
