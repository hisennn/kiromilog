"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";

type TrackFormAction = (formData: FormData) => Promise<boolean | void>;
type TrackFormValues = Record<string, string | number | null | undefined>;
type TrackFormSnapshot = Record<string, string>;

function normalizeFieldValue(value: FormDataEntryValue | string | number | null | undefined) {
  return value == null ? "" : String(value);
}

function createSnapshotFromValues(values: TrackFormValues): TrackFormSnapshot {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, normalizeFieldValue(value)]),
  );
}

function createSnapshotFromForm(form: HTMLFormElement, fieldNames: string[]) {
  const formData = new FormData(form);

  return Object.fromEntries(
    fieldNames.map((fieldName) => [fieldName, normalizeFieldValue(formData.get(fieldName))]),
  );
}

function snapshotsMatch(a: TrackFormSnapshot, b: TrackFormSnapshot) {
  return Object.keys(a).every((key) => a[key] === b[key]);
}

function applySnapshotToForm(form: HTMLFormElement, snapshot: TrackFormSnapshot) {
  for (const [fieldName, value] of Object.entries(snapshot)) {
    const field = form.elements.namedItem(fieldName);

    if (
      field instanceof HTMLInputElement ||
      field instanceof HTMLSelectElement ||
      field instanceof HTMLTextAreaElement
    ) {
      field.value = value;
    }
  }
}

export function SaveButton({
  className,
  children,
  disabled,
  isPending = false,
  showSuccess = false,
}: {
  className?: string;
  children: React.ReactNode;
  disabled?: boolean;
  isPending?: boolean;
  showSuccess?: boolean;
}) {

  return (
      <div className="flex items-center justify-end gap-3 w-full md:w-auto">
      {showSuccess && !isPending && (
        <span className="text-green-400 font-medium text-xs animate-fade-in-up whitespace-nowrap">Successfully saved!</span>
      )}
      {isPending && (
        <span className="inline-flex items-center justify-center h-4 w-4" aria-label="Saving...">
          <span className="loading-spinner text-muted/70" />
        </span>
      )}
      <button
        className={`button ${className} transition-all duration-300 ${
          disabled || isPending
            ? "opacity-40 cursor-not-allowed border-white/10 bg-transparent text-muted"
            : "button-primary cursor-pointer hover:-translate-y-0.5 shadow-[0_0_15px_rgba(255,255,255,0.1)]"
        }`}
        disabled={isPending || disabled}
        type="submit"
      >
        {isPending ? "Saving..." : children}
      </button>
    </div>
  );
}

export function TrackForm({
  action,
  defaultValues,
  children,
  className,
  allowPristineSubmit = false,
  modalId,
}: {
  action: TrackFormAction;
  defaultValues: TrackFormValues;
  children: (state: { isDirty: boolean; isSaving: boolean; canSubmit: boolean; showSuccess: boolean }) => React.ReactNode;
  className?: string;
  allowPristineSubmit?: boolean;
  modalId?: string;
}) {
  const [isDirty, setIsDirty] = useState(false);
  const [canSubmitPristine, setCanSubmitPristine] = useState(allowPristineSubmit);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSaving, startSavingTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const baselineRef = useRef(createSnapshotFromValues(defaultValues));
  const initialBaselineRef = useRef(createSnapshotFromValues(defaultValues));

  const defaultValuesStr = JSON.stringify(defaultValues);

  const syncDirtyState = useCallback(() => {
    if (!formRef.current) {
      return;
    }

    const currentSnapshot = createSnapshotFromForm(
      formRef.current,
      Object.keys(baselineRef.current),
    );

    setIsDirty(!snapshotsMatch(currentSnapshot, baselineRef.current));
  }, []);

  useEffect(() => {
    const newSnapshot = createSnapshotFromValues(JSON.parse(defaultValuesStr));
    baselineRef.current = newSnapshot;
    initialBaselineRef.current = newSnapshot;
    if (formRef.current) {
      applySnapshotToForm(formRef.current, newSnapshot);
    }
    syncDirtyState();
  }, [defaultValuesStr, syncDirtyState]);

  const restoreBaseline = useCallback(
    (nextBaseline: TrackFormSnapshot, nextCanSubmitPristine: boolean) => {
      baselineRef.current = nextBaseline;

      if (formRef.current) {
        applySnapshotToForm(formRef.current, nextBaseline);
      }

      setIsDirty(false);
      setCanSubmitPristine(nextCanSubmitPristine);
    },
    [],
  );

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!formRef.current || isSaving) {
        return;
      }

      const currentSnapshot = createSnapshotFromForm(
        formRef.current,
        Object.keys(baselineRef.current),
      );
      const dirty = !snapshotsMatch(currentSnapshot, baselineRef.current);
      const canSubmit = dirty || canSubmitPristine;

      setIsDirty(dirty);

      if (!canSubmit) {
        return;
      }

      const formData = new FormData(formRef.current);

      startSavingTransition(async () => {
        const result = await action(formData);

        if (result === false) {
          syncDirtyState();
          return;
        }

        restoreBaseline(currentSnapshot, false);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      });
    },
    [action, canSubmitPristine, isSaving, restoreBaseline, syncDirtyState],
  );

  useEffect(() => {
    if (!modalId) return;

    const handleHashChange = () => {
      const isOpen = window.location.hash === `#${modalId}`;

      if (!isOpen) {
        setShowSuccess(false);
        restoreBaseline(
          baselineRef.current,
          allowPristineSubmit &&
            snapshotsMatch(baselineRef.current, initialBaselineRef.current),
        );
      }
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [allowPristineSubmit, modalId, restoreBaseline]);

  const isActuallySaving = isSaving;

  return (
    <form
      ref={formRef}
      className={className}
      onChange={syncDirtyState}
      onInput={syncDirtyState}
      onSubmit={handleSubmit}
      autoComplete="off"
    >
      {children({
        isDirty,
        isSaving: isActuallySaving,
        canSubmit: isDirty || canSubmitPristine,
        showSuccess,
      })}
    </form>
  );
}
