import { registerSnapshotCommands } from './snapshot/register.js'

// snapshot 域只读且相对独立，用单独 barrel 输出便于后续扩展。
export { registerSnapshotCommands }
