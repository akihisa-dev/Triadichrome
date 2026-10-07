import { TRIADIC_FILE_EXTENSION, TRIADIC_MIME_TYPE } from "../core/storage/triadicSchema";
export const fileTypes = [{ description: "Triadichrome計画", accept: { [TRIADIC_MIME_TYPE]: [TRIADIC_FILE_EXTENSION] } }];
export type PickerWindow = Window & {
  showOpenFilePicker?: (options: { multiple: boolean; mode: "readwrite"; types: typeof fileTypes }) => Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?: (options: { suggestedName: string; types: typeof fileTypes }) => Promise<FileSystemFileHandle>;
};
export function choosePlanDestination(name: string): Promise<FileSystemFileHandle> {
  const picker = (window as PickerWindow).showSaveFilePicker;
  if (!picker) throw new Error("この環境では保存できません。ファイルを保存できるChromeで開いてください。");
  return picker.call(window, { suggestedName: name, types: fileTypes });
}
