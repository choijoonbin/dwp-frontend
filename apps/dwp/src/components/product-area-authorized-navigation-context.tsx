import { createContext, useContext, type ReactNode } from 'react';

const ProductAreaAuthorizedNavigationPathsContext = createContext<ReadonlySet<string> | null>(null);

export function ProductAreaAuthorizedNavigationPathsProvider({
  paths,
  children,
}: {
  paths: ReadonlySet<string>;
  children: ReactNode;
}) {
  return (
    <ProductAreaAuthorizedNavigationPathsContext.Provider value={paths}>
      {children}
    </ProductAreaAuthorizedNavigationPathsContext.Provider>
  );
}

export function useProductAreaAuthorizedNavigationPaths() {
  return useContext(ProductAreaAuthorizedNavigationPathsContext);
}
