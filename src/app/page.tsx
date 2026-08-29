'use client';

import { Header } from '@/components/layout/Header';
import GenealogyTree from './genealogy-tree/page';
import Sidebar from './sidebar';

export default function Home() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header searchQuery="" onSearchQueryChange={() => {}} searchResults={[]} />
        <div className="flex-1 overflow-hidden">
          <GenealogyTree />
        </div>
      </div>
    </div>
  );
}
