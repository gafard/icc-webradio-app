'use client';

import { supabase } from '../lib/supabase';
import type { SpiritualTemplate, TemplateType } from '../types/spiritual';

type TemplateRow = {
  id: string;
  type: TemplateType;
  title: string;
  description: string;
  days?: number | null;
  schedule_mode?: 'auto' | 'calendar' | null;
  plan_key?: string | null;
  schedule?: string[][] | null;
  duration?: number | null;
  task_list?: string[] | null;
  category?: string | null;
  difficulty?: 'facile' | 'moyen' | 'difficile' | null;
  frequency?: 'quotidien' | 'hebdo' | null;
  visibility: 'private' | 'public' | 'official';
  created_at?: string | null;
  updated_at?: string | null;
  created_by?: string | null;
};

const rowToTemplate = (row: TemplateRow): SpiritualTemplate => ({
  id: row.id,
  type: row.type,
  title: row.title,
  description: row.description,
  days: row.days ?? undefined,
  scheduleMode: row.schedule_mode ?? undefined,
  planKey: row.plan_key ?? undefined,
  schedule: row.schedule ?? undefined,
  duration: row.duration ?? undefined,
  taskList: row.task_list ?? undefined,
  category: row.category ?? undefined,
  difficulty: row.difficulty ?? undefined,
  frequency: row.frequency ?? undefined,
  visibility: row.visibility,
  createdAt: row.created_at ?? new Date().toISOString(),
  updatedAt: row.updated_at ?? undefined,
  createdBy: row.created_by ?? undefined,
});

const templateToRow = (template: SpiritualTemplate): TemplateRow => ({
  id: template.id,
  type: template.type,
  title: template.title,
  description: template.description,
  days: template.days ?? null,
  schedule_mode: template.scheduleMode ?? null,
  plan_key: template.planKey ?? null,
  schedule: template.schedule ?? null,
  duration: template.duration ?? null,
  task_list: template.taskList ?? null,
  category: template.category ?? null,
  difficulty: template.difficulty ?? null,
  frequency: template.frequency ?? null,
  visibility: template.visibility,
  created_at: template.createdAt,
  updated_at: template.updatedAt ?? null,
  created_by: template.createdBy ?? null,
});

export async function fetchCommunityTemplates(types: TemplateType[] = ['plan', 'challenge']) {
  if (!supabase) return [] as SpiritualTemplate[];
  const { data } = await supabase
    .from('spiritual_templates')
    .select('*')
    .in('type', types)
    .in('visibility', ['public', 'official'])
    .order('created_at', { ascending: false });
  if (!data) return [];
  return (data as TemplateRow[]).map(rowToTemplate);
}

export async function publishTemplate(template: SpiritualTemplate) {
  if (!supabase) return null;
  const payload = templateToRow(template);
  const { data } = await supabase.from('spiritual_templates').insert(payload).select('*').maybeSingle();
  if (!data) return null;
  return rowToTemplate(data as TemplateRow);
}

export async function fetchTemplateReports(ids: string[]) {
  if (!supabase || ids.length === 0) return {} as Record<string, number>;
  const { data } = await supabase
    .from('spiritual_reports')
    .select('target_id')
    .in('target_id', ids);
  if (!data) return {} as Record<string, number>;
  const counts: Record<string, number> = {};
  for (const row of data as Array<{ target_id: string }>) {
    counts[row.target_id] = (counts[row.target_id] || 0) + 1;
  }
  return counts;
}

export async function reportTemplate(targetId: string, targetType: TemplateType, reason: string, createdBy?: string) {
  if (!supabase) return;
  await supabase.from('spiritual_reports').insert({
    id: `report_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    target_id: targetId,
    target_type: targetType,
    reason,
    created_by: createdBy ?? null,
    created_at: new Date().toISOString(),
  });
}
