import {
  PRIMARY_MUSCLE_GROUPS,
  DETAILED_MODE_MUSCLE_GROUPS,
  MUSCLE_LABELS,
  collapseDetailedMusclesToPrimary,
  expandPrimaryMusclesForDetailedMode,
} from '/shared/muscles.js';
import {
  buildRoutineDraft,
  copyExercises,
  createEmptyExercise,
  createEmptyRoutine,
  createRoutineSnapshot,
  validateRoutineDraft,
} from '/shared/programs.js';

const USER_ID = "default-user";
const API_BASE = window.__ROUTINE_WEB_CONFIG__?.apiBase || "http://localhost:4000";
const MUSCLE_MODE_STORAGE_KEY = "routine-lab-muscle-mode";
const PRIMARY_MUSCLE_OPTIONS = PRIMARY_MUSCLE_GROUPS.map((key) => [key, MUSCLE_LABELS[key]]);
const DETAILED_MUSCLE_OPTIONS = DETAILED_MODE_MUSCLE_GROUPS.map((key) => [key, MUSCLE_LABELS[key]]);

const state = {
  programs: [],
  selectedProgramId: null,
  draft: createEmptyRoutine(createId),
  lastSavedSnapshot: "",
  connectionState: "loading",
  draggingExerciseId: null,
  muscleMode: loadMuscleMode(),
};

const elements = {
  routineList: document.querySelector("#routine-list"),
  routineCount: document.querySelector("#routine-count"),
  statusText: document.querySelector("#status-text"),
  connectionDot: document.querySelector("#connection-dot"),
  editorTitle: document.querySelector("#editor-title"),
  dirtyIndicator: document.querySelector("#dirty-indicator"),
  routineName: document.querySelector("#routine-name"),
  muscleModeSelect: document.querySelector("#muscle-mode-select"),
  exerciseList: document.querySelector("#exercise-list"),
  emptyState: document.querySelector("#empty-state"),
  newRoutineBtn: document.querySelector("#new-routine-btn"),
  addExerciseBtn: document.querySelector("#add-exercise-btn"),
  emptyAddExerciseBtn: document.querySelector("#empty-add-exercise-btn"),
  importBtn: document.querySelector("#import-btn"),
  importInput: document.querySelector("#import-input"),
  saveBtn: document.querySelector("#save-btn"),
  deleteBtn: document.querySelector("#delete-btn"),
  duplicateBtn: document.querySelector("#duplicate-btn"),
  refreshBtn: document.querySelector("#refresh-btn"),
  routineItemTemplate: document.querySelector("#routine-item-template"),
  exerciseTemplate: document.querySelector("#exercise-template"),
};

bindEvents();
bootstrap();

async function bootstrap() {
  syncDraftInputs();
  updateStatus("loading", "Checking API connection...");
  const isHealthy = await checkHealth();
  if (!isHealthy) {
    render();
    return;
  }
  await loadPrograms();
}

function bindEvents() {
  elements.newRoutineBtn.addEventListener("click", () => {
    if (!confirmDiscardIfNeeded()) return;
    state.selectedProgramId = null;
    state.draft = createEmptyRoutine(createId);
    state.lastSavedSnapshot = createRoutineSnapshot(state.draft.name, state.draft.exercises);
    render();
  });

  elements.addExerciseBtn.addEventListener("click", () => {
    appendExercise();
  });

  elements.emptyAddExerciseBtn.addEventListener("click", () => {
    appendExercise();
  });

  elements.importBtn.addEventListener("click", () => {
    elements.importInput.click();
  });

  elements.importInput.addEventListener("change", async (event) => {
    const [file] = Array.from(event.target.files || []);
    event.target.value = "";
    if (!file) return;
    await importRoutineFromFile(file);
  });

  elements.saveBtn.addEventListener("click", async () => {
    await saveCurrentRoutine();
  });

  elements.deleteBtn.addEventListener("click", async () => {
    await deleteCurrentRoutine();
  });

  elements.duplicateBtn.addEventListener("click", () => {
    duplicateCurrentRoutine();
  });

  elements.refreshBtn.addEventListener("click", async () => {
    await loadPrograms();
  });

  elements.routineName.addEventListener("input", (event) => {
    state.draft.name = event.target.value;
    renderMetaOnly();
  });

  elements.muscleModeSelect.addEventListener("change", (event) => {
    state.muscleMode = event.target.value === "detailed" ? "detailed" : "primary";
    window.localStorage.setItem(MUSCLE_MODE_STORAGE_KEY, state.muscleMode);
    renderExerciseList();
  });
}

