import { useState } from 'react';

export const useCompetitorResearch = () => {
  const [research, setResearch] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  return {
    research,
    researchData: [],
    stationStats: [],
    loading,
    addResearch: async () => {},
    updateResearch: async () => {},
    deleteResearch: async () => {},
    refreshResearch: async () => {},
    refetch: async () => {},
  };
};
