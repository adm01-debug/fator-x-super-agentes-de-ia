import { useEffect } from 'react';
import { toast } from 'sonner';

export function useNetworkStatus() {
  useEffect(() => {
    const handleOffline = () => {
      toast.error('Sem conexão com a internet', {
        id: 'network-offline',
        description: 'Verifique sua conexão e tente novamente.',
        duration: Infinity,
      });
    };

    const handleOnline = () => {
      toast.dismiss('network-offline');
      toast.success('Conexão restaurada', {
        id: 'network-online',
        duration: 3000,
      });
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    // Check initial state
    if (!navigator.onLine) handleOffline();

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);
}
