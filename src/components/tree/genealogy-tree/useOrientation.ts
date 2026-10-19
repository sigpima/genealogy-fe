import { useEffect, useState } from 'react';
import { ORIENTATION_KEY, type Orientation } from './constants';

/** The tree's direction, remembered in this browser. */
export function useOrientation(): [Orientation, () => void] {
  const [orientation, setOrientation] = useState<Orientation>('vertical');
  useEffect(() => {
    try {
      if (window.localStorage.getItem(ORIENTATION_KEY) === 'horizontal') setOrientation('horizontal');
    } catch {
      // storage can be blocked: the default is fine
    }
  }, []);
  function toggleOrientation() {
    const next: Orientation = orientation === 'vertical' ? 'horizontal' : 'vertical';
    setOrientation(next);
    try {
      window.localStorage.setItem(ORIENTATION_KEY, next);
    } catch {
      // not remembered, still works
    }
  }
  return [orientation, toggleOrientation];
}
