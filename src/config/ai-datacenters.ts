import type { AIDataCenter } from '@/types';
import aiDataCenters from './data/ai-datacenters.json';

// Data from Epoch AI GPU Clusters dataset
// https://epoch.ai/data/gpu-clusters
// Licensed under Creative Commons Attribution
// Filtered for clusters with >1000 GPUs, Existing/Planned status, Confirmed/Likely certainty
export const AI_DATA_CENTERS = aiDataCenters as AIDataCenter[];
