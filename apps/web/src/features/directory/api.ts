import { directoryPageSchema, type DirectoryQueryInput } from '@ruet-chottor/shared';
import { apiRequest } from '@/lib/api-client';

export const directoryApi = {
  search: (query: DirectoryQueryInput) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') params.set(key, String(value));
    }
    return apiRequest(`/directory?${params.toString()}`, directoryPageSchema);
  },
};
