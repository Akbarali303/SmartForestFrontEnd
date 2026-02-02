'use client';

import StatCard from '@/components/StatCard';

const DEMO_STATS = [
  { title: 'O‘rmon maydoni', value: '12 450 ga', icon: ForestIcon },
  { title: 'Faol kamerlar', value: '24', icon: CameraIcon },
  { title: 'Xavfli zonalar', value: '8', icon: AlertIcon },
  { title: 'Monitoring hududlari', value: '14', icon: MapIcon },
  { title: 'Aniqlangan hodisalar', value: '156', icon: EventIcon },
];

const DEMO_MONITORING = [
  { id: 1, region: 'Toshkent viloyati', status: 'Normal', time: '10:45' },
  { id: 2, region: 'Fargʻona viloyati', status: 'Ogohlantirish', time: '10:42' },
  { id: 3, region: 'Samarqand viloyati', status: 'Normal', time: '10:40' },
  { id: 4, region: 'Buxoro viloyati', status: 'Normal', time: '10:38' },
  { id: 5, region: 'Qashqadaryo viloyati', status: 'Normal', time: '10:35' },
];

const SEVERITY_LABEL: Record<string, string> = { high: 'Yuqori', medium: 'O‘rta', low: 'Past' };
const DEMO_EVENTS = [
  { id: 1, title: 'Daraxt tekshiruvi', severity: 'medium', time: '10:30' },
  { id: 2, title: 'Harorat oshishi', severity: 'low', time: '10:15' },
  { id: 3, title: 'Yongʻin xavfi', severity: 'high', time: '09:55' },
  { id: 4, title: 'Kamera o‘flayn', severity: 'medium', time: '09:40' },
];

const CAMERA_STATUS_LABEL: Record<string, string> = { online: 'Onlayn', offline: 'O‘flayn' };
const DEMO_CAMERAS = [
  { id: 1, name: 'Cam-01 Toshkent', status: 'online' },
  { id: 2, name: 'Cam-02 Fargʻona', status: 'online' },
  { id: 3, name: 'Cam-03 Samarqand', status: 'offline' },
  { id: 4, name: 'Cam-04 Buxoro', status: 'online' },
];

function ForestIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  );
}
function CameraIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}
function AlertIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}
function MapIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  );
}
function EventIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );
}

export default function DashboardPage() {
  if (typeof window === 'undefined') {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="animate-pulse text-slate-500">Yuklanmoqda...</div>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Boshqaruv paneli</h1>
        <p className="text-slate-500 mt-0.5">Monitoring va statistika</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {DEMO_STATS.map((stat) => (
          <StatCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            icon={<stat.icon />}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="font-semibold text-slate-800">So‘nggi monitoring</h2>
            <p className="text-sm text-slate-500">Viloyatlar bo‘yicha holat</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600">
                  <th className="text-left px-5 py-3 font-medium">Viloyat</th>
                  <th className="text-left px-5 py-3 font-medium">Holat</th>
                  <th className="text-left px-5 py-3 font-medium">Vaqt</th>
                </tr>
              </thead>
              <tbody>
                {DEMO_MONITORING.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                    <td className="px-5 py-3 text-slate-800">{row.region}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          row.status === 'Ogohlantirish'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-forest-100 text-forest-700'
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-500">{row.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="font-semibold text-slate-800">Eventlar</h2>
            <p className="text-sm text-slate-500">So‘nggi aniqlangan hodisalar</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600">
                  <th className="text-left px-5 py-3 font-medium">Hodisa</th>
                  <th className="text-left px-5 py-3 font-medium">Daraja</th>
                  <th className="text-left px-5 py-3 font-medium">Vaqt</th>
                </tr>
              </thead>
              <tbody>
                {DEMO_EVENTS.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                    <td className="px-5 py-3 text-slate-800">{row.title}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          row.severity === 'high'
                            ? 'bg-red-100 text-red-700'
                            : row.severity === 'medium'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {SEVERITY_LABEL[row.severity] ?? row.severity}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-500">{row.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">Kamera holati</h2>
          <p className="text-sm text-slate-500">Kamerlar ro‘yxati va holati</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600">
                <th className="text-left px-5 py-3 font-medium">ID</th>
                <th className="text-left px-5 py-3 font-medium">Nomi</th>
                <th className="text-left px-5 py-3 font-medium">Holat</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_CAMERAS.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                  <td className="px-5 py-3 text-slate-500">{row.id}</td>
                  <td className="px-5 py-3 text-slate-800">{row.name}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${
                        row.status === 'online'
                          ? 'bg-forest-100 text-forest-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          row.status === 'online' ? 'bg-forest-500' : 'bg-red-500'
                        }`}
                      />
                      {CAMERA_STATUS_LABEL[row.status] ?? row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
