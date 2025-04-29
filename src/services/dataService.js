import { supabase } from '../supabaseClient';

export const getRoomTypes = async () => {
  try {
    const { data, error } = await supabase
      .from('room')
      .select('room_type')
      .order('room_type', { ascending: true });

    if (error) throw error;
    
    // Remove duplicates and set room types
    const uniqueRoomTypes = [...new Set(data.map(room => room.room_type))];
    return uniqueRoomTypes;
  } catch (error) {
    console.error('Error fetching room types:', error);
    return [];
  }
}; 