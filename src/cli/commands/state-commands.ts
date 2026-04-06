import { registerStateCommands } from './state/register.js'

// state 域命令较多，单独 re-export 可以避免顶层入口直接感知子目录结构。
export { registerStateCommands }
