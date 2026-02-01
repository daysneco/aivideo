import { LucideIcon, Dog, Banknote, PiggyBank, Egg, Lightbulb, GraduationCap } from 'lucide-react';

export interface ScriptItem {
  id: string;
  text: string;
  subtext?: string;
  durationInFrames: number;
  icon: LucideIcon;
  color: string;
}

export const script: ScriptItem[] = [
  {
    id: 'intro',
    text: '小狗钱钱',
    subtext: 'A Dog Named Money',
    durationInFrames: 150,
    icon: Dog,
    color: '#fbbf24', // Gold
  },
  {
    id: 'story-start',
    text: '吉娅与钱钱的相遇',
    subtext: '一只会说话的理财高手',
    durationInFrames: 240,
    icon: Banknote,
    color: '#3b82f6', // Blue
  },
  {
    id: 'lesson-1',
    text: '第一课：梦想清单',
    subtext: '写下愿望，每天为它存钱',
    durationInFrames: 300,
    icon: PiggyBank,
    color: '#ec4899', // Pink
  },
  {
    id: 'lesson-2',
    text: '第二课：养鹅理论',
    subtext: '本金是鹅，利息是蛋',
    durationInFrames: 300,
    icon: Egg,
    color: '#fbbf24', // Gold
  },
  {
    id: 'lesson-3',
    text: '学会记成功日记',
    subtext: '建立自信，从每一件小事开始',
    durationInFrames: 240,
    icon: GraduationCap,
    color: '#10b981', // Emerald
  },
  {
    id: 'outro',
    text: '通往财务自由之路',
    subtext: '从今天开始行动！',
    durationInFrames: 270,
    icon: Lightbulb,
    color: '#8b5cf6', // Violet
  },
];
