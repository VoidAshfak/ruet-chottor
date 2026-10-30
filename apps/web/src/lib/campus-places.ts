import type { CampusPlace } from '@ruet-chottor/shared';

/** Labels for the shared campus places (lost & found, marketplace meeting points). */
export const CAMPUS_PLACE_LABELS = {
  central_library: 'Central library',
  academic_building: 'Academic building',
  cafeteria: 'Cafeteria',
  central_auditorium: 'Central auditorium',
  residential_hall: 'Residential hall',
  medical_centre: 'Medical centre',
  playground: 'Playground',
  bus: 'University bus',
  main_gate: 'Main gate',
  other: 'Somewhere else',
} as const satisfies Record<CampusPlace, string>;
