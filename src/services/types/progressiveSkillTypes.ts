export interface Skill {
  id: string;
  name: string;
  description: string;
  content: string;
  tokenCount: number;
  keywords: string[];
  category: SkillCategory;
  priority: number;
  dependencies: string[];
  alwaysLoad: boolean;
  lastUsed?: string;
  useCount: number;
}

export type SkillCategory =
  | 'core'
  | 'data'
  | 'communication'
  | 'analysis'
  | 'automation'
  | 'integration'
  | 'creative'
  | 'security'
  | 'custom';

export interface SkillLoadResult {
  loaded: Skill[];
  skipped: Skill[];
  totalTokens: number;
  remainingBudget: number;
  strategy: 'exact' | 'semantic' | 'priority' | 'dependency';
}

export interface SkillMatchScore {
  skill: Skill;
  score: number;
  matchedKeywords: string[];
  matchReason: string;
}

export interface SkillLoadOptions {
  tokenBudget?: number;
  forceInclude?: string[];
  exclude?: string[];
  categories?: SkillCategory[];
  minScore?: number;
  maxSkills?: number;
}
