'use client';

export default function ForestRentPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Ijara yerlar</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Ijara maydonlari ro‘yxati, xaritada ko‘rsatish, tahrirlash va o‘chirish
        </p>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <p className="text-slate-600 text-sm">
          Bu sahifada ijara maydonlari ro‘yxati, xaritada ko‘rsatish va edit/delete funksiyalari qo‘shiladi.
        </p>
      </div>
    </div>
  );
}
