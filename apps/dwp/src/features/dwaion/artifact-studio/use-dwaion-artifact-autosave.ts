import { useCallback, useEffect, useRef, useState } from 'react';

import type { DwaionArtifactDocument } from './dwaion-artifact-model';

type SaveArtifact = (
  artifactId: string,
  expectedRevision: number,
  content: { title: string; body: string },
  sources: DwaionArtifactDocument['sources']
) => Promise<DwaionArtifactDocument>;

export function useDwaionArtifactAutosave({
  serverDocument,
  enabled = true,
  save,
  onError,
}: {
  serverDocument: DwaionArtifactDocument | null;
  enabled?: boolean;
  save: SaveArtifact;
  onError: (error: unknown) => void;
}) {
  const [draft, setDraft] = useState<DwaionArtifactDocument | null>(null);
  const activeSave = useRef(false);
  const accessEpoch = useRef(0);
  useEffect(() => {
    accessEpoch.current += 1;
    if (!enabled) setDraft(null);
  }, [enabled]);
  let localDocument = serverDocument;
  if (
    draft &&
    serverDocument &&
    draft.artifactId === serverDocument.artifactId &&
    (['DIRTY', 'SAVING', 'FAILED', 'CONFLICT'].includes(draft.autosaveState) ||
      draft.revision >= serverDocument.revision)
  ) {
    localDocument = draft;
  }

  const update = useCallback(
    (artifactId: string, expectedRevision: number, content: { title: string; body: string }) => {
      const current =
        localDocument?.artifactId === artifactId && localDocument.revision === expectedRevision
          ? localDocument
          : serverDocument?.artifactId === artifactId
            ? serverDocument
            : null;
      if (!enabled || !current) return;
      setDraft({
        ...current,
        title: content.title,
        body: content.body,
        autosaveState: 'DIRTY',
      });
    },
    [enabled, localDocument, serverDocument]
  );

  useEffect(() => {
    if (!enabled || !draft || draft.autosaveState !== 'DIRTY') return;
    if (!draft.title.trim() || !draft.body.trim()) return;
    const snapshot = draft;
    const epoch = accessEpoch.current;
    const timer = window.setTimeout(() => {
      if (activeSave.current) return;
      activeSave.current = true;
      setDraft((current) =>
        current?.artifactId === snapshot.artifactId
          ? { ...current, autosaveState: 'SAVING' }
          : current
      );
      void save(
        snapshot.artifactId,
        snapshot.revision,
        { title: snapshot.title, body: snapshot.body },
        snapshot.sources
      )
        .then((saved) => {
          activeSave.current = false;
          if (epoch !== accessEpoch.current) {
            setDraft((current) => (current?.autosaveState === 'DIRTY' ? { ...current } : current));
            return;
          }
          setDraft((current) => {
            if (!current || current.artifactId !== snapshot.artifactId) return current;
            if (current.title === snapshot.title && current.body === snapshot.body) {
              return { ...saved, autosaveState: 'SAVED', lastSavedAt: saved.updatedAt };
            }
            return {
              ...current,
              revision: saved.revision,
              draftRevision: saved.draftRevision,
              updatedAt: saved.updatedAt,
              autosaveState: 'DIRTY',
            };
          });
        })
        .catch((error) => {
          activeSave.current = false;
          if (epoch !== accessEpoch.current) {
            setDraft((current) => (current?.autosaveState === 'DIRTY' ? { ...current } : current));
            return;
          }
          setDraft((current) =>
            current?.artifactId === snapshot.artifactId
              ? {
                  ...current,
                  autosaveState:
                    typeof error === 'object' &&
                    error !== null &&
                    'status' in error &&
                    error.status === 409
                      ? 'CONFLICT'
                      : 'FAILED',
                }
              : current
          );
          onError(error);
        });
    }, 650);
    return () => window.clearTimeout(timer);
  }, [draft, enabled, onError, save]);

  return { document: localDocument, update };
}
