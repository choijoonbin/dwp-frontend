/**
 * Case Tabs Debug Context — DEV/QA 전용 payload 저장
 * @see docs/job/PROMPT_FE_CASE_TABS_DEBUG_UX_P11.txt
 */

import { useMemo, useState, useContext, useCallback, createContext } from 'react';

export type TabDebugPayload = {
  status: 'success' | 'error';
  payload: unknown;
  error?: string;
  url?: string;
};

type CaseTabsDebugContextValue = {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  payloads: Record<string, TabDebugPayload>;
  setPayload: (tabKey: string, payload: TabDebugPayload) => void;
  clearPayload: (tabKey?: string) => void;
};

const CaseTabsDebugContext = createContext<CaseTabsDebugContextValue | null>(null);

export const useCaseTabsDebug = (): CaseTabsDebugContextValue | null => useContext(CaseTabsDebugContext);

export const CaseTabsDebugProvider = ({
  children,
  activeTab,
  onActiveTabChange,
}: {
  children: React.ReactNode;
  activeTab: string;
  onActiveTabChange: (tab: string) => void;
}) => {
  const [payloads, setPayloads] = useState<Record<string, TabDebugPayload>>({});

  const setPayload = useCallback((tabKey: string, payload: TabDebugPayload) => {
    setPayloads((prev) => ({ ...prev, [tabKey]: payload }));
  }, []);

  const clearPayload = useCallback((tabKey?: string) => {
    if (tabKey) {
      setPayloads((prev) => {
        const next = { ...prev };
        delete next[tabKey];
        return next;
      });
    } else {
      setPayloads({});
    }
  }, []);

  const value = useMemo<CaseTabsDebugContextValue>(
    () => ({
      activeTab,
      setActiveTab: onActiveTabChange,
      payloads,
      setPayload,
      clearPayload,
    }),
    [activeTab, onActiveTabChange, payloads, setPayload, clearPayload]
  );

  return (
    <CaseTabsDebugContext.Provider value={value}>
      {children}
    </CaseTabsDebugContext.Provider>
  );
};
