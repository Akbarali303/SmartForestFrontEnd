'use client';

import { usePathname } from 'next/navigation';
import DashboardSidebar from '@/components/DashboardSidebar';
import DashboardTopbar from '@/components/DashboardTopbar';
import { ForestAreasProvider } from '@/contexts/ForestAreasContext';
import { ContractsProvider } from '@/contexts/ContractsContext';
import { MonitoringNotificationsProvider } from '@/contexts/MonitoringNotificationsContext';
import { UnattendedAreasProvider } from '@/contexts/UnattendedAreasContext';

export default function DashboardLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isMapPage = pathname === '/dashboard/map';
  const isForestCreatePage = pathname === '/dashboard/forest/create';
  const isFullScreenMap = isMapPage || isForestCreatePage;

  return (
    <ForestAreasProvider>
      <ContractsProvider>
        <MonitoringNotificationsProvider>
        <UnattendedAreasProvider>
        <div className={`flex bg-slate-100 ${isFullScreenMap ? 'h-screen' : 'min-h-screen'}`}>
        <DashboardSidebar />
        <div className={`flex flex-1 flex-col min-w-0 ${isFullScreenMap ? 'h-screen overflow-hidden' : ''}`}>
          {!isFullScreenMap && <DashboardTopbar />}
          <main className={isFullScreenMap ? 'flex-1 min-h-0 flex flex-col overflow-hidden' : 'flex-1 p-6 overflow-auto'}>
            {children}
          </main>
        </div>
      </div>
        </UnattendedAreasProvider>
        </MonitoringNotificationsProvider>
      </ContractsProvider>
    </ForestAreasProvider>
  );
}
