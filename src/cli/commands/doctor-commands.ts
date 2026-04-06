import { registerDoctorCommands } from './doctor/register.js'

// doctor 作为诊断域保留独立出口，方便 CLI 与测试统一接入。
export { registerDoctorCommands }
