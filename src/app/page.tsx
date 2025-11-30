import RallyViewer from '@/components/RallyViewer';

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white selection:bg-lime-500/30">
      <RallyViewer />
    </main>
  );
}