function appendExercise() {
  state.draft.exercises.push(createEmptyExercise(createId));
  render();
}

function stripJsonExtension(filename) {
  return typeof filename === "string" ? filename.replace(/.json$/i, "").trim() : "";
}

function extractImportSource(payload) {
  if (Array.isArray(payload)) {
    return { name: "", exercises: payload };
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("File must contain a JSON object or an exercises array.");
  }

  for (const key of ["program", "routine", "workout"]) {
    if (payload[key] && typeof payload[key] === "object") {
      return payload[key];
    }
  }

  return payload;
}

function inferInitialWeightFromSets(sets) {
  if (!Array.isArray(sets)) {
    return null;
  }

  for (const set of sets) {
    const weight = Number(set?.weight);
    if (Number.isFinite(weight) && weight >= 0) {
      return weight;
    }
  }

  return null;
}

function convertImportedExercise(exercise) {
  const defaultSets = Number(exercise?.defaultSets);
  const setCount = Array.isArray(exercise?.sets) ? exercise.sets.length : 0;
  const restSeconds = Number(exercise?.restSeconds);
  const initialWeight = Number(exercise?.initialWeight);

  return {
    id: createId(),
    name: typeof exercise?.name === "string" ? exercise.name : "",
    defaultSets: Number.isFinite(defaultSets)
      ? Math.max(1, Math.round(defaultSets))
      : Math.max(1, setCount || 3),
    restSeconds: Number.isFinite(restSeconds)
      ? Math.max(0, Math.round(restSeconds))
      : 90,
    notes: typeof exercise?.notes === "string" ? exercise.notes : "",
    weightUnit: exercise?.weightUnit === "lbs" ? "lbs" : "kg",
    initialWeight: Number.isFinite(initialWeight) && initialWeight >= 0
      ? initialWeight
      : inferInitialWeightFromSets(exercise?.sets),
    muscles: Array.isArray(exercise?.muscles) ? exercise.muscles : [],
  };
}

function buildImportedDraft(payload, fallbackName) {
  const source = extractImportSource(payload);
  const exercises = Array.isArray(source?.exercises)
    ? source.exercises
    : Array.isArray(source)
      ? source
      : null;

  if (!exercises) {
    throw new Error("File must include an exercises array.");
  }

  const name = typeof source?.name === "string" && source.name.trim().length > 0
    ? source.name
    : stripJsonExtension(fallbackName) || "Imported routine";

  return buildRoutineDraft(name, exercises.map(convertImportedExercise), createId);
}

async function importRoutineFromFile(file) {
  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    const importedDraft = buildImportedDraft(payload, file.name);
    const validationError = validateRoutineDraft(importedDraft.name, importedDraft.exercises);

    if (validationError) {
      alert("Import failed: " + validationError);
      return;
    }

    if (!confirmDiscardIfNeeded()) {
      return;
    }

    state.selectedProgramId = null;
    state.draft = importedDraft;
    state.lastSavedSnapshot = "";
    updateStatus("connected", "Imported " + file.name);
    render();
  } catch (error) {
    console.error(error);
    updateStatus("error", "Import failed");
    alert("The file could not be imported. Use a JSON file containing a routine/program or workout with an exercises array.");
  }
}

function render() {
  renderRoutineList();
  renderDraft();
  renderStatusChrome();
}

