import { SupabaseClient } from '@supabase/supabase-js';
import { supabaseCodeInsights } from '../config/supabaseClient';

export interface MetadataEntry {
  id?: string;
  repositoryId: string;
  filePath: string;
  fileType: string;
  size: number;
  lastModified: Date;
  dependencies: string[];
  exports: string[];
  imports: string[];
  functions: string[];
  classes: string[];
  variables: string[];
  complexity: number;
  linesOfCode: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export const createMetadata = async (data: MetadataEntry) => {
  try {
    const { data: result, error } = await supabaseCodeInsights
      .from('file_metadata')
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return result;
  } catch (error) {
    console.error('Error creating metadata:', error);
    throw error;
  }
};

export const getMetadataByRepository = async (repositoryId: string) => {
  try {
    const { data, error } = await supabaseCodeInsights
      .from('file_metadata')
      .select('*')
      .eq('repositoryId', repositoryId);

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching metadata:', error);
    throw error;
  }
};

export const getMetadataByFile = async (repositoryId: string, filePath: string) => {
  try {
    const { data, error } = await supabaseCodeInsights
      .from('file_metadata')
      .select('*')
      .eq('repositoryId', repositoryId)
      .eq('filePath', filePath)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching file metadata:', error);
    throw error;
  }
};

export const updateMetadata = async (id: string, updates: Partial<MetadataEntry>) => {
  try {
    const { data, error } = await supabaseCodeInsights
      .from('file_metadata')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating metadata:', error);
    throw error;
  }
};

export const deleteMetadata = async (id: string) => {
  try {
    const { error } = await supabaseCodeInsights
      .from('file_metadata')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting metadata:', error);
    throw error;
  }
};
