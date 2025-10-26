import { createContext, useContext, useState, ReactNode } from 'react';

interface MapConfigContextType {
  mapboxToken: string;
  setMapboxToken: (token: string) => void;
  isMapConfigured: boolean;
}

const MapConfigContext = createContext<MapConfigContextType | undefined>(undefined);

export const useMapConfig = () => {
  const context = useContext(MapConfigContext);
  if (!context) {
    throw new Error('useMapConfig must be used within MapConfigProvider');
  }
  return context;
};

export const MapConfigProvider = ({ children }: { children: ReactNode }) => {
  const [mapboxToken, setMapboxTokenState] = useState(() => {
    return localStorage.getItem('mapbox_token') || '';
  });

  const setMapboxToken = (token: string) => {
    localStorage.setItem('mapbox_token', token);
    setMapboxTokenState(token);
  };

  return (
    <MapConfigContext.Provider value={{
      mapboxToken,
      setMapboxToken,
      isMapConfigured: Boolean(mapboxToken)
    }}>
      {children}
    </MapConfigContext.Provider>
  );
};