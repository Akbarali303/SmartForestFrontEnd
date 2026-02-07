'use client';

export default function SettingsPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Sozlamalar</h1>
        <p className="text-slate-500 mt-1 text-sm">Tizim va foydalanuvchi sozlamalari</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-800 mb-3">Til</h2>
        <p className="text-sm text-slate-600">Interfeys tili: <span className="font-medium text-slate-800">O‘zbekcha</span></p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-800 mb-3">Mavzu</h2>
        <p className="text-sm text-slate-600">Yorug‘lik rejimi (kelajakda qo‘shiladi)</p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-800 mb-3">Bildirishnomalar</h2>
        <p className="text-sm text-slate-600">Hodisa va ogohlantirishlar haqida xabar olish sozlamalari (kelajakda qo‘shiladi)</p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-800 mb-3">Xarita</h2>
        <p className="text-sm text-slate-600">Xarita bazali qatlami va default ko‘rinish (kelajakda qo‘shiladi)</p>
      </section>
    </div>
  );
}
