// GYM-79: UI string constants for the program builder, library, and onboarding flows.
// All user-facing copy lives here (except exercise/split names which are user data).
//
// GYM-29 (Phase 1, 2026-08-22): this file's content has been migrated
// verbatim into messages/en.json's builder/library/explorer/onboarding/
// sessionBlock namespaces (+ Spanish in messages/es.json), the new
// locale-keyed source of truth for the next-intl infra (see
// i18n/request.ts, app/layout.tsx). This file itself is left as-is and
// still imported by the 4 screens using it today (RoutineEditorScreen,
// CustomProgramBuilderScreen, ProgramLibraryScreen, ProgramExplorerScreen)
// — those screens get rewired to `useTranslations()` when they're rebuilt
// in Phase 3/4, not here. Do not add new keys to this file; add them to
// messages/en.json + messages/es.json instead.

export const t = {
  // Program Builder
  builder: {
    titleCreate: 'Program Builder',
    titleEdit: 'Edit Program',
    namePlaceholder: 'e.g. My Custom Split',
    nameLabel: 'PROGRAM NAME',
    nameMinLengthError: 'Program name must be at least 3 characters',
    addSplitButton: '+ ADD SPLIT',
    maxSplitsWarning: 'Maximum 7 splits reached',
    splitNamePlaceholder: 'Split name',
    addExerciseButton: '+ ADD EXERCISE',
    setsLabel: 'S',
    repRangeLabel: 'Reps',
    saveButton: 'CREATE PROGRAM',
    saveButtonEdit: 'DONE',
    savingButton: 'SAVING...',
    cancelButton: 'Cancel',
    deleteSplitConfirm: 'DELETE',
    deleteSplitCancel: 'CANCEL',
    archiveNotice: 'This split has logged workouts and was archived',
    noExercises: 'No exercises yet',
    sessionBlockBanner: 'Finish your current workout before editing this program.',
  },

  // Program Library
  library: {
    title: 'PROGRAMS',
    myProgramsHeader: 'MY PROGRAMS',
    emptyStateHeading: 'GET STARTED',
    emptyStateBody: 'Explore curated programs or build your own from scratch.',
    exploreProgramsCta: '+ EXPLORE PROGRAMS',
    buildMyOwnCta: '+ BUILD MY OWN',
    editButton: 'EDIT',
    deleteButton: 'DELETE',
    deleteConfirmButton: 'CONFIRM',
    deleteCancelButton: 'CANCEL',
    selectButton: 'SELECT',
    activeBadge: 'ACTIVE',
    confirmButton: 'CONFIRM',
    cancelButton: 'CANCEL',
    loading: 'LOADING...',
  },

  // Program Explorer
  explorer: {
    title: 'EXPLORE PROGRAMS',
    backButton: '← PROGRAMS',
    addButton: 'ADD TO MY PROGRAMS',
    ownedButton: 'IN YOUR PROGRAMS',
    addingButton: 'ADDING...',
    splitsHeader: 'SPLITS & EXERCISES',
    errorGeneric: 'Something went wrong. Try again.',
  },

  // Onboarding
  onboarding: {
    title: 'Choose Your Program',
    subtitle: 'Pick a template to get started, or build your own from scratch.',
    templateSectionHeader: 'TEMPLATES',
    buildMyOwnCta: '+ BUILD MY OWN',
  },

  // Session block banner (shown when user tries to edit during active workout)
  sessionBlock: {
    banner: 'Finish your current workout before editing this program.',
  },
} as const
