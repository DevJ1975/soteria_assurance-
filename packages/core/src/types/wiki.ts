import type { Timestamp } from './common';
import type { StandardId } from '../standards/types';

export type WikiCategory =
  /** Clause-by-clause guidance for the article's standard. */
  | 'clause_guide'
  /** How to audit effectively. */
  | 'audit_technique'
  /** How to write findings. */
  | 'finding_guidance'
  /** Legislation references for the article's discipline. */
  | 'legal_reference'
  /** Industry best practices. */
  | 'best_practice'
  /** How to use templates. */
  | 'template_guide'
  /** Platform how-to articles. */
  | 'platform_help'
  /** ISO/audit terminology. */
  | 'glossary';

/**
 * A wiki article. A `null`/absent `tenantId` denotes a global article.
 */
export interface WikiArticle {
  id: string;
  /** Absent = global wiki article. */
  tenantId?: string;

  // Classification
  category: WikiCategory;
  /**
   * The standard this article is guidance for. Required because clause
   * references and legal/discipline content differ per standard.
   */
  standardId: StandardId;
  /** e.g. "6.1.2". Resolved within `standardId`. */
  clauseReference?: string;
  tags: string[];

  // Content
  title: string;
  summary: string;
  /** Markdown content. */
  content: string;

  // Metadata
  author: string;
  version: string;
  lastReviewDate: string;

  // Related
  relatedArticleIds: string[];
  relatedClauseNumbers: string[];

  // Access
  isPublished: boolean;
  isFeatured: boolean;

  viewCount: number;
  helpfulVotes: number;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
