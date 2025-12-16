import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Community } from '../types';

export const useCommunities = () => {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCommunities = async () => {
    try {
      const { data, error } = await supabase
        .from('communities')
        .select('*, organization:organizations(name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCommunities(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const addCommunity = async (communityData: Omit<Community, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('communities')
        .insert([communityData])
        .select()
        .single();

      if (error) throw error;
      setCommunities(prev => [data, ...prev]);
      return { data, error: null };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err.message : 'Failed to add community' };
    }
  };

  const updateCommunity = async (id: string, updates: Partial<Community>) => {
    try {
      const { data, error } = await supabase
        .from('communities')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setCommunities(prev => prev.map(item => item.id === id ? data : item));
      return { data, error: null };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err.message : 'Failed to update community' };
    }
  };

  const deleteCommunity = async (id: string) => {
    try {
      const { error } = await supabase
        .from('communities')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setCommunities(prev => prev.filter(item => item.id !== id));
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to delete community' };
    }
  };

  const generateAccessCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  useEffect(() => {
    fetchCommunities();
  }, []);

  return {
    communities,
    loading,
    error,
    addCommunity,
    updateCommunity,
    deleteCommunity,
    generateAccessCode,
    refetch: fetchCommunities,
  };
};