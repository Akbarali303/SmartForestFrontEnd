import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Camera test — Smart Forest',
  description: 'HLS oqimni tekshirish (xaritaga qo‘shishdan oldin)',
};

export default function CameraTestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
