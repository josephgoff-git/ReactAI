import { create } from "zustand";

export const useHasFilesStore = create((set) => ({
  hasFiles: false,
  setHasFiles: (newHasFiles) => set({ hasFiles: newHasFiles }),
}));

export const useShowEditorStore = create((set) => ({
  showEditor: false,
  setShowEditor: (newShowEditor) => set({ showEditor: newShowEditor }),
}));

export const useShowGPTStore = create((set) => ({
  showGPT: false,
  setShowGPT: (newShowGPT) => set({ showGPT: newShowGPT }),
}));

export const useShowUploadStore = create((set) => ({
  showUpload: true,
  setShowUpload: (newShowUpload) => set({ showUpload: newShowUpload }),
}));

export const useFirstBuildStore = create((set) => ({
  firstBuild: true,
  setFirstBuild: (newFirstBuild) => set({ firstBuild: newFirstBuild }),
}));


