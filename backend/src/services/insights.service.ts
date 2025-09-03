import { SupabaseClient } from '@supabase/supabase-js';
import { supabaseCodeInsights } from '../config/supabaseClient';

export interface InsightData {
  id?: string;
  repositoryId: string;
  filePath: string;
  insights: any;
  metadata: any;
  createdAt?: Date;
  updatedAt?: Date;
}

export const createInsight = async (data: InsightData) => {
  try {
    const { data: result, error } = await supabaseCodeInsights
      .from('insights')
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return result;
  } catch (error) {
    console.error('Error creating insight:', error);
    throw error;
  }
};

export const getInsightsByRepository = async (repositoryId: string) => {
  try {
    const { data, error } = await supabaseCodeInsights
      .from('insights')
      .select('*')
      .eq('repositoryId', repositoryId);

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching insights:', error);
    throw error;
  }
};

export const updateInsight = async (id: string, updates: Partial<InsightData>) => {
  try {
    const { data, error } = await supabaseCodeInsights
      .from('insights')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating insight:', error);
    throw error;
  }
};

export const deleteInsight = async (id: string) => {
  try {
    const { error } = await supabaseCodeInsights
      .from('insights')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting insight:', error);
    throw error;
  }
};
