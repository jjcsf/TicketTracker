import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface SeasonContextType {
  selectedSeasonId: number | null;
  setSelectedSeasonId: (seasonId: number | null) => void;
}

const SeasonContext = createContext<SeasonContextType | undefined>(undefined);

interface SeasonProviderProps {
  children: ReactNode;
}

export function SeasonProvider({ children }: SeasonProviderProps) {
  const [selectedSeasonId, setSelectedSeasonIdState] = useState<number | null>(() => {
    // Initialize from sessionStorage
    const stored = sessionStorage.getItem('selectedSeasonId');
    return stored ? parseInt(stored, 10) : null;
  });

  const setSelectedSeasonId = (seasonId: number | null) => {
    setSelectedSeasonIdState(seasonId);
    // Persist to sessionStorage
    if (seasonId !== null) {
      sessionStorage.setItem('selectedSeasonId', seasonId.toString());
    } else {
      sessionStorage.removeItem('selectedSeasonId');
    }
  };

  return (
    <SeasonContext.Provider value={{ selectedSeasonId, setSelectedSeasonId }}>
      {children}
    </SeasonContext.Provider>
  );
}

export function useSeason() {
  const context = useContext(SeasonContext);
  if (context === undefined) {
    throw new Error('useSeason must be used within a SeasonProvider');
  }
  return context;
}