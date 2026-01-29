import { createContext, useContext, ReactNode, useState, useEffect } from 'react';

type SidebarContextType = {
  isExpanded: boolean;
  toggleSidebar: () => void;
  sidebarWidth: string;
};

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isExpanded, setIsExpanded] = useState(true);
  
  const toggleSidebar = () => {
    setIsExpanded(!isExpanded);
  };
  
  const sidebarWidth = isExpanded ? '120px' : '60px';
  
  // Mettre à jour la propriété CSS personnalisée
  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-width', sidebarWidth);
  }, [sidebarWidth]);
  
  return (
    <SidebarContext.Provider value={{ isExpanded, toggleSidebar, sidebarWidth }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}