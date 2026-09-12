import type { StandardDefinition } from '../types';
import { ISO45001_CLAUSES } from './clauses';

export { ISO45001_CLAUSES };

/**
 * ISO 45001:2018 — Occupational health and safety management systems.
 *
 * The platform's founding standard and, today, the only fully authored one.
 */
export const ISO45001: StandardDefinition = {
  id: 'iso45001',
  name: 'ISO 45001:2018',
  shortName: 'ISO 45001',
  edition: '2018',
  discipline: 'Occupational Health & Safety',
  isAvailable: true,
  clauses: ISO45001_CLAUSES,
  topLevelNumbers: ['4', '5', '6', '7', '8', '9', '10'],
  prompt: {
    personaName: 'ARIA',
    expertiseLines: [
      'Deep knowledge of ISO 45001:2018 text, intent, and application',
      'ISO 19011:2018 audit methodology and best practices',
      'OHSAS 18001 transition requirements',
      'Occupational health & safety hazard identification and risk control',
      'Worker consultation and participation requirements',
    ],
    relatedStandards: ['ISO 19011:2018', 'OHSAS 18001'],
    riskMethodologies: ['HIRA', 'Bowtie', 'FMEA', 'Job Safety Analysis'],
  },
};
