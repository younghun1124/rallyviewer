import { Suspense } from 'react';
import RallyViewer from '@/components/RallyViewer';

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white selection:bg-lime-500/30">
      <Suspense fallback={<div className="text-white text-center py-20">Loading...</div>}>
        <RallyViewer />
      </Suspense>
    </main>
  );
}