function renderRoutineList() {
  const sortedPrograms = [...state.programs].sort((a, b) => normalizeUpdatedAt(b) - normalizeUpdatedAt(a));
  elements.routineList.innerHTML = "";
  elements.routineCount.textContent = String(sortedPrograms.length);

  if (sortedPrograms.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = "<strong>No routines yet.</strong><span>Create one to write straight into your database.</span>";
    elements.routineList.append(empty);
    return;
  }

  for (const program of sortedPrograms) {
    const fragment = elements.routineItemTemplate.content.cloneNode(true);
    const button = fragment.querySelector(".routine-item");
    const name = fragment.querySelector(".routine-item-name");
    const meta = fragment.querySelector(".routine-item-meta");
    const exerciseCount = (program.exercises || []).length;

    name.textContent = program.name || "Untitled routine";
        meta.textContent = `${exerciseCount} exercise${exerciseCount === 1 ? "" : "s"} - updated ${formatDate(normalizeUpdatedAt(program))}`;

    if (program._id === state.selectedProgramId) {
      button.classList.add("is-selected");
    }

    button.addEventListener("click", () => {
      if (program._id === state.selectedProgramId) return;
      if (!confirmDiscardIfNeeded()) return;
      loadDraftFromProgram(program);
      render();
    });

    elements.routineList.append(button);
  }
}

function renderDraft() {
  elements.editorTitle.textContent = state.selectedProgramId ? "Edit routine" : "New routine";
  syncDraftInputs();
  renderExerciseList();
  renderMetaOnly();
}

function renderMetaOnly() {
  const dirty = isDraftDirty();
  elements.dirtyIndicator.textContent = dirty ? "Unsaved changes" : "All changes saved";
  elements.deleteBtn.disabled = !state.selectedProgramId;
  elements.duplicateBtn.disabled = !state.draft.name.trim() && state.draft.exercises.length === 0;
}

function renderStatusChrome() {
  elements.connectionDot.classList.remove("connected", "error");
  if (state.connectionState === "connected") {
    elements.connectionDot.classList.add("connected");
  }
  if (state.connectionState === "error") {
    elements.connectionDot.classList.add("error");
  }
}

function syncDraftInputs() {
  elements.routineName.value = state.draft.name;
  elements.muscleModeSelect.value = state.muscleMode;
}

function getMuscleOptions() {
  return state.muscleMode === "detailed" ? DETAILED_MUSCLE_OPTIONS : PRIMARY_MUSCLE_OPTIONS;
}

function getDisplayedMuscles(muscles) {
  return state.muscleMode === "detailed"
    ? expandPrimaryMusclesForDetailedMode(muscles || [])
    : collapseDetailedMusclesToPrimary(muscles || []);
}

function toggleDisplayedMuscle(selectedMuscles, muscleKey) {
  const next = new Set(selectedMuscles);
  if (next.has(muscleKey)) {
    next.delete(muscleKey);
  } else {
    next.add(muscleKey);
  }
  return Array.from(next);
}

