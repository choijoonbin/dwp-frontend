// ----------------------------------------------------------------------

import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// ----------------------------------------------------------------------

export type PageContext = {
  url: string;
  path: string;
  title: string;
  activeApp: string;
  itemId?: string;
  metadata?: Record<string, any>;
};

export const usePageContext = (): PageContext => {
  const location = useLocation();
  const [title, setTitle] = useState('');

  useEffect(() => {
    setTitle(document.title || window.location.pathname);
  }, [location]);

  const path = location.pathname;
  const segments = path.split('/').filter(Boolean);
  const activeApp = segments[0] || 'dashboard';
  const itemId = segments[segments.length - 1];

  // Extract metadata from page
  const [metadata, setMetadata] = useState<Record<string, any>>({});
  
  // Try to extract data from common elements
  useEffect(() => {
    const headings = Array.from(document.querySelectorAll('h1, h2, h3')).map((el) => el.textContent);
    const tables = document.querySelectorAll('table');
    const cards = document.querySelectorAll('[class*="card"], [class*="Card"]');

    const newMetadata: Record<string, any> = {};
    if (headings.length > 0) {
      newMetadata.headings = headings.slice(0, 5);
    }
    if (tables.length > 0) {
      newMetadata.hasTables = true;
      newMetadata.tableCount = tables.length;
    }
    if (cards.length > 0) {
      newMetadata.hasCards = true;
      newMetadata.cardCount = cards.length;
    }
    setMetadata(newMetadata);
  }, [location]);

  return {
    url: window.location.href,
    path,
    title,
    activeApp,
    itemId: /^\d+$/.test(itemId) || /^[a-f\d]{24}$/i.test(itemId) ? itemId : undefined,
    metadata,
  };
};
