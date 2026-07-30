import { workspaceSeed } from "../../shared/data/seed"
import { cloneValue } from "../../shared/utils/clone"

export function createInitialWorkspaceDocument() {
  return cloneValue(workspaceSeed)
}
