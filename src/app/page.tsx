import LoginPage from '@/app/login/page';
import Sidebar from './sidebar';
import GenealogyTree from './genealogy-tree/page';

export default function Home() {
  return (
    <>
      <Sidebar />
      <GenealogyTree />
    </>
  );
}
