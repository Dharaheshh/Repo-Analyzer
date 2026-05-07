// Backward-compatible export for any older imports. New code should use
// aiProviderService directly so provider health and failover stay centralized.
export { analyzeRepo } from './aiProviderService.js';
