'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import GenealogyTree, { type FocusRequest } from './genealogy-tree/page';
import treeData from './genealogy-tree/new_treeData.json';
import Sidebar from './sidebar';
import { findMembersByName } from '@/lib/tree/search';
import type { FamilyMember } from '@/lib/tree/types';

const familyTree = treeData as FamilyMember;

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);

  const matches = findMembersByName(familyTree, searchQuery);

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          searchResults={matches.map((match) => ({
            key: match.path.join(' > '),
            label: match.path.join(' → '),
            onSelect: () => setFocusRequest({ path: match.path, token: Date.now() }),
          }))}
        />
        <div className="flex-1 overflow-hidden">
          <GenealogyTree focusRequest={focusRequest} />
        </div>
      </div>
    </div>
  );
}
