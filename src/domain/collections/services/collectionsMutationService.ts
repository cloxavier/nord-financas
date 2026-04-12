import { supabase } from '@/src/lib/supabase';

export async function completeCollectionTask(taskId: string) {
  const { error } = await supabase.rpc('update_collection_task_status', {
    p_task_id: taskId,
    p_new_status: 'completed',
  });

  if (error) {
    throw error;
  }
}

export async function dismissCollectionTask(taskId: string) {
  const { error } = await supabase.rpc('update_collection_task_status', {
    p_task_id: taskId,
    p_new_status: 'dismissed',
  });

  if (error) {
    throw error;
  }
}