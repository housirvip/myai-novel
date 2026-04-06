import { registerWorkflowCommands } from './workflow/register.js'

// 保留独立导出入口，便于顶层 CLI 装配时按命令域懒引用。
export { registerWorkflowCommands }