function renderExerciseList() {
  const exercises = state.draft.exercises;
  elements.exerciseList.innerHTML = "";
  elements.emptyState.hidden = exercises.length !== 0;

  exercises.forEach((exercise, index) => {
    const fragment = elements.exerciseTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".exercise-card");
    const slotLabel = fragment.querySelector(".exercise-slot-label");
    const titleInput = fragment.querySelector(".exercise-title-input");
    const setsInput = fragment.querySelector(".exercise-sets-input");
    const restInput = fragment.querySelector(".exercise-rest-input");
    const unitInput = fragment.querySelector(".exercise-unit-input");
    const weightInput = fragment.querySelector(".exercise-weight-input");
    const notesInput = fragment.querySelector(".exercise-notes-input");
    const removeButton = fragment.querySelector(".remove-exercise-btn");
    const muscleGroup = fragment.querySelector(".muscle-chip-group");
    const muscleModeBadge = fragment.querySelector(".muscle-mode-badge");

    card.dataset.exerciseId = exercise.id;
    slotLabel.textContent = `Slot ${index + 1}`;
    titleInput.value = exercise.name;
    setsInput.value = String(exercise.defaultSets);
    restInput.value = String(exercise.restSeconds);
    unitInput.value = exercise.weightUnit;
    weightInput.value = exercise.initialWeight == null ? "" : String(exercise.initialWeight);
    notesInput.value = exercise.notes;

    const displayedMuscles = getDisplayedMuscles(exercise.muscles);
    const muscleOptions = getMuscleOptions();
    muscleModeBadge.textContent = state.muscleMode === "detailed" ? "Detailed groups" : "Primary groups";

    titleInput.addEventListener("input", (event) => {
      exercise.name = event.target.value;
      renderMetaOnly();
    });

    setsInput.addEventListener("input", (event) => {
      const numeric = Number(event.target.value);
      exercise.defaultSets = Number.isFinite(numeric) && numeric >= 1 ? Math.round(numeric) : 1;
      renderMetaOnly();
    });

    restInput.addEventListener("input", (event) => {
      const numeric = Number(event.target.value);
      exercise.restSeconds = Number.isFinite(numeric) && numeric >= 0 ? Math.round(numeric) : 0;
      renderMetaOnly();
    });

    unitInput.addEventListener("change", (event) => {
      exercise.weightUnit = event.target.value;
      renderMetaOnly();
    });

    weightInput.addEventListener("input", (event) => {
      const rawValue = event.target.value;
      if (rawValue === "") {
        exercise.initialWeight = null;
      } else {
        const numeric = Number(rawValue);
        exercise.initialWeight = Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
      }
      renderMetaOnly();
    });

    notesInput.addEventListener("input", (event) => {
      exercise.notes = event.target.value;
      renderMetaOnly();
    });

    removeButton.addEventListener("click", () => {
      state.draft.exercises = state.draft.exercises.filter((item) => item.id !== exercise.id);
      render();
    });

    card.addEventListener("dragstart", (event) => {
      state.draggingExerciseId = exercise.id;
      card.classList.add("is-dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", exercise.id);
    });

    card.addEventListener("dragend", () => {
      state.draggingExerciseId = null;
      card.classList.remove("is-dragging");
      clearDropTargets();
    });

    card.addEventListener("dragover", (event) => {
      event.preventDefault();
      if (state.draggingExerciseId && state.draggingExerciseId !== exercise.id) {
        card.classList.add("is-drop-target");
      }
    });

    card.addEventListener("dragleave", () => {
      card.classList.remove("is-drop-target");
    });

    card.addEventListener("drop", (event) => {
      event.preventDefault();
      const draggedId = state.draggingExerciseId || event.dataTransfer.getData("text/plain");
      reorderExercises(draggedId, exercise.id);
    });

    for (const [muscleKey, label] of muscleOptions) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "muscle-chip";
      chip.textContent = label;
      if (displayedMuscles.includes(muscleKey)) {
        chip.classList.add("is-active");
      }
      chip.addEventListener("click", () => {
        exercise.muscles = toggleDisplayedMuscle(displayedMuscles, muscleKey);
        render();
      });
      muscleGroup.append(chip);
    }

    elements.exerciseList.append(card);
  });
}

function reorderExercises(sourceId, targetId) {
  if (!sourceId || !targetId || sourceId === targetId) return;
  const current = [...state.draft.exercises];
  const sourceIndex = current.findIndex((exercise) => exercise.id === sourceId);
  const targetIndex = current.findIndex((exercise) => exercise.id === targetId);
  if (sourceIndex === -1 || targetIndex === -1) return;

  const [moved] = current.splice(sourceIndex, 1);
  current.splice(targetIndex, 0, moved);
  state.draft.exercises = current;
  clearDropTargets();
  render();
}

function clearDropTargets() {
  document.querySelectorAll(".exercise-card.is-drop-target").forEach((node) => {
    node.classList.remove("is-drop-target");
  });
}

async function checkHealth() {
  try {
    const response = await fetch(`${API_BASE}/health`);
    if (!response.ok) {
      throw new Error(`Health check returned ${response.status}`);
    }
    updateStatus("connected", "API connected");
    return true;
  } catch (error) {
    console.error(error);
    updateStatus("error", "Could not reach backend. Start the API on port 4000.");
    return false;
  }
}

async function loadPrograms() {
  updateStatus("loading", "Loading routines...");
  try {
    const response = await fetch(`${API_BASE}/programs?userId=${encodeURIComponent(USER_ID)}`);
    if (!response.ok) {
      throw new Error(`Load failed with ${response.status}`);
    }

    const data = await response.json();
    state.programs = Array.isArray(data) ? data.filter((item) => !item.deletedAt) : [];

    if (state.selectedProgramId) {
      const selected = state.programs.find((program) => program._id === state.selectedProgramId);
      if (selected) {
        loadDraftFromProgram(selected);
      } else {
        state.selectedProgramId = null;
        state.draft = createEmptyRoutine(createId);
        state.lastSavedSnapshot = createRoutineSnapshot(state.draft.name, state.draft.exercises);
      }
    } else if (state.programs.length > 0) {
      loadDraftFromProgram(state.programs[0]);
    } else {
      state.draft = createEmptyRoutine(createId);
      state.lastSavedSnapshot = createRoutineSnapshot(state.draft.name, state.draft.exercises);
    }

    updateStatus("connected", `${state.programs.length} routine${state.programs.length === 1 ? "" : "s"} loaded`);
    render();
  } catch (error) {
    console.error(error);
    updateStatus("error", "Failed to load routines");
    render();
  }
}

async function saveCurrentRoutine() {
  const validationError = validateRoutineDraft(state.draft.name, state.draft.exercises);
  if (validationError) {
    alert(validationError);
    return;
  }

  const existing = state.programs.find((program) => program._id === state.selectedProgramId);
  const sanitizedDraft = buildRoutineDraft(state.draft.name, state.draft.exercises, createId);
  const payload = {
    _id: existing?._id || createId(),
    userId: USER_ID,
    name: sanitizedDraft.name,
    exercises: sanitizedDraft.exercises,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: Date.now(),
    deletedAt: null,
  };

  updateStatus("loading", "Saving routine...");
  try {
    const response = await fetch(`${API_BASE}/programs`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Save failed with ${response.status}`);
    }

    const saved = await response.json();
    const existingIndex = state.programs.findIndex((program) => program._id === saved._id);
    if (existingIndex === -1) {
      state.programs.unshift(saved);
    } else {
      state.programs[existingIndex] = saved;
    }
    state.selectedProgramId = saved._id;
    loadDraftFromProgram(saved);
    updateStatus("connected", "Routine saved");
    render();
  } catch (error) {
    console.error(error);
    updateStatus("error", "Save failed");
    renderStatusChrome();
    alert("The routine could not be saved. Check that the backend is running and the database is reachable.");
  }
}

async function deleteCurrentRoutine() {
  if (!state.selectedProgramId) return;
  const current = state.programs.find((program) => program._id === state.selectedProgramId);
  if (!current) return;

  const confirmed = window.confirm(`Delete "${current.name}" and sync that deletion to mobile?`);
  if (!confirmed) return;

  updateStatus("loading", "Deleting routine...");
  try {
    const response = await fetch(`${API_BASE}/programs/${encodeURIComponent(current._id)}?userId=${encodeURIComponent(USER_ID)}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error(`Delete failed with ${response.status}`);
    }

    state.programs = state.programs.filter((program) => program._id !== current._id);
    state.selectedProgramId = null;
    state.draft = createEmptyRoutine(createId);
    state.lastSavedSnapshot = createRoutineSnapshot(state.draft.name, state.draft.exercises);
    updateStatus("connected", "Routine deleted");
    render();
  } catch (error) {
    console.error(error);
    updateStatus("error", "Delete failed");
    alert("The routine could not be deleted.");
  }
}

function duplicateCurrentRoutine() {
  if (!state.draft.name.trim() && state.draft.exercises.length === 0) return;
  if (!confirmDiscardIfNeeded()) return;

  state.selectedProgramId = null;
  state.draft = {
    name: `${state.draft.name.trim() || "Untitled routine"} Copy`,
    exercises: copyExercises(state.draft.exercises, createId),
  };
  render();
}

function confirmDiscardIfNeeded() {
  if (!isDraftDirty()) return true;
  return window.confirm("Discard the current unsaved changes?");
}

function loadDraftFromProgram(program) {
  state.selectedProgramId = program._id;
  state.draft = buildRoutineDraft(program.name, program.exercises, createId);
  state.lastSavedSnapshot = createRoutineSnapshot(state.draft.name, state.draft.exercises);
}

function isDraftDirty() {
  return createRoutineSnapshot(state.draft.name, state.draft.exercises) !== state.lastSavedSnapshot;
}

function updateStatus(nextState, message) {
  state.connectionState = nextState;
  elements.statusText.textContent = message;
  renderStatusChrome();
}

function loadMuscleMode() {
  const stored = window.localStorage.getItem(MUSCLE_MODE_STORAGE_KEY);
  return stored === "detailed" ? "detailed" : "primary";
}

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `routine-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeUpdatedAt(program) {
  const numeric = Number(program?.updatedAt);
  return Number.isFinite(numeric) ? numeric : Date.now();
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
